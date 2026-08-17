#!/usr/bin/env bash
#
# Prints everything needed to work out why the panel isn't showing the
# dashboard. Read-only — changes nothing.
#
#   ./pi-setup/diagnose.sh
set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

hr() { printf '\n=== %s %s\n' "$1" "$(printf '%.0s-' $(seq 1 $((60 - ${#1}))))"; }
have() { command -v "$1" >/dev/null 2>&1; }

hr "system"
echo "user:            $(id -un)  (groups: $(id -Gn))"
echo "app dir:         $APP_DIR"
echo "os:              $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME")"
echo "kernel:          $(uname -r)"
echo "node:            $(have node && echo "$(command -v node) $(node --version)" || echo 'NOT INSTALLED')"
echo "chromium:        $(have chromium-browser && command -v chromium-browser ||
    { have chromium && command -v chromium; } || echo 'NOT INSTALLED')"
echo "default target:  $(systemctl get-default 2>/dev/null)"
echo "display mgr:     $([[ -e /etc/systemd/system/display-manager.service ]] &&
    readlink -f /etc/systemd/system/display-manager.service || echo 'none')"

hr "startup mechanism"
echo "boot: which of these exists determines how the kiosk launches"
WIRED=0
for f in "$HOME/.xinitrc" \
    "$HOME/.config/labwc/autostart" \
    "$HOME/.config/wayfire.ini" \
    "$HOME/.config/lxsession/LXDE-pi/autostart"; do
    if [[ -e "$f" ]] && grep -q 'kiosk-start.sh\|home_interface' "$f" 2>/dev/null; then
        printf '  [x] %s   <- launches the kiosk\n' "$f"
        sed 's/^/        /' "$f" | grep -v '^[[:space:]]*$' | head -8
        WIRED=$((WIRED + 1))
    elif [[ -e "$f" ]]; then
        printf '  [-] %s   (exists, no kiosk entry)\n' "$f"
    else
        printf '  [ ] %s\n' "$f"
    fi
done
if ((WIRED > 1)); then
    echo ""
    echo "  *** $WIRED launchers are wired at once. They will race and start"
    echo "      several Chromium instances on different displays. Re-run"
    echo "      ./pi-setup/install.sh to clear the stale ones. ***"
fi

echo "  tty1 autologin:  $([[ -f /etc/systemd/system/getty@tty1.service.d/autologin.conf ]] &&
    echo yes || echo no)"
echo "  startx in .bash_profile: $(grep -q startx "$HOME/.bash_profile" 2>/dev/null &&
    echo yes || echo no)"
echo "  kiosk systemd unit: $([[ -e /etc/systemd/system/home-interface-kiosk.service ]] &&
    echo 'present (should be removed — it cannot reach a session)' || echo 'absent (correct)')"

hr "control server"
if have systemctl; then
    systemctl is-enabled home-interface-server.service 2>&1 | sed 's/^/enabled: /'
    systemctl is-active home-interface-server.service 2>&1 | sed 's/^/active:  /'
    systemctl status home-interface-server.service --no-pager -n 15 2>&1 | sed 's/^/  /' || true
else
    echo "systemctl not available on this host"
fi

hr "control server log (this is what to read if it is crash-looping)"
if have journalctl; then
    journalctl -u home-interface-server.service -n 40 --no-pager 2>&1 | sed 's/^/  /'
else
    echo "  journalctl not available"
fi

hr "port 3001"
if have ss; then
    LISTEN=$(sudo -n ss -ltnp 2>/dev/null | grep ':3001' ||
        ss -ltnp 2>/dev/null | grep ':3001' || true)
    if [[ -n "$LISTEN" ]]; then
        echo "$LISTEN" | sed 's/^/  /'
        if echo "$LISTEN" | grep -q 'displayServer'; then
            echo ""
            echo "  *** The pre-1.0 displayServer.js is holding the port. It keeps"
            echo "      running even though the file was deleted, so the new unit"
            echo "      crash-loops on EADDRINUSE. Fix:"
            echo "        pkill -f displayServer.js && ./pi-setup/install.sh ***"
        fi
    else
        echo "  nothing listening on 3001"
    fi
else
    echo "  ss not available"
fi
echo "  legacy displayServer processes: $(pgrep -af 'displayServer\.js' 2>/dev/null || echo none)"

hr "health endpoint"
if curl -fsS --max-time 3 http://127.0.0.1:3001/healthz 2>/dev/null; then
    echo ""
else
    echo "NOT RESPONDING on 127.0.0.1:3001"
fi

hr "build output"
if [[ -f "$APP_DIR/dist/index.html" ]]; then
    echo "dist/index.html present ($(find "$APP_DIR/dist" -type f | wc -l | tr -d ' ') files)"
else
    echo "dist/index.html MISSING — run: npm run build"
fi

hr "git state"
git -C "$APP_DIR" log --oneline -1 2>&1 | sed 's/^/head:  /'
DIRTY=$(git -C "$APP_DIR" status --porcelain 2>/dev/null)
if [[ -n "$DIRTY" ]]; then
    echo "tree:  DIRTY (this blocks auto-update)"
    echo "$DIRTY" | sed 's/^/         /'
else
    echo "tree:  clean"
fi

hr "backlight"
found=0
for bl in /sys/class/backlight/*/brightness; do
    [[ -e "$bl" ]] || continue
    found=1
    ls -l "$bl" | sed 's/^/  /'
    echo "    current: $(cat "$bl" 2>/dev/null || echo unreadable)"
    echo "    writable by me: $([[ -w "$bl" ]] && echo yes || echo 'NO — log out and back in for the video group')"
done
[[ $found -eq 0 ]] && echo "  no sysfs backlight (will fall back to vcgencmd/xset, on/off only)"

hr "power permissions"
if [[ -f /etc/sudoers.d/home-interface ]]; then
    sudo -n visudo -cf /etc/sudoers.d/home-interface 2>&1 | sed 's/^/  /' ||
        echo "  (needs sudo to validate)"
else
    echo "  /etc/sudoers.d/home-interface MISSING — shutdown/restart buttons won't work"
fi

hr "kiosk log"
KLOG="${LOG_DIR:-$HOME/.local/state/home-interface}/kiosk.log"
if [[ -f "$KLOG" ]]; then
    tail -25 "$KLOG" | sed 's/^/  /'
else
    echo "  no kiosk log at $KLOG — kiosk-start.sh has not run"
fi

hr "crontab"
crontab -l 2>/dev/null | grep -v '^#' | grep -v '^[[:space:]]*$' | sed 's/^/  /' ||
    echo "  (empty)"

hr "update log"
if [[ -f "$APP_DIR/logs/update.log" ]]; then
    tail -15 "$APP_DIR/logs/update.log" | sed 's/^/  /'
else
    echo "  none yet"
fi

hr "done"
echo "Paste this whole output if the panel is still blank."
