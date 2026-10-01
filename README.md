# Home Interface

A two-page touch dashboard for a wall-mounted Raspberry Pi panel:

- time, weather, and CTA arrivals;
- Home Assistant lights, switches, and fans.

It is built with React 19, Vite 7, and Tailwind CSS 4 for the Pi's 1024×600
touchscreen.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The optional display-control server is a separate process:

```bash
npm run display-server
```

It listens on `127.0.0.1:3001` and controls the panel backlight and shutdown.
The dashboard still renders when it is not installed.

Before committing a change:

```bash
npm run lint
npm run build
```

## Raspberry Pi runtime

The deployed panel serves the validated production bundle with Vite Preview on
`127.0.0.1:5173`. Chromium is launched once from the labwc user session by
`pi-setup/kiosk-start.sh`.

The launcher:

- starts locally without waiting for the internet;
- serves optimized production assets instead of React's development runtime;
- refuses duplicate launchers with an atomic PID lock;
- requires the correct Home Interface HTML before opening Chromium;
- pins Vite to port 5173 instead of silently moving to another port;
- disables HMR on the appliance;
- supervises both Vite and Chromium;
- shows a dark diagnostic page and retries if Vite cannot start.

The app also has an error boundary and an inline dark boot shell. A JavaScript
startup failure is therefore visible and diagnosable, never an unexplained
white screen.

See [pi-setup/README.md](pi-setup/README.md) for installation, recovery, and
diagnostic commands.

## Configuration

Settings are entered from the gear icon and stored in Chromium's local storage.

| Setting | Notes |
| --- | --- |
| CTA API key | CTA Train Tracker developer key |
| Station ID | Five-digit CTA station MapID |
| Zip code | Used by Open-Meteo; no weather API key required |
| Home Assistant address | Defaults to `http://127.0.0.1:8123` |
| Home Assistant token | Long-lived access token |
| Wi-Fi | Scan and connect through NetworkManager on the Pi only |
| Theme | Dark or light |
| Idle sleep | Never, 3, 10, or 30 minutes |

The kiosk-only Network panel talks to a loopback Vite endpoint. Wi-Fi passwords
are passed directly to NetworkManager over stdin; the dashboard does not put
them in local storage, command arguments, application logs, or the repository.

## Home Assistant page

Swipe left from the main page to reach smart-home controls. The panel connects
directly to Home Assistant's WebSocket API. It keeps the last known device state
during an outage and reconnects automatically.

Supported entities are defined in `src/lib/haEntities.js`; the current domains
are lights, switches, and fans.

## Touch behavior

Page navigation uses native horizontal scrolling and CSS scroll snapping. The
Pi's labwc configuration must send real touch events:

```xml
<touch deviceName="10-0038 generic ft5x06 (79)" mapToOutput="DSI-1" mouseEmulation="no"/>
```

Do not replace the native pager with pointer-driven transforms. Earlier
attempts did not fix the OS touch setting and rendered white on the Pi.
