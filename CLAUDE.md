# Home Interface development notes

Read this before changing the Raspberry Pi runtime or touch behavior.

## Hardware and runtime

- Raspberry Pi 4 Model B Rev 1.5, 4 GB, `aarch64`.
- Debian 13 (Trixie), Raspberry Pi desktop using labwc / Wayland and Xwayland.
- 1024×600 official DSI touchscreen (`generic ft5x06`).
- Chromium 151.
- Repo on the Pi: `/home/jordankeyser/Desktop/home-interface`.
- The UI is intentionally served by Vite on `127.0.0.1:5173`. This is the
  runtime proven on the panel. Do not replace it with an untested static server.
- Home Assistant runs separately in Docker from `~/homeassistant/compose.yml`
  and is reached by the UI at `http://127.0.0.1:8123`.

## Touchscreen

Real touch events require this in `~/.config/labwc/rc.xml`:

```xml
<touch deviceName="10-0038 generic ft5x06 (79)" mapToOutput="DSI-1" mouseEmulation="no"/>
```

`mouseEmulation="yes"` converts touches to mouse drags, which breaks native
momentum scrolling and CSS scroll-snap swiping. Do not replace the native pager
with pointer-driven transforms. Commits `8cb71ab`, `6c90cbc`, and `2be6a86`
tried that and rendered a white screen on the Pi.

## White-screen incident and permanent runtime rules

The app at `601c547` was confirmed to render correctly. Later, the source tree
was restored to that exact version and the panel could still be white. The HTML
contains an inline dark boot shell, so a plain white screen means Chromium did
not receive the Home Interface HTML—it is a launcher/server problem, not a React
layout problem.

Over time installers configured three different launch paths outside git:

1. `/etc/systemd/system/home-interface-kiosk.service`
2. `~/.xinitrc`
3. `~/.config/labwc/autostart`

Rolling back git does not remove those system files. Multiple launchers can race
for Vite and Chromium. The supported configuration is now exactly one labwc
autostart entry. Run `pi-setup/repair-wayland-kiosk.sh` once on the Pi after
pulling the runtime fix.

`pi-setup/kiosk-start.sh` enforces these rules:

- non-blocking process lock: a duplicate launcher exits;
- no internet gate—the local UI boots offline;
- Vite uses `--strictPort` and must return this app's HTML before Chromium opens;
- kiosk Vite has HMR disabled (`HOME_INTERFACE_KIOSK=1`);
- Chromium gets a cache-busting query while keeping the same origin/localStorage;
- a failed server displays `pi-setup/boot-error.html`, never a white page;
- Chromium is relaunched if it exits.

`pi-setup/daily-update.sh` validates lint and build, rolls back a failed update,
and reboots after every successful update. Never deploy to the panel with HMR.

If boot fails, run the read-only `pi-setup/diagnose-kiosk.sh` and inspect:

```text
~/.local/state/home-interface/kiosk.log
~/.local/state/home-interface/vite.log
```

## Home Assistant UI

- `src/lib/homeAssistantClient.js`: WebSocket protocol and service calls.
- `src/hooks/useHomeAssistant.js`: connection lifecycle, optimistic state,
  grouping by room.
- `src/components/modules/Devices/`: device page and light controls.
- `src/components/Pager.jsx`: native CSS scroll-snap; keep it native.
- Long-lived HA token is stored in the browser's localStorage. Changing only a
  URL query does not erase it; changing the origin or Chromium profile does.

## Development and deployment

```bash
npm install
npm run dev
npm run lint
npm run build
```

Develop on the Mac at `http://localhost:5173`. Do not infer panel behavior from
desktop pointer simulation: the real touch/GPU path must be tested on the Pi.

Deploy by committing and pushing `main`, then on the Pi:

```bash
./pi-setup/daily-update.sh
```

The updater now reboots after a validated change. The owner runs Pi commands;
give exact commands in separate code blocks and explain any destructive effect.
