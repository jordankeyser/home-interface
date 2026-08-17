#!/usr/bin/env bash
#
# Pulls the latest code, rebuilds, and restarts the services.
#
# Fixes vs. the previous version:
#   - restarts the SYSTEM units (it used `systemctl --user`, which could never
#     work because install.sh installs into /etc/systemd/system)
#   - actually rebuilds; the app is now served from dist/, not a dev server
#   - a dirty working tree no longer silently disables updates forever
set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_FILE="${LOG_FILE:-$APP_DIR/logs/update.log}"
BRANCH="${BRANCH:-main}"
# Pass --force (or FORCE=1) to discard local edits and update anyway.
FORCE="${FORCE:-0}"
[[ "${1:-}" == "--force" ]] && FORCE=1

mkdir -p "$(dirname "$LOG_FILE")"
exec >>"$LOG_FILE" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "----- update check started -----"
cd "$APP_DIR" || { log "ERROR: cannot cd to $APP_DIR"; exit 1; }

if [[ -n "$(git status --porcelain)" ]]; then
    if [[ "$FORCE" == "1" ]]; then
        log "WARNING: discarding local changes (--force)"
        git reset --hard
        git clean -fd
    else
        log "WARNING: local changes present, skipping update."
        log "         Auto-update stays blocked until the tree is clean."
        log "         Files:"
        git status --porcelain | sed 's/^/           /'
        log "         Re-run with --force to discard them."
        exit 0
    fi
fi

git fetch origin "$BRANCH" || { log "ERROR: git fetch failed"; exit 1; }

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [[ "$LOCAL" == "$REMOTE" ]]; then
    log "Already up to date ($(git rev-parse --short HEAD))."
    exit 0
fi

log "Updating ${LOCAL:0:7} -> ${REMOTE:0:7}"
git merge --ff-only "origin/$BRANCH" || { log "ERROR: fast-forward failed"; exit 1; }

log "Installing dependencies..."
npm ci --omit=dev 2>/dev/null || npm install || { log "ERROR: npm install failed"; exit 1; }

log "Building..."
if ! npm run build; then
    log "ERROR: build failed — rolling back to $LOCAL so the panel keeps working"
    git reset --hard "$LOCAL"
    npm install
    npm run build || log "ERROR: rollback build also failed"
    exit 1
fi

log "Restarting the control server..."
sudo -n systemctl restart home-interface-server.service || log "WARNING: server restart failed"

# Chromium is launched by the desktop session, not systemd, so cron (which has
# no session or DISPLAY) can't restart or reload it. Rebooting is the reliable
# way to pick up the new build — and at 3:30 AM nobody is looking at the panel.
# Set REBOOT_AFTER_UPDATE=0 to skip it and pick changes up on the next boot.
if [[ "${REBOOT_AFTER_UPDATE:-1}" == "1" ]]; then
    log "Update applied; rebooting to load the new build."
    sudo -n /sbin/reboot || log "WARNING: reboot failed (check /etc/sudoers.d/home-interface)"
else
    log "REBOOT_AFTER_UPDATE=0 — new build loads on next boot."
fi

log "Update complete at $(git rev-parse --short HEAD)."
