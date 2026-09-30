import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // The wall panel is an appliance, not a development session. Updating the
    // checkout under a live HMR connection previously mixed old and new React
    // modules and left the screen white. The updater validates, then reboots;
    // the Mac dev server keeps normal HMR.
    hmr: process.env.HOME_INTERFACE_KIOSK === '1' ? false : undefined,
    proxy: {
      '/api': {
        target: 'http://lapi.transitchicago.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
})
