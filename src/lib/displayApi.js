/**
 * Client for the local control server (see `server/index.js`).
 *
 * Paths are relative: in production the same Node process serves the built app
 * and these endpoints, and in development Vite proxies them to it. Nothing here
 * should ever hardcode `http://localhost:3001` — that was why display control
 * silently did nothing once the app was served from anywhere else.
 */

const post = async (path, body) => {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    return await res.json();
  } catch (err) {
    // The control server is optional (it only exists on the Pi), so a failure
    // here is expected on a dev machine. Warn rather than swallow entirely —
    // silent catch is what hid the fact that it was never running.
    console.warn(`[display] ${path} failed:`, err.message);
    return null;
  }
};

export const displayOff = () => post('/display/off');
export const displayOn = () => post('/display/on');

/** @param {number} percent 0–100 */
export const setBrightness = (percent) =>
  post('/display/brightness', {
    percent: Math.max(0, Math.min(100, Math.round(percent))),
  });

export const shutdownHost = () => post('/shutdown');
export const rebootHost = () => post('/reboot');

/**
 * Backlight curve for an always-on wall panel: full brightness through the day,
 * easing down in the evening, low overnight. Returns 0–100.
 */
export const ambientBrightness = (date = new Date()) => {
  const h = date.getHours() + date.getMinutes() / 60;

  const DAY = 100;
  const NIGHT = 22;
  const EVENING = 55;

  const lerp = (a, b, t) => a + (b - a) * t;

  if (h >= 7 && h < 19) return DAY;
  if (h >= 19 && h < 21) return lerp(DAY, EVENING, (h - 19) / 2);
  if (h >= 21 && h < 23) return lerp(EVENING, NIGHT, (h - 21) / 2);
  if (h >= 23 || h < 6) return NIGHT;
  // 06:00–07:00 ramp back up.
  return lerp(NIGHT, DAY, h - 6);
};
