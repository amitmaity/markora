import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './global.css'
import './themes/github.css'
import './themes/academic.css'
import './themes/night.css'
import './themes/newsprint.css'
import './themes/gothic.css'
import './themes/whitey.css'
import { getStoredTheme, applyTheme } from './themes/themeManager'

// Apply theme immediately before React renders to avoid flash
applyTheme(getStoredTheme())

// Remove StrictMode — it double-invokes effects which breaks TipTap editor initialization
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
)
