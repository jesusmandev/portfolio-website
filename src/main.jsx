import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// ── Service Worker (offline support para GitHub Pages) ───────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // En producción el BASE_URL es /portfolio-website/, en dev es /
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl, {
      scope: import.meta.env.BASE_URL,
    }).then(reg => {
      console.log('[SW] Registrado con scope:', reg.scope);
    }).catch(err => {
      console.warn('[SW] Error al registrar:', err);
    });
  });
}
