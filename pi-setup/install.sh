#!/usr/bin/env bash
# One-time Raspberry Pi OS Trixie + labwc setup for Home Interface.
#
# The kiosk must start inside the graphical user session. A system service is
# deliberately not used for Chromium: it races the desktop and was the source
# of the recurring unreachable/white panel.

set -euo pipefail

KIOSK_USER="${KIOSK_USER:-$(id -un)}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [[ "$KIOSK_USER" == "root" ]]; then
    echo "ERROR: run this as the normal desktop user, not with sudo."
    exit 1
fi

step() { echo; echo "--- $* ---"; }

node_is_supported() {
    command -v node >/dev/null 2>&1 || return 1
    node -e '
      const [major, minor] = process.versions.node.split(".").map(Number);
      process.exit(
        (major === 20 && minor >= 19) ||
        (major === 22 && minor >= 12) ||
        major > 22 ? 0 : 1
      );
    '
}

echo "========================================="
echo " Home Interface kiosk setup"
echo "========================================="
echo "  user:    $KIOSK_USER"
echo "  app dir: $APP_DIR"

step "Installing system packages"
sudo apt-get update
if apt-cache policy chromium-browser 2>/dev/null | grep -q "Candidate:.*[0-9]"; then
    CHROMIUM_PKG="chromium-browser"
else
    CHROMIUM_PKG="chromium"
fi
sudo apt-get install -y \
    "$CHROMIUM_PKG" \
    ca-certificates \
    curl \
    git \
    unclutter \
    x11-xserver-utils

step "Checking Node.js"
if ! node_is_supported; then
    echo "Installing a Vite-compatible Node.js 20 release..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
if ! node_is_supported; then
    echo "ERROR: Node.js 20.19+, 22.12+, or a newer release is required."
    echo "       Found: $(node --version 2>/dev/null || echo missing)"
    exit 1
fi
echo "  node $(node --version)"
echo "  npm  $(npm --version)"

step "Installing and validating the dashboard"
cd "$APP_DIR"
npm install
npm run lint
npm run build
mkdir -p "$APP_DIR/logs"
chmod +x "$APP_DIR"/pi-setup/*.sh

step "Installing the single labwc launch path"
"$APP_DIR/pi-setup/repair-wayland-kiosk.sh"

step "Allowing validated updates to reboot cleanly"
echo "$KIOSK_USER ALL=(root) NOPASSWD: /sbin/shutdown" | \
    sudo tee /etc/sudoers.d/home-interface-updater >/dev/null
sudo chmod 0440 /etc/sudoers.d/home-interface-updater
sudo visudo -cf /etc/sudoers.d/home-interface-updater

step "Scheduling validated updates at 3:30 AM"
CRON_JOB="30 3 * * * $APP_DIR/pi-setup/daily-update.sh"
(
    crontab -l 2>/dev/null | grep -v "daily-update.sh" || true
    echo "$CRON_JOB"
) | crontab -

step "Quieting boot messages"
CMDLINE="/boot/firmware/cmdline.txt"
[[ -f "$CMDLINE" ]] || CMDLINE="/boot/cmdline.txt"
if [[ -f "$CMDLINE" ]]; then
    if ! grep -q "logo.nologo" "$CMDLINE"; then
        sudo sed -i '1 s/$/ quiet loglevel=3 logo.nologo vt.global_cursor_default=0/' "$CMDLINE"
    fi
else
    echo "  No cmdline.txt found; skipping."
fi

echo
echo "========================================="
echo " Setup complete"
echo "========================================="
echo
echo "Reboot once so the repaired labwc session owns the kiosk:"
echo "  sudo reboot"
echo
echo "Logs:"
echo "  $HOME/.local/state/home-interface/kiosk.log"
echo "  $HOME/.local/state/home-interface/vite.log"
echo
echo "If startup still fails:"
echo "  $APP_DIR/pi-setup/diagnose-kiosk.sh"
