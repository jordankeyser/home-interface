#!/usr/bin/env bash
# Home Interface launcher for Raspberry Pi OS (labwc / Wayland).
#
# This script intentionally serves the UI with Vite on port 5173. That is the
# runtime proven on this panel. What it does *not* do is let several boot paths
# start competing Vite and Chromium processes: repair-wayland-kiosk.sh installs
# one labwc autostart entry, and the atomic lock below rejects duplicates.

set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
UI_PORT="${UI_PORT:-5173}"
APP_URL="http://127.0.0.1:$UI_PORT"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/home-interface"
KIOSK_LOG="$STATE_DIR/kiosk.log"
VITE_LOG="$STATE_DIR/vite.log"
ERROR_PAGE="file://$APP_DIR/pi-setup/boot-error.html"

mkdir -p "$STATE_DIR" "$APP_DIR/logs"
touch "$KIOSK_LOG" "$VITE_LOG"
ln -sfn "$VITE_LOG" "$APP_DIR/logs/vite.log" 2>/dev/null || true

exec >>"$KIOSK_LOG" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "------------------------------------------------------------"
log "kiosk launcher starting"
log "app=$APP_DIR session=${XDG_SESSION_TYPE:-unknown} wayland=${WAYLAND_DISPLAY:-none} display=${DISPLAY:-none}"

# A previous installation enabled both a system unit and a desktop-session
# launcher. If that configuration comes back, only the first process may own
# the panel. `mkdir` is an atomic, portable lock; the PID lets a cold boot clear
# a directory left behind by a power cut.
LOCK_DIR="$STATE_DIR/kiosk.lock.d"
claim_lock() {
    if mkdir "$LOCK_DIR" 2>/dev/null; then
        echo "$$" >"$LOCK_DIR/pid"
        return 0
    fi

    owner="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
    if [[ "$owner" =~ ^[0-9]+$ ]] && kill -0 "$owner" 2>/dev/null; then
        return 1
    fi

    # Stale after an unclean shutdown. Both targets are exact and private to
    # this app; avoid a recursive delete.
    rm -f "$LOCK_DIR/pid"
    rmdir "$LOCK_DIR" 2>/dev/null || return 1
    mkdir "$LOCK_DIR" || return 1
    echo "$$" >"$LOCK_DIR/pid"
}

if ! claim_lock; then
    log "another kiosk launcher already owns the lock; exiting"
    exit 0
fi

cd "$APP_DIR" || {
    log "FATAL: cannot enter $APP_DIR"
    exit 1
}

if [[ -n "${CHROMIUM_BIN:-}" ]]; then
    CHROMIUM="$CHROMIUM_BIN"
elif command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM="chromium"
else
    log "FATAL: Chromium is not installed"
    exit 1
fi

NPM_BIN="${NPM_BIN:-$(command -v npm || true)}"
vite_pid=""
chromium_pid=""
monitor_pid=""

cleanup() {
    if [[ -n "$monitor_pid" ]] && kill -0 "$monitor_pid" 2>/dev/null; then
        kill "$monitor_pid" 2>/dev/null || true
        wait "$monitor_pid" 2>/dev/null || true
    fi
    if [[ -n "$chromium_pid" ]] && kill -0 "$chromium_pid" 2>/dev/null; then
        kill "$chromium_pid" 2>/dev/null || true
        wait "$chromium_pid" 2>/dev/null || true
    fi
    if [[ -n "$vite_pid" ]] && kill -0 "$vite_pid" 2>/dev/null; then
        kill "$vite_pid" 2>/dev/null || true
        wait "$vite_pid" 2>/dev/null || true
    fi
    rm -f "$LOCK_DIR/pid"
    rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' INT TERM

# A socket is not enough: previous white screens happened when Chromium was
# pointed at a process returning the wrong page. Require this app's HTML shell.
serves_home_interface() {
    curl -fsS --max-time 2 "$APP_URL/" 2>/dev/null |
        grep -F '<title>Home Interface</title>' >/dev/null
}

start_vite() {
    if serves_home_interface; then
        log "reusing Home Interface already serving on $APP_URL"
        return 0
    fi

    if [[ -z "$NPM_BIN" ]]; then
        log "ERROR: npm is not available in PATH=$PATH"
        return 1
    fi

    if [[ -n "$vite_pid" ]] && kill -0 "$vite_pid" 2>/dev/null; then
        log "stopping an unhealthy Vite process (pid $vite_pid)"
        kill "$vite_pid" 2>/dev/null || true
        wait "$vite_pid" 2>/dev/null || true
        vite_pid=""
    fi

    # There should be no listener after a cold boot. If one exists but does not
    # serve our HTML, strictPort makes the problem explicit instead of silently
    # moving Vite to 5174 while Chromium continues to open 5173.
    : >"$VITE_LOG"
    log "starting Vite on 127.0.0.1:$UI_PORT"
    HOME_INTERFACE_KIOSK=1 "$NPM_BIN" run dev -- \
        --host 127.0.0.1 --port "$UI_PORT" --strictPort \
        >>"$VITE_LOG" 2>&1 &
    vite_pid=$!

    for _attempt in $(seq 1 60); do
        if serves_home_interface; then
            log "Vite is serving Home Interface (pid $vite_pid)"
            return 0
        fi
        if ! kill -0 "$vite_pid" 2>/dev/null; then
            log "ERROR: Vite exited before serving the UI"
            tail -50 "$VITE_LOG" 2>/dev/null || true
            return 1
        fi
        sleep 1
    done

    log "ERROR: Vite did not serve the UI within 60 seconds"
    tail -50 "$VITE_LOG" 2>/dev/null || true
    return 1
}

# Screen blanking is disabled only under X/Xwayland. Under native Wayland these
# commands are irrelevant and are allowed to fail. In-app sleep manages the
# panel backlight without powering down the touch digitiser.
xset s off >/dev/null 2>&1 || true
xset -dpms >/dev/null 2>&1 || true
xset s noblank >/dev/null 2>&1 || true
if command -v unclutter >/dev/null 2>&1 && ! pgrep -x unclutter >/dev/null 2>&1; then
    unclutter -idle 3 >/dev/null 2>&1 &
fi

launch_chromium() {
    "$CHROMIUM" \
        --kiosk \
        --noerrdialogs \
        --disable-infobars \
        --no-first-run \
        --no-default-browser-check \
        --disable-session-crashed-bubble \
        --disable-application-cache \
        --overscroll-history-navigation=0 \
        --disable-pinch \
        --enable-features=OverlayScrollbar \
        --check-for-update-interval=31536000 \
        --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \
        "$KIOSK_URL"
}

# Chromium is the process the user sees. Supervise both it and Vite: if either
# one dies, relaunch the pair rather than leaving a stale or unreachable page.
# If Vite is down, the dark diagnostic stays visible while retries continue.
attempt=0
while true; do
    attempt=$((attempt + 1))

    server_ok=0
    if start_vite; then
        server_ok=1
        # A changing query bypasses a stale Chromium document cache without
        # changing the origin, so localStorage settings survive.
        KIOSK_URL="$APP_URL/?boot=$(date +%s)"
    else
        KIOSK_URL="$ERROR_PAGE"
        log "showing the on-screen diagnostic while Vite is unavailable"
    fi

    log "launching $CHROMIUM at $KIOSK_URL (attempt $attempt)"
    launch_chromium &
    chromium_pid=$!

    # `wait` is the reliable Chromium liveness check. `kill -0` also succeeds
    # for a zombie, which would make an exited browser look alive forever.
    if [[ "$server_ok" -eq 1 ]]; then
        (
            while kill -0 "$chromium_pid" 2>/dev/null; do
                sleep 10
                if ! serves_home_interface; then
                    log "Vite stopped serving the UI; restarting Chromium and Vite"
                    kill "$chromium_pid" 2>/dev/null || true
                    exit 0
                fi
            done
        ) &
        monitor_pid=$!
    fi

    wait "$chromium_pid" 2>/dev/null
    status=$?
    chromium_pid=""
    if [[ -n "$monitor_pid" ]]; then
        kill "$monitor_pid" 2>/dev/null || true
        wait "$monitor_pid" 2>/dev/null || true
        monitor_pid=""
    fi
    log "Chromium exited with status $status; relaunching in 3 seconds"
    sleep 3
done
