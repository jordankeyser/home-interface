#!/usr/bin/env bash
#
# One-time Raspberry Pi kiosk setup for Home Interface.
#
# Two independent pieces:
#   * home-interface-server.service — systemd, runs at multi-user.target, needs
#     no display. Serves the build, proxies the CTA API, drives the backlight.
#   * the kiosk itself — launched by whatever session mechanism this image
#     actually uses. Detected below rather than assumed; a kiosk systemd unit
#     bound to graphical.target cannot reach a user session and never fires on
#     a console/Lite image.
set -euo pipefail

KIOSK_USER="${KIOSK_USER:-$(id -un)}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [[ "$KIOSK_USER" == "root" ]]; then
    echo "ERROR: run as your normal login user, not root (it sudos as needed)."
    exit 1
fi

step() { echo ""; echo "--- $* ---"; }

# --- detect how this image starts a graphical session ----------------------
detect_launcher() {
    if command -v labwc >/dev/null 2>&1 && [[ -d "$HOME/.config/labwc" ]]; then
        echo labwc
    elif command -v wayfire >/dev/null 2>&1; then
        echo wayfire
    elif command -v startlxde-pi >/dev/null 2>&1 || [[ -d "$HOME/.config/lxsession" ]]; then
        echo lxde
    elif command -v labwc >/dev/null 2>&1; then
        echo labwc
    else
        # No desktop session: X started from a tty1 login. This is what the
        # original setup used and what a Lite image gives you.
        echo xinit
    fi
}

LAUNCHER="${LAUNCHER:-$(detect_launcher)}"

echo "========================================="
echo " Home Interface kiosk setup"
echo "========================================="
echo "  user:     $KIOSK_USER"
echo "  app dir:  $APP_DIR"
echo "  launcher: $LAUNCHER"
echo ""
echo "  (override with LAUNCHER=xinit|labwc|wayfire|lxde ./pi-setup/install.sh)"
echo ""
read -r -p "Continue? [y/N] " reply
[[ "$reply" =~ ^[Yy]$ ]] || exit 1

step "Installing system packages"
sudo apt-get update
if apt-cache policy chromium-browser 2>/dev/null | grep -q "Candidate: [0-9]"; then
    CHROMIUM_PKG=chromium-browser
else
    CHROMIUM_PKG=chromium
fi
PACKAGES=("$CHROMIUM_PKG" git curl)
if [[ "$LAUNCHER" == "xinit" || "$LAUNCHER" == "lxde" ]]; then
    PACKAGES+=(xserver-xorg xinit x11-xserver-utils unclutter)
fi
sudo apt-get install -y "${PACKAGES[@]}"

step "Checking Node.js"
if ! command -v node >/dev/null 2>&1 ||
    [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]]; then
    echo "Installing Node.js ${NODE_MAJOR}.x ..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
    sudo apt-get install -y nodejs
fi
NODE_BIN="$(command -v node)"
echo "node $(node --version) at $NODE_BIN"

step "Installing app dependencies and building"
cd "$APP_DIR"
npm install
npm run build
mkdir -p "$APP_DIR/logs"
chmod +x "$APP_DIR"/pi-setup/*.sh

step "Granting backlight access (udev)"
# Lets the control server set brightness with a plain file write instead of
# shelling out to `echo … | sudo tee …`.
sudo tee /etc/udev/rules.d/90-backlight.rules >/dev/null <<'EOF'
# Allow the video group to control panel brightness.
SUBSYSTEM=="backlight", ACTION=="add", \
  RUN+="/bin/chgrp video /sys/class/backlight/%k/brightness", \
  RUN+="/bin/chmod g+w /sys/class/backlight/%k/brightness"
EOF
sudo usermod -aG video "$KIOSK_USER"
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=backlight || true

# Apply to any already-present backlight so a reboot isn't required.
for bl in /sys/class/backlight/*/brightness; do
    [[ -e "$bl" ]] || continue
    sudo chgrp video "$bl" && sudo chmod g+w "$bl"
    echo "  backlight: $bl"
done

step "Allowing shutdown/reboot without a password"
sudo tee /etc/sudoers.d/home-interface >/dev/null <<EOF
# Home Interface: power controls and service restart from the dashboard.
$KIOSK_USER ALL=(root) NOPASSWD: /sbin/shutdown, /sbin/reboot
$KIOSK_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart home-interface-server.service
EOF
sudo chmod 0440 /etc/sudoers.d/home-interface
sudo visudo -cf /etc/sudoers.d/home-interface

step "Installing the control server service"
sed -e "s|__USER__|$KIOSK_USER|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__NODE__|$NODE_BIN|g" \
    "$APP_DIR/pi-setup/home-interface-server.service" |
    sudo tee /etc/systemd/system/home-interface-server.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable home-interface-server.service
sudo systemctl restart home-interface-server.service

# Give it a moment, then confirm — a silent failure here is what made display
# control appear to "do nothing" in the previous setup.
sleep 2
if curl -fsS --max-time 3 http://127.0.0.1:3001/healthz >/dev/null 2>&1; then
    echo "  control server responding on 127.0.0.1:3001"
else
    echo "  WARNING: control server did not respond. Check:"
    echo "    journalctl -u home-interface-server -n 40"
fi

# A kiosk unit bound to graphical.target was installed by earlier versions of
# this script. It cannot reach a user session, so remove it rather than leave it
# restart-looping.
if [[ -e /etc/systemd/system/home-interface-kiosk.service ]]; then
    step "Removing the obsolete kiosk systemd unit"
    sudo systemctl disable --now home-interface-kiosk.service 2>/dev/null || true
    sudo rm -f /etc/systemd/system/home-interface-kiosk.service
    sudo systemctl daemon-reload
    echo "  removed (the session launcher below owns startup now)"
fi

step "Wiring kiosk startup ($LAUNCHER)"
KIOSK_CMD="$APP_DIR/pi-setup/kiosk-start.sh"

# Remove every launcher hook first, then add back only the chosen one. Leaving
# stale hooks in place starts several Chromium instances against different
# displays at once — a console X server on :0 racing the desktop session on :1.
clear_launcher_hooks() {
    rm -f "$HOME/.xinitrc" "$HOME/.xinitrc.home-interface.bak"

    # Neuter any startx-on-login block without breaking the enclosing if/fi
    # (an emptied if body is a shell syntax error, which would break login).
    if [[ -f "$HOME/.bash_profile" ]] && grep -q startx "$HOME/.bash_profile" 2>/dev/null; then
        sed -i 's|^\([[:space:]]*\)\(exec[[:space:]]\+\)\?startx.*|\1true  # startx disabled by home-interface installer|' \
            "$HOME/.bash_profile"
    fi

    for f in "$HOME/.config/labwc/autostart" \
        "$HOME/.config/lxsession/LXDE-pi/autostart"; do
        [[ -f "$f" ]] || continue
        grep -v 'kiosk-start.sh' "$f" >"$f.tmp" 2>/dev/null || true
        mv "$f.tmp" "$f"
    done

    [[ -f "$HOME/.config/wayfire.ini" ]] &&
        sed -i '/home_interface/d' "$HOME/.config/wayfire.ini"

    # tty1 autologin belongs to the console path only; a display manager does
    # its own autologin and the two fight over the console.
    if [[ "$LAUNCHER" != "xinit" ]] &&
        [[ -e /etc/systemd/system/display-manager.service ]] &&
        [[ -f /etc/systemd/system/getty@tty1.service.d/autologin.conf ]]; then
        sudo rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf
        sudo systemctl daemon-reload
        echo "  removed tty1 autologin (lightdm handles login on this image)"
    fi

    return 0
}

clear_launcher_hooks
echo "  cleared previous launcher hooks"

case "$LAUNCHER" in
xinit)
    # tty1 autologin -> .bash_profile runs startx -> .xinitrc execs the kiosk.
    # This is the mechanism the original install used and what works on an
    # image with no desktop session.
    sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
    sudo tee /etc/systemd/system/getty@tty1.service.d/autologin.conf >/dev/null <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF
    sudo systemctl set-default multi-user.target
    sudo systemctl daemon-reload
    echo "  tty1 autologin configured"

    # Match our marker, not bare "startx": clear_launcher_hooks leaves a
    # "startx disabled by ..." comment behind, which a bare grep would match.
    if ! grep -q "home-interface: autostart X" "$HOME/.bash_profile" 2>/dev/null; then
        cat >>"$HOME/.bash_profile" <<'EOF'

# home-interface: autostart X on tty1 login
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    exec startx
fi
EOF
        echo "  added startx to ~/.bash_profile"
    else
        echo "  ~/.bash_profile already configured"
    fi

    cat >"$HOME/.xinitrc" <<EOF
#!/bin/bash
# home-interface kiosk
exec $KIOSK_CMD
EOF
    chmod +x "$HOME/.xinitrc"
    echo "  wrote ~/.xinitrc"
    ;;

labwc)
    mkdir -p "$HOME/.config/labwc"
    AUTOSTART="$HOME/.config/labwc/autostart"
    touch "$AUTOSTART"
    grep -v 'kiosk-start.sh' "$AUTOSTART" >"$AUTOSTART.tmp" || true
    mv "$AUTOSTART.tmp" "$AUTOSTART"
    echo "$KIOSK_CMD &" >>"$AUTOSTART"
    chmod +x "$AUTOSTART"
    sudo systemctl set-default graphical.target
    echo "  wrote $AUTOSTART"
    ;;

wayfire)
    WF="$HOME/.config/wayfire.ini"
    touch "$WF"
    if ! grep -q '^\[autostart\]' "$WF"; then printf '\n[autostart]\n' >>"$WF"; fi
    if ! grep -q 'home_interface' "$WF"; then
        sed -i "/^\[autostart\]/a home_interface = $KIOSK_CMD" "$WF"
    fi
    sudo systemctl set-default graphical.target
    echo "  wrote $WF"
    ;;

lxde)
    mkdir -p "$HOME/.config/lxsession/LXDE-pi"
    AUTOSTART="$HOME/.config/lxsession/LXDE-pi/autostart"
    touch "$AUTOSTART"
    grep -v 'kiosk-start.sh' "$AUTOSTART" >"$AUTOSTART.tmp" || true
    mv "$AUTOSTART.tmp" "$AUTOSTART"
    {
        echo "@xset s off"
        echo "@xset -dpms"
        echo "@xset s noblank"
        echo "@$KIOSK_CMD"
    } >>"$AUTOSTART"
    sudo systemctl set-default graphical.target
    echo "  wrote $AUTOSTART"
    ;;

*)
    echo "  ERROR: unknown launcher '$LAUNCHER'"
    exit 1
    ;;
esac

step "Scheduling daily updates (3:30 AM)"
CRON_LINE="30 3 * * * $APP_DIR/pi-setup/daily-update.sh"
(
    crontab -l 2>/dev/null | grep -v 'daily-update.sh'
    echo "$CRON_LINE"
) | crontab -

step "Quieting the boot messages"
# Bookworm moved this file; the pre-Bookworm path silently no-ops on current OS.
CMDLINE=/boot/firmware/cmdline.txt
[[ -f "$CMDLINE" ]] || CMDLINE=/boot/cmdline.txt
if [[ -f "$CMDLINE" ]]; then
    if ! grep -q "logo.nologo" "$CMDLINE"; then
        sudo sed -i '1 s/$/ quiet loglevel=3 logo.nologo vt.global_cursor_default=0/' "$CMDLINE"
        echo "  updated $CMDLINE"
    else
        echo "  already configured"
    fi
else
    echo "  WARNING: no cmdline.txt found; skipping"
fi

echo ""
echo "========================================="
echo " Done — reboot to start the kiosk"
echo "========================================="
cat <<EOF

  sudo reboot

If the panel comes up blank, run this and paste the output:

  $APP_DIR/pi-setup/diagnose.sh

Useful commands:
  systemctl status home-interface-server
  journalctl -u home-interface-server -f
  curl -s localhost:3001/healthz
  tail -f \$HOME/.local/state/home-interface/kiosk.log

You were added to the 'video' group; that takes effect after the reboot.
Configure API keys from the gear icon on the panel.
EOF
