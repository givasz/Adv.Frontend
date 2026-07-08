import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Editor from './pages/Editor'
import Directory from './pages/Directory'
import PublicProfile from './pages/PublicProfile'
import Preview from './pages/Preview'
import AdminPanel from './pages/AdminPanel'

// Rota escondida do painel de moderação — não linkada em nenhum lugar da UI.
// Trocável por VITE_ADMIN_PATH (sem barra inicial). Mantenha não-óbvia.
const ADMIN_PATH = (import.meta.env.VITE_ADMIN_PATH ?? 'painel-mod-7fq3k9x2a').replace(/^\/+/, '')

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/buscar" element={<Directory />} />
        <Route path="/__preview/:themeId" element={<Preview />} />
        <Route path={`/${ADMIN_PATH}`} element={<AdminPanel />} />
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}
