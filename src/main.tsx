import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      void reg.update()
    })
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const last = Number(sessionStorage.getItem('sepho-sw-reload') || 0)
    if (last && Date.now() - last < 8000) return
    sessionStorage.setItem('sepho-sw-reload', String(Date.now()))
    location.reload()
  })
}
