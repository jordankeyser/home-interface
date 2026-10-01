import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

// The Pi launcher opts into a cheaper visual path before React paints. Large
// moving blurs behind translucent cards keep Chromium compositing every frame
// on the panel; desktop development retains the full ambient treatment.
if (import.meta.env.VITE_HOME_INTERFACE_KIOSK === '1') {
  document.documentElement.dataset.kiosk = 'true'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
