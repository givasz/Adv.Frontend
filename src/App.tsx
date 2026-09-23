import { Suspense, useEffect, type ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { sobDemanda } from '@/lib/sobDemanda'
import { AvisoDeTermos } from '@/components/ui/AvisoDeTermos'
import { AvisoDeEmail } from '@/components/ui/AvisoDeEmail'
import { FalhaNaTela } from '@/components/ui/FalhaNaTela'
// O perfil público é o produto — um minisite que abre por link compartilhado,
// quase sempre num celular em rede ruim. Só ele entra no pacote inicial; todo
// o resto (editor, painel, onboarding, admin…) chega sob demanda, para que o
// visitante do minisite nunca pague pelo código do dono do perfil.
//
// `sobDemanda`, e não `lazy`: um deploy troca o nome dos pedaços, e a aba aberta
// antes dele ficava com a tela vazia ao abrir a próxima página. Ver
// lib/sobDemanda.ts.
import PublicProfile from './pages/PublicProfile'
const Landing = sobDemanda(() => import('./pages/Landing'))
const AuthPage = sobDemanda(() => import('./pages/AuthPage'))
const EntrarComGooglePage = sobDemanda(() => import('./pages/EntrarComGooglePage'))
const EsqueciSenhaPage = sobDemanda(() => import('./pages/EsqueciSenhaPage'))
const RedefinirSenhaPage = sobDemanda(() => import('./pages/RedefinirSenhaPage'))
const ConfirmarEmailPage = sobDemanda(() => import('./pages/ConfirmarEmailPage'))
const Onboarding = sobDemanda(() => import('./pages/Onboarding'))
const Painel = sobDemanda(() => import('./pages/Painel'))
const Editor = sobDemanda(() => import('./pages/Editor'))
const AgendaPage = sobDemanda(() => import('./pages/AgendaPage'))
const AgendaDigitalPage = sobDemanda(() => import('./pages/AgendaDigitalPage'))
const TestarAssistentePage = sobDemanda(() => import('./pages/TestarAssistentePage'))
const Preview = sobDemanda(() => import('./pages/Preview'))
const AdminPanel = sobDemanda(() => import('./pages/AdminPanel'))
const Escritorio = sobDemanda(() => import('./pages/Escritorio'))
const FirmEditor = sobDemanda(() => import('./pages/FirmEditor'))
const SolicitacoesEscritorio = sobDemanda(() => import('./pages/SolicitacoesEscritorio'))
const VisitasEscritorio = sobDemanda(() => import('./pages/VisitasEscritorio'))
const LegalPage = sobDemanda(() => import('./pages/LegalPage'))
const ReportPage = sobDemanda(() => import('./pages/ReportPage'))
const SchedulePage = sobDemanda(() => import('./pages/SchedulePage'))
const SharePage = sobDemanda(() => import('./pages/SharePage'))
const SupportPage = sobDemanda(() => import('./pages/SupportPage'))
const ContestarPage = sobDemanda(() => import('./pages/ContestarPage'))
const DadosPage = sobDemanda(() => import('./pages/DadosPage'))
const PlansPage = sobDemanda(() => import('./pages/PlansPage'))
const CheckoutPage = sobDemanda(() => import('./pages/CheckoutPage'))
const MudarPlanoPage = sobDemanda(() => import('./pages/MudarPlanoPage'))
const ContratosPage = sobDemanda(() => import('./pages/ContratosPage'))
const ContratoPage = sobDemanda(() => import('./pages/ContratoPage'))
const ModeloProprioPage = sobDemanda(() => import('./pages/ModeloProprioPage'))
const ConferirDocumentoPage = sobDemanda(() => import('./pages/ConferirDocumentoPage'))

// Rota escondida do console de administração — não linkada em nenhum lugar da
// UI. O segmento vive em lib/adminPath.ts (fonte única, usada também pelo smoke).
import { ADMIN_PATH } from '@/lib/adminPath'

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
      {/* Por fora de tudo, a rede de proteção: erro ao desenhar qualquer tela vira
          uma tela que diz o que fazer, e não o fundo vazio (ver FalhaNaTela). */}
      <FalhaNaTela>
      {/* Fora do <Suspense> de propósito: o aviso de Termos não pode ficar
          esperando um pedaço lazy carregar — a faixa é justamente o que precisa
          aparecer ANTES de a pessoa continuar usando. Ela mesma decide em quais
          telas se mostra (ver AvisoDeTermos). A de e-mail segue a mesma regra,
          e cede a vez quando a dos Termos está na tela. */}
      <AvisoDeTermos />
      <AvisoDeEmail />
      {/* O fallback é o mesmo spinner das trocas de sessão — a espera de um
          pedaço lazy não deve piscar diferente da espera do /auth/me. */}
      <Suspense fallback={<Carregando />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<AuthPage mode="login" />} />
        <Route path="/criar-conta" element={<AuthPage mode="signup" />} />
        {/* A volta do "Continuar com o Google": o servidor já conferiu quem é a
            pessoa, e esta tela abre a sessão — ou pede o aceite, se a conta é nova. */}
        <Route path="/entrar/google" element={<EntrarComGooglePage />} />
        {/* Os links que chegam por e-mail. Sem RequireAuth: quem esqueceu a senha
            não entra, e o link de confirmação costuma abrir em outro aparelho. */}
        <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
        <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
        <Route path="/confirmar-email" element={<ConfirmarEmailPage />} />
        {/* Áreas que exigem conta (mesmo no Free). Criar perfil → cadastro; gerir → login. */}
        <Route path="/comecar" element={<RequireAuth to="/criar-conta"><Onboarding /></RequireAuth>} />
        <Route path="/painel" element={<RequireAuth><Painel /></RequireAuth>} />
        <Route path="/editor" element={<RequireAuth><Editor /></RequireAuth>} />
        {/* A conversa do advogado com o próprio assistente: dizer quais horários
            já foram marcados por fora. Página própria, e não uma seção do editor,
            porque é a única tarefa que se REPETE — e porque é a mesma conversa
            que o cliente vê, do outro lado. */}
        <Route path="/agenda" element={<RequireAuth><AgendaPage /></RequireAuth>} />
        <Route path="/agenda-digital" element={<RequireAuth><AgendaDigitalPage /></RequireAuth>} />
        {/* Ensaio do próprio assistente: a conversa de verdade, com o perfil
            gravado, e sem abrir o WhatsApp no fim. É a resposta a "se eu fosse um
            cliente, o que eu veria?" — ver pages/TestarAssistentePage.tsx. */}
        <Route path="/assistente/testar" element={<RequireAuth><TestarAssistentePage /></RequireAuth>} />
        {/* Contratos e procurações: minuta por modelo, revisão e registro da
            impressão digital do PDF. O texto fica no aparelho; o servidor guarda
            só o hash (ver lib/contratos/rascunhos.ts). */}
        <Route path="/contratos" element={<RequireAuth><ContratosPage /></RequireAuth>} />
        <Route path="/contratos/rascunho/:id" element={<RequireAuth><ContratoPage /></RequireAuth>} />
        {/* Modelos próprios (Max, até 3): só texto, com campos entre chaves no
            lugar do dado de cliente. "novo" cria. */}
        <Route path="/contratos/modelos/:id" element={<RequireAuth><ModeloProprioPage /></RequireAuth>} />
        {/* Sem RequireAuth de propósito: quem confere um contrato é o cliente, a
            outra parte ou um juiz — gente sem conta. */}
        <Route path="/contratos/conferir" element={<ConferirDocumentoPage />} />
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
        {/* Antes de /escritorio/:slug, senão o Nest do roteador casaria estas
            como se fossem o endereço público de uma sociedade. */}
        <Route path="/escritorio/solicitacoes" element={<RequireAuth><SolicitacoesEscritorio /></RequireAuth>} />
        <Route path="/escritorio/visitas" element={<RequireAuth><VisitasEscritorio /></RequireAuth>} />
        <Route path="/escritorio/:slug" element={<Escritorio />} />
        {/* Subpáginas do perfil público — antes eram modais (ver components/ui/SubPage). */}
        <Route path="/:slug/denunciar" element={<ReportPage />} />
        <Route path="/:slug/agendar" element={<SchedulePage />} />
        <Route path="/:slug/compartilhar" element={<SharePage />} />
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
      </Suspense>
      </FalhaNaTela>
    </BrowserRouter>
  )
}
