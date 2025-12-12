import http from 'http';
import { exec } from 'child_process';
import fs from 'fs';

const PORT = 3001;

// Detect backlight path
const BACKLIGHT_PATHS = [
    '/sys/class/backlight/10-0045/brightness',            // Your display
    '/sys/class/backlight/rpi_backlight/brightness',      // Official Pi touchscreen
    '/sys/class/backlight/backlight/brightness',          // Generic
];

let backlightPath = null;
for (const path of BACKLIGHT_PATHS) {
    if (fs.existsSync(path)) {
        backlightPath = path;
        console.log(`Found backlight at: ${path}`);
        break;
    }
}

const turnOffDisplay = () => {
    // Method 1: Direct backlight control (best for touchscreens - keeps touch working)
    if (backlightPath) {
        exec(`echo 0 | sudo tee ${backlightPath}`, (err) => {
            if (err) console.log('Backlight control failed:', err.message);
        });
        return;
    }

    // Method 2: vcgencmd (HDMI displays)
    exec('vcgencmd display_power 0', (err) => {
        if (err) {
            // Method 3: xset dpms
            exec('DISPLAY=:0 xset dpms force off');
        }
    });
};

const turnOnDisplay = () => {
    // Method 1: Direct backlight control
    if (backlightPath) {
        exec(`echo 255 | sudo tee ${backlightPath}`, (err) => {
            if (err) console.log('Backlight control failed:', err.message);
        });
        return;
    }

    // Method 2: vcgencmd (HDMI displays)
    exec('vcgencmd display_power 1', (err) => {
        if (err) {
            // Method 3: xset dpms
            exec('DISPLAY=:0 xset dpms force on');
        }
    });
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/display/off') {
        turnOffDisplay();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'display_off' }));
    } else if (req.method === 'POST' && req.url === '/display/on') {
        turnOnDisplay();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'display_on' }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`Display control server running on port ${PORT}`);
    console.log(`Backlight path: ${backlightPath || 'Not found, using vcgencmd/xset'}`);
});
