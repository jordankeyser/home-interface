const http = require('http');
const { exec } = require('child_process');

const PORT = 3001;

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/display/off') {
        // Turn off the display using multiple methods for compatibility
        // Method 1: vcgencmd (Raspberry Pi specific)
        exec('vcgencmd display_power 0', (err) => {
            if (err) {
                // Method 2: xset (X11)
                exec('DISPLAY=:0 xset dpms force off', (err2) => {
                    if (err2) {
                        // Method 3: wlr-randr (Wayland)
                        exec('wlr-randr --output HDMI-A-1 --off', () => {});
                    }
                });
            }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'display_off' }));
    } else if (req.method === 'POST' && req.url === '/display/on') {
        // Turn on the display using multiple methods for compatibility
        exec('vcgencmd display_power 1', (err) => {
            if (err) {
                exec('DISPLAY=:0 xset dpms force on', (err2) => {
                    if (err2) {
                        exec('wlr-randr --output HDMI-A-1 --on', () => {});
                    }
                });
            }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action: 'display_on' }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`Display control server running on port ${PORT}`);
});
