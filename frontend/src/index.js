import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { store } from './store';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);

// Service Worker registration with graceful error handling
// Prevents console error spam when the SW endpoint returns errors (e.g. 502 on preview hosts)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/sw.js`)
      .then((registration) => {
        console.log('[SW] Registered successfully:', registration.scope);
      })
      .catch((error) => {
        // SW registration failed (e.g. 502 from preview host).
        // Unregister any existing SWs to prevent repeated failed update attempts.
        console.warn('[SW] Registration failed, unregistering existing service workers:', error);
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((reg) => reg.unregister());
        });
      });
  });
}
