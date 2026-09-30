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
  -> Vite on 127.0.0.1:5173
  -> verified Home Interface HTML
  -> Chromium kiosk
```

Internet access is not a boot dependency. Weather and CTA may show their normal
error states while offline, but the local interface and Home Assistant page
still load.

## Diagnostics

Run:

```bash
./pi-setup/diagnose-kiosk.sh
```

A healthy result has:

- one `kiosk-start.sh` launch entry, in `~/.config/labwc/autostart`;
- no enabled `home-interface-kiosk.service`;
- one Vite listener on `127.0.0.1:5173`;
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
