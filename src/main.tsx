import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthProvider } from './lib/auth'
import { JournalsProvider } from './lib/journals'
import { TradesProvider } from './lib/useTrades'
import './index.css'

// Keep the app up to date without disrupting anyone: a new version downloads in
// the background, and we only swap to it when the user returns to the tab (never
// mid-action). Long-open tabs are caught by a periodic update check.
let applyUpdate: (() => void) | null = null
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    applyUpdate = () => updateSW(true) // activate the waiting SW + reload
  },
  onRegisteredSW(_swUrl, r) {
    if (r) setInterval(() => r.update().catch(() => {}), 30 * 60 * 1000)
  },
})
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && applyUpdate) {
    const fn = applyUpdate
    applyUpdate = null
    fn()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <JournalsProvider>
          <TradesProvider>
            <App />
          </TradesProvider>
        </JournalsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
