import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

// The Pi launcher opts into its cheaper visual path before React paints. The
// query flag works in the built bundle; the env flag keeps local kiosk testing
// convenient without baking appliance state into ordinary production builds.
const isKiosk =
  import.meta.env.VITE_HOME_INTERFACE_KIOSK === '1' ||
  new URLSearchParams(window.location.search).get('kiosk') === '1'

if (isKiosk) {
  document.documentElement.dataset.kiosk = 'true'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
