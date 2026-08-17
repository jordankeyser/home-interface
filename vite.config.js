import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const CONTROL_SERVER = 'http://127.0.0.1:3001';

// In development the app is served by Vite and the control server runs
// alongside it, so proxy everything the app expects same-origin in production.
// Run both with `npm run dev` (Vite) and `npm run server` (control server).
const proxy = Object.fromEntries(
  ['/api', '/display', '/shutdown', '/reboot', '/healthz'].map((route) => [
    route,
    { target: CONTROL_SERVER, changeOrigin: true },
  ])
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    proxy,
  },
  build: {
    // The Pi renders this on a fixed panel; a couple of larger chunks are fine
    // and beat the request overhead of aggressive splitting.
    chunkSizeWarningLimit: 700,
  },
});
