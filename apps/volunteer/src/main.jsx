import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ToastProvider } from '../../../shared/ui/Toast/ToastProvider.jsx'
import { Agentation } from 'agentation';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
      {import.meta.env.DEV && <Agentation />}
    </ToastProvider>
  </React.StrictMode>,
)
