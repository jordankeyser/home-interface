#!/usr/bin/env bash
# Read-only snapshot for diagnosing a panel that did not boot correctly.

set -u

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/home-interface"
mkdir -p "$STATE_DIR"

section() { echo; echo "=== $* ==="; }

section "version"
date
git -C "$APP_DIR" log --oneline -1 2>&1

section "session"
printf 'type=%s wayland=%s display=%s\n' \
    "${XDG_SESSION_TYPE:-unset}" "${WAYLAND_DISPLAY:-unset}" "${DISPLAY:-unset}"

section "launch configuration"
systemctl is-enabled home-interface-kiosk.service 2>&1 || true
grep -n 'kiosk-start.sh' \
    "$HOME/.config/labwc/autostart" \
    "$HOME/.xinitrc" \
    "$HOME/.config/lxsession/LXDE-pi/autostart" 2>/dev/null || true

section "touch configuration"
grep -n 'mouseEmulation' "$HOME/.config/labwc/rc.xml" 2>/dev/null || true

section "processes"
pgrep -af 'kiosk-start|vite|chromium' 2>/dev/null || true

section "port 5173"
ss -ltnp 2>/dev/null | grep ':5173' || true
if curl -fsS --max-time 3 http://127.0.0.1:5173/ >"$STATE_DIR/diagnose-index.html"; then
    grep -E '<title>|id="root"' "$STATE_DIR/diagnose-index.html" || true
else
    echo "No UI response from 127.0.0.1:5173"
fi

section "kiosk log"
tail -80 "$STATE_DIR/kiosk.log" 2>/dev/null || echo "No kiosk log"

section "Vite log"
tail -80 "$STATE_DIR/vite.log" 2>/dev/null || echo "No Vite log"
