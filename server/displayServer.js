/**
 * Display control server.
 *
 * Small, single-purpose companion to the dashboard: turns the panel backlight
 * off when the UI sleeps, back on when it wakes, and shuts the Pi down on
 * request. Nothing else depends on it — if it isn't running, the dashboard still
 * works and Sleep simply blanks the screen without cutting the backlight.
 *
 * Runs as its own systemd service (pi-setup/home-interface-display.service),
 * deliberately independent of the kiosk boot path.
 *
 * Backlight is written directly with fs, which needs group write access on the
 * sysfs `brightness` file — the udev rule in
 * pi-setup/install-display-server.sh grants that to the `video` group. Relying
 * on `sudo tee` (as this used to do exclusively) meant it silently did nothing
 * unless a NOPASSWD rule happened to exist.
 *
 * Binds loopback only. The previous version listened on every interface with
 * `Access-Control-Allow-Origin: *` and an unauthenticated /shutdown, so anything
 * on the LAN could power off the Pi.
 */

import http from 'node:http';
import fs from 'node:fs';
import { exec } from 'node:child_process';

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';

/* ------------------------------------------------------------- backlight -- */

const BACKLIGHT_DIRS = [
  '/sys/class/backlight/10-0045', // the panel on this Pi
  '/sys/class/backlight/11-0045',
  '/sys/class/backlight/rpi_backlight',
  '/sys/class/backlight/backlight',
];

const findBacklight = () => {
  // Prefer the known paths, then anything else the kernel exposes.
  const candidates = [...BACKLIGHT_DIRS];
  try {
    for (const name of fs.readdirSync('/sys/class/backlight')) {
      const dir = `/sys/class/backlight/${name}`;
      if (!candidates.includes(dir)) candidates.push(dir);
    }
  } catch {
    // No /sys/class/backlight at all (e.g. HDMI-only, or not Linux).
  }

  for (const dir of candidates) {
    const file = `${dir}/brightness`;
    if (!fs.existsSync(file)) continue;

    let max = 255;
    try {
      const parsed = Number(fs.readFileSync(`${dir}/max_brightness`, 'utf8').trim());
      if (Number.isFinite(parsed) && parsed > 0) max = parsed;
    } catch {
      // max_brightness is optional; 255 is the usual default.
    }

    let writable = true;
    try {
      fs.accessSync(file, fs.constants.W_OK);
    } catch {
      writable = false;
    }

    return { file, max, writable };
  }
  return null;
};

const backlight = findBacklight();

const run = (cmd) =>
  new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (err) => resolve(!err));
  });

const setBacklight = async (on) => {
  if (backlight) {
    const value = on ? backlight.max : 0;

    try {
      fs.writeFileSync(backlight.file, String(value));
      return { ok: true, method: 'sysfs', value };
    } catch (err) {
      console.error(`[display] direct write to ${backlight.file} failed: ${err.message}`);
    }

    // Only reached if the udev rule / group membership isn't in place.
    if (await run(`echo ${value} | sudo -n tee ${backlight.file} >/dev/null`)) {
      return { ok: true, method: 'sudo-tee', value };
    }
  }

  // HDMI displays.
  if (await run(`vcgencmd display_power ${on ? 1 : 0}`)) {
    return { ok: true, method: 'vcgencmd' };
  }

  // Last resort. Note DPMS can also cut power to the touch digitiser on some
  // panels, which is why it is last rather than first.
  if (await run(`DISPLAY=:0 xset dpms force ${on ? 'on' : 'off'}`)) {
    return { ok: true, method: 'xset' };
  }

  return { ok: false, method: 'none' };
};

/* ----------------------------------------------------------------- power -- */

const shutdownPi = async () => {
  console.log('[display] shutdown requested');
  if (await run('sudo -n /sbin/shutdown -h now')) return true;
  if (await run('sudo -n shutdown -h now')) return true;
  console.error('[display] shutdown failed — check /etc/sudoers.d/home-interface');
  return false;
};

/* -------------------------------------------------------------- plumbing -- */

const send = (res, status, payload, origin) => {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  res.writeHead(status, headers);
  res.end(body);
};

/** The dashboard is served by Vite on another port, so this is cross-origin. */
const allowedOrigin = (req) => {
  const origin = req.headers.origin;
  if (!origin) return null;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null;
};

const server = http.createServer(async (req, res) => {
  const origin = allowedOrigin(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/healthz') {
    return send(
      res,
      200,
      {
        ok: true,
        app: 'home-interface-display',
        backlight: backlight?.file || null,
        max: backlight?.max ?? null,
        writable: backlight?.writable ?? false,
      },
      origin
    );
  }

  if (req.method === 'POST') {
    if (req.url === '/display/off') {
      return send(res, 200, { ...(await setBacklight(false)), action: 'display_off' }, origin);
    }
    if (req.url === '/display/on') {
      return send(res, 200, { ...(await setBacklight(true)), action: 'display_on' }, origin);
    }
    if (req.url === '/shutdown') {
      // Reply before the host goes down.
      send(res, 200, { ok: true, action: 'shutdown' }, origin);
      setTimeout(shutdownPi, 250);
      return undefined;
    }
  }

  return send(res, 404, { error: 'Not found' }, origin);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[fatal] port ${PORT} is already in use on ${HOST}.\n` +
        `        Find it with: sudo ss -ltnp | grep ${PORT}`
    );
  } else {
    console.error(`[fatal] ${err.code || ''} ${err.message}`);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(`[fatal] uncaught exception: ${err?.stack || err}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Display control server → http://${HOST}:${PORT}`);
  if (backlight) {
    console.log(`  backlight: ${backlight.file} (max ${backlight.max})`);
    if (!backlight.writable) {
      console.warn(
        '  WARNING: not writable by this user. Run pi-setup/install-display-server.sh,\n' +
          '           then log out and back in so the video group applies.'
      );
    }
  } else {
    console.log('  backlight: none found — will try vcgencmd, then xset dpms');
  }
});

const stop = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
};

process.on('SIGTERM', stop);
process.on('SIGINT', stop);
