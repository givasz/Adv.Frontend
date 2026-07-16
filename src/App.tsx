import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import Onboarding from './pages/Onboarding'
import Painel from './pages/Painel'
import Editor from './pages/Editor'
import Agenda from './pages/Agenda'
import Agendar from './pages/Agendar'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<AuthPage mode="login" />} />
        <Route path="/criar-conta" element={<AuthPage mode="signup" />} />
        <Route path="/comecar" element={<Onboarding />} />
        <Route path="/painel" element={<Painel />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/agendar/:slug" element={<Agendar />} />
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
