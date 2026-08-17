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
/** Set once bound; may differ from PORT if it had to move (see listen() below). */
let activePort = PORT;
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

/**
 * Shown instead of a bare JSON 404 when there is no build to serve. On a wall
 * panel an unexplained white page reading "Not found" is the worst possible
 * outcome — say what's wrong and how to fix it.
 */
const buildMissingPage = () => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Home Interface — no build</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;
    background:#06080d;color:#f3f6fa;
    font:16px/1.6 ui-sans-serif,system-ui,sans-serif;text-align:center}
  div{max-width:34rem;padding:2rem}
  h1{font-size:1.6rem;margin:0 0 .75rem}
  p{color:#93a1b5;margin:.5rem 0}
  code{background:#ffffff14;padding:.2em .45em;border-radius:.3em;color:#35b6ff}
</style></head><body><div>
<h1>No build to serve</h1>
<p>The control server is running, but <code>dist/index.html</code> is missing.</p>
<p>Build it and the panel will load on the next refresh:</p>
<p><code>cd ~/Desktop/home-interface &amp;&amp; npm run build</code></p>
</div></body></html>`;

const serveStatic = async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const requested = path.join(DIST, urlPath);

  // Contain path traversal.
  const resolved = path.resolve(requested);
  if (resolved !== DIST && !resolved.startsWith(DIST + path.sep)) {
    return send(res, 403, { error: 'Forbidden' });
  }

  // A request for a concrete file (.js, .css, .woff2, …) must never fall back to
  // index.html. Returning HTML with a text/html type for a missing .js means
  // Chromium refuses to execute it and the whole page renders as an unstyled
  // white screen with no error anywhere — which is exactly what a stale dist/
  // used to produce.
  const looksLikeAsset = /\.[a-z0-9]+$/i.test(urlPath);

  let filePath = resolved;
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    if (looksLikeAsset) {
      console.error(
        `[404] missing asset ${urlPath} — dist/ is stale or incomplete. Rebuild: npm run build`
      );
      return send(res, 404, { error: 'Not found', path: urlPath, hint: 'npm run build' });
    }
    // Genuine SPA route: serve the shell.
    filePath = path.join(DIST, 'index.html');
  }

  // No build at all — explain it on screen rather than returning a JSON 404.
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    const body = buildMissingPage();
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    return res.end(body);
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
      const servingDist = fs.existsSync(path.join(DIST, 'index.html'));
      // `ok` means "actually able to serve the dashboard". It used to report
      // true with no build present, so the kiosk treated a server that could
      // only return 404s as healthy and pointed Chromium at it.
      return send(res, servingDist ? 200 : 503, {
        ok: servingDist,
        app: 'home-interface',
        port: activePort,
        backlight: backlight?.path || null,
        powerEnabled: ALLOW_POWER,
        servingDist,
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

// Without these, any startup failure exits with code 1 and logs nothing at all —
// which is how this service once came to crash-loop invisibly.
process.on('uncaughtException', (err) => {
  console.error(`[fatal] uncaught exception: ${err?.stack || err}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[fatal] unhandled rejection: ${reason?.stack || reason}`);
  process.exit(1);
});

/**
 * Bind PORT, or the next free port after it.
 *
 * The frontend only ever uses relative URLs, so the actual port is irrelevant to
 * the app — which makes fighting over 3001 pointless. If something else holds
 * it (classically the pre-1.0 displayServer.js, which keeps running after the
 * file is deleted), move over instead of crash-looping. kiosk-start.sh probes
 * for whichever port is serving the dashboard.
 *
 * Set STRICT_PORT=1 to require the exact port and fail loudly instead.
 */
const STRICT_PORT = process.env.STRICT_PORT === '1';
const MAX_PORT_ATTEMPTS = STRICT_PORT ? 1 : 10;

const listen = (port, attempt = 1) => {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      console.warn(`[warn] port ${port} is in use, trying ${port + 1}`);
      server.removeListener('error', onError);
      listen(port + 1, attempt + 1);
      return;
    }

    if (err.code === 'EADDRINUSE') {
      console.error(
        `[fatal] no free port in ${PORT}–${PORT + MAX_PORT_ATTEMPTS - 1} on ${HOST}.\n` +
          `        Identify what's holding them: sudo ss -ltnp | grep ${PORT}`
      );
    } else if (err.code === 'EACCES') {
      console.error(`[fatal] not allowed to bind ${HOST}:${port}: ${err.message}`);
    } else {
      console.error(`[fatal] server error: ${err.code || ''} ${err.message}`);
    }
    process.exit(1);
  };

  server.once('error', onError);
  server.listen(port, HOST, () => {
    server.removeListener('error', onError);
    activePort = port;

    const built = fs.existsSync(path.join(DIST, 'index.html'));
    console.log(`Home Interface server → http://${HOST}:${port}`);
    console.log(`  node:      ${process.version} on ${process.platform}`);
    console.log(`  static:    ${built ? DIST : `${DIST} (NOT BUILT — run: npm run build)`}`);
    console.log(`  backlight: ${backlight ? `${backlight.path} (max ${backlight.max})` : 'not found — will try vcgencmd/xset'}`);
    console.log(`  power:     ${ALLOW_POWER ? 'enabled' : 'disabled'}`);
  });
};

listen(PORT);

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
