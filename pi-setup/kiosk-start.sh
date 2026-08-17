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

# "Healthy" must mean "this is OUR server AND it has a build to serve".
# Checking only for a 200 was how Chromium ended up pointed at a server that
# could only return 404s — a white "Not found" page on the wall.
healthy_at() { # $1 = port
    curl -fsS --max-time 2 "http://127.0.0.1:$1/healthz" 2>/dev/null |
        grep -q '"app":"home-interface"' || return 1
    curl -fsS --max-time 2 "http://127.0.0.1:$1/healthz" 2>/dev/null |
        grep -q '"servingDist":true'
}

healthy() { healthy_at "$PORT"; }

# The frontend uses only relative URLs, so any port works. Find one that is
# actually serving the dashboard rather than insisting on 3001.
find_serving_port() {
    local p
    for p in $(seq "$PORT" $((PORT + 9))); do
        if healthy_at "$p"; then
            echo "$p"
            return 0
        fi
    done
    return 1
}

port_busy() {
    if command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | grep -qE "127\.0\.0\.1:$PORT|0\.0\.0\.0:$PORT|\*:$PORT"
    else
        return 1
    fi
}

# Waits for any port in range to serve the dashboard; sets APP_URL to it.
wait_serving() { # $1 = seconds
    local waited=0 found
    while ((waited < $1)); do
        if found=$(find_serving_port); then
            APP_URL="http://127.0.0.1:$found"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    return 1
}

# --- rebuild if dist/ is stale or broken ------------------------------------
# `git pull && reboot` must be enough. dist/ is gitignored, so a pull updates the
# sources and leaves the old build in place; if index.html then references asset
# filenames that no longer exist, every asset 404s and the panel renders blank.
needs_rebuild() {
    [[ -f "$APP_DIR/dist/index.html" ]] || {
        log "dist/index.html missing"
        return 0
    }

    # Any source newer than the build means the build is stale.
    local newer
    newer=$(find "$APP_DIR/src" "$APP_DIR/public" "$APP_DIR/index.html" \
        "$APP_DIR/package.json" "$APP_DIR/vite.config.js" \
        -newer "$APP_DIR/dist/index.html" -print -quit 2>/dev/null)
    if [[ -n "$newer" ]]; then
        log "dist/ is older than $newer"
        return 0
    fi

    # And verify the assets index.html points at are actually on disk.
    local ref missing=0
    while read -r ref; do
        [[ -n "$ref" ]] || continue
        [[ -f "$APP_DIR/dist/$ref" ]] || {
            log "dist/index.html references missing asset: $ref"
            missing=1
        }
    done < <(grep -oE '(src|href)="/[^"]+\.(js|css)"' "$APP_DIR/dist/index.html" 2>/dev/null |
        sed -E 's/.*"\/(.*)"/\1/')
    ((missing)) && return 0

    return 1
}

rebuild() {
    log "rebuilding dist/ (this takes ~10s)"
    if (cd "$APP_DIR" && npm run build) >>"$LOG_DIR/build.log" 2>&1; then
        log "build ok"
        return 0
    fi
    log "BUILD FAILED — see $LOG_DIR/build.log (keeping the previous dist/)"
    return 1
}

if needs_rebuild; then
    rebuild || true
else
    log "dist/ is current"
fi

# --- 1..2: make sure the control server is up -------------------------------
ensure_server() {
    local found
    if found=$(find_serving_port); then
        APP_URL="http://127.0.0.1:$found"
        log "dashboard already being served on port $found"
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
        wait_serving 20 && {
            log "control server up via systemd at $APP_URL"
            return 0
        }
    fi

    # Fall back to running it ourselves. This is the belt-and-braces path: the
    # panel should not depend on the unit file being correct.
    if pgrep -f "$APP_DIR/server/index.js" >/dev/null 2>&1; then
        log "a control server process is already running; waiting for it"
    else
        log "starting the control server directly: $NODE_BIN server/index.js"
        (cd "$APP_DIR" && exec "$NODE_BIN" "$APP_DIR/server/index.js") \
            >>"$LOG_DIR/server.log" 2>&1 &
    fi

    wait_serving 30 && {
        log "control server up (direct) at $APP_URL"
        return 0
    }

    log "WARNING: nothing is serving the dashboard — see $LOG_DIR/server.log"
    return 1
}

# Keep trying rather than giving up or pointing Chromium at a 404. A white
# "Not found" page on the wall is worse than a few more seconds of waiting.
round=0
until ensure_server; do
    round=$((round + 1))
    log "retry $round in 15s (will keep trying; check $LOG_DIR/server.log)"
    sleep 15
done
log "serving from $APP_URL"

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

    # If the server went away in the meantime, bring it back before relaunching.
    until ensure_server; do
        log "server unavailable; retrying in 15s"
        sleep 15
    done
    sleep 5
done
