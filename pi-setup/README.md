# Raspberry Pi Kiosk Setup Guide

This guide will help you set up your Home Interface application as a fullscreen kiosk on a Raspberry Pi with a 7-inch touchscreen.

## 🎯 Features

- ✅ **Fullscreen kiosk mode** - No browser UI, no desktop visible
- ✅ **Touch-optimized** - All buttons sized for touch interaction (minimum 48x48px)
- ✅ **Auto-start on boot** - Application launches automatically when Pi powers on
- ✅ **Auto-updates** - Pulls latest code from git once daily at 3 AM
- ✅ **Auto-restart** - Service restarts automatically if it crashes
- ✅ **Screen management** - Disables screen blanking and sleep

## 📋 Prerequisites

- Raspberry Pi (3, 4, or 5 recommended)
- 7-inch touchscreen display
- Raspberry Pi OS (with desktop) installed
- Internet connection
- This repository cloned to `/home/pi/home-interface`

## 🚀 Quick Installation

### Step 1: Clone the Repository

```bash
cd /home/pi
git clone <your-repository-url> home-interface
cd home-interface
```

### Step 2: Run the Installation Script

```bash
chmod +x pi-setup/install.sh
./pi-setup/install.sh
```

### Step 3: Configure Settings

Before rebooting, you may want to set up your API keys and settings:

1. Temporarily start the app: `npm start`
2. Open it in a browser: `http://localhost:5173`
3. Click the settings gear icon
4. Enter your:
   - CTA API Key
   - Station ID (MapID)
   - Zip Code
5. Save settings

Settings are stored in localStorage and will persist.

### Step 4: Reboot

```bash
sudo reboot
```

The kiosk will automatically start!

## 📁 Files Included

### `kiosk-start.sh`
Main startup script that:
- Waits for network connection
- Starts the Vite development server
- Disables screen blanking
- Hides mouse cursor after 3 seconds of inactivity
- Launches Chromium in fullscreen kiosk mode

### `home-interface-kiosk.service`
Systemd service unit file that:
- Runs the kiosk automatically on boot
- Restarts the service if it crashes
- Manages the kiosk lifecycle

### `daily-update.sh`
Automated update script that:
- Runs daily at 3 AM via cron
- Pulls latest changes from git
- Installs any new dependencies
- Restarts the kiosk service

### `install.sh`
One-time installation script that:
- Installs all required system packages
- Sets up Node.js
- Configures auto-login and auto-start
- Creates systemd service
- Sets up cron job for daily updates
- Hides boot messages

## 🎮 Usage

### Starting/Stopping the Kiosk

```bash
# Check status
sudo systemctl status home-interface-kiosk

# Start manually
sudo systemctl start home-interface-kiosk

# Stop
sudo systemctl stop home-interface-kiosk

# Restart
sudo systemctl restart home-interface-kiosk

# Disable auto-start
sudo systemctl disable home-interface-kiosk

# Re-enable auto-start
sudo systemctl enable home-interface-kiosk
```

### Viewing Logs

```bash
# Vite server logs
tail -f /home/pi/home-interface/logs/vite.log

# Update logs
tail -f /home/pi/home-interface/logs/update.log

# System service logs
journalctl -u home-interface-kiosk -f
```

### Exiting the Kiosk

When the kiosk is running, you can exit by:
- Pressing **Alt+F4**
- Connecting via SSH and running: `sudo systemctl stop home-interface-kiosk`

### Manual Updates

To manually update the application:

```bash
cd /home/pi/home-interface
git pull origin main
npm install
sudo systemctl restart home-interface-kiosk
```

## 🔧 Configuration

### Changing the Port

If you need to change from port 5173, edit:
1. `vite.config.js` - Set custom port
2. `pi-setup/kiosk-start.sh` - Update the localhost URL in two places

### Touch Calibration

If your touchscreen needs calibration:

```bash
sudo apt install xinput-calibrator
DISPLAY=:0 xinput_calibrator
```

Follow the on-screen instructions and add the output to your X configuration.

### Screen Rotation

To rotate the screen, add to `/boot/config.txt`:

```bash
# For 90-degree rotation
display_rotate=1

# For 180-degree rotation
display_rotate=2

# For 270-degree rotation
display_rotate=3
```

Then reboot.

### Brightness Control

Create a script to adjust brightness:

```bash
echo 100 | sudo tee /sys/class/backlight/*/brightness  # Max brightness
echo 50 | sudo tee /sys/class/backlight/*/brightness   # 50% brightness
```

## 🐛 Troubleshooting

### Kiosk won't start

1. Check the service status:
   ```bash
   sudo systemctl status home-interface-kiosk
   ```

2. Check logs:
   ```bash
   journalctl -u home-interface-kiosk -n 50
   ```

3. Check if Vite server is running:
   ```bash
   curl http://localhost:5173
   ```

### Black screen after boot

- The app might still be loading. Wait 30 seconds.
- Check if X server started: `ps aux | grep X`
- Try restarting: `sudo systemctl restart home-interface-kiosk`

### Touch not working

- Verify touch input: `xinput list`
- Test touch: `xinput test <device-id>`
- Reboot if needed

### Updates not working

- Check cron is running: `systemctl status cron`
- View update logs: `cat /home/pi/home-interface/logs/update.log`
- Test manual update: `./pi-setup/daily-update.sh`

### Network connection issues

- Ensure Pi has internet: `ping -c 3 google.com`
- The kiosk waits for network before starting
- Check network logs: `journalctl -u NetworkManager`

## 🔐 Security Notes

### SSH Access

Keep SSH enabled for remote management:

```bash
sudo systemctl enable ssh
sudo systemctl start ssh
```

### Firewall

Consider setting up ufw:

```bash
sudo apt install ufw
sudo ufw allow ssh
sudo ufw enable
```

## 🎨 Touch-Friendly Features

The UI has been optimized for touchscreen use:

- All interactive buttons are minimum 48x48 pixels
- Added `touch-manipulation` CSS for better touch response
- Increased tap targets on all controls:
  - Settings gear icon
  - Refresh buttons
  - Pause/play button
  - Modal buttons
- Smooth scrolling with momentum
- No text selection on UI elements
- Visual feedback on touch (active states)

## 📱 Screen Wake-up

To wake the screen by touch:

1. The Pi should wake from DPMS sleep on touch automatically
2. If not, disable DPMS entirely by ensuring `xset -dpms` is in the startup script (already included)

## 🔄 Update Schedule

By default, the system checks for updates at **3:00 AM** daily. To change this:

```bash
# Edit crontab
crontab -e

# Change the time (format: minute hour day month weekday)
# Example: 2 AM instead of 3 AM
0 2 * * * /home/pi/home-interface/pi-setup/daily-update.sh
```

## ⚡ Performance Tips

1. **Use Raspberry Pi 4 or 5** for best performance
2. **Overclock** (optional): Edit `/boot/config.txt`
   ```
   over_voltage=2
   arm_freq=1750
   ```
3. **Reduce GPU memory** if not needed: Add to `/boot/config.txt`
   ```
   gpu_mem=128
   ```

## 🆘 Support

If you encounter issues:
1. Check the logs (see "Viewing Logs" section)
2. Verify all prerequisites are met
3. Try a fresh installation
4. Check GitHub issues

---

**Made with ❤️ for Raspberry Pi touchscreen kiosks**


