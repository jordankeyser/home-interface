# Home Interface — notes for future fixes and development

Read this before changing anything that runs on the Pi. It records how the
panel is actually set up (which differs from some of the older docs), how Home
Assistant fits in, and what has gone wrong before. The README covers the app's
features and theming.

## Working with the owner

- The owner runs commands on the Pi themselves. Give exact commands, one per
  code block, say what each should print, and say how to undo anything that
  changes the system.
- The Pi usually can't be reached from the development Mac (SSH gave "No route
  to host", likely a VPN or different network), so assume you can't inspect
  the device. Ask for command output instead of guessing.
- Two things can't be verified in a desktop browser: **touch behaviour** and
  **how the Pi's GPU renders**. Any change to layout layers, transforms,
  scrolling or gestures must be tested on the panel before more changes are
  stacked on it. See the incident log below for why.

## Hardware and OS

| | |
| --- | --- |
| Board | Raspberry Pi 4 Model B Rev 1.5, 4 GB RAM |
| OS | Raspberry Pi OS on Debian 13 (trixie), 64-bit (`aarch64`) |
| Desktop | **labwc (Wayland)**, with Xwayland. Not X11. |
| Display | Official Raspberry Pi DSI touchscreen, 1024×600 (`10-0038 generic ft5x06 (79)`) |
| Browser | Chromium 151 in kiosk mode |
| Network | Pi at `192.168.68.61` on the home Wi-Fi (was, as of 2026-09-30) |

## How the panel runs

- Repo on the Pi: `/home/jordankeyser/Desktop/home-interface`.
- `pi-setup/kiosk-start.sh` starts the **Vite dev server** on
  `127.0.0.1:5173`, verifies the correct HTML, and then starts Chromium. It is
  launched exactly once by `~/.config/labwc/autostart`. A kiosk systemd unit
  and `~/.xinitrc` are unsupported duplicate launch paths; the one-time
  `pi-setup/repair-wayland-kiosk.sh` removes them.
- The script also calls `xset` and `unclutter`, which are X11 tools. Under
  labwc they probably do nothing; this hasn't been checked.
- `server/displayServer.js` (optional, port 3001, loopback only) cuts the
  backlight on sleep and handles shutdown. It runs as its own unit,
  `home-interface-display.service`.
- **Updates:** cron runs `pi-setup/daily-update.sh` at 3:30 AM. The script
  fast-forwards `main`, installs changed dependencies, validates lint/build,
  rolls back a failed validation, and cold-reboots after a successful update.
  HMR is disabled on the kiosk so revisions are never mixed in a live page.
- **Never put files inside the repo folder on the Pi.** A dirty tree blocks the
  update, and `daily-update.sh --force` runs `git reset --hard && git clean -fd`,
  which deletes anything untracked.

## Touchscreen: read before touching gestures or scrolling

Raspberry Pi OS configures labwc to turn touches into mouse events
(`mouseEmulation="yes"`) for the official touchscreens. With that on, Chromium
never sees a touch, so finger-scrolling lists and swiping between pages do
nothing: a drag arrives as a mouse drag.

**The fix, applied 2026-09-30:**
- `~/.config/labwc/rc.xml` on the Pi now contains
  `<touch deviceName="10-0038 generic ft5x06 (79)" mapToOutput="DSI-1" mouseEmulation="no"/>`.
- The original is at `~/.config/labwc/rc.xml.bak`.
- The system defaults in `/etc/xdg/labwc/rc.xml` still say `yes`, but the user
  file wins.

With real touches, native scrolling and the scroll-snap page swipe work with no
special code. **Rules that follow from this:**

- Use the browser's native scrolling and CSS scroll snapping. Don't
  reimplement touch scrolling or swiping in JavaScript.
- If touch starts acting like a mouse again (lists won't drag, swipes do
  nothing), check the labwc config first:
  `grep mouseEmulation ~/.config/labwc/rc.xml`. Raspberry Pi's Screen
  Configuration tool can rewrite that file.
- Chromium may show its right-click menu on a long press now that touches are
  real. Nothing blocks `contextmenu` yet; add a handler only if it's actually
  observed.

## Home Assistant

Home Assistant runs on the same Pi, in Docker. Home Assistant OS was ruled out
because it would replace the OS the kiosk runs on.

- **Compose file:** `~/homeassistant/compose.yml` on the Pi, deliberately
  outside the repo. Its config lives in `~/homeassistant/config`.
  ```yaml
  services:
    homeassistant:
      container_name: homeassistant
      image: ghcr.io/home-assistant/home-assistant:stable
      volumes:
        - ./config:/config
        - /etc/localtime:/etc/localtime:ro
        - /run/dbus:/run/dbus:ro
      environment:
        TZ: America/Chicago
      restart: unless-stopped
      stop_grace_period: 60s
      privileged: true
      network_mode: host
  ```
- **Web UI:** `http://192.168.68.61:8123` from another device, or
  `http://127.0.0.1:8123` on the Pi itself.
- **SD-card wear:** `configuration.yaml` sets `recorder: purge_keep_days: 3`.
- **Lights:** the Wi-Fi bulbs use the **AiDot** app (Linkind). They're added
  through Home Assistant's official AiDot integration (Home Assistant 2026.6+),
  which signs in with the AiDot account and then controls the bulbs over the
  local network. Pair new bulbs in the AiDot app first. Rooms are set as Areas
  in Home Assistant.
- **Update:**
  `sudo docker compose -f ~/homeassistant/compose.yml pull && sudo docker compose -f ~/homeassistant/compose.yml up -d`
- **Logs:** `sudo docker logs -f homeassistant`

### How the panel talks to Home Assistant

The address and a long-lived access token are entered in the panel's Settings
(Home Assistant section, with a Test connection button). Like the CTA key,
they're stored in the browser's `localStorage`. The address defaults to
`http://127.0.0.1:8123`.

| File | Role |
| --- | --- |
| `src/lib/homeAssistantClient.js` | WebSocket client: auth, `get_states`, `state_changed` subscription, area/device/entity registries (refetched on registry events), `call_service`, and a one-shot `testHomeAssistant` |
| `src/hooks/useHomeAssistant.js` | Connection lifecycle (open while awake, closed while asleep), grouping by room, optimistic toggles that revert if HA doesn't confirm within 6 s |
| `src/lib/haEntities.js` | Which device types are shown (`DOMAINS`: light, switch, fan) and how they're read |
| `src/components/modules/Devices/` | Devices page, tiles, brightness sheet |
| `src/components/Pager.jsx` | Swipe between the trains/weather page and the devices page |

- **Protocol details:**
  - A rejected token stops reconnecting on purpose, so it doesn't pile up
    failed logins.
  - `config/entity_registry/list_for_display` uses short keys: `ei` is the
    entity id, `di` the device id, `ai` the area id, `ec` the entity category
    and `hb` the hidden flag.
  - An entity takes its device's area unless it has its own.
- **Adding a device type:** add an entry to `DOMAINS` in `haEntities.js` and an
  icon in `DeviceTile.jsx`. Anything beyond on/off plus brightness (climate,
  covers, locks) needs its own controls.
- **Later hardware:** Zigbee needs a USB radio plus the built-in ZHA
  integration. Matter, Thread and Z-Wave need extra containers, because
  Container installs don't get Home Assistant's add-ons.

## Developing

```bash
npm install
```
```bash
npm run dev
```
```bash
npm run lint
```
```bash
npm run build
```

- On the Mac, Vite listens on `localhost` (IPv6). `http://127.0.0.1:5173` may
  refuse the connection, so use `http://localhost:5173`.
- Turn on Settings → "Simulate 7-inch panel", or set a 1024×600 viewport, to
  see the real layout.
- **Lint is strict** (React compiler rules):
  - No `setState` called directly in an effect body. To reset state when a
    prop changes, adjust it during render with a `prev` state variable.
  - No impure calls such as `Date.now()` or `performance.now()` in anything the
    compiler thinks can run during render; move them to module scope or event
    handlers.
- **Design rules:** no text below 13px (`--text-xs`) and no tap target below
  48px (`.icon-btn` and `.btn` enforce it). Colours come from CSS variables in
  `src/index.css`.
- `position: fixed` overlays must be portalled to `<body>`. The cards'
  `backdrop-filter` and the panel's burn-in `transform` trap fixed elements
  inside them.

### Testing against a throwaway Home Assistant

Home Assistant's `demo` integration gives fake lights, switches and fans, which
is enough to exercise the devices page without the real Pi.

1. Start it, with a config folder in a scratch location containing a
   `configuration.yaml` of `default_config:` and `demo:`:
   `docker run -d --name ha-dev -p 8123:8123 -v <dir>:/config ghcr.io/home-assistant/home-assistant:stable`
2. Onboard it without the UI:
   1. `POST /api/onboarding/users` with `client_id`, `name`, `username`,
      `password` and `language`. It returns an `auth_code`.
   2. `POST /auth/token` with `grant_type=authorization_code`. It returns an
      access token.
   3. Over the WebSocket, send `auth/long_lived_access_token` to get a token
      for the panel.
3. Put demo devices in rooms with `config/device_registry/update`
   (`device_id`, `area_id`). Home Assistant saves registry changes a few
   seconds late, so an immediate `docker stop` loses them.
4. Remove it afterwards: `docker rm -f ha-dev`.

## Deploying and rolling back

- **Deploy:** commit to `main` and push. That's what the Pi pulls, and all
  history is on `main`. Then have the owner run `./pi-setup/daily-update.sh`
  on the Pi, or wait for the nightly run.
- **Roll back:** revert on `main` and push (for example
  `git revert --no-commit <good>..HEAD`), then update the Pi. Don't reset the
  Pi's checkout by hand; the next nightly update would fast-forward it again.

## Incident log

**2026-09-30: blank white panel after swipe rewrites.** The Home Assistant
page first shipped in `601c547` with a native scroll-snap pager. It rendered
fine, but swiping didn't work. Assuming the screen couldn't do native touch
scrolling, three rewrites followed:

- `8cb71ab`: a pointer-event pager moving a `will-change: transform` track.
- `6c90cbc`: scrollLeft-driven instead of the transform.
- `2be6a86`: one page shown at a time, plus JS drag-scrolling on every list.

With each of them the panel showed a plain white screen with the page dots,
straight from boot. They were rolled back: `6cfbc73` reverted everything, then
`af36c1f` restored the exact `601c547` tree, which is what runs now.

**The real cause of the swipe and scroll problem was labwc's mouse emulation**
(see Touchscreen), not the code. Once it was turned off, `601c547` worked as
designed. Why the rewrites rendered white was never identified.

**Lessons:**
- Get device facts first: `xinput list`, the labwc config, Chromium's
  launch flags.
- Make one change at a time, and have it tested on the panel before the next.
- Don't re-apply those three commits.

## Known loose ends

- The Home Assistant token sits in `localStorage` on the panel. That's
  acceptable for a single-user, loopback-only kiosk.
