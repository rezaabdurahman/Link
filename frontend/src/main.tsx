import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './utils/devAuth' // Load dev authentication helper in development
import { startMockWorker } from './mocks/browser'
import './index.css'

// Start MSW for API mocking in development/demo
startMockWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
