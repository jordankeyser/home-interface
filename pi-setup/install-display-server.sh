#!/usr/bin/env bash
#
# Installs the display control server so Sleep actually cuts the backlight.
#
# Scoped deliberately narrowly: this touches ONLY the display server. It does not
# change the boot path, the kiosk script, autologin, the default systemd target,
# or anything else the panel needs to come up. If it fails, the dashboard keeps
# working exactly as it does now — Sleep just blanks the screen without cutting
# the backlight, which is the current behaviour anyway.
#
# Safe to re-run.
set -euo pipefail

KIOSK_USER="$(id -un)"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
NODE_BIN="$(command -v node || echo /usr/bin/node)"
PORT=3001

if [[ "$KIOSK_USER" == "root" ]]; then
    echo "ERROR: run as your normal login user, not root (it sudos as needed)."
    exit 1
fi

step() { echo ""; echo "--- $* ---"; }

echo "========================================="
echo " Display control server setup"
echo "========================================="
echo "  user:    $KIOSK_USER"
echo "  app dir: $APP_DIR"
echo "  node:    $NODE_BIN"
echo ""
echo "  This only installs the backlight/shutdown service."
echo "  The kiosk boot path is not touched."
echo ""
read -r -p "Continue? [y/N] " reply
[[ "$reply" =~ ^[Yy]$ ]] || exit 1

step "Checking for a backlight device"
FOUND=""
for bl in /sys/class/backlight/*/brightness; do
    [[ -e "$bl" ]] || continue
    FOUND="$bl"
    echo "  $bl (max $(cat "$(dirname "$bl")/max_brightness" 2>/dev/null || echo '?'))"
done
if [[ -z "$FOUND" ]]; then
    echo "  none found — the server will fall back to vcgencmd, then xset dpms."
    echo "  Note DPMS can also cut power to the touch digitiser on some panels."
fi

step "Granting backlight write access"
sudo tee /etc/udev/rules.d/90-backlight.rules >/dev/null <<'EOF'
# Allow the video group to control panel brightness, so the display server can
# write it directly instead of shelling out to `sudo tee`.
SUBSYSTEM=="backlight", ACTION=="add", \
  RUN+="/bin/chgrp video /sys/class/backlight/%k/brightness", \
  RUN+="/bin/chmod g+w /sys/class/backlight/%k/brightness"
EOF
sudo usermod -aG video "$KIOSK_USER"
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=backlight || true

# Apply to devices that already exist, so no reboot is needed for this part.
for bl in /sys/class/backlight/*/brightness; do
    [[ -e "$bl" ]] || continue
    sudo chgrp video "$bl"
    sudo chmod g+w "$bl"
    echo "  $bl -> group video, writable"
done

step "Allowing shutdown without a password"
sudo tee /etc/sudoers.d/home-interface >/dev/null <<EOF
# Home Interface: shutdown from the dashboard's Power section.
$KIOSK_USER ALL=(root) NOPASSWD: /sbin/shutdown
EOF
sudo chmod 0440 /etc/sudoers.d/home-interface
sudo visudo -cf /etc/sudoers.d/home-interface

step "Clearing anything already on port $PORT"
# An older hand-started displayServer.js keeps running after a code change and
# would stop the service binding.
if pgrep -f 'displayServer\.js' >/dev/null 2>&1; then
    echo "  stopping existing displayServer.js:"
    pgrep -af 'displayServer\.js' | sed 's/^/    /'
    pkill -f 'displayServer\.js' || true
    sleep 1
fi
if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -qE "[.:]$PORT\b"; then
    echo "  WARNING: something is still listening on $PORT:"
    sudo ss -ltnp 2>/dev/null | grep ":$PORT" | sed 's/^/    /'
    echo "  The service will fail to bind until that is stopped."
fi

step "Installing the systemd service"
sed -e "s|__USER__|$KIOSK_USER|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__NODE__|$NODE_BIN|g" \
    "$APP_DIR/pi-setup/home-interface-display.service" |
    sudo tee /etc/systemd/system/home-interface-display.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable home-interface-display.service
sudo systemctl restart home-interface-display.service

step "Verifying"
sleep 2
if HEALTH=$(curl -fsS --max-time 3 "http://127.0.0.1:$PORT/healthz" 2>/dev/null); then
    echo "  service is responding:"
    echo "    $HEALTH"

    if echo "$HEALTH" | grep -q '"writable":true'; then
        echo ""
        echo "  Testing the backlight (off for 1s, then back on)..."
        curl -fsS -X POST "http://127.0.0.1:$PORT/display/off" >/dev/null && sleep 1
        curl -fsS -X POST "http://127.0.0.1:$PORT/display/on" >/dev/null
        echo "  If the panel blinked, backlight control is working."
    elif echo "$HEALTH" | grep -q '"backlight":null'; then
        echo "  No sysfs backlight; using vcgencmd/xset fallbacks."
    else
        echo ""
        echo "  NOTE: the backlight file is not writable by this service yet."
        echo "  Group membership applies at next login — reboot to finish:"
        echo "    sudo reboot"
    fi
else
    echo "  ERROR: service is not responding. Check:"
    echo "    systemctl status home-interface-display"
    echo "    journalctl -u home-interface-display -n 30 --no-pager"
    echo ""
    echo "  The dashboard is unaffected by this failure."
    exit 1
fi

echo ""
echo "========================================="
echo " Done."
echo "========================================="
cat <<EOF

Sleep now cuts the backlight. Touch the panel to wake it.

  systemctl status home-interface-display
  journalctl -u home-interface-display -f
  curl -s localhost:$PORT/healthz

Idle timeout is set in Settings (Never / 3m / 10m / 30m).
EOF
