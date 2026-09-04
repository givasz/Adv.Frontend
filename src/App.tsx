import { lazy, Suspense, useEffect, type ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { AvisoDeTermos } from '@/components/ui/AvisoDeTermos'
// O perfil público é o produto — um minisite que abre por link compartilhado,
// quase sempre num celular em rede ruim. Só ele entra no pacote inicial; todo
// o resto (editor, painel, onboarding, admin…) chega sob demanda, para que o
// visitante do minisite nunca pague pelo código do dono do perfil.
import PublicProfile from './pages/PublicProfile'
const Landing = lazy(() => import('./pages/Landing'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Painel = lazy(() => import('./pages/Painel'))
const Editor = lazy(() => import('./pages/Editor'))
const Preview = lazy(() => import('./pages/Preview'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const Escritorio = lazy(() => import('./pages/Escritorio'))
const FirmEditor = lazy(() => import('./pages/FirmEditor'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const ReportPage = lazy(() => import('./pages/ReportPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const SharePage = lazy(() => import('./pages/SharePage'))
const SupportPage = lazy(() => import('./pages/SupportPage'))
const ContestarPage = lazy(() => import('./pages/ContestarPage'))
const DadosPage = lazy(() => import('./pages/DadosPage'))
const PlansPage = lazy(() => import('./pages/PlansPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const MudarPlanoPage = lazy(() => import('./pages/MudarPlanoPage'))

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
//
// A espera do meio é o que faltava: a credencial mora num cookie que a página não
// consegue ler, então saber se a sessão vale custa uma ida ao servidor. Decidir
// antes da resposta expulsava para o login quem estava logado — bastava abrir o
// link direto numa aba nova, ou o navegador ter limpado o retrato local.
function RequireAuth({ children, to = '/entrar' }: { children: ReactElement; to?: string }) {
  const { isAuthed, conferindo } = useAuth()
  const loc = useLocation()
  if (conferindo && !isAuthed) return <Carregando />
  if (!isAuthed) {
    const next = encodeURIComponent(loc.pathname + loc.search)
    return <Navigate to={`${to}?next=${next}`} replace />
  }
  return children
}

// Mesma espera das telas do app (painel, editor) — a troca entre uma e outra não
// deve piscar duas coisas diferentes.
function Carregando() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy"
        role="status"
        aria-label="Carregando"
      />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      {/* Fora do <Suspense> de propósito: o aviso de Termos não pode ficar
          esperando um pedaço lazy carregar — a faixa é justamente o que precisa
          aparecer ANTES de a pessoa continuar usando. Ela mesma decide em quais
          telas se mostra (ver AvisoDeTermos). */}
      <AvisoDeTermos />
      {/* O fallback é o mesmo spinner das trocas de sessão — a espera de um
          pedaço lazy não deve piscar diferente da espera do /auth/me. */}
      <Suspense fallback={<Carregando />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<AuthPage mode="login" />} />
        <Route path="/criar-conta" element={<AuthPage mode="signup" />} />
        {/* Áreas que exigem conta (mesmo no Free). Criar perfil → cadastro; gerir → login. */}
        <Route path="/comecar" element={<RequireAuth to="/criar-conta"><Onboarding /></RequireAuth>} />
        <Route path="/painel" element={<RequireAuth><Painel /></RequireAuth>} />
        <Route path="/editor" element={<RequireAuth><Editor /></RequireAuth>} />
        <Route path="/suporte" element={<RequireAuth><SupportPage /></RequireAuth>} />
        {/* Sem RequireAuth de propósito: quem foi suspenso não consegue entrar,
            e é justamente essa pessoa que mais precisa desta página. */}
        <Route path="/contestar" element={<ContestarPage />} />
        <Route path="/conta/dados" element={<RequireAuth><DadosPage /></RequireAuth>} />
        <Route path="/planos" element={<RequireAuth><PlansPage /></RequireAuth>} />
        <Route path="/assinar/:plano" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
        {/* Descer de plano tem página própria: ela diz o que muda ANTES de mudar.
            Subir continua indo pelo checkout — são decisões diferentes. */}
        <Route path="/plano/mudar/:plano" element={<RequireAuth><MudarPlanoPage /></RequireAuth>} />
        {/* Documentação jurídica da plataforma — antes do catch-all /:slug */}
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/legal/:slug" element={<LegalPage />} />
        <Route path="/__preview/:themeId" element={<Preview />} />
        <Route path={`/${ADMIN_PATH}`} element={<AdminPanel />} />
        <Route path="/escritorio/editar" element={<RequireAuth><FirmEditor /></RequireAuth>} />
        <Route path="/escritorio/:slug" element={<Escritorio />} />
        {/* Subpáginas do perfil público — antes eram modais (ver components/ui/SubPage). */}
        <Route path="/:slug/denunciar" element={<ReportPage />} />
        <Route path="/:slug/agendar" element={<SchedulePage />} />
        <Route path="/:slug/compartilhar" element={<SharePage />} />
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
