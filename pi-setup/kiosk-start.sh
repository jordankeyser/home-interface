#!/bin/bash
# Kiosk Startup Script for Home Interface on Raspberry Pi
# This script launches the app in fullscreen kiosk mode

# Wait for network to be ready
echo "Waiting for network connection..."
while ! ping -c 1 -W 1 8.8.8.8 > /dev/null 2>&1; do
    sleep 1
done
echo "Network is ready!"

# Navigate to the app directory
cd /home/pi/home-interface || exit 1

# Start the Vite development server in the background
echo "Starting Vite server..."
npm start > /home/pi/home-interface/logs/vite.log 2>&1 &
VITE_PID=$!

# Wait for the server to be ready
echo "Waiting for server to start..."
sleep 10

# Check if server is running
until curl -s http://localhost:5173 > /dev/null; do
    echo "Waiting for localhost:5173..."
    sleep 2
done

echo "Server is ready! Launching kiosk..."

# Disable screen blanking and power management
xset s off
xset -dpms
xset s noblank

# Hide mouse cursor after 3 seconds of inactivity
unclutter -idle 3 &

# Launch Chromium in kiosk mode
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --fast \
    --fast-start \
    --disable-features=TranslateUI \
    --disk-cache-dir=/dev/null \
    --overscroll-history-navigation=0 \
    --disable-pinch \
    --enable-features=OverlayScrollbar \
    --check-for-update-interval=31536000 \
    --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \
    http://localhost:5173

# If Chromium exits, kill the Vite server
kill $VITE_PID

