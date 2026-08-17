/**
 * Client for `server/displayServer.js`.
 *
 * Absolute URLs to localhost:3001, matching how this always worked: the display
 * server sets `Access-Control-Allow-Origin: *`, and Vite's dev config proxies
 * only `/api`, so relative paths would hit Vite and return the HTML shell.
 *
 * Only the three endpoints displayServer.js actually implements are exposed.
 * Brightness levels and reboot are deliberately absent — it has no such routes,
 * and a control that silently does nothing is worse than no control.
 *
 * Note the display server is not started by any of the pi-setup scripts. Until
 * it is running, these calls fail softly and sleep is visual only (the panel
 * blacks out but the backlight stays lit).
 */

const CONTROL = 'http://localhost:3001';

const post = async (path) => {
  try {
    const res = await fetch(`${CONTROL}${path}`, { method: 'POST' });
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[display] ${path} failed:`, err.message);
    return null;
  }
};

export const displayOff = () => post('/display/off');
export const displayOn = () => post('/display/on');
export const shutdownHost = () => post('/shutdown');
