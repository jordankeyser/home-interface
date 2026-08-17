import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const CONTROL_SERVER = 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    proxy: {
      // Straight to the CTA, as it was before the control server existed.
      // Routing this through the control server meant trains broke whenever
      // that process didn't come up — the UI must not depend on it.
      '/api': {
        target: 'http://lapi.transitchicago.com',
        changeOrigin: true,
      },
      // Backlight, dimming and power. Optional: if the control server isn't
      // running these fail softly and the dashboard still works.
      '/display': { target: CONTROL_SERVER, changeOrigin: true },
      '/shutdown': { target: CONTROL_SERVER, changeOrigin: true },
      '/reboot': { target: CONTROL_SERVER, changeOrigin: true },
      '/healthz': { target: CONTROL_SERVER, changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
  },
});
