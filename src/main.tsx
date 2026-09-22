import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startAutoHeight } from './lib/autoHeight'

// landr-6eita.1: when embedded in an iframe, keep the parent informed of the
// content height (landr:resize) so the iframe grows instead of scrolling.
startAutoHeight()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
