#!/usr/bin/env bash
#
# Launches Chromium against the local control server.
#
# Invoked by whichever session mechanism install.sh detected:
#   * console/Lite image -> ~/.xinitrc (inside startx)
#   * labwc / wayfire    -> session autostart
#   * LXDE / X11 desktop -> ~/.config/lxsession/LXDE-pi/autostart
#
# It does NOT start a Vite dev server. The old version ran `npm start` (Vite
# dev, with HMR and a file watcher) as the production front-end on a Pi.
set -uo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3001}"
# (no readiness timeout — see the wait loop below)
LOG_DIR="${LOG_DIR:-$HOME/.local/state/home-interface}"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/kiosk.log") 2>&1

log() { echo "[kiosk $(date '+%H:%M:%S')] $*"; }

log "starting (session=${XDG_SESSION_TYPE:-unknown} wayland=${WAYLAND_DISPLAY:-none} display=${DISPLAY:-none})"

# --- wait for the control server -------------------------------------------
# systemd starts it first, but ordering is not a readiness guarantee.
#
# This waits indefinitely rather than giving up. The session autostart runs this
# script exactly once, so exiting on a timeout leaves the user staring at a bare
# desktop with no way back — whereas a server that recovers two minutes late
# should still produce a dashboard.
log "waiting for ${APP_URL} ..."
waited=0
until curl -fsS --max-time 2 "${APP_URL}/healthz" >/dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if ((waited % 30 == 0)); then
        log "still waiting (${waited}s) — check: systemctl status home-interface-server"
    fi
done
log "control server is up after ${waited}s"

# --- figure out the display server -----------------------------------------
PLATFORM=x11
if [[ -n "${WAYLAND_DISPLAY:-}" ]] || [[ "${XDG_SESSION_TYPE:-}" == "wayland" ]]; then
    PLATFORM=wayland
fi
log "display platform: $PLATFORM"

if [[ "$PLATFORM" == "x11" ]]; then
    # Only meaningful under X. Sleep/dimming is handled in-app by lowering the
    # backlight, which keeps the touch digitiser powered — so X must not also
    # blank the panel.
    export DISPLAY="${DISPLAY:-:0}"
    xset s off || true
    xset -dpms || true
    xset s noblank || true

    if command -v unclutter >/dev/null 2>&1; then
        unclutter -idle 2 -root &
    fi
fi

# --- find chromium ----------------------------------------------------------
if command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM=chromium
else
    log "ERROR: chromium not found"
    exit 1
fi

# A persistent profile keeps the HTTP cache and localStorage (your API keys and
# theme), so a restart neither refetches the bundle nor loses settings.
PROFILE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/home-interface-chromium"
mkdir -p "$PROFILE_DIR"

# Chromium leaves this set after an unclean shutdown (i.e. every power cut),
# which otherwise pops a "restore pages?" bubble over the dashboard.
PREFS="$PROFILE_DIR/Default/Preferences"
if [[ -f "$PREFS" ]]; then
    sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$PREFS" 2>/dev/null || true
fi

log "launching $CHROMIUM"
exec "$CHROMIUM" \
    --kiosk \
    --user-data-dir="$PROFILE_DIR" \
    --ozone-platform="$PLATFORM" \
    --app="$APP_URL" \
    --start-fullscreen \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-features=TranslateUI,Translate \
    --no-first-run \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --autoplay-policy=no-user-gesture-required \
    --check-for-update-interval=31536000 \
    --password-store=basic \
    --enable-features=OverlayScrollbar
