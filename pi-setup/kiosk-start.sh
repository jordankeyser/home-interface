#!/usr/bin/env bash
# Reliable Raspberry Pi kiosk launcher.
#
# This file is intentionally safe to invoke from either ~/.xinitrc or the
# legacy systemd unit. Some existing installs have both wired up; the lock
# below makes one launcher own the kiosk while the other waits and keeps its
# parent graphical session alive.

set -u

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/home-interface"
KIOSK_LOG="$STATE_DIR/kiosk.log"
VITE_LOG="$STATE_DIR/vite.log"
BOOT_ERROR_URL="file://$APP_DIR/pi-setup/boot-error.html"

mkdir -p "$STATE_DIR" "$APP_DIR/logs"
touch "$KIOSK_LOG" "$VITE_LOG"
ln -sfn "$VITE_LOG" "$APP_DIR/logs/vite.log" 2>/dev/null || true

exec >>"$KIOSK_LOG" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"

log "------------------------------------------------------------"
log "Kiosk launcher starting"
log "app=$APP_DIR display=$DISPLAY user=$(id -un)"

# Starting Chromium before X is accepting clients produces a white panel or a
# rapid restart loop. Wait for the actual display, not merely graphical.target.
display_ready=0
for _attempt in $(seq 1 120); do
    if xset q >/dev/null 2>&1; then
        display_ready=1
        break
    fi
    sleep 1
done

if [ "$display_ready" -ne 1 ]; then
    log "FATAL: X display $DISPLAY did not become ready within 120 seconds"
    exit 1
fi

# Existing Pi images may launch this script from both systemd and ~/.xinitrc.
# Blocking is deliberate: if the xinitrc copy loses the race, it must stay
# alive or startx will tear down the X server underneath the winning copy.
exec 9>"$STATE_DIR/kiosk.lock"
if command -v flock >/dev/null 2>&1; then
    log "Waiting for kiosk launcher lock"
    flock 9
fi
log "Kiosk launcher lock acquired"

cd "$APP_DIR" || {
    log "FATAL: cannot enter $APP_DIR"
    exit 1
}

server_pid=""

cleanup() {
    if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
        kill "$server_pid" 2>/dev/null || true
        wait "$server_pid" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

server_ready() {
    curl -fsS --max-time 2 http://127.0.0.1:5173/ >/dev/null 2>&1
}

start_server() {
    if server_ready; then
        log "Reusing the server already listening on 127.0.0.1:5173"
        return 0
    fi

    if ! command -v npm >/dev/null 2>&1; then
        log "ERROR: npm is not available in PATH=$PATH"
        return 1
    fi

    log "Starting Vite ($(node --version 2>/dev/null || echo 'node unavailable'))"
    : >"$VITE_LOG"
    npm start -- --host 127.0.0.1 --port 5173 --strictPort >>"$VITE_LOG" 2>&1 &
    server_pid=$!

    for _attempt in $(seq 1 45); do
        if server_ready; then
            log "Vite is ready on 127.0.0.1:5173 (pid $server_pid)"
            return 0
        fi
        if ! kill -0 "$server_pid" 2>/dev/null; then
            log "ERROR: Vite exited before becoming ready"
            tail -40 "$VITE_LOG" 2>/dev/null || true
            return 1
        fi
        sleep 1
    done

    log "ERROR: Vite did not become ready within 45 seconds"
    tail -40 "$VITE_LOG" 2>/dev/null || true
    return 1
}

if command -v chromium-browser >/dev/null 2>&1; then
    chromium_cmd="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
    chromium_cmd="chromium"
else
    log "FATAL: neither chromium-browser nor chromium is installed"
    exit 1
fi

# Best effort only: neither utility is allowed to prevent the dashboard from
# starting. DPMS is intentionally disabled because it can power down the touch
# digitiser on this panel.
xset s off >/dev/null 2>&1 || true
xset -dpms >/dev/null 2>&1 || true
xset s noblank >/dev/null 2>&1 || true
if command -v unclutter >/dev/null 2>&1 && ! pgrep -x unclutter >/dev/null 2>&1; then
    unclutter -idle 3 >/dev/null 2>&1 &
fi

if start_server; then
    kiosk_url="http://127.0.0.1:5173/"
else
    kiosk_url="$BOOT_ERROR_URL"
    log "Launching the on-screen boot diagnostic because Vite is unavailable"
fi

log "Launching $chromium_cmd at $kiosk_url"

# Hardware compositing was the common factor in the Pi-only white-screen
# failures after the swipe/UI work. Software rendering is less glamorous but
# reliable at this panel's 1024x600 resolution. Chromium is relaunched if it
# crashes or is closed.
while true; do
    "$chromium_cmd" \
        --kiosk \
        --noerrdialogs \
        --disable-infobars \
        --no-first-run \
        --no-default-browser-check \
        --disable-session-crashed-bubble \
        --disable-application-cache \
        --disable-gpu \
        --overscroll-history-navigation=0 \
        --disable-pinch \
        --check-for-update-interval=31536000 \
        --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \
        "$kiosk_url"
    exit_code=$?
    log "Chromium exited with status $exit_code; relaunching in 3 seconds"
    sleep 3
done
