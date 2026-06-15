import React from 'react'
import ReactDOM from 'react-dom/client'
import { redirectToCanonicalOriginIfNeeded } from '@/bibliotheque/appOrigin'
import App from './Application'
import './styles/index.css'
import './styles/App.css'

redirectToCanonicalOriginIfNeeded()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
