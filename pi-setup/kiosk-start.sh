#!/bin/bash
# Kiosk Startup Script for Home Interface on Raspberry Pi
# This script launches the app in fullscreen kiosk mode

# Navigate to the app directory
cd /home/jordankeyser/Desktop/home-interface || exit 1

# The dashboard is local and must boot even when Wi-Fi, DNS, or the upstream
# internet is unavailable. Network-backed modules can show their offline state
# after the shell is visible; gating Chromium here leaves a blank panel forever.
mkdir -p logs

# Start the Vite development server in the background
echo "Starting Vite server..."
npm start > /home/jordankeyser/Desktop/home-interface/logs/vite.log 2>&1 &
VITE_PID=$!

# Wait for the server to be ready
echo "Waiting for server to start..."
for attempt in $(seq 1 30); do
    if curl -fsS --max-time 1 http://localhost:5173/ > /dev/null 2>&1; then
        break
    fi
    echo "Waiting for localhost:5173..."
    sleep 1
done

if ! curl -fsS --max-time 2 http://localhost:5173/ > /dev/null 2>&1; then
    echo "Vite failed to start; see logs/vite.log"
    exit 1
fi

echo "Server is ready! Launching kiosk..."

# Disable screen blanking and power management
xset s off
xset -dpms
xset s noblank

# Hide mouse cursor after 3 seconds of inactivity
unclutter -idle 3 &

# Launch Chromium in kiosk mode (try both command names)
if command -v chromium-browser &> /dev/null; then
    CHROMIUM_CMD="chromium-browser"
else
    CHROMIUM_CMD="chromium"
fi

$CHROMIUM_CMD \
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
