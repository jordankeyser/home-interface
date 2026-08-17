#!/usr/bin/env bash
#
# Starts the Home Interface panel.
#
# Runtime: Vite's own dev server, which is what this panel ran on for months
# before the 1.0 rewrite. It is the only configuration proven to work on this
# hardware. It also cannot suffer the failure that produced a blank white
# screen: there is no dist/ to go stale, because modules are transformed on
# request and index.html is served straight from source.
#
# The control server (backlight, dimming, power) is started best-effort and is
# NOT required. If it fails, the dashboard still comes up — only dimming and the
# shutdown button stop working. Trains keep working because Vite proxies /api
# straight to the CTA.
#
# Set HOME_INTERFACE_MODE=prod to serve the built dist/ from the control server
# instead (lower memory, faster boot) once that path is confirmed on-device.
set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
MODE="${HOME_INTERFACE_MODE:-dev}"
UI_PORT="${UI_PORT:-5173}"
CONTROL_PORT="${CONTROL_PORT:-3001}"
LOG_DIR="${LOG_DIR:-$HOME/.local/state/home-interface}"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/kiosk.log") 2>&1

log() { echo "[kiosk $(date '+%H:%M:%S')] $*"; }

NPM_BIN="$(command -v npm || echo /usr/bin/npm)"
NODE_BIN="$(command -v node || echo /usr/bin/node)"

log "=============================================="
log "starting in $MODE mode"
log "session=${XDG_SESSION_TYPE:-unknown} wayland=${WAYLAND_DISPLAY:-none} display=${DISPLAY:-none}"
log "app dir: $APP_DIR"
log "node: $NODE_BIN  npm: $NPM_BIN"

# The real test of "is the UI up" is that the HTML shell is being served. A open
# socket, or a 200 from a health endpoint, proved nothing useful — that is how
# Chromium ended up pointed at a server returning 404s.
serves_ui() { # $1 = port
    curl -fsS --max-time 3 "http://127.0.0.1:$1/" 2>/dev/null | grep -q 'id="root"'
}

wait_for_ui() { # $1 = port, $2 = seconds
    local waited=0
    while ((waited < $2)); do
        serves_ui "$1" && return 0
        sleep 2
        waited=$((waited + 2))
        ((waited % 20 == 0)) && log "  still waiting for the UI on :$1 (${waited}s)"
    done
    return 1
}

# --- control server (optional) ----------------------------------------------
start_control_server() {
    if curl -fsS --max-time 2 "http://127.0.0.1:$CONTROL_PORT/healthz" >/dev/null 2>&1; then
        log "control server already running"
        return 0
    fi

    # The pre-1.0 displayServer.js bound this same port and keeps running after
    # the file is deleted; clear it so the current one can bind.
    if pgrep -f 'displayServer\.js' >/dev/null 2>&1; then
        log "killing obsolete displayServer.js"
        pkill -f 'displayServer\.js' 2>/dev/null || true
        sleep 1
    fi

    if command -v systemctl >/dev/null 2>&1 &&
        sudo -n /usr/bin/systemctl restart home-interface-server.service 2>/dev/null; then
        log "control server started via systemd"
        return 0
    fi

    log "starting control server directly (backlight/power only)"
    (cd "$APP_DIR" && exec "$NODE_BIN" "$APP_DIR/server/index.js") \
        >>"$LOG_DIR/server.log" 2>&1 &
    return 0
}

# Deliberately not fatal and not waited on — dimming and shutdown are nice to
# have; the dashboard is not allowed to depend on them.
start_control_server || log "control server unavailable (dimming/shutdown disabled)"

# --- the UI -----------------------------------------------------------------
APP_URL="http://127.0.0.1:$UI_PORT"

if [[ "$MODE" == "prod" ]]; then
    log "prod mode: serving the built dist/ from the control server"
    if [[ ! -f "$APP_DIR/dist/index.html" ]] ||
        [[ -n "$(find "$APP_DIR/src" "$APP_DIR/index.html" -newer "$APP_DIR/dist/index.html" -print -quit 2>/dev/null)" ]]; then
        log "building dist/"
        (cd "$APP_DIR" && "$NPM_BIN" run build) >>"$LOG_DIR/build.log" 2>&1 ||
            log "BUILD FAILED — see $LOG_DIR/build.log"
    fi

    if wait_for_ui "$CONTROL_PORT" 60; then
        APP_URL="http://127.0.0.1:$CONTROL_PORT"
    else
        log "WARNING: control server is not serving the UI — falling back to dev mode"
        MODE=dev
    fi
fi

if [[ "$MODE" == "dev" ]]; then
    if serves_ui "$UI_PORT"; then
        log "a UI server is already running on :$UI_PORT"
    else
        log "starting Vite on :$UI_PORT"
        (cd "$APP_DIR" && exec "$NPM_BIN" run dev -- --port "$UI_PORT" --host 127.0.0.1) \
            >>"$LOG_DIR/vite.log" 2>&1 &
    fi

    if ! wait_for_ui "$UI_PORT" 180; then
        log "ERROR: Vite never served the UI after 180s — see $LOG_DIR/vite.log"
        log "       common cause: node_modules missing. Run: cd $APP_DIR && npm install"
    fi
    APP_URL="http://127.0.0.1:$UI_PORT"
fi

log "UI url: $APP_URL"

# --- display server setup ---------------------------------------------------
PLATFORM=x11
if [[ -n "${WAYLAND_DISPLAY:-}" ]] || [[ "${XDG_SESSION_TYPE:-}" == "wayland" ]]; then
    PLATFORM=wayland
fi
log "display platform: $PLATFORM"

if [[ "$PLATFORM" == "x11" ]]; then
    # In-app sleep dims the backlight, which keeps the touch digitiser powered,
    # so X must not blank the panel itself.
    export DISPLAY="${DISPLAY:-:0}"
    xset s off || true
    xset -dpms || true
    xset s noblank || true
    command -v unclutter >/dev/null 2>&1 && unclutter -idle 2 -root &
fi

# --- Chromium ---------------------------------------------------------------
if command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM=chromium
else
    log "ERROR: chromium not found — sudo apt install -y chromium"
    exit 1
fi

PROFILE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/home-interface-chromium"
mkdir -p "$PROFILE_DIR"

launch_chromium() {
    # Chromium leaves exit_type=Crashed after any power cut, which pops a
    # "restore pages?" bubble over the dashboard.
    local prefs="$PROFILE_DIR/Default/Preferences"
    [[ -f "$prefs" ]] &&
        sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$prefs" 2>/dev/null || true

    "$CHROMIUM" \
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
}

attempt=0
while true; do
    attempt=$((attempt + 1))
    log "launching $CHROMIUM at $APP_URL (attempt $attempt)"
    launch_chromium
    code=$?
    log "chromium exited (code $code) — restarting in 5s"
    sleep 5
done
