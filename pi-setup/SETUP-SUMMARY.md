# Raspberry Pi Kiosk Setup Summary

## ✅ Changes Made to the Repository

### UI Enhancements for Touchscreen

**Files Modified:**
1. `src/components/ClockBar.jsx`
   - Settings button enlarged to 48x48px minimum
   - Added `touch-manipulation` CSS class
   - Added `active:` states for touch feedback
   - Added aria-label for accessibility

2. `src/components/modules/Train/TrainModule.jsx`
   - Refresh and pause/play buttons enlarged to 48x48px
   - Increased icon sizes from 4-5px to 6px
   - Added touch-manipulation classes
   - Enhanced visual feedback on touch

3. `src/components/modules/Weather/WeatherModule.jsx`
   - Refresh button enlarged to 48x48px
   - Added touch-manipulation and active states
   - Better visual feedback

4. `src/components/SettingsModal.jsx`
   - Cancel and Save buttons increased to 48px height
   - Added better padding (px-6 py-3)
   - Added active states for touch feedback

5. `src/index.css`
   - Added touch-optimized CSS rules
   - Smooth scrolling with momentum
   - Disabled text selection on buttons
   - Touch-specific tap highlight colors
   - Improved webkit-overflow-scrolling
   - Optional cursor hiding for kiosk mode
   - Media query for coarse pointers (touch devices)

6. `package.json`
   - Added `"start": "vite"` script for standard npm start command

### New Files in Repository

**pi-setup/ Directory:**
- `README.md` - Complete Raspberry Pi setup guide
- `install.sh` - One-time installation script
- `kiosk-start.sh` - Kiosk startup script  
- `daily-update.sh` - Daily git pull automation script
- `home-interface-kiosk.service` - Systemd service configuration
- `SETUP-SUMMARY.md` - This file
- `.gitkeep` - Keeps directory in git

## 🔧 Steps to Perform ON THE RASPBERRY PI

### Prerequisites (Before You Start)
1. Raspberry Pi with Raspberry Pi OS (with desktop) installed
2. 7-inch touchscreen connected
3. Internet connection configured
4. SSH enabled (optional, for remote access)

### Step-by-Step Installation on Pi

#### 1. Clone Repository
```bash
cd /home/pi
git clone <your-repository-url> home-interface
cd home-interface
```

#### 2. Run Installation Script
```bash
chmod +x pi-setup/install.sh
./pi-setup/install.sh
```

**What This Script Does ON THE PI:**
- ✅ Updates system packages
- ✅ Installs Chromium browser
- ✅ Installs unclutter (hides mouse cursor)
- ✅ Installs xdotool and x11-xserver-utils
- ✅ Installs Node.js 20.x
- ✅ Runs `npm install` in the project
- ✅ Creates `/home/pi/home-interface/logs/` directory
- ✅ Makes all scripts executable
- ✅ Copies systemd service to `/etc/systemd/system/`
- ✅ Enables systemd service for auto-start
- ✅ Sets up cron job for daily updates at 3 AM
- ✅ Configures auto-login for pi user
- ✅ Configures auto-startx in .bash_profile
- ✅ Updates /boot/cmdline.txt to hide boot messages
- ✅ Creates .xinitrc to auto-start kiosk

#### 3. Configure Settings (Optional but Recommended)
Before rebooting, you can configure your API keys:

```bash
# Temporarily start the app
npm start

# In another terminal or from another computer, open browser to:
# http://<pi-ip-address>:5173

# Click settings gear icon and enter:
# - CTA API Key
# - Station ID (MapID)
# - Zip Code

# Save and close
```

Settings are saved to browser localStorage.

#### 4. Reboot
```bash
sudo reboot
```

The kiosk will automatically start on boot!

## 🎯 What Happens After Setup

### On Boot Sequence:
1. Pi boots and auto-logs in as user `pi`
2. `.bash_profile` automatically runs `startx`
3. X server starts
4. `.xinitrc` runs `kiosk-start.sh`
5. Script waits for network connection
6. Vite dev server starts on port 5173
7. Screen blanking disabled
8. Mouse cursor hidden after 3 seconds
9. Chromium launches in fullscreen kiosk mode
10. App loads at http://localhost:5173

### Automatic Daily Updates:
- Cron job runs at 3:00 AM every day
- Checks for git updates
- Pulls latest code if available
- Runs `npm install` for new dependencies
- Restarts kiosk service
- Logs everything to `/home/pi/home-interface/logs/update.log`

### Auto-Restart:
- If app crashes, systemd automatically restarts it
- 10-second delay between restart attempts

## 🎮 Managing the Kiosk

### Common Commands (Run on Pi via SSH or terminal)

```bash
# Check if kiosk is running
sudo systemctl status home-interface-kiosk

# Stop the kiosk
sudo systemctl stop home-interface-kiosk

# Start the kiosk
sudo systemctl start home-interface-kiosk

# Restart the kiosk
sudo systemctl restart home-interface-kiosk

# View live logs
tail -f /home/pi/home-interface/logs/vite.log

# View update logs
tail -f /home/pi/home-interface/logs/update.log

# View system service logs
journalctl -u home-interface-kiosk -f

# Disable auto-start
sudo systemctl disable home-interface-kiosk

# Re-enable auto-start
sudo systemctl enable home-interface-kiosk
```

### Exiting the Kiosk (When at the Pi)
- Press **Alt+F4** to close Chromium
- Or SSH in and run: `sudo systemctl stop home-interface-kiosk`

## 📍 File Locations on Pi

### Application Files (In Repository):
```
/home/pi/home-interface/
├── src/                           # React app source
├── pi-setup/                      # Setup scripts (part of repo)
├── logs/                          # Created by install script
│   ├── vite.log                  # Vite server output
│   └── update.log                # Update script logs
├── package.json
└── ...
```

### System Files (Created ON Pi, OUTSIDE repo):
```
/etc/systemd/system/
└── home-interface-kiosk.service  # Copied from pi-setup/

/home/pi/
├── .bash_profile                 # Modified to auto-startx
├── .xinitrc                      # Created to run kiosk-start.sh
└── .Xauthority                   # X server auth file

/var/spool/cron/crontabs/
└── pi                            # Cron jobs for pi user

/boot/
├── cmdline.txt                   # Modified to hide boot messages
└── config.txt                    # May need edits for rotation/overclock
```

## 🚨 Important Notes

### What's in Git (These files are version controlled):
- ✅ All source code changes
- ✅ All files in `pi-setup/` directory
- ✅ Updated `package.json`
- ✅ Updated `README.md`
- ✅ Touch-optimized CSS

### What's NOT in Git (Pi-specific system configurations):
- ❌ `/etc/systemd/system/home-interface-kiosk.service` (copied during install)
- ❌ Modified `/home/pi/.bash_profile`
- ❌ Created `/home/pi/.xinitrc`
- ❌ Modified `/boot/cmdline.txt`
- ❌ Cron jobs
- ❌ Installed system packages
- ❌ Log files
- ❌ User settings (stored in browser localStorage)

## 🔄 Updating the App

### Automatic (Default):
- Happens every day at 3 AM
- No action needed

### Manual Update:
```bash
cd /home/pi/home-interface
git pull origin main
npm install
sudo systemctl restart home-interface-kiosk
```

### Push from Development:
```bash
# On your development machine
git add .
git commit -m "Your changes"
git push origin main

# Changes will auto-deploy to Pi at 3 AM
# Or trigger manual update on Pi
```

## 🛠️ Customization

### Change Update Time:
```bash
# Edit cron schedule
crontab -e

# Current: 0 3 * * * (3 AM daily)
# Change to: 0 2 * * * (2 AM daily)
```

### Change Port:
1. Edit `vite.config.js` and set custom port
2. Edit `pi-setup/kiosk-start.sh` and update localhost URL (2 places)
3. Commit and push changes
4. Update on Pi

### Screen Rotation:
Add to `/boot/config.txt`:
```
display_rotate=1  # 90 degrees
```

### Disable Mouse Cursor Completely:
Edit `pi-setup/kiosk-start.sh` and change:
```bash
unclutter -idle 3 &
# to:
unclutter -idle 0.1 &
```

## 📞 Support

### Quick Diagnostics:
```bash
# Is the service running?
sudo systemctl status home-interface-kiosk

# Is Vite server responding?
curl http://localhost:5173

# Are there recent errors?
tail -50 /home/pi/home-interface/logs/vite.log

# Is X server running?
ps aux | grep X

# Is Chromium running?
ps aux | grep chromium
```

### Common Issues:

**Black Screen:**
- Wait 30 seconds for app to load
- Check logs
- Try restarting: `sudo systemctl restart home-interface-kiosk`

**Touch Not Working:**
- Check `xinput list`
- May need calibration: `sudo apt install xinput-calibrator`

**No Network:**
- App waits for network before starting
- Check WiFi connection
- Check with: `ping google.com`

**Updates Not Working:**
- Check cron is running: `systemctl status cron`
- Check logs: `cat logs/update.log`
- Test manually: `./pi-setup/daily-update.sh`

---

## ✨ Summary

This setup provides a **production-ready touchscreen kiosk** that:
- ✅ Starts automatically on boot
- ✅ Updates itself daily
- ✅ Restarts if it crashes  
- ✅ Provides a touch-friendly interface
- ✅ Hides all OS elements (true kiosk mode)
- ✅ Manages screen power
- ✅ Logs everything for debugging

**Everything you need is in the repository.** Just clone and run `install.sh` on your Pi!


