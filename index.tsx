
import React from 'react';
import ReactDOM from 'react-dom/client';
// Fix: Import App without .tsx extension
import App from './App';

/**
 * Global Error Handling
 * Captures uncaught synchronous errors and unhandled promise rejections
 * to aid in debugging and production monitoring.
 */
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler]:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection Handler]:', {
    reason: event.reason
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);