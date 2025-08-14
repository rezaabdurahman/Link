import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './utils/devAuth' // Load dev authentication helper in development
import './index.css'

// Conditionally start MSW for API mocking in development/demo
const enableMocks = import.meta.env.DEV || 
                   import.meta.env.VITE_APP_MODE === 'demo' || 
                   import.meta.env.VITE_ENABLE_MOCKING === 'true';

if (enableMocks) {
  import('./mocks/browser').then(({ startMockWorker }) => {
    return startMockWorker();
  }).catch(error => {
    console.warn('Failed to load MSW:', error);
    // Continue loading the app even if MSW fails
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
