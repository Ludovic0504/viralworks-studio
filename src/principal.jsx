import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './Application'
import './styles/index.css'
import './styles/App.css'
import { AuthProvider } from './contexte/FournisseurAuth'
import { AuthActionProvider } from './contexte/ActionAuthModalContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AuthActionProvider>
          <App />
        </AuthActionProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
