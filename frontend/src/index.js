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

// NOTE: Service Worker registration is handled in App.js only.
// Registering here AND in App.js caused duplicate registrations targeting the
// same scope, which produced repeated "Failed to update a ServiceWorker ...
// An unknown error occurred when fetching the script" errors. App.js has the
// robust registration with fallbacks, so we keep it there and remove this one.
