# Raspberry Pi Kiosk Setup

Everything needed to run Home Interface as a wall-mounted kiosk.

> Consolidated from the former `README.md` + `SETUP-SUMMARY.md` +
> `QUICK-REFERENCE.md`, which had drifted out of sync with each other and with
> the code.

## Requirements

- Raspberry Pi 3, 4 or 5
- Raspberry Pi OS (Bookworm or later). Lite works — the installer detects that
  there's no desktop and starts X from a tty1 login instead
- A display — the DSI/HDMI touchscreens with a `/sys/class/backlight` entry get
  real brightness control; others fall back to on/off
- Network connection

## Install

```bash
git clone https://github.com/jordankeyser/home-interface.git
cd home-interface
./pi-setup/install.sh
```

Then reboot:

```bash
sudo reboot
```

Run it as your normal login user, not root — it calls `sudo` where needed. The
user and install path are detected from where you cloned the repo; nothing is
hardcoded.

Configure API keys from the gear icon on the panel itself.

## What the installer does

| Step | Detail |
| --- | --- |
| Packages | Chromium, git, curl — plus `xserver-xorg`, `xinit`, `x11-xserver-utils`, `unclutter` on X11 setups |
| Node.js | Installs 20.x if missing or older |
| Build | `npm install && npm run build` |
| Backlight | udev rule granting the `video` group write access to `brightness`, and adds you to `video` |
| Power | `/etc/sudoers.d/home-interface` — NOPASSWD for `shutdown`, `reboot`, and restarting the server unit |
| Service | Installs and enables `home-interface-server`, then verifies it answers |
| Startup | Detects the session type and wires the kiosk into it (see below) |
| Updates | Cron entry at 3:30 AM running `daily-update.sh` |
| Boot | Quiet boot via `cmdline.txt` |
| Cleanup | Removes the obsolete kiosk systemd unit if present |

## How it starts

Two independent pieces.

**The control server** is a systemd unit, `home-interface-server.service`. It
serves the built app from `dist/`, proxies the CTA API, and controls the
backlight and host power. It listens on `127.0.0.1:3001` only and runs at
`multi-user.target`, so display control works even before X is up.

```bash
systemctl status home-interface-server
sudo systemctl restart home-interface-server
journalctl -u home-interface-server -f
```

## Runtime

The UI is served by **Vite's own dev server on :5173** — the configuration this
panel ran on for months before the 1.0 rewrite, and the only one proven on this
hardware. It also can't suffer the stale-build failure that produced a blank
white screen, because there is no `dist/`: modules are transformed on request and
`index.html` is served from source.

The control server on :3001 is **optional**. It provides backlight dimming and
the shutdown/restart buttons. If it doesn't start, the dashboard still comes up
and trains still work, because Vite proxies `/api` straight to the CTA. Nothing
in the UI path depends on it.

`HOME_INTERFACE_MODE=prod` switches to serving the built `dist/` from the control
server (lower memory, faster boot). It falls back to dev mode automatically if
that isn't serving the UI. Use it only once you've confirmed it works on-device.

**The port is not fixed.** The frontend only uses relative URLs, so the server
binds 3001 or the next free port after it (up to 3010), and `kiosk-start.sh`
probes that range for whichever port is actually serving the dashboard. A stale
listener on 3001 therefore can't break the panel — it just moves over. Set
`STRICT_PORT=1` to require the exact port and fail loudly instead.

`/healthz` returns 503 unless there is a real build to serve, so the kiosk never
points Chromium at a server that can only answer 404s. If there is genuinely no
build, the page explains that instead of showing a bare "Not found".

**`kiosk-start.sh` owns the whole stack and is the thing that must not fail.**
It clears any stale listener on port 3001, makes sure the control server is
running — asking systemd first, then starting it directly if systemd hasn't or
can't — launches Chromium whether or not the server came up, and relaunches
Chromium if it ever exits. The panel is designed to appear on boot even when
something else is broken; an earlier version only waited on the systemd unit and
gave up, so one bad unit file meant nothing but the desktop.

**The kiosk** is launched by the graphical session, *not* by systemd. A systemd
unit bound to `graphical.target` cannot reach a user session and never fires at
all on an image with no desktop — which is what broke startup once before. The
installer detects the session type and wires the launcher accordingly:

| Detected | Mechanism |
| --- | --- |
| `xinit` (no desktop / Lite) | tty1 autologin, `startx` in `~/.bash_profile`, `~/.xinitrc` execs `kiosk-start.sh` |
| `labwc` (Bookworm Wayland) | `~/.config/labwc/autostart` |
| `wayfire` | `[autostart]` in `~/.config/wayfire.ini` |
| `lxde` (X11 desktop) | `~/.config/lxsession/LXDE-pi/autostart` |

Force one if the detection guesses wrong:

```bash
LAUNCHER=xinit ./pi-setup/install.sh
```

`kiosk-start.sh` handles both X11 and Wayland — it picks Chromium's
`--ozone-platform` from the session and only calls `xset` under X11. It logs to
`~/.local/state/home-interface/kiosk.log`.

## If the panel is blank

Run the diagnostic and read the top of its output — it reports which launcher is
wired, whether the server is answering, whether `dist/` exists, and the tail of
the kiosk log.

```bash
./pi-setup/diagnose.sh
```

It changes nothing.

## Health check

```bash
curl -s localhost:3001/healthz
```

```json
{
  "ok": true,
  "backlight": "/sys/class/backlight/10-0045/brightness",
  "powerEnabled": true,
  "servingDist": true
}
```

- `backlight: null` — no sysfs backlight found; falls back to `vcgencmd`, then
  `xset dpms`. Both are on/off only, and DPMS can disable touch on some panels.
- `servingDist: false` — the app hasn't been built. Run `npm run build`.

## Updates

`daily-update.sh` runs nightly at 3:30 AM: fetches, fast-forwards, installs
dependencies, rebuilds, restarts the control server, then reboots so Chromium
loads the new build. If the build fails it rolls back to the previous commit so
the panel keeps working, and does not reboot.

Cron has no graphical session, so it cannot reload Chromium in place — hence the
reboot. Set `REBOOT_AFTER_UPDATE=0` to skip it and pick changes up on the next
boot instead.

```bash
./pi-setup/daily-update.sh            # run now
./pi-setup/daily-update.sh --force    # discard local changes first
tail -f logs/update.log
```

A dirty working tree blocks updates by design — the log says which files are
dirty. Use `--force` to discard them.

To push a change from your dev machine:

```bash
git push origin main
```

The Pi picks it up at 3:30 AM, or run the script manually.

## Display behaviour

Sleep dims the **backlight to zero** rather than using DPMS blanking, which
keeps the touch digitiser powered so a tap wakes the panel. X screen blanking and
DPMS are explicitly disabled in `kiosk-start.sh` so they can't fight the app.

The dashboard stays mounted while asleep, so waking is instant with no loading
flash. Data polling pauses while the panel is dark.

Ambient dimming follows a day/night curve: full brightness 7 AM–7 PM, easing
down through the evening, low overnight. Toggle it in Settings.

## Exiting the kiosk

Plug in a keyboard and press `Alt+F4`. From SSH, kill Chromium — the session
launcher started it, so there's no unit to stop:

```bash
pkill -f 'chromium.*home-interface'
```

To stop it coming back on the next boot, remove the launcher hook for your
session (`~/.xinitrc`, `~/.config/labwc/autostart`, etc.).

## Troubleshooting

**Black screen after boot.** Run `./pi-setup/diagnose.sh` first. Then:

```bash
journalctl -u home-interface-server -n 50
tail -30 ~/.local/state/home-interface/kiosk.log
```

If the kiosk log is missing entirely, the session never ran `kiosk-start.sh` —
the launcher is wired to the wrong mechanism. Re-run the installer with an
explicit `LAUNCHER=` (see the table above). If the log shows it timing out
waiting for `/healthz`, the control server is the problem, not the kiosk.

**The panel shows the desktop, and the server keeps restarting.** Something else
is holding port 3001, so the unit crash-loops on `EADDRINUSE`. Nearly always the
pre-1.0 `server/displayServer.js`, which bound the same port and keeps running
even though the file has been deleted:

```bash
sudo ss -ltnp | grep 3001
pkill -f displayServer.js
./pi-setup/install.sh
```

The installer now checks this before installing the unit, and removes whatever
was starting the old server at boot (autostart files, crontab, stray units).

**Brightness doesn't change.** If `/healthz` lists a backlight path, your `video`
group membership hasn't taken effect — log out and back in, or reboot. Verify by
hand:

```bash
ls -l /sys/class/backlight/*/brightness
groups
```

**Shutdown/restart buttons do nothing.** Validate the sudoers drop-in:

```bash
sudo visudo -cf /etc/sudoers.d/home-interface
```

Set `HOME_INTERFACE_ALLOW_POWER=0` in the server unit to disable power control
entirely.

**Touch works but scrolling feels wrong.** The app uses native momentum
scrolling. Make sure `--disable-pinch` is still in `kiosk-start.sh` and that
nothing else is injecting touch emulation.

**Trains error but weather works.** The CTA key or station ID is wrong. Test the
proxy directly:

```bash
curl "localhost:3001/api/1.0/ttarrivals.aspx?key=YOUR_KEY&mapid=40380&outputType=JSON"
```

**Panel is the wrong resolution.** Set it in `/boot/firmware/config.txt`, e.g.
`hdmi_cvt=1024 600 60` with `hdmi_group=2` and `hdmi_mode=87`.

## Uninstall

```bash
sudo systemctl disable --now home-interface-server
sudo rm -f /etc/systemd/system/home-interface-server.service
sudo rm -f /etc/sudoers.d/home-interface /etc/udev/rules.d/90-backlight.rules
sudo systemctl daemon-reload
crontab -l | grep -v daily-update.sh | crontab -
rm -f ~/.xinitrc
```

## Files

| File | Purpose |
| --- | --- |
| `install.sh` | One-time setup |
| `kiosk-start.sh` | Waits for the server, then launches Chromium (X11 or Wayland) |
| `daily-update.sh` | Nightly pull, rebuild, restart, reboot; rolls back on build failure |
| `diagnose.sh` | Read-only state dump for when the panel is blank |
| `home-interface-server.service` | Control server unit (`__USER__`/`__APP_DIR__`/`__NODE__` templated) |
