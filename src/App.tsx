import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
// Login por e-mail desligado na fase de teste — rotas /entrar e /criar-conta
// comentadas (ver abaixo). Reativar junto com o AccountMenu quando o auth voltar.
// import AuthPage from './pages/AuthPage'
import Onboarding from './pages/Onboarding'
import Painel from './pages/Painel'
import Editor from './pages/Editor'
import Directory from './pages/Directory'
import PublicProfile from './pages/PublicProfile'
import Preview from './pages/Preview'
import AdminPanel from './pages/AdminPanel'
import Escritorio from './pages/Escritorio'
import FirmEditor from './pages/FirmEditor'
import LegalPage from './pages/LegalPage'

// Rota escondida do painel de moderação — não linkada em nenhum lugar da UI.
// Trocável por VITE_ADMIN_PATH (sem barra inicial). Mantenha não-óbvia.
const ADMIN_PATH = (import.meta.env.VITE_ADMIN_PATH ?? 'painel-mod-7fq3k9x2a').replace(/^\/+/, '')

// Reseta a rolagem para o topo a cada troca de rota — sem isso, ao abrir uma
// página nova (ex.: um documento em /legal) a tela continua na posição anterior.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* Login por e-mail desligado na fase de teste. Reativar quando o auth voltar:
        <Route path="/entrar" element={<AuthPage mode="login" />} />
        <Route path="/criar-conta" element={<AuthPage mode="signup" />} /> */}
        <Route path="/comecar" element={<Onboarding />} />
        <Route path="/painel" element={<Painel />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/buscar" element={<Directory />} />
        {/* Documentação jurídica da plataforma — antes do catch-all /:slug */}
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/legal/:slug" element={<LegalPage />} />
        <Route path="/__preview/:themeId" element={<Preview />} />
        <Route path={`/${ADMIN_PATH}`} element={<AdminPanel />} />
        <Route path="/escritorio/editar" element={<FirmEditor />} />
        <Route path="/escritorio/:slug" element={<Escritorio />} />
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}
