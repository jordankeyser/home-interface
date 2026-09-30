/**
 * Client for `server/displayServer.js`.
 *
 * Absolute URLs to localhost:3001 match the Pi's two-process runtime. The
 * display server allows only loopback dashboard origins; Vite proxies only
 * `/api`, so relative display paths would hit Vite and return the HTML shell.
 *
 * Only the three endpoints displayServer.js actually implements are exposed.
 * Brightness levels and reboot are deliberately absent — it has no such routes,
 * and a control that silently does nothing is worse than no control.
 *
 * The optional install-display-server.sh script starts it as a separate unit.
 * Until it is installed, calls fail softly and sleep is visual only.
 */

// 127.0.0.1, not "localhost": the server binds IPv4 loopback, and "localhost"
// can resolve to ::1 first, which would fail to connect.
const CONTROL = 'http://127.0.0.1:3001';

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
