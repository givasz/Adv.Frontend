import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Religa a folha das fontes (index.html a declara com media="print" para não
// bloquear a primeira pintura). Feito aqui, e não num onload inline, porque o
// CSP de produção (script-src 'self') bloqueia handler de atributo no HTML.
for (const link of document.querySelectorAll<HTMLLinkElement>('link[data-fontes]')) {
  link.media = 'all'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
