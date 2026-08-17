#!/usr/bin/env bash
#
# Launches Chromium against the local control server.
#
# It does NOT start a Vite dev server any more. The old version ran `npm start`
# (Vite dev, with HMR, a file watcher and unminified sources) as the production
# front-end on a Raspberry Pi, then slept 10 seconds hoping it was up.
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3001}"
READY_TIMEOUT="${READY_TIMEOUT:-90}"

log() { echo "[kiosk] $*"; }

# Wait for the control server (systemd starts it first, but ordering is not a
# readiness guarantee).
log "Waiting for ${APP_URL} ..."
deadline=$((SECONDS + READY_TIMEOUT))
until curl -fsS --max-time 2 "${APP_URL}/healthz" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
        log "ERROR: control server did not become ready within ${READY_TIMEOUT}s"
        log "       check: journalctl -u home-interface-server -n 50"
        exit 1
    fi
    sleep 1
done
log "Control server is up."

# Screen blanking and DPMS are handled in-app (idle sleep dims the backlight and
# keeps the touch digitiser alive), so X must not also blank the panel.
xset s off || true
xset -dpms || true
xset s noblank || true

# Hide the pointer when idle.
if command -v unclutter >/dev/null 2>&1; then
    unclutter -idle 2 -root &
fi

if command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM=chromium
else
    log "ERROR: chromium not found"
    exit 1
fi

# A persistent profile dir keeps the HTTP cache and localStorage (settings) so a
# restart doesn't refetch the bundle or lose configuration. The old flags sent
# the cache to /dev/null.
PROFILE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/home-interface-chromium"
mkdir -p "$PROFILE_DIR"

log "Launching ${CHROMIUM}"
exec "$CHROMIUM" \
    --kiosk \
    --user-data-dir="$PROFILE_DIR" \
    --app="$APP_URL" \
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
