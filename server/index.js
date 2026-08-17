/**
 * Home Interface control server.
 *
 * One process does three jobs so the Pi runs one service instead of a dev
 * server plus an unmanaged side process:
 *
 *   1. Serves the production build from `dist/`.
 *   2. Proxies `/api/*` to the CTA Train Tracker (this used to live in Vite's
 *      dev proxy, which is why the app could never be served from a real build).
 *   3. Controls the panel backlight and host power.
 *
 * Security notes vs. the previous version:
 *   - Binds to 127.0.0.1 by default. The old server listened on every interface
 *     with `Access-Control-Allow-Origin: *` and an unauthenticated /shutdown,
 *     so anything on the LAN could power off the device.
 *   - No CORS headers at all: the app is same-origin now.
 *   - Brightness is written with fs.writeFile, not `echo … | sudo tee …`.
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';
const CTA_ORIGIN = 'https://lapi.transitchicago.com';
/** Set HOME_INTERFACE_ALLOW_POWER=0 to disable shutdown/reboot entirely. */
const ALLOW_POWER = process.env.HOME_INTERFACE_ALLOW_POWER !== '0';

/* ------------------------------------------------------------ backlight --- */

const BACKLIGHT_DIRS = [
  '/sys/class/backlight/10-0045',
  '/sys/class/backlight/11-0045',
  '/sys/class/backlight/rpi_backlight',
  '/sys/class/backlight/backlight',
];

const findBacklight = () => {
  for (const dir of BACKLIGHT_DIRS) {
    const brightness = path.join(dir, 'brightness');
    if (!fs.existsSync(brightness)) continue;

    let max = 255;
    try {
      const raw = fs.readFileSync(path.join(dir, 'max_brightness'), 'utf8');
      const parsed = Number(raw.trim());
      if (Number.isFinite(parsed) && parsed > 0) max = parsed;
    } catch {
      // max_brightness is optional; 255 is the common default.
    }

    return { path: brightness, max };
  }
  return null;
};

const backlight = findBacklight();

const run = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000 }, (err) => resolve(!err));
  });

/**
 * Write a 0–100 percentage to the backlight. Falls back to vcgencmd (HDMI) and
 * then xset DPMS for setups without a sysfs backlight — note those can only do
 * on/off, and DPMS also kills the touch digitiser on some panels.
 */
const applyBrightness = async (percent) => {
  const clamped = Math.max(0, Math.min(100, percent));

  if (backlight) {
    const value = Math.round((clamped / 100) * backlight.max);
    try {
      await fsp.writeFile(backlight.path, String(value));
      return { ok: true, method: 'sysfs', value };
    } catch (err) {
      console.error(
        `[display] cannot write ${backlight.path}: ${err.message}\n` +
          '          Run pi-setup/install.sh to install the udev rule that ' +
          'grants the video group write access.'
      );
    }
  }

  const on = clamped > 0;

  if (await run('vcgencmd', ['display_power', on ? '1' : '0'])) {
    return { ok: true, method: 'vcgencmd' };
  }

  if (
    await run('xset', ['-display', ':0', 'dpms', 'force', on ? 'on' : 'off'])
  ) {
    return { ok: true, method: 'xset' };
  }

  return { ok: false, method: 'none' };
};

/* ----------------------------------------------------------------- power --- */

const powerAction = async (action) => {
  if (!ALLOW_POWER) return false;
  const arg = action === 'reboot' ? '-r' : '-h';
  // Needs the NOPASSWD sudoers drop-in that install.sh creates.
  return (
    (await run('sudo', ['-n', '/sbin/shutdown', arg, 'now'])) ||
    (await run('/sbin/shutdown', [arg, 'now']))
  );
};

/* ----------------------------------------------------------- static files -- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

const serveStatic = async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const requested = path.join(DIST, urlPath);

  // Contain path traversal.
  const resolved = path.resolve(requested);
  if (resolved !== DIST && !resolved.startsWith(DIST + path.sep)) {
    return send(res, 403, { error: 'Forbidden' });
  }

  let filePath = resolved;
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    // SPA fallback.
    filePath = path.join(DIST, 'index.html');
  }

  try {
    const body = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isHashed = /\.[0-9a-f]{8,}\./i.test(path.basename(filePath));

    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': isHashed
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    res.end(body);
  } catch {
    send(res, 404, { error: 'Not found' });
  }
};

/* -------------------------------------------------------------- plumbing --- */

const send = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
};

const readBody = (req, limit = 4096) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });

/** Proxy /api/* to the CTA Train Tracker. */
const proxyCta = async (req, res) => {
  const incoming = new URL(req.url, 'http://localhost');
  const target = `${CTA_ORIGIN}${incoming.pathname}${incoming.search}`;

  try {
    const upstream = await fetch(target, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: 'application/json' },
    });
    const body = Buffer.from(await upstream.arrayBuffer());

    res.writeHead(upstream.status, {
      'Content-Type':
        upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    console.error('[cta] proxy failed:', err.message);
    send(res, 502, { error: 'Upstream request failed' });
  }
};

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET' && pathname === '/healthz') {
      return send(res, 200, {
        ok: true,
        backlight: backlight?.path || null,
        powerEnabled: ALLOW_POWER,
        servingDist: fs.existsSync(path.join(DIST, 'index.html')),
      });
    }

    if (pathname.startsWith('/api/')) {
      if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
      return proxyCta(req, res);
    }

    if (req.method === 'POST') {
      if (pathname === '/display/on') {
        const result = await applyBrightness(100);
        return send(res, 200, { ...result, action: 'display_on' });
      }

      if (pathname === '/display/off') {
        const result = await applyBrightness(0);
        return send(res, 200, { ...result, action: 'display_off' });
      }

      if (pathname === '/display/brightness') {
        const body = await readBody(req);
        const percent = Number(body.percent);
        if (!Number.isFinite(percent)) {
          return send(res, 400, { error: 'percent must be a number 0–100' });
        }
        const result = await applyBrightness(percent);
        return send(res, 200, { ...result, percent });
      }

      if (pathname === '/shutdown' || pathname === '/reboot') {
        const action = pathname === '/reboot' ? 'reboot' : 'shutdown';
        if (!ALLOW_POWER) return send(res, 403, { error: 'Power control disabled' });
        // Reply before the host goes down.
        send(res, 200, { ok: true, action });
        setTimeout(() => {
          powerAction(action).then((ok) => {
            if (!ok) {
              console.error(
                `[power] ${action} failed. Install the sudoers drop-in from ` +
                  'pi-setup/install.sh.'
              );
            }
          });
        }, 250);
        return undefined;
      }

      return send(res, 404, { error: 'Not found' });
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res);
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[server]', err);
    return send(res, 500, { error: 'Internal error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Home Interface server → http://${HOST}:${PORT}`);
  console.log(`  static:    ${fs.existsSync(DIST) ? DIST : `${DIST} (not built yet)`}`);
  console.log(`  backlight: ${backlight ? `${backlight.path} (max ${backlight.max})` : 'not found — will try vcgencmd/xset'}`);
  console.log(`  power:     ${ALLOW_POWER ? 'enabled' : 'disabled'}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
