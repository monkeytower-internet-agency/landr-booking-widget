import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startAutoHeight } from './lib/autoHeight'
import { browserLocale } from './lib/locale'
import { loadUiCatalog } from './lib/strings'
import { resolveShortLinkPath } from './lib/shortLink'

// landr-6eita.1: when embedded in an iframe, keep the parent informed of the
// content height (landr:resize) so the iframe grows instead of scrolling.
startAutoHeight()

// landr-8r6oc.18: the non-English catalogs are lazy chunks. Fetch the one for
// the browser's language first so the first paint is already translated; a slow
// or failed fetch falls back to English rather than holding the widget back.
// landr-nun2y: `/s/<code>` short links resolve to `/?<query>` before mount.
void Promise.all([resolveShortLinkPath(), loadUiCatalog(browserLocale())]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
