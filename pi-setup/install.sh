#!/bin/bash
# Installation Script for Home Interface Kiosk on Raspberry Pi
# Run this script once to set up the kiosk

set -e

echo "========================================="
echo "Home Interface Kiosk Setup"
echo "========================================="
echo ""

# Check if running as jordankeyser user
if [ "$USER" != "jordankeyser" ]; then
    echo "ERROR: This script must be run as the 'jordankeyser' user"
    exit 1
fi

# Update system
echo "Step 1: Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install required packages
echo "Step 2: Installing required packages..."

# Determine which Chromium package is available
if apt-cache policy chromium-browser 2>/dev/null | grep -q "Candidate:.*[0-9]"; then
    CHROMIUM_PKG="chromium-browser"
elif apt-cache policy chromium 2>/dev/null | grep -q "Candidate:.*[0-9]"; then
    CHROMIUM_PKG="chromium"
else
    echo "ERROR: Neither chromium-browser nor chromium package found"
    echo "Trying to install chromium anyway..."
    CHROMIUM_PKG="chromium"
fi

echo "Installing Chromium package: $CHROMIUM_PKG"

sudo apt install -y \
    $CHROMIUM_PKG \
    unclutter \
    xdotool \
    x11-xserver-utils \
    git \
    curl

# Install Node.js if not already installed
if ! command -v node &> /dev/null; then
    echo "Step 3: Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Step 3: Node.js already installed ($(node --version))"
fi

# Verify repository exists
if [ ! -d "/home/jordankeyser/Desktop/home-interface" ]; then
    echo "ERROR: Repository not found at /home/jordankeyser/Desktop/home-interface"
    echo "Please clone the repository first:"
    echo "  cd /home/jordankeyser/Desktop"
    echo "  git clone <your-repo-url> home-interface"
    exit 1
fi

cd /home/jordankeyser/Desktop/home-interface

# Install npm dependencies
echo "Step 4: Installing npm dependencies..."
npm install

# Create logs directory
echo "Step 5: Creating logs directory..."
mkdir -p /home/jordankeyser/Desktop/home-interface/logs

# Make scripts executable
echo "Step 6: Making scripts executable..."
chmod +x /home/jordankeyser/Desktop/home-interface/pi-setup/*.sh

# Set up the one supported launch path. Raspberry Pi OS Trixie runs labwc;
# starting the kiosk from both a system unit and the desktop session created the
# race behind the recurring white panel.
echo "Step 7: Configuring the labwc kiosk launcher..."
/home/jordankeyser/Desktop/home-interface/pi-setup/repair-wayland-kiosk.sh

# Set up daily update cron job
echo "Step 8: Setting up daily update cron job..."
CRON_JOB="0 3 * * * /home/jordankeyser/Desktop/home-interface/pi-setup/daily-update.sh"
(crontab -l 2>/dev/null | grep -v "daily-update.sh"; echo "$CRON_JOB") | crontab -

# Hide boot messages by configuring /boot/cmdline.txt
echo "Step 9: Configuring boot parameters..."
if ! grep -q "quiet splash" /boot/cmdline.txt 2>/dev/null; then
    sudo sed -i '$ s/$/ quiet splash loglevel=3 logo.nologo vt.global_cursor_default=0/' /boot/cmdline.txt
fi

echo ""
echo "========================================="
echo "Installation Complete!"
echo "========================================="
echo ""
echo "Configuration saved. To start the kiosk:"
echo "1. Option A: Reboot the Pi: sudo reboot"
echo "2. Option B: log out and back into the desktop session"
echo ""
echo "The kiosk will automatically:"
echo "- Start on boot"
echo "- Pull updates daily at 3 AM"
echo "- Start once from the labwc desktop session"
echo "- Restart Chromium if it crashes"
echo ""
echo "Useful commands:"
echo "- View logs: tail -f /home/jordankeyser/Desktop/home-interface/logs/vite.log"
echo "- View update logs: tail -f /home/jordankeyser/Desktop/home-interface/logs/update.log"
echo "- View launcher log: tail -f ~/.local/state/home-interface/kiosk.log"
echo ""
echo "To exit the kiosk once running, press: Alt+F4"
echo ""
