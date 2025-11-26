# 🚀 Quick Reference Card

## One-Time Setup

```bash
cd /home/pi
git clone <your-repo-url> home-interface
cd home-interface
chmod +x pi-setup/install.sh
./pi-setup/install.sh
sudo reboot
```

## Common Commands

```bash
# Control the Kiosk
sudo systemctl status home-interface-kiosk    # Check status
sudo systemctl start home-interface-kiosk     # Start
sudo systemctl stop home-interface-kiosk      # Stop
sudo systemctl restart home-interface-kiosk   # Restart

# View Logs
tail -f ~/home-interface/logs/vite.log        # App logs
tail -f ~/home-interface/logs/update.log      # Update logs
journalctl -u home-interface-kiosk -f         # Service logs

# Manual Update
cd ~/home-interface
git pull origin main
npm install
sudo systemctl restart home-interface-kiosk

# Test Scripts
~/home-interface/pi-setup/daily-update.sh     # Test update
~/home-interface/pi-setup/kiosk-start.sh      # Test kiosk start
```

## Exit Kiosk

- Press **Alt+F4**
- Or: `sudo systemctl stop home-interface-kiosk`

## File Locations

```
/home/pi/home-interface/          # App directory
/home/pi/home-interface/logs/     # Log files
/etc/systemd/system/              # Service file
```

## Troubleshooting

```bash
# Service won't start
sudo systemctl status home-interface-kiosk
journalctl -u home-interface-kiosk -n 50

# Check network
ping google.com

# Check Vite server
curl http://localhost:5173

# Check X server
ps aux | grep X

# Restart everything
sudo systemctl restart home-interface-kiosk
# or
sudo reboot
```

## Important Files

- `pi-setup/install.sh` - Initial setup
- `pi-setup/kiosk-start.sh` - Startup script
- `pi-setup/daily-update.sh` - Auto-update script
- `pi-setup/README.md` - Full documentation

## Default Schedule

- **Boot**: Auto-start kiosk
- **3:00 AM**: Auto-update from git
- **On Crash**: Auto-restart (10s delay)

## Settings

Configure in the app UI (gear icon):
- CTA API Key
- Station ID (MapID)
- Zip Code
- Pi Mode (for testing)

---

**Need more info?** See [README.md](README.md) or [SETUP-SUMMARY.md](SETUP-SUMMARY.md)

