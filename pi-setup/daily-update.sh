#!/bin/bash
# Daily Update Script - Pulls latest changes from git
# This script runs once per day to update the application

REPO_DIR="/home/pi/home-interface"
LOG_FILE="/home/pi/home-interface/logs/update.log"

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

echo "----------------------------------------" >> "$LOG_FILE"
echo "Update check started at $(date)" >> "$LOG_FILE"

cd "$REPO_DIR" || exit 1

# Check if there are local changes
if [[ -n $(git status -s) ]]; then
    echo "WARNING: Local changes detected, skipping update" >> "$LOG_FILE"
    exit 0
fi

# Fetch latest changes
git fetch origin main >> "$LOG_FILE" 2>&1

# Check if update is available
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "Already up to date" >> "$LOG_FILE"
else
    echo "Updates found, pulling changes..." >> "$LOG_FILE"
    git pull origin main >> "$LOG_FILE" 2>&1
    
    # Install any new dependencies
    npm install >> "$LOG_FILE" 2>&1
    
    echo "Update completed successfully" >> "$LOG_FILE"
    echo "Restarting kiosk service..." >> "$LOG_FILE"
    
    # Restart the kiosk service to apply changes
    systemctl --user restart home-interface-kiosk.service >> "$LOG_FILE" 2>&1
fi

echo "Update check completed at $(date)" >> "$LOG_FILE"

