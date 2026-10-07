"""Coordinator for AiDot with routed-device discovery and recovery.

Home Assistant's upstream AiDot integration discovers bulbs with a UDP
broadcast. Broadcasts do not cross routed subnets, even when the devices are
directly reachable. This copy preserves the upstream behavior and uses the
private IP reported by AiDot Cloud only when broadcast discovery has not
already supplied an address. It also bounds connection attempts and schedules
clean retries so one stalled bulb cannot remain unavailable forever.
"""

import asyncio
from datetime import timedelta
from ipaddress import ip_address
import logging
import socket
from typing import Any, override

from aidot.client import AidotClient
from aidot.const import (
    CONF_ACCESS_TOKEN,
    CONF_AES_KEY,
    CONF_DEVICE_LIST,
    CONF_ID,
    CONF_TYPE,
)
from aidot.device_client import DeviceClient, DeviceStatusData
from aidot.exceptions import AidotAuthFailed, AidotUserOrPassIncorrect

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import DOMAIN

type AidotConfigEntry = ConfigEntry[AidotDeviceManagerCoordinator]
_LOGGER = logging.getLogger(__name__)

UPDATE_DEVICE_LIST_INTERVAL = timedelta(minutes=5)
CONNECT_TIMEOUT_SECONDS = 5
LOGIN_TIMEOUT_SECONDS = 8
RECONNECT_DELAY_SECONDS = 15
CLOSE_TIMEOUT_SECONDS = 1


async def _close_transport(self: DeviceClient) -> None:
    """Close a failed transport without letting cleanup stall recovery."""
    writer = self.writer
    self.reader = self.writer = None
    if writer is None:
        return
    writer.close()
    try:
        await asyncio.wait_for(writer.wait_closed(), timeout=CLOSE_TIMEOUT_SECONDS)
    except (TimeoutError, OSError):
        pass


async def _reliable_connect(self: DeviceClient, ip_address: str) -> None:
    """Connect with time limits and leave every failure retryable."""
    self.reader = self.writer = None
    self._connecting = True
    self._ip_address = ip_address
    try:
        self.reader, self.writer = await asyncio.wait_for(
            asyncio.open_connection(ip_address, 10000),
            timeout=CONNECT_TIMEOUT_SECONDS,
        )
        sock: socket.socket = self.writer.get_extra_info("socket")
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        self.seq_num = 1
        await asyncio.wait_for(self.login(), timeout=LOGIN_TIMEOUT_SECONDS)
        if not self.status.online:
            raise ConnectionError("AiDot login did not complete")
        self._connect_and_login = True
    except asyncio.CancelledError:
        self._connect_and_login = False
        self.status.online = False
        self._notify_status_update()
        await _close_transport(self)
        raise
    except Exception as error:
        self._connect_and_login = False
        self.status.online = False
        self._notify_status_update()
        await _close_transport(self)
        _LOGGER.warning(
            "AiDot device %s connection failed (%s); retry scheduled",
            self.device_id,
            type(error).__name__,
        )
        self._schedule_reconnect()
    finally:
        self._connecting = False


def _reliable_schedule_reconnect(self: DeviceClient) -> None:
    """Schedule one bounded reconnect instead of allowing a stuck task."""
    if self._is_close or self._reconnect_handle is not None:
        return

    def _retry() -> None:
        self._reconnect_handle = None
        if not self._is_close:
            self._login_task = asyncio.create_task(self.async_login())

    self._reconnect_handle = asyncio.get_running_loop().call_later(
        RECONNECT_DELAY_SECONDS,
        _retry,
    )


# python-aidot 0.3.56 can wait forever for a login response. Once that happens,
# its `_connecting` flag prevents every later discovery response from retrying.
# Patch the two narrow lifecycle methods until the upstream library gains
# bounded connection handling.
DeviceClient.connect = _reliable_connect
DeviceClient._schedule_reconnect = _reliable_schedule_reconnect


def _cloud_reported_private_ip(device: dict[str, Any]) -> str | None:
    """Return a safe routed fallback address reported by the device."""
    properties = device.get("properties")
    if not isinstance(properties, dict):
        return None

    raw_address = properties.get("ipAddress")
    if not isinstance(raw_address, str):
        return None

    try:
        address = ip_address(raw_address)
    except ValueError:
        return None

    if not (address.is_private or address.is_link_local):
        return None
    return str(address)


class AidotDeviceUpdateCoordinator(DataUpdateCoordinator[DeviceStatusData]):
    """Class to manage AiDot data."""

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: AidotConfigEntry,
        device_client: DeviceClient,
    ) -> None:
        """Initialize coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            config_entry=config_entry,
            name=DOMAIN,
            update_interval=None,
        )
        self.device_client = device_client

    @override
    async def _async_setup(self) -> None:
        """Set up the coordinator."""
        self.device_client.on_status_update = self._handle_status_update

    def _handle_status_update(self, status: DeviceStatusData) -> None:
        """Handle status callback."""
        self.async_set_updated_data(status)

    @override
    async def _async_update_data(self) -> DeviceStatusData:
        """Return current status."""
        return self.device_client.status


class AidotDeviceManagerCoordinator(DataUpdateCoordinator[None]):
    """Class to manage fetching AiDot data."""

    config_entry: AidotConfigEntry

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: AidotConfigEntry,
    ) -> None:
        """Initialize coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            config_entry=config_entry,
            name=DOMAIN,
            update_interval=UPDATE_DEVICE_LIST_INTERVAL,
        )
        self.client = AidotClient(
            session=async_get_clientsession(hass),
            token=config_entry.data,
        )
        self.client.set_token_fresh_cb(self.token_fresh_cb)
        self.device_coordinators: dict[str, AidotDeviceUpdateCoordinator] = {}

    @override
    async def _async_setup(self) -> None:
        """Set up the coordinator."""
        try:
            await self.async_auto_login()
        except AidotUserOrPassIncorrect as error:
            raise ConfigEntryError from error

    @override
    async def _async_update_data(self) -> None:
        """Update data async."""
        try:
            data = await self.client.async_get_all_device()
        except AidotAuthFailed as error:
            raise ConfigEntryError from error
        current_devices = {
            device[CONF_ID]: device
            for device in data[CONF_DEVICE_LIST]
            if (
                device[CONF_TYPE] == "light"
                and CONF_AES_KEY in device
                and device[CONF_AES_KEY][0] is not None
            )
        }

        removed_ids = set(self.device_coordinators) - set(current_devices)
        for dev_id in removed_ids:
            coordinator = self.device_coordinators.pop(dev_id)
            coordinator.device_client.on_status_update = None
        if removed_ids:
            self._purge_deleted_lists()

        for dev_id, device in current_devices.items():
            device_client = self.client.get_device_client(device)

            # python-aidot normally learns the address from a UDP broadcast.
            # If no broadcast response was received, connect to the private
            # address the device itself last reported to AiDot Cloud. This
            # supports reachable bulbs on another routed Wi-Fi subnet.
            fallback_ip = _cloud_reported_private_ip(device)
            current_ip = getattr(device_client, "_ip_address", None)
            should_refresh_ip = fallback_ip is not None and (
                current_ip is None or not device_client.connect_and_login
            )
            if should_refresh_ip:
                if current_ip != fallback_ip:
                    _LOGGER.info(
                        "Using cloud-reported local address for AiDot device %s",
                        dev_id,
                    )
                device_client.update_ip_address(fallback_ip)

            if dev_id not in self.device_coordinators:
                device_coordinator = AidotDeviceUpdateCoordinator(
                    self.hass, self.config_entry, device_client
                )
                await device_coordinator.async_config_entry_first_refresh()
                self.device_coordinators[dev_id] = device_coordinator

    async def async_cleanup(self) -> None:
        """Perform cleanup actions."""
        for coordinator in self.device_coordinators.values():
            coordinator.device_client.on_status_update = None
        await self.client.async_cleanup()

    def token_fresh_cb(self) -> None:
        """Update token."""
        self.hass.config_entries.async_update_entry(
            self.config_entry, data=self.client.login_info.copy()
        )

    async def async_auto_login(self) -> None:
        """Async auto login."""
        if self.client.login_info.get(CONF_ACCESS_TOKEN) is None:
            await self.client.async_post_login()

    def _purge_deleted_lists(self) -> None:
        """Purge device entries of deleted lists."""

        device_reg = dr.async_get(self.hass)
        identifiers = {
            (
                DOMAIN,
                device_coordinator.device_client.info.dev_id,
            )
            for device_coordinator in self.device_coordinators.values()
        }
        for device in dr.async_entries_for_config_entry(
            device_reg, self.config_entry.entry_id
        ):
            if not set(device.identifiers) & identifiers:
                _LOGGER.debug("Removing obsolete device entry %s", device.name)
                device_reg.async_remove_device(device.id)
