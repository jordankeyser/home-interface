# Home Interface

A beautiful, touch-optimized home dashboard built with React and Vite. Displays real-time weather, CTA train arrivals, and more. Designed specifically for Raspberry Pi kiosk mode on a 7-inch touchscreen.

![Home Interface](https://via.placeholder.com/800x450?text=Home+Interface+Dashboard)

## ✨ Features

- **🌤️ Weather Module** - Real-time weather data with animated backgrounds
- **🚆 Train Arrivals** - Live CTA train tracking with automatic updates
- **⏰ Clock Bar** - Current time and date display
- **⚙️ Settings** - Easy configuration for API keys and preferences
- **📱 Touch-Optimized** - All controls sized for comfortable touch interaction
- **🖥️ Kiosk Mode** - Fullscreen display with no browser UI

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm start
# or
npm run dev

# Build for production
npm run build
```

Visit `http://localhost:5173` to see the app.

### Raspberry Pi Kiosk Setup

For complete Raspberry Pi kiosk installation instructions, see:

**📖 [Pi Setup Guide →](pi-setup/README.md)**

Quick setup on your Raspberry Pi:

```bash
# Clone the repo
cd /home/pi
git clone <your-repo-url> home-interface
cd home-interface

# Run installation script
chmod +x pi-setup/install.sh
./pi-setup/install.sh

# Reboot to start kiosk
sudo reboot
```

## 📱 Raspberry Pi Kiosk Features

The application includes complete Raspberry Pi kiosk support:

### ✅ What's Included

- **Auto-start on boot** - Application launches automatically
- **Touch-optimized UI** - All buttons minimum 48x48px tap targets
- **Fullscreen kiosk mode** - No browser UI, no desktop
- **Auto-updates** - Pulls latest code daily at 3 AM
- **Auto-restart** - Service restarts if it crashes
- **Screen management** - No screen blanking or sleep
- **Network handling** - Waits for network before starting

### 🎯 Touch Enhancements

All interactive elements have been optimized for touchscreen use:

- ⚙️ Settings icon - Enlarged to 48x48px minimum
- 🔄 Refresh buttons - Larger tap targets with visual feedback
- ⏸️ Pause/play controls - Touch-friendly sizing
- 💾 Modal buttons - Increased padding for easier tapping
- 📜 Smooth scrolling - Momentum-based touch scrolling
- 👆 Active states - Visual feedback on all touch interactions

### 📂 Pi Setup Files

Located in the `pi-setup/` directory:

- `install.sh` - One-time installation script
- `kiosk-start.sh` - Kiosk startup script
- `home-interface-kiosk.service` - Systemd service configuration
- `daily-update.sh` - Automatic update script
- `README.md` - Complete setup documentation

## ⚙️ Configuration

### Settings

Click the gear icon (⚙️) in the top-right corner to configure:

- **CTA API Key** - Get from [CTA API](https://www.transitchicago.com/developers/)
- **Station ID** - 5-digit MapID for your CTA station
- **Zip Code** - For weather data
- **Pi Mode** - Simulates 7-inch display (1024x600) for testing

Settings are saved to browser localStorage.

### Environment

No environment variables required - all configuration is done through the UI.

## 🏗️ Project Structure

```
home-interface/
├── src/
│   ├── components/
│   │   ├── ClockBar.jsx          # Time and date display
│   │   ├── Layout.jsx             # Main layout wrapper
│   │   ├── SettingsModal.jsx     # Settings configuration
│   │   └── modules/
│   │       ├── Train/
│   │       │   └── TrainModule.jsx
│   │       └── Weather/
│   │           └── WeatherModule.jsx
│   ├── context/
│   │   └── SettingsContext.jsx   # Settings state management
│   ├── hooks/
│   │   ├── useCTA.js             # CTA API integration
│   │   └── useWeather.js         # Weather API integration
│   ├── App.jsx                    # Main app component
│   ├── main.jsx                   # App entry point
│   └── index.css                  # Global styles + touch optimization
├── pi-setup/                      # Raspberry Pi kiosk files
│   ├── README.md                  # Complete Pi setup guide
│   ├── install.sh                 # Installation script
│   ├── kiosk-start.sh            # Startup script
│   ├── daily-update.sh           # Auto-update script
│   └── home-interface-kiosk.service
└── package.json
```

## 🎨 Customization

### Adding New Modules

1. Create a new component in `src/components/modules/YourModule/`
2. Import and add to `App.jsx`
3. Follow the existing module structure for consistency

### Styling

The app uses Tailwind CSS v4 with custom animations. Key styles:

- **Touch-friendly CSS** - See `index.css` for touch optimizations
- **Glassmorphism** - Backdrop blur effects throughout
- **Animations** - Weather animations, train departures, etc.

## 📊 APIs Used

- **Weather**: [Open-Meteo](https://open-meteo.com/) - Free weather API (no key required)
- **CTA Trains**: [CTA Train Tracker API](https://www.transitchicago.com/developers/)
- **Geocoding**: [Open-Meteo Geocoding](https://open-meteo.com/) - Zip code to coordinates

## 🐛 Troubleshooting

### Development

- **Port already in use**: Change port in `vite.config.js`
- **API errors**: Check your CTA API key and station ID in settings
- **Weather not loading**: Verify zip code is valid

### Raspberry Pi Kiosk

See the **[Pi Setup Guide](pi-setup/README.md)** for detailed troubleshooting including:
- Service won't start
- Black screen after boot
- Touch not working
- Network issues
- Update problems

## 🚀 Deployment

### Standard Web Deployment

```bash
npm run build
# Deploy the 'dist' folder to your hosting service
```

### Raspberry Pi Deployment

The Pi automatically updates daily via git pull. To deploy:

```bash
git commit -m "Your changes"
git push origin main
# Pi will pull changes at 3 AM or run manual update
```

## 🔧 Development Tips

### Testing Pi Mode Locally

Enable "Simulate Raspberry Pi (7")" in settings to test the 7-inch display size (1024x600).

### Hot Module Replacement

Vite provides instant updates during development. Changes appear immediately without page refresh.

### Debugging

- Use React DevTools browser extension
- Check browser console for errors
- On Pi, check logs: `tail -f /home/pi/home-interface/logs/vite.log`

## 📝 Requirements

### Development

- Node.js 18+ 
- npm or yarn
- Modern web browser

### Raspberry Pi Kiosk

- Raspberry Pi 3, 4, or 5
- Raspberry Pi OS (with desktop)
- 7-inch touchscreen (or any display)
- Internet connection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including touch interactions if UI changes)
5. Submit a pull request

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/)
- Weather data from [Open-Meteo](https://open-meteo.com/)
- CTA data from [Chicago Transit Authority API](https://www.transitchicago.com/developers/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

**Questions?** Check the [Pi Setup Guide](pi-setup/README.md) for detailed documentation.
