#!/usr/bin/env bash
#
# One-time Raspberry Pi kiosk setup for Home Interface.
#
# Changes vs. the previous version:
#   - user and paths are detected, not hardcoded to /home/jordankeyser/Desktop
#   - installs a unit for the control server, which previously was never started
#     by anything, so sleep/wake/backlight/shutdown silently did nothing
#   - installs the udev rule and sudoers drop-in that backlight and shutdown
#     actually require
#   - writes /boot/firmware/cmdline.txt on Bookworm (the old path silently
#     no-ops on current Pi OS)
#   - single boot path (systemd), instead of systemd AND .xinitrc both launching
#     the kiosk
set -euo pipefail

KIOSK_USER="${KIOSK_USER:-$(id -un)}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [[ "$KIOSK_USER" == "root" ]]; then
    echo "ERROR: run this as your normal login user, not root (it will sudo as needed)."
    exit 1
fi

echo "========================================="
echo " Home Interface kiosk setup"
echo "========================================="
echo "  user:    $KIOSK_USER"
echo "  app dir: $APP_DIR"
echo ""
read -r -p "Continue? [y/N] " reply
[[ "$reply" =~ ^[Yy]$ ]] || exit 1

step() { echo ""; echo "--- $* ---"; }

step "Installing system packages"
sudo apt-get update
if apt-cache policy chromium-browser 2>/dev/null | grep -q "Candidate: [0-9]"; then
    CHROMIUM_PKG=chromium-browser
else
    CHROMIUM_PKG=chromium
fi
sudo apt-get install -y \
    "$CHROMIUM_PKG" \
    unclutter \
    x11-xserver-utils \
    xserver-xorg \
    xinit \
    git \
    curl

step "Checking Node.js"
if ! command -v node >/dev/null 2>&1 ||
    [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]]; then
    echo "Installing Node.js ${NODE_MAJOR}.x ..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "node $(node --version)"

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
# Home Interface: power controls and service restarts from the dashboard.
$KIOSK_USER ALL=(root) NOPASSWD: /sbin/shutdown, /sbin/reboot
$KIOSK_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart home-interface-server.service
$KIOSK_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart home-interface-kiosk.service
EOF
sudo chmod 0440 /etc/sudoers.d/home-interface
sudo visudo -cf /etc/sudoers.d/home-interface

step "Installing systemd units"
for unit in home-interface-server home-interface-kiosk; do
    sed -e "s|__USER__|$KIOSK_USER|g" -e "s|__APP_DIR__|$APP_DIR|g" \
        "$APP_DIR/pi-setup/$unit.service" |
        sudo tee "/etc/systemd/system/$unit.service" >/dev/null
    echo "  installed $unit.service"
done
sudo systemctl daemon-reload
sudo systemctl enable home-interface-server.service
sudo systemctl enable home-interface-kiosk.service

step "Scheduling daily updates (3:30 AM)"
CRON_LINE="30 3 * * * $APP_DIR/pi-setup/daily-update.sh"
(crontab -l 2>/dev/null | grep -v 'daily-update.sh'; echo "$CRON_LINE") | crontab -

step "Configuring auto-login to the graphical target"
sudo raspi-config nonint do_boot_behaviour B4 2>/dev/null ||
    echo "  raspi-config unavailable — set desktop autologin manually."

step "Quieting the boot messages"
# Bookworm moved this file; the old script wrote the pre-Bookworm path and
# silently did nothing.
CMDLINE=/boot/firmware/cmdline.txt
[[ -f "$CMDLINE" ]] || CMDLINE=/boot/cmdline.txt
if [[ -f "$CMDLINE" ]]; then
    if ! grep -q "logo.nologo" "$CMDLINE"; then
        sudo sed -i '1 s/$/ quiet loglevel=3 logo.nologo vt.global_cursor_default=0/' "$CMDLINE"
        echo "  updated $CMDLINE"
    else
        echo "  $CMDLINE already configured"
    fi
else
    echo "  WARNING: no cmdline.txt found; skipping"
fi

# The old install also wrote ~/.xinitrc launching the kiosk, so both X init and
# systemd started Chromium. Remove it if this machine still has it.
if [[ -f "$HOME/.xinitrc" ]] && grep -q "kiosk-start.sh" "$HOME/.xinitrc"; then
    mv "$HOME/.xinitrc" "$HOME/.xinitrc.home-interface.bak"
    echo "  moved conflicting ~/.xinitrc aside (systemd owns startup now)"
fi

echo ""
echo "========================================="
echo " Done."
echo "========================================="
cat <<EOF

Reboot to start the kiosk:   sudo reboot

Useful commands:
  systemctl status home-interface-server
  systemctl status home-interface-kiosk
  journalctl -u home-interface-server -f
  curl -s localhost:3001/healthz | python3 -m json.tool
  tail -f $APP_DIR/logs/update.log

You are now in the 'video' group; log out and back in (or reboot) for backlight
control to take effect.

Configure API keys via the gear icon on the panel itself.
EOF
