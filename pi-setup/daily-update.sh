#!/bin/bash
# Daily Update Script - Pulls latest changes from git
# Runs from cron once per day.
#
# Two things this used to get wrong:
#
#   1. It restarted `home-interface-kiosk.service` via `systemctl --user`. That
#      unit does not exist in user scope — it never did — so the restart always
#      failed. The kiosk is launched by the X session (.xinitrc), which cron
#      cannot reach. Handled below: source-only changes are picked up by Vite's
#      file watcher with no restart at all, and dependency changes trigger a
#      reboot, which is the only reliable way to restart a session-owned process
#      from cron.
#
#   2. Any dirty file silently disabled updates forever, with one line in a log
#      nobody reads. package-lock.json churn from `npm install` is enough to
#      trigger it, and did. Generated files are now reset automatically, and a
#      genuine local edit is reported loudly.

set -uo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
[ -d "$REPO_DIR/.git" ] || REPO_DIR="/home/jordankeyser/Desktop/home-interface"
LOG_FILE="${LOG_FILE:-$REPO_DIR/logs/update.log}"
BRANCH="${BRANCH:-main}"
# Reboot when dependencies change so the new ones actually load. 0 to disable.
ALLOW_REBOOT="${ALLOW_REBOOT:-1}"
FORCE="${FORCE:-0}"
[ "${1:-}" = "--force" ] && FORCE=1

mkdir -p "$(dirname "$LOG_FILE")"

# Keep the log from growing without bound.
if [ -f "$LOG_FILE" ] && [ "$(wc -c <"$LOG_FILE")" -gt 1000000 ]; then
    tail -c 200000 "$LOG_FILE" >"$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

exec >>"$LOG_FILE" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "----------------------------------------"
log "Update check started"

cd "$REPO_DIR" || {
    log "ERROR: cannot cd to $REPO_DIR"
    exit 1
}

# --- working tree ------------------------------------------------------------
# package-lock.json is generated, and npm rewrites it on a different platform
# than the one the lock was built on. Never let it block an update.
GENERATED="package-lock.json"

if [ -n "$(git status --porcelain)" ]; then
    for f in $GENERATED; do
        if ! git diff --quiet -- "$f" 2>/dev/null; then
            log "Resetting generated file: $f"
            git checkout -- "$f" 2>/dev/null || true
        fi
    done
fi

DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
    if [ "$FORCE" = "1" ]; then
        log "WARNING: discarding local changes (--force):"
        echo "$DIRTY" | sed 's/^/             /'
        git reset --hard
        git clean -fd
    else
        log "SKIPPING UPDATE: local changes present. Auto-update stays blocked"
        log "                 until the tree is clean. Files:"
        echo "$DIRTY" | sed 's/^/                   /'
        log "                 Fix: cd $REPO_DIR && git checkout -- <file>"
        log "                 Or:  $REPO_DIR/pi-setup/daily-update.sh --force"
        log "Update check finished (no changes applied)"
        exit 0
    fi
fi

# --- fetch -------------------------------------------------------------------
if ! git fetch origin "$BRANCH"; then
    log "ERROR: git fetch failed (network down?)"
    exit 1
fi

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    log "Already up to date ($(git rev-parse --short HEAD))"
    log "Update check finished"
    exit 0
fi

log "Updating $(echo "$LOCAL" | cut -c1-7) -> $(echo "$REMOTE" | cut -c1-7)"

# Did dependencies change? Decided before the merge, while HEAD is still old.
DEPS_CHANGED=0
if ! git diff --quiet "$LOCAL" "$REMOTE" -- package.json package-lock.json; then
    DEPS_CHANGED=1
    log "Dependency changes detected"
fi

if ! git merge --ff-only "origin/$BRANCH"; then
    log "ERROR: fast-forward merge failed; leaving the tree at $LOCAL"
    exit 1
fi

log "Now at $(git rev-parse --short HEAD)"

# --- dependencies ------------------------------------------------------------
if [ "$DEPS_CHANGED" = "1" ]; then
    log "Running npm install"
    if ! npm install; then
        log "ERROR: npm install failed — rolling back to $LOCAL"
        git reset --hard "$LOCAL"
        npm install
        log "Rolled back."
        exit 1
    fi
fi

# --- apply -------------------------------------------------------------------
# The display service is a system unit, so cron can restart it directly.
if systemctl list-unit-files 2>/dev/null | grep -q home-interface-display; then
    log "Restarting home-interface-display"
    sudo -n systemctl restart home-interface-display.service ||
        log "  WARNING: restart failed (check /etc/sudoers.d/home-interface)"
fi

if [ "$DEPS_CHANGED" = "1" ]; then
    # Vite's watcher can hot-reload source changes, but not a new dependency
    # tree. The kiosk belongs to the X session, which cron cannot signal, so a
    # reboot is the only reliable way to pick it up.
    if [ "$ALLOW_REBOOT" = "1" ]; then
        log "Dependencies changed — rebooting to reload them"
        sudo -n /sbin/shutdown -r now ||
            log "  WARNING: reboot failed; changes apply at next manual reboot"
    else
        log "ALLOW_REBOOT=0 — dependency changes apply at next reboot"
    fi
else
    # Source-only change: Vite's file watcher reloads the page by itself.
    log "Source-only change — Vite's watcher will reload the panel"
fi

log "Update check finished successfully"
