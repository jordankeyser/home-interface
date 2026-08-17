#!/usr/bin/env bash
#
# Starts the Home Interface panel. This script owns the whole stack.
#
# Design rule learned the hard way: the interface must come up on boot even if
# something else is broken. An earlier version only waited for a separate
# systemd service and gave up if it never appeared — so one bad unit meant the
# panel showed nothing but the desktop. This script now:
#
#   1. clears anything squatting on the port that isn't us
#   2. makes sure the control server is running, starting it itself if systemd
#      hasn't or can't
#   3. launches Chromium regardless, and relaunches it if it exits
#
# Invoked by whichever session mechanism install.sh detected (labwc/wayfire/LXDE
# autostart, or ~/.xinitrc on a console image).
set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PORT="${PORT:-3001}"
APP_URL="${APP_URL:-http://127.0.0.1:$PORT}"
LOG_DIR="${LOG_DIR:-$HOME/.local/state/home-interface}"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/kiosk.log") 2>&1

log() { echo "[kiosk $(date '+%H:%M:%S')] $*"; }

NODE_BIN="$(command -v node || echo /usr/bin/node)"

log "starting (session=${XDG_SESSION_TYPE:-unknown} wayland=${WAYLAND_DISPLAY:-none} display=${DISPLAY:-none})"
log "app dir: $APP_DIR"

healthy() { curl -fsS --max-time 2 "$APP_URL/healthz" >/dev/null 2>&1; }

port_busy() {
    if command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | grep -qE "127\.0\.0\.1:$PORT|0\.0\.0\.0:$PORT|\*:$PORT"
    else
        return 1
    fi
}

wait_healthy() { # $1 = seconds
    local waited=0
    while ((waited < $1)); do
        healthy && return 0
        sleep 1
        waited=$((waited + 1))
    done
    return 1
}

# --- 1..2: make sure the control server is up -------------------------------
ensure_server() {
    if healthy; then
        log "control server already healthy"
        return 0
    fi

    # Not healthy. Clear the one listener we know is obsolete: the pre-1.0
    # server/displayServer.js bound this same port and keeps running even though
    # the file is gone from the repo, which makes every bind attempt fail.
    # Done unconditionally — it's a targeted kill of a known-dead component, and
    # gating it on `ss` being present would skip it on hosts without iproute2.
    if pgrep -f 'displayServer\.js' >/dev/null 2>&1; then
        log "killing the obsolete displayServer.js holding port $PORT"
        pkill -f 'displayServer\.js' 2>/dev/null || true
        sleep 2
    elif port_busy; then
        log "port $PORT is busy but not answering /healthz — see 'sudo ss -ltnp | grep $PORT'"
    fi

    # Prefer the systemd unit if it's available.
    if command -v systemctl >/dev/null 2>&1; then
        log "asking systemd to start the control server"
        sudo -n /usr/bin/systemctl restart home-interface-server.service 2>/dev/null ||
            systemctl --user restart home-interface-server.service 2>/dev/null ||
            log "  (couldn't drive systemd; will fall back to running it directly)"
        wait_healthy 20 && {
            log "control server up via systemd"
            return 0
        }
    fi

    # Fall back to running it ourselves. This is the belt-and-braces path: the
    # panel should not depend on the unit file being correct.
    if pgrep -f "$APP_DIR/server/index.js" >/dev/null 2>&1; then
        log "a control server process is already running; waiting for it"
    else
        if [[ ! -f "$APP_DIR/dist/index.html" ]]; then
            log "dist/ is missing — building now (first run after an update?)"
            (cd "$APP_DIR" && npm run build) >>"$LOG_DIR/build.log" 2>&1 ||
                log "  build failed, see $LOG_DIR/build.log"
        fi
        log "starting the control server directly: $NODE_BIN server/index.js"
        (cd "$APP_DIR" && exec "$NODE_BIN" "$APP_DIR/server/index.js") \
            >>"$LOG_DIR/server.log" 2>&1 &
    fi

    wait_healthy 30 && {
        log "control server up (direct)"
        return 0
    }

    log "WARNING: control server still not healthy — see $LOG_DIR/server.log"
    log "         launching the browser anyway so the panel isn't left blank"
    return 1
}

ensure_server || true

# --- display server setup ---------------------------------------------------
PLATFORM=x11
if [[ -n "${WAYLAND_DISPLAY:-}" ]] || [[ "${XDG_SESSION_TYPE:-}" == "wayland" ]]; then
    PLATFORM=wayland
fi
log "display platform: $PLATFORM"

if [[ "$PLATFORM" == "x11" ]]; then
    # Sleep/dimming is handled in-app by lowering the backlight, which keeps the
    # touch digitiser powered — so X must not also blank the panel.
    export DISPLAY="${DISPLAY:-:0}"
    xset s off || true
    xset -dpms || true
    xset s noblank || true
    command -v unclutter >/dev/null 2>&1 && unclutter -idle 2 -root &
fi

# --- 3: launch and supervise Chromium ---------------------------------------
if command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM=chromium
else
    log "ERROR: chromium not found — install it with: sudo apt install -y chromium"
    exit 1
fi

# A persistent profile keeps the HTTP cache and localStorage (API keys, theme),
# so a restart neither refetches the bundle nor loses settings.
PROFILE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/home-interface-chromium"
mkdir -p "$PROFILE_DIR"

launch_chromium() {
    # Chromium leaves exit_type=Crashed after any power cut, which otherwise
    # pops a "restore pages?" bubble over the dashboard.
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

# Supervise rather than exec: if Chromium dies (OOM, GPU hiccup, power blip) the
# panel should come back on its own rather than dropping to the desktop.
attempt=0
while true; do
    attempt=$((attempt + 1))
    log "launching $CHROMIUM (attempt $attempt)"
    launch_chromium
    code=$?
    log "chromium exited (code $code) — restarting in 5s"

    # If the server went away in the meantime, bring it back too.
    healthy || ensure_server || true
    sleep 5
done
