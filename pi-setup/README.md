# Raspberry Pi kiosk setup

These scripts target the deployed hardware: Raspberry Pi OS Trixie, labwc on
Wayland, Chromium, and the official 1024×600 DSI touchscreen.

## Repair an existing broken installation

Older installers registered the kiosk in up to three places at once:

1. a system-level `home-interface-kiosk.service`;
2. `~/.xinitrc`;
3. labwc autostart.

Those launchers race for Chromium and port 5173. A git rollback cannot remove
the stale files outside the repository.

After updating this repository on the Pi, run the one-time repair as the normal
desktop user:

```bash
cd /home/jordankeyser/Desktop/home-interface
```

```bash
./pi-setup/repair-wayland-kiosk.sh
```

The repair backs up the existing launch configuration under
`~/.local/state/home-interface/repair-backup-*`, disables the stale system
unit, removes duplicate session entries, preserves the real-touch setting, and
installs one labwc autostart entry.

Then reboot:

```bash
sudo reboot
```

## Fresh installation

Run this as the normal desktop user, not with `sudo`:

```bash
./pi-setup/install.sh
```

The installer:

- installs Chromium and required utilities;
- installs a Vite-compatible Node.js if necessary;
- installs dependencies and requires lint/build to pass;
- runs the single-owner labwc repair;
- schedules validated updates at 3:30 AM.

It does not install a Chromium systemd service.

## What boot should do

The supported sequence is:

```text
Raspberry Pi desktop
  -> labwc autostart
  -> pi-setup/kiosk-start.sh
  -> validated production bundle on 127.0.0.1:5173
  -> verified Home Interface HTML
  -> Chromium kiosk
```

Internet access is not a boot dependency. Weather and CTA may show their normal
error states while offline, but the local interface and Home Assistant page
still load.

## AiDot lights on a routed Wi-Fi subnet

Home Assistant's built-in AiDot integration discovers bulbs with a UDP
broadcast. A bulb on another routed subnet can be directly reachable while
remaining unavailable in Home Assistant because broadcasts do not cross the
subnet boundary.

`homeassistant/aidot-coordinator.py` is a narrow override of Home Assistant's
AiDot coordinator. It keeps broadcast discovery as the first choice, then uses
the private local address reported by AiDot Cloud when no broadcast address is
available. Public addresses are rejected. It also puts time limits around
local connection and login attempts, retries failed sessions after 15 seconds,
and refreshes device addresses every five minutes. This prevents one stalled
socket from leaving a reachable light permanently unavailable. The override is
mounted read-only over the built-in coordinator from
`~/homeassistant/compose.yml`, so it survives container recreation without
modifying the image.

Before updating Home Assistant, compare the override with the new built-in
coordinator. Remove the compose mount to return to the unmodified integration.

## Wi-Fi recovery from the touchscreen

Open the dashboard's gear menu and scroll to **Network**. The panel can scan for
nearby access points or accept a network name manually, including hidden
networks. Selecting **Connect** updates NetworkManager and enables automatic
reconnection at boot. The endpoint exists only in kiosk mode and accepts only
loopback requests from the panel itself.

The password is sent to `nmcli --ask` over stdin. It is not stored by the React
app, printed in process arguments, or written to the kiosk logs. NetworkManager
owns the resulting system connection profile.

## Diagnostics

Run:

```bash
./pi-setup/diagnose-kiosk.sh
```

A healthy result has:

- one `kiosk-start.sh` launch entry, in `~/.config/labwc/autostart`;
- no enabled `home-interface-kiosk.service`;
- one UI listener on `127.0.0.1:5173`;
- an HTML response containing `<title>Home Interface</title>`;
- `mouseEmulation="no"` in the labwc touch configuration.

Logs are outside the repository so nightly updates cannot delete them:

```bash
tail -80 ~/.local/state/home-interface/kiosk.log
```

```bash
tail -80 ~/.local/state/home-interface/vite.log
```

If Vite fails, the panel displays `pi-setup/boot-error.html` and retries.
If React fails during startup, the in-app error boundary displays a dark error
screen. Neither failure path should produce a blank white panel.

## Touchscreen

The official DSI panel must remain configured for real touch events:

```bash
grep mouseEmulation ~/.config/labwc/rc.xml
```

Expected output contains:

```text
mouseEmulation="no"
```

With `yes`, labwc turns touches into mouse drags and Chromium cannot perform
native swipe or momentum scrolling.

## Optional display control

Backlight sleep and the shutdown button use a separate, loopback-only service.
Install it independently:

```bash
./pi-setup/install-display-server.sh
```

Its failure does not prevent the dashboard from booting. Check it with:

```bash
curl -s http://127.0.0.1:3001/healthz
```

## Updates

`pi-setup/daily-update.sh` fast-forwards `main`, installs dependency changes,
runs lint and a production build, rolls back a failed validation, and reboots
after a successful update. The cold restart prevents Vite HMR from mixing
modules from different revisions on an unattended panel.
