import { useEffect, type ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import Onboarding from './pages/Onboarding'
import Painel from './pages/Painel'
import Editor from './pages/Editor'
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

// Exige conta para acessar as áreas do app (criar/gerenciar perfil) — inclusive
// no plano Free. Sem sessão, manda para o cadastro/login guardando o destino.
function RequireAuth({ children, to = '/entrar' }: { children: ReactElement; to?: string }) {
  const { isAuthed } = useAuth()
  const loc = useLocation()
  if (!isAuthed) {
    const next = encodeURIComponent(loc.pathname + loc.search)
    return <Navigate to={`${to}?next=${next}`} replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<AuthPage mode="login" />} />
        <Route path="/criar-conta" element={<AuthPage mode="signup" />} />
        {/* Áreas que exigem conta (mesmo no Free). Criar perfil → cadastro; gerir → login. */}
        <Route path="/comecar" element={<RequireAuth to="/criar-conta"><Onboarding /></RequireAuth>} />
        <Route path="/painel" element={<RequireAuth><Painel /></RequireAuth>} />
        <Route path="/editor" element={<RequireAuth><Editor /></RequireAuth>} />
        {/* Documentação jurídica da plataforma — antes do catch-all /:slug */}
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/legal/:slug" element={<LegalPage />} />
        <Route path="/__preview/:themeId" element={<Preview />} />
        <Route path={`/${ADMIN_PATH}`} element={<AdminPanel />} />
        <Route path="/escritorio/editar" element={<RequireAuth><FirmEditor /></RequireAuth>} />
        <Route path="/escritorio/:slug" element={<Escritorio />} />
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}
