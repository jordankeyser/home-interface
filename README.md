# Home Interface

A touch dashboard for a wall-mounted Raspberry Pi panel. Shows the time, local
weather, CTA train arrivals, and a market ticker — sized to be read from across
the room and operated with a fingertip.

Built with React 19, Vite 7 and Tailwind CSS v4. Runs on a 1024x600 touchscreen
in Chromium kiosk mode.

## Quick start (development)

Two processes: Vite for the UI, and the control server for the CTA proxy and
backlight endpoints.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run server
```

Open http://127.0.0.1:5173. Vite proxies `/api`, `/display`, `/shutdown`,
`/reboot` and `/healthz` to the control server on port 3001, which is the same
layout the app sees in production — so nothing needs to change between the two.

Running only `npm run dev` works fine; display-control calls just log a warning.

## Production

```bash
npm start
```

That builds to `dist/` and serves it from `server/index.js` on
http://127.0.0.1:3001.

## Architecture

```
index.html
public/
  fonts/           Inter (variable, self-hosted — no network needed at boot)
  icon.svg
server/
  index.js         Static build + CTA proxy + backlight/power control
src/
  App.jsx
  index.css        Design tokens, theme definitions, component classes, keyframes
  components/
    ClockBar.jsx
    ConfirmDialog.jsx
    Layout.jsx     Canvas, ambient background, grid, settings mount
    SettingsModal.jsx
    SleepMode.jsx  Idle sleep, ambient dimming, display context provider
    icons/         Inline SVG icon set
    modules/
      Stocks/StocksModule.jsx
      Train/TrainModule.jsx
      Weather/WeatherModule.jsx
      Weather/WeatherBackdrop.jsx   Ambient weather effects (CSS only)
      Weather/WeatherGlyph.jsx      WMO code -> icon
  config/themes.js Theme registry (ids + labels only)
  context/         Settings and display providers
  hooks/           useSettings, useDisplay, useWeather, useCTA, useOnline
  lib/             fetchJson, displayApi, stockProviders, weatherCodes
pi-setup/          Kiosk install, server unit, update and diagnostic scripts
```

The control server does three jobs in one process, so the Pi runs one service:

1. Serves the production build from `dist/`.
2. Proxies `/api/*` to the CTA Train Tracker, keeping the API key out of a
   cross-origin request.
3. Controls the panel backlight (`/display/*`) and host power
   (`/shutdown`, `/reboot`).

It binds to `127.0.0.1` only and sets no CORS headers — the app is same-origin.

## Theming

Themes are CSS custom properties in `src/index.css` under `[data-theme="..."]`,
applied to `<html>` by `SettingsContext`. Components use semantic Tailwind
utilities (`bg-surface`, `text-fg-muted`, `border-line`) that map to those
variables via `@theme inline`, plus component classes (`.card`, `.icon-btn`,
`.btn`, `.field`).

To add a theme: add a token block in `index.css` and an entry in
`src/config/themes.js`. No component changes.

Two rules worth keeping:

- **No text below `--text-xs` (13px).** This panel is read from 6–10 feet.
- **No tap target below 48px.** Use `.icon-btn` / `.btn`, which enforce it.

## Configuration

Everything is configured from the gear icon on the panel and stored in
`localStorage` — there are no environment variables or config files.

| Setting | Notes |
| --- | --- |
| CTA API key | [transitchicago.com/developers](https://www.transitchicago.com/developers/) |
| Station ID | 5-digit station MapID (e.g. `40380`) |
| Zip code | Weather location. No key needed — Open-Meteo is free |
| Quote provider | Finnhub (60 req/min free) or Alpha Vantage (25 req/**day**) |
| Stock API key | [finnhub.io/register](https://finnhub.io/register) |
| Symbols | Comma-separated, up to 12 tickers |
| Theme | Dark or Light |
| Simulate 7-inch panel | Frames the view at 1024x600 for desktop testing |
| Ambient dimming | Day/night backlight curve |
| Sleep after inactivity | Never / 3m / 10m / 30m |

Finnhub is the default because Alpha Vantage's free tier (25 requests per day)
cannot sustain a live ticker.

## APIs

- **Weather** — [Open-Meteo](https://open-meteo.com/), no key required
- **Geocoding** — [Zippopotam.us](https://api.zippopotam.us/), cached in
  `localStorage` since a zip code's coordinates never change
- **Trains** — [CTA Train Tracker](https://www.transitchicago.com/developers/)
- **Quotes** — [Finnhub](https://finnhub.io/) or
  [Alpha Vantage](https://www.alphavantage.co/)

## Raspberry Pi kiosk

See **[pi-setup/README.md](pi-setup/README.md)** for the full guide.

```bash
git clone https://github.com/jordankeyser/home-interface.git
cd home-interface
./pi-setup/install.sh
sudo reboot
```

The installer detects the current user, repo path and graphical session type,
builds the app, installs the control-server systemd unit, wires the kiosk into
whatever session mechanism the image actually uses, grants backlight access via
udev, adds a NOPASSWD sudoers drop-in for shutdown/reboot, and schedules a
nightly update at 3:30 AM.

If the panel comes up blank, `./pi-setup/diagnose.sh` reports which launcher is
wired, whether the control server is answering, and the tail of the kiosk log.

## Runtime on the Pi

The kiosk runs the UI from **Vite's dev server on :5173**, which is what this
panel ran on before the 1.0 rewrite and the only configuration proven on the
hardware. The control server on :3001 is optional — it adds backlight dimming and
the power buttons, and the dashboard works without it (Vite proxies `/api`
straight to the CTA). `HOME_INTERFACE_MODE=prod` serves the built `dist/`
instead, falling back to dev mode if that isn't serving.

## Behaviour on the wall

- **Idle sleep** dims the backlight to zero rather than blanking via DPMS, so the
  touch digitiser stays live and a tap wakes it. The dashboard stays mounted,
  so waking is instant with no loading flash, and polling pauses while dark.
- **Ambient dimming** follows a day/night curve (full through the day, easing
  down from 7 PM, low overnight).
- **Anti burn-in**: the whole panel creeps about 2px over 15 minutes.
- **Offline**: modules keep showing the last good reading with a small warning
  glyph instead of replacing the panel with an error, and a network-off icon
  appears next to the clock.
- **Reduced motion** is respected via `prefers-reduced-motion`.
- **Boot is self-healing**: `pi-setup/kiosk-start.sh` clears stale listeners on
  the control port, starts the control server itself if systemd hasn't, launches
  Chromium regardless, and relaunches it if it exits. The panel comes up on boot
  even if the service unit is broken.

## Troubleshooting

**Backlight control does nothing.** Check `curl -s localhost:3001/healthz` — if
`backlight` is `null`, no sysfs backlight was found and it fell back to
`vcgencmd`/`xset`. If a path is listed but brightness doesn't change, the udev
rule hasn't applied; log out and back in so your `video` group membership takes
effect.

**Shutdown/restart does nothing.** The sudoers drop-in is missing or invalid:
`sudo visudo -cf /etc/sudoers.d/home-interface`.

**Blank screen after boot.** Run `./pi-setup/diagnose.sh` — it reports which
launcher is wired, whether the control server answers, and the tail of
`~/.local/state/home-interface/kiosk.log`. If that log doesn't exist, the
session never ran the kiosk script; re-run the installer with an explicit
`LAUNCHER=` (see [pi-setup/README.md](pi-setup/README.md)).

**Updates aren't landing.** `tail -f logs/update.log`. A dirty working tree
blocks updates by design; run `./pi-setup/daily-update.sh --force` to discard
local edits and update anyway.

**Trains show "Arrivals unavailable".** Check the key and station ID in
Settings. Verify the proxy directly:
`curl "localhost:3001/api/1.0/ttarrivals.aspx?key=YOUR_KEY&mapid=40380&outputType=JSON"`.

## Development notes

```bash
npm run lint
npm run build
```

`Date.now()` and other impure calls are not allowed in render — the React
compiler lint rules are enforced. The weather forecast anchors on the API
payload's own `current.time` for this reason.
