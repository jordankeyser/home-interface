#!/usr/bin/env bash
#
# Undoes the boot-wiring changes the 1.0 installers made, returning the Pi to the
# mechanism that worked before: tty1 autologin -> ~/.bash_profile runs startx ->
# ~/.xinitrc -> pi-setup/kiosk-start.sh -> Vite on :5173 -> Chromium.
#
# A git checkout can restore the scripts but not the system state, which is why
# this exists. Run it once, then reboot.
#
# It reverses, specifically:
#   - systemd default target set to graphical.target      -> multi-user.target
#   - tty1 autologin drop-in removed                      -> reinstated
#   - `startx` in ~/.bash_profile replaced with `true`     -> restored
#   - ~/.xinitrc deleted                                  -> recreated
#   - kiosk launched from ~/.config/labwc/autostart        -> removed
#   - home-interface-server.service / -kiosk.service       -> removed
set -euo pipefail

KIOSK_USER="$(id -un)"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [[ "$KIOSK_USER" == "root" ]]; then
    echo "ERROR: run as your normal login user, not root."
    exit 1
fi

echo "Restoring the pre-1.0 boot path"
echo "  user:    $KIOSK_USER"
echo "  app dir: $APP_DIR"
echo ""
read -r -p "Continue? [y/N] " reply
[[ "$reply" =~ ^[Yy]$ ]] || exit 1

step() { echo ""; echo "--- $* ---"; }

step "Removing the 1.0 systemd units"
for unit in home-interface-server home-interface-kiosk; do
    if [[ -e "/etc/systemd/system/$unit.service" ]]; then
        sudo systemctl disable --now "$unit.service" 2>/dev/null || true
        sudo rm -f "/etc/systemd/system/$unit.service"
        echo "  removed $unit.service"
    fi
done
sudo systemctl daemon-reload

step "Stopping stray processes"
pkill -f 'server/index.js' 2>/dev/null || true
pkill -f 'displayServer\.js' 2>/dev/null || true
echo "  done"

step "Removing the kiosk entry from desktop-session autostart"
for f in "$HOME/.config/labwc/autostart" \
    "$HOME/.config/lxsession/LXDE-pi/autostart"; do
    if [[ -f "$f" ]] && grep -q 'kiosk-start.sh' "$f"; then
        grep -v 'kiosk-start.sh' "$f" >"$f.tmp" || true
        mv "$f.tmp" "$f"
        echo "  cleaned $f"
    fi
done
if [[ -f "$HOME/.config/wayfire.ini" ]]; then
    sed -i '/home_interface/d' "$HOME/.config/wayfire.ini"
fi
echo "  done"

step "Booting to the console again (multi-user.target)"
sudo systemctl set-default multi-user.target
echo "  default target: $(systemctl get-default)"

step "Reinstating tty1 autologin"
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF
sudo systemctl daemon-reload
echo "  done"

step "Restoring startx in ~/.bash_profile"
touch "$HOME/.bash_profile"
if grep -q 'startx disabled by home-interface installer' "$HOME/.bash_profile"; then
    # Undo the `true  # startx disabled ...` substitution.
    sed -i 's|^\([[:space:]]*\)true[[:space:]]*# startx disabled by home-interface installer.*|\1startx|' \
        "$HOME/.bash_profile"
    echo "  re-enabled the existing startx line"
elif grep -qE '^[[:space:]]*(exec[[:space:]]+)?startx' "$HOME/.bash_profile"; then
    echo "  already present"
else
    cat >>"$HOME/.bash_profile" <<'EOF'

# Auto-start X server on login (tty1 only)
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    startx
fi
EOF
    echo "  added the startx block"
fi

step "Recreating ~/.xinitrc"
cat >"$HOME/.xinitrc" <<EOF
#!/bin/bash
# Start the kiosk on X server launch
exec $APP_DIR/pi-setup/kiosk-start.sh
EOF
chmod +x "$HOME/.xinitrc"
echo "  wrote ~/.xinitrc"

step "Making sure X and the kiosk have what they need"
sudo apt-get install -y xserver-xorg xinit x11-xserver-utils unclutter
mkdir -p "$APP_DIR/logs"
chmod +x "$APP_DIR"/pi-setup/*.sh
echo "  done"

echo ""
echo "========================================="
echo " Restored. Reboot to start the kiosk:"
echo ""
echo "   sudo reboot"
echo "========================================="
echo ""
echo "After boot, the panel runs Vite on :5173 and Chromium in kiosk mode,"
echo "exactly as it did before the 1.0 rewrite."
echo ""
echo "Logs: $APP_DIR/logs/vite.log"
echo ""
echo "Note: server/displayServer.js is not started by anything (it never was),"
echo "so the backlight is not controlled and Sleep only blanks the screen."
echo "Ask before wiring it up — that is a separate change."
