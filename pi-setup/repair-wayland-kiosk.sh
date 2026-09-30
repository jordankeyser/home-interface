#!/usr/bin/env bash
# One-time repair for the Raspberry Pi OS Trixie + labwc installation.
#
# The repository historically installed the kiosk through systemd, ~/.xinitrc,
# and desktop autostart at different times. Those launchers can coexist after a
# git rollback because system configuration is outside the repository. This
# script leaves exactly one owner: labwc's user-session autostart.

set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
    echo "ERROR: run this as your normal login user, not with sudo."
    exit 1
fi

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="$HOME/.local/state/home-interface/repair-backup-$(date +%Y%m%d-%H%M%S)-$$"
LABWC_AUTOSTART="$HOME/.config/labwc/autostart"
LAUNCH_CMD="$APP_DIR/pi-setup/kiosk-start.sh"

mkdir -p "$BACKUP_DIR" "$(dirname "$LABWC_AUTOSTART")" "$APP_DIR/logs"
chmod +x "$APP_DIR"/pi-setup/*.sh

echo "Repairing Home Interface startup"
echo "  app:    $APP_DIR"
echo "  backup: $BACKUP_DIR"

backup_if_present() {
    local path="$1"
    if [[ -e "$path" ]]; then
        cp -a "$path" "$BACKUP_DIR/$(basename "$path")"
    fi
}

backup_if_present "$LABWC_AUTOSTART"
backup_if_present "$HOME/.xinitrc"
backup_if_present "$HOME/.bash_profile"

echo "Removing duplicate system kiosk unit"
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl disable --now home-interface-kiosk.service 2>/dev/null || true
    sudo rm -f /etc/systemd/system/home-interface-kiosk.service
    sudo systemctl daemon-reload
    sudo systemctl set-default graphical.target >/dev/null
fi

echo "Removing older desktop-session launch entries"
for file in \
    "$HOME/.config/labwc/autostart" \
    "$HOME/.config/lxsession/LXDE-pi/autostart"; do
    if [[ -f "$file" ]]; then
        grep -v 'home-interface.*/pi-setup/kiosk-start\.sh' "$file" >"$file.tmp" || true
        mv "$file.tmp" "$file"
    fi
done
if [[ -f "$HOME/.config/wayfire.ini" ]]; then
    sed '/home_interface/d' "$HOME/.config/wayfire.ini" >"$HOME/.config/wayfire.ini.tmp"
    mv "$HOME/.config/wayfire.ini.tmp" "$HOME/.config/wayfire.ini"
fi
if [[ -f "$HOME/.xinitrc" ]] && grep -q 'pi-setup/kiosk-start\.sh' "$HOME/.xinitrc"; then
    grep -v 'pi-setup/kiosk-start\.sh' "$HOME/.xinitrc" >"$HOME/.xinitrc.tmp" || true
    mv "$HOME/.xinitrc.tmp" "$HOME/.xinitrc"
fi
if [[ -f "$HOME/.bash_profile" ]] && grep -q 'Auto-start X server on login' "$HOME/.bash_profile"; then
    sed '/^# Auto-start X server on login (tty1 only)$/,/^fi$/d' \
        "$HOME/.bash_profile" >"$HOME/.bash_profile.tmp"
    mv "$HOME/.bash_profile.tmp" "$HOME/.bash_profile"
fi

echo "Installing one labwc autostart entry"
{
    [[ -s "$LABWC_AUTOSTART" ]] && cat "$LABWC_AUTOSTART"
    printf '\n%s &\n' "$LAUNCH_CMD"
} >"$LABWC_AUTOSTART.tmp"
mv "$LABWC_AUTOSTART.tmp" "$LABWC_AUTOSTART"

# Keep the touchscreen fix. Do not overwrite the file; only correct an old
# value if Raspberry Pi's screen configuration tool changed it back.
if [[ -f "$HOME/.config/labwc/rc.xml" ]]; then
    sed 's/mouseEmulation="yes"/mouseEmulation="no"/g' \
        "$HOME/.config/labwc/rc.xml" >"$HOME/.config/labwc/rc.xml.tmp"
    mv "$HOME/.config/labwc/rc.xml.tmp" "$HOME/.config/labwc/rc.xml"
fi

echo "Stopping stale launchers; the desktop will restart them after reboot"
pkill -f "$APP_DIR/node_modules/.bin/vite" 2>/dev/null || true
pkill -f 'vite.*5173' 2>/dev/null || true
pkill -f 'pi-setup/kiosk-start\.sh' 2>/dev/null || true

echo
echo "Repair complete. Reboot now:"
echo "  sudo reboot"
echo
echo "After boot, there will be exactly one launcher. Logs:"
echo "  $HOME/.local/state/home-interface/kiosk.log"
echo "  $HOME/.local/state/home-interface/vite.log"
