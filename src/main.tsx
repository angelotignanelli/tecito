import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Vercel Web Analytics — pageviews + custom events. Lightweight,
        privacy-friendly, no cookies. The /react import is correct for
        Vite projects (do NOT use /next here). */}
    <Analytics />
  </StrictMode>,
)
