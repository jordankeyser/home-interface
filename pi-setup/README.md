# Raspberry Pi Kiosk Setup

Everything needed to run Home Interface as a wall-mounted kiosk.

> Consolidated from the former `README.md` + `SETUP-SUMMARY.md` +
> `QUICK-REFERENCE.md`, which had drifted out of sync with each other and with
> the code.

## Requirements

- Raspberry Pi 3, 4 or 5
- Raspberry Pi OS (Bookworm or later, with desktop)
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
| Packages | Chromium, `unclutter`, `x11-xserver-utils`, `xserver-xorg`, `xinit`, git, curl |
| Node.js | Installs 20.x if missing or older |
| Build | `npm install && npm run build` |
| Backlight | udev rule granting the `video` group write access to `brightness`, and adds you to `video` |
| Power | `/etc/sudoers.d/home-interface` — NOPASSWD for `shutdown`, `reboot`, and restarting the two units |
| Services | Installs and enables `home-interface-server` and `home-interface-kiosk` |
| Updates | Cron entry at 3:30 AM running `daily-update.sh` |
| Boot | Desktop autologin via `raspi-config`, quiet boot via `cmdline.txt` |
| Cleanup | Moves aside a legacy `~/.xinitrc` that would double-launch the kiosk |

## Services

Two units, in dependency order:

**`home-interface-server.service`** — the Node control server. Serves the built
app from `dist/`, proxies the CTA API, and controls the backlight and host power.
Listens on `127.0.0.1:3001` only. Runs at `multi-user.target`, so display control
works even before X is up.

**`home-interface-kiosk.service`** — Chromium in kiosk mode. Waits for the
server's `/healthz` to answer before launching, and restarts on crash.

```bash
systemctl status home-interface-server
systemctl status home-interface-kiosk

sudo systemctl restart home-interface-server
sudo systemctl restart home-interface-kiosk

journalctl -u home-interface-server -f
journalctl -u home-interface-kiosk -f
```

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
dependencies, rebuilds, and restarts both services. If the build fails it rolls
back to the previous commit so the panel keeps working.

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

Plug in a keyboard and press `Alt+F4`, or from SSH:

```bash
sudo systemctl stop home-interface-kiosk
```

## Troubleshooting

**Black screen after boot.** Check the server first, then the kiosk:

```bash
journalctl -u home-interface-server -n 50
journalctl -u home-interface-kiosk -n 50
```

The kiosk script waits up to 90 seconds for `/healthz` and exits with an
explicit error rather than hanging.

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
sudo systemctl disable --now home-interface-kiosk home-interface-server
sudo rm /etc/systemd/system/home-interface-{kiosk,server}.service
sudo rm -f /etc/sudoers.d/home-interface /etc/udev/rules.d/90-backlight.rules
sudo systemctl daemon-reload
crontab -l | grep -v daily-update.sh | crontab -
```

## Files

| File | Purpose |
| --- | --- |
| `install.sh` | One-time setup |
| `kiosk-start.sh` | Waits for the server, then launches Chromium |
| `daily-update.sh` | Nightly pull, rebuild, restart, rollback on failure |
| `home-interface-server.service` | Control server unit (`__USER__`/`__APP_DIR__` templated) |
| `home-interface-kiosk.service` | Chromium unit (`__USER__`/`__APP_DIR__` templated) |
