import { spawn } from 'node:child_process';

const API_ROOT = '/api/system/wifi';
const MAX_BODY_BYTES = 4096;
const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

export const parseTerseLine = (line) => {
  const fields = [];
  let field = '';
  let escaped = false;

  for (const char of line) {
    if (escaped) {
      field += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === ':') {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }

  if (escaped) field += '\\';
  fields.push(field);
  return fields;
};

export const parseDeviceStatus = (output) => {
  for (const line of output.trim().split('\n')) {
    if (!line) continue;
    const [device, type, state, ...connectionParts] = parseTerseLine(line);
    if (type !== 'wifi') continue;

    const connection = connectionParts.join(':');
    return {
      available: true,
      device,
      state,
      connected: state === 'connected',
      ssid: connection && connection !== '--' ? connection : '',
    };
  }

  return {
    available: false,
    device: '',
    state: 'unavailable',
    connected: false,
    ssid: '',
  };
};

export const parseNetworkList = (output) => {
  const bySsid = new Map();

  for (const line of output.trim().split('\n')) {
    if (!line) continue;
    const [active, ssid, signalText, ...securityParts] = parseTerseLine(line);
    if (!ssid) continue;

    const signal = Math.max(0, Math.min(100, Number(signalText) || 0));
    const security = securityParts.join(':');
    const network = {
      ssid,
      active: active === '*',
      signal,
      secure: Boolean(security && security !== '--'),
    };
    const existing = bySsid.get(ssid);
    if (!existing || (!existing.active && (network.active || network.signal > existing.signal))) {
      bySsid.set(ssid, network);
    }
  }

  return [...bySsid.values()].sort(
    (a, b) => Number(b.active) - Number(a.active) || b.signal - a.signal
  );
};

const runNmcli = (args, { input = '', timeoutMs = 20_000 } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn('nmcli', ['--colors', 'no', ...args], {
      env: { ...process.env, LC_ALL: 'C' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(new Error('NetworkManager timed out'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      finish(
        new Error(error.code === 'ENOENT' ? 'NetworkManager tools are not installed' : error.message)
      );
    });
    child.on('close', (code) => {
      if (code === 0) return finish(null, stdout);
      const reason = stderr.trim() || stdout.trim() || `NetworkManager exited with code ${code}`;
      return finish(new Error(reason.slice(0, 300)));
    });

    child.stdin.end(input);
  });

const getStatus = async () =>
  parseDeviceStatus(
    await runNmcli([
      '--terse',
      '--escape',
      'yes',
      '--fields',
      'DEVICE,TYPE,STATE,CONNECTION',
      'device',
      'status',
    ])
  );

const scanNetworks = async () => {
  // A rescan can be rejected while NetworkManager is associating. The cached
  // list is still useful, so fall through to it rather than failing the UI.
  await runNmcli(['--wait', '15', 'device', 'wifi', 'rescan'], { timeoutMs: 18_000 }).catch(
    () => undefined
  );
  return parseNetworkList(
    await runNmcli([
      '--terse',
      '--escape',
      'yes',
      '--fields',
      'IN-USE,SSID,SIGNAL,SECURITY',
      'device',
      'wifi',
      'list',
    ])
  );
};

const connectNetwork = async ({ ssid, password, hidden }) => {
  if (typeof ssid !== 'string' || !ssid.trim() || ssid.length > 32) {
    throw new Error('Enter a valid network name');
  }
  if (typeof password !== 'string' || password.length > 128) {
    throw new Error('Enter a valid Wi-Fi password');
  }

  const args = ['--ask', '--wait', '40', 'device', 'wifi', 'connect', ssid.trim()];
  if (hidden) args.push('hidden', 'yes');

  // --ask accepts the secret on stdin. It never appears in Chromium, Vite, or
  // nmcli process arguments and is not written to this app's logs or storage.
  await runNmcli(args, { input: `${password}\n`, timeoutMs: 45_000 });

  const status = await getStatus();
  if (status.connected && status.ssid) {
    await runNmcli([
      'connection',
      'modify',
      status.ssid,
      'connection.autoconnect',
      'yes',
      'connection.autoconnect-priority',
      '100',
    ]).catch(() => undefined);
  }
  return status;
};

const readJson = async (req) => {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('Request is too large');
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw new Error('Invalid request');
  }
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
};

const isAllowedRequest = (req) => {
  const address = req.socket.remoteAddress;
  const loopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  const origin = req.headers.origin;
  return loopback && (!origin || LOOPBACK_ORIGIN.test(origin));
};

export const createWifiManagerPlugin = () => ({
  name: 'home-interface-wifi-manager',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const path = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      if (!path.startsWith(API_ROOT)) return next();

      if (!isAllowedRequest(req)) {
        sendJson(res, 403, { error: 'Wi-Fi controls are available only on this panel' });
        return;
      }

      try {
        if (req.method === 'GET' && path === `${API_ROOT}/status`) {
          sendJson(res, 200, await getStatus());
          return;
        }
        if (req.method === 'POST' && path === `${API_ROOT}/scan`) {
          sendJson(res, 200, { networks: await scanNetworks() });
          return;
        }
        if (req.method === 'POST' && path === `${API_ROOT}/connect`) {
          if (!req.headers['content-type']?.startsWith('application/json')) {
            sendJson(res, 415, { error: 'JSON is required' });
            return;
          }
          sendJson(res, 200, await connectNetwork(await readJson(req)));
          return;
        }
        sendJson(res, 404, { error: 'Not found' });
      } catch (error) {
        sendJson(res, 503, { error: error.message || 'Wi-Fi operation failed' });
      }
    });
  },
});
