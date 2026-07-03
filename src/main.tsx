import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { JournalsProvider } from './lib/journals'
import { TradesProvider } from './lib/useTrades'
import './index.css'

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
