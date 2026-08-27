import { useEffect, useState } from 'react'
import {
  adminLogin,
  adminLogout,
  adminSessao,
  listReports,
  searchProfiles,
  type AdminProfile,
  type ReportGroup,
  listTickets,
  setTicketStatus,
  type AdminTicket,
  type AdminMe,
  PrecisaSegundoFator,
} from '@/lib/adminApi'
import EquipeTab from '@/components/admin/EquipeTab'
import HistoricoTab from '@/components/admin/HistoricoTab'
import ContestacoesTab from '@/components/admin/ContestacoesTab'
import SegundoFator from '@/components/admin/SegundoFator'
import { Etiqueta } from '@/components/admin/pecas'
import { Rodape } from '@/components/admin/Paginacao'
import FichaDoPerfil from '@/components/admin/FichaDoPerfil'
import { usePaginado } from '@/components/admin/usePaginado'
import { cnaSearchUrl } from '@/components/ui/CnaLink'
import type { ModerationStatus } from '@/lib/types'
import { CheckIcon, ExternalLinkIcon, LockIcon, ScaleIcon, SearchIcon } from '@/components/ui/icons'

const STATUS_META: Record<ModerationStatus, { label: string; cls: string }> = {
  active: { label: 'Ativo', cls: 'bg-ink/[0.06] text-ink-faint' },
  warned: { label: 'Avisado', cls: 'bg-brass/15 text-brass-deep' },
  partial: { label: 'Censura parcial', cls: 'bg-brass/20 text-brass-deep' },
  restricted: { label: 'Restrito', cls: 'bg-burgundy/10 text-burgundy-deep' },
}

export default function AdminPanel() {
  // `undefined` = ainda perguntando ao servidor. A sessão do painel é um cookie
  // HttpOnly: recarregar a página apaga tudo o que esta tela sabia, e só o
  // servidor pode dizer se ela continua aberta — e para QUEM. Sem o estado
  // intermediário, o painel piscaria a tela de login em toda recarga.
  const [me, setMe] = useState<AdminMe | null | undefined>(undefined)

  // Uma fonte só para "o que este papel abre": o servidor. A tela desenha o que
  // ele disser; quem recusa de verdade continua sendo a API.
  const reconferir = () => void adminSessao().then(setMe)

  useEffect(() => {
    let vivo = true
    void adminSessao().then((r) => {
      if (vivo) setMe(r)
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    document.title = 'Painel · advoc.me'
    // Rota escondida: impede indexação por buscadores mesmo que o link vaze.
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  if (me === undefined) return <Conferindo />
  if (!me) return <LoginScreen onLogin={setMe} />
  return (
    <Dashboard
      me={me}
      onAtualizar={reconferir}
      onLogout={() => {
        void adminLogout()
        setMe(null)
      }}
    />
  )
}

/** Meio segundo de "conferindo" em vez de um piscar de tela de login. */
function Conferindo() {
  return (
    <div className="grain flex min-h-dvh items-center justify-center px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
          <LockIcon width={20} height={20} />
        </span>
        <p className="text-[12.5px] text-ink-faint">Conferindo a sessão…</p>
      </div>
    </div>
  )
}

// ---- Login ----

function LoginScreen({ onLogin }: { onLogin: (me: AdminMe) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // O campo do código só aparece depois que a senha passou. Mostrá-lo de saída
  // faria toda entrada parecer exigir um aplicativo que nem todo papel usa.
  const [pedeCodigo, setPedeCodigo] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onLogin(await adminLogin(username, password, codigo))
    } catch (err) {
      if (err instanceof PrecisaSegundoFator) {
        setPedeCodigo(true)
        setError(codigo ? 'Código incorreto. Tente o próximo.' : null)
      } else {
        setError(err instanceof Error ? err.message : 'Usuário ou senha inválidos.')
      }
    } finally {
      setBusy(false)
    }
  }

  const campo =
    'w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

  return (
    <div className="grain flex min-h-dvh items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-ink/10 bg-paper p-6 shadow-card"
      >
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
            <LockIcon width={20} height={20} />
          </span>
          <h1 className="font-display text-lg font-semibold text-ink">Painel advoc.me</h1>
          <p className="text-[12px] text-ink-faint">Acesso restrito à equipe</p>
        </div>

        {/* htmlFor/id: os rótulos estavam soltos, sem associação com os campos —
            clicar no texto não focava nada e leitor de tela anunciava input sem
            nome. */}
        <label htmlFor="admin-user" className="mb-1.5 block text-[12.5px] font-medium text-ink">
          E-mail
        </label>
        <input
          id="admin-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          spellCheck={false}
          autoCapitalize="none"
          disabled={pedeCodigo}
          className={`mb-3 ${campo} disabled:opacity-60`}
        />
        <label htmlFor="admin-pass" className="mb-1.5 block text-[12.5px] font-medium text-ink">
          Senha
        </label>
        <input
          id="admin-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          spellCheck={false}
          disabled={pedeCodigo}
          className={`mb-4 ${campo} disabled:opacity-60`}
        />

        {pedeCodigo && (
          <>
            <label htmlFor="admin-totp" className="mb-1.5 block text-[12.5px] font-medium text-ink">
              Código de 6 dígitos
            </label>
            <input
              id="admin-totp"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className={`mb-1 ${campo} font-mono tracking-[0.3em]`}
            />
            <p className="mb-4 text-[11.5px] text-ink-faint">
              O que está no seu aplicativo de autenticação agora.
            </p>
          </>
        )}

        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || (pedeCodigo && codigo.length !== 6)}
          className="btn-primary w-full disabled:opacity-50"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

// ---- Dashboard ----

/**
 * As abas, e a permissão que cada uma pede.
 *
 * Quem não tem a permissão não vê a aba — e, se forçar a URL, a API recusa do
 * mesmo jeito. Esconder é conforto; a fronteira é o servidor.
 */
const ABAS = [
  { id: 'reports', label: 'Denúncias', permissao: 'moderacao:ler' },
  // Logo depois das denúncias, e de propósito: é a única fila com relógio
  // correndo contra a plataforma — se ninguém responder em 10 dias, a medida
  // cai sozinha.
  { id: 'appeals', label: 'Contestações', permissao: 'moderacao:ler' },
  { id: 'support', label: 'Suporte', permissao: 'suporte:ler' },
  { id: 'search', label: 'Advogados', permissao: 'contas:ler' },
  { id: 'historico', label: 'Histórico', permissao: 'auditoria:ler' },
  { id: 'equipe', label: 'Equipe', permissao: 'admins:gerir' },
] as const

type AbaId = (typeof ABAS)[number]['id']

function Dashboard({
  me,
  onAtualizar,
  onLogout,
}: {
  me: AdminMe
  onAtualizar: () => void
  onLogout: () => void
}) {
  const abas = ABAS.filter((a) => me.permissoes.includes(a.permissao))
  const [tab, setTab] = useState<AbaId>(abas[0]?.id ?? 'reports')
  const podeDecidir = me.permissoes.includes('moderacao:decidir')
  const podeResponder = me.permissoes.includes('suporte:responder')
  const podeSancionar = me.permissoes.includes('contas:sancionar')

  return (
    <div className="min-h-dvh bg-paper-deep">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="shrink-0 text-burgundy" />
            <span className="truncate">Painel</span>
          </span>
          {/* Quem está logado, sempre à vista: num painel que decide o que sai do
              ar, "em nome de quem" é a primeira informação da tela. */}
          <span className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-[12.5px] text-ink-faint sm:inline">{me.name}</span>
            <Etiqueta papel={me.role} />
            <button
              onClick={onLogout}
              className="text-[13px] font-medium text-ink-faint transition-colors hover:text-burgundy"
            >
              Sair
            </button>
          </span>
        </div>
        <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4">
          {/* Ordem = prioridade de atendimento: o que tem gente esperando resposta
              primeiro; busca, histórico e equipe são ferramenta, não fila. */}
          {abas.map((a) => (
            <button
              key={a.id}
              onClick={() => setTab(a.id)}
              className={`shrink-0 border-b-2 px-3 py-2 text-[13.5px] font-medium transition-colors ${
                tab === a.id
                  ? 'border-burgundy text-burgundy'
                  : 'border-transparent text-ink-faint hover:text-ink'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {me.totpPendente && <SegundoFator onPronto={onAtualizar} />}
        {me.emergencia && <FaixaEmergencia producao={me.producao} />}

        {tab === 'reports' && <ReportsTab podeDecidir={podeDecidir} podeSancionar={podeSancionar} />}
        {tab === 'appeals' && <ContestacoesTab podeDecidir={podeDecidir} />}
        {tab === 'support' && <SupportTab podeResponder={podeResponder} />}
        {tab === 'search' && <SearchTab podeDecidir={podeDecidir} podeSancionar={podeSancionar} />}
        {tab === 'historico' && <HistoricoTab />}
        {tab === 'equipe' && <EquipeTab eu={me} />}
      </main>
    </div>
  )
}

/**
 * Você entrou pela credencial do .env, que só vale enquanto não existe
 * administrador nenhum. Enquanto for assim, nenhuma decisão tem autor de
 * verdade — então a faixa não é decorativa, é a primeira tarefa do painel.
 */
function FaixaEmergencia({ producao }: { producao: boolean }) {
  return (
    <section className="mb-5 rounded-xl2 border border-burgundy/30 bg-burgundy/[0.06] p-4">
      <h2 className="mb-1 font-display text-[15px] font-semibold text-burgundy-deep">
        Ninguém administra este painel ainda
      </h2>
      <p className="max-w-prose text-[13px] text-ink-soft">
        Você entrou pela credencial de emergência do ambiente. Ela existe só para
        criar o primeiro acesso — e para de valer sozinha assim que ele existir.
        Enquanto isso, as decisões ficam registradas sem um nome por trás.
      </p>
      <p className="mt-2 max-w-prose text-[13px] text-ink-soft">
        Crie o seu acesso na aba <strong>Equipe</strong>
        {producao ? '' : ' (ou por `npm run admin:create` no servidor)'}.
      </p>
    </section>
  )
}

// ---- Aba: Denúncias ----

function ReportsTab({ podeDecidir, podeSancionar }: { podeDecidir: boolean; podeSancionar: boolean }) {
  const [status, setStatus] = useState<'open' | 'all'>('open')
  const [selected, setSelected] = useState<string | null>(null)

  // A fila é paginada por PERFIL: um perfil com quarenta denúncias é uma linha.
  const lista = usePaginado<ReportGroup>(
    (offset) => listReports(status, offset),
    'Falha ao carregar denúncias.',
  )
  const { itens: groups, erro: error, recomecar: reload } = lista

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['open', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                status === s ? 'bg-burgundy text-paper-soft' : 'bg-ink/[0.06] text-ink-faint hover:bg-ink/10'
              }`}
            >
              {s === 'open' ? 'Abertas' : 'Todas'}
            </button>
          ))}
        </div>
        <button onClick={() => void reload()} className="text-[12.5px] font-medium text-ink-faint hover:text-burgundy">
          Atualizar
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
          {error}
        </p>
      )}

      {!groups ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">Carregando…</p>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">Nenhuma denúncia {status === 'open' ? 'aberta' : ''}.</p>
      ) : (
        <ul className="space-y-2.5">
          {groups.map((g) => (
            <li key={g.profile.id} className="overflow-hidden rounded-xl2 border border-ink/10 bg-paper">
              <button
                onClick={() => setSelected(selected === g.profile.id ? null : g.profile.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.02]"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{g.profile.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_META[g.profile.moderationStatus].cls}`}>
                      {STATUS_META[g.profile.moderationStatus].label}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-faint">
                    advoc.me/{g.profile.slug} · {g.profile.oabNumber}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {g.openCount > 0 && (
                    <span className="rounded-full bg-burgundy px-2 py-0.5 text-[11px] font-semibold text-paper-soft">
                      {g.openCount} aberta{g.openCount > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-[11px] text-ink-faint">{g.total} no total</span>
                </span>
              </button>
              {selected === g.profile.id && (
                <FichaDoPerfil
                  profileId={g.profile.id}
                  podeDecidir={podeDecidir}
                  podeSancionar={podeSancionar}
                  onChanged={() => void reload()}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <Rodape
        mostrando={groups?.length ?? 0}
        total={lista.total}
        temMais={lista.temMais}
        carregando={lista.carregando}
        onMais={() => void lista.mais()}
        nome="perfis na fila"
      />
    </div>
  )
}

function SearchTab({ podeDecidir, podeSancionar }: { podeDecidir: boolean; podeSancionar: boolean }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [tick, setTick] = useState(0) // bump para re-buscar após moderar

  // A busca devolvia 50 e calava sobre o resto: quem procurasse um nome comum
  // via meia lista sem nada dizendo que havia mais.
  const lista = usePaginado<AdminProfile>(
    (offset) => searchProfiles(q.trim(), offset),
    'Falha na busca.',
  )
  const { itens: results, carregando: loading, erro: error } = lista

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      lista.esvaziar()
      return
    }
    // O atraso é o que impede uma consulta por tecla digitada. A troca de termo
    // no meio do caminho já é tratada pelo hook: só a resposta do pedido atual
    // chega à tela.
    const t = setTimeout(() => void lista.recomecar(), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tick])

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-full border border-ink/15 bg-paper px-4 py-1 shadow-card focus-within:border-burgundy">
        <SearchIcon width={18} height={18} className="text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, OAB, cidade ou endereço…"
          aria-label="Buscar advogados"
          autoFocus
          className="w-full bg-transparent py-2.5 text-[14px] placeholder:text-ink-faint/60 focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
          {error}
        </p>
      )}

      {q.trim().length < 2 ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">
          Digite ao menos 2 caracteres para buscar.
        </p>
      ) : loading && !results ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">Buscando…</p>
      ) : results && results.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">Nenhum advogado encontrado.</p>
      ) : (
        <ul className="space-y-2.5">
          {(results ?? []).map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl2 border border-ink/10 bg-paper">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  onClick={() => setOpen(open === p.id ? null : p.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-ink">{p.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_META[p.moderationStatus].cls}`}
                    >
                      {STATUS_META[p.moderationStatus].label}
                    </span>
                    {!p.published && (
                      <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-ink-faint">
                        não publicado
                      </span>
                    )}
                    <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-ink-faint uppercase">
                      {p.plan}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-faint">
                    advoc.me/{p.slug} · {p.oabNumber} · {p.city}/{p.state}
                  </span>
                </button>
                <a
                  href={`/${p.slug}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-brass/50 hover:text-brass-deep"
                >
                  Ver perfil
                  <ExternalLinkIcon width={12} height={12} strokeWidth={1.8} />
                </a>
                {/* Ferramenta de MODERAÇÃO, não de selo: é como se julga uma
                    denúncia de registro falso (motivo `oab_invalid`). */}
                <a
                  href={cnaSearchUrl(p.name)}
                  target="_blank"
                  rel="noreferrer noopener nofollow"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-brass/50 hover:text-brass-deep"
                >
                  Conferir no CNA
                  <ExternalLinkIcon width={12} height={12} strokeWidth={1.8} />
                </a>
              </div>
              {open === p.id && (
                <FichaDoPerfil
                  profileId={p.id}
                  podeDecidir={podeDecidir}
                  podeSancionar={podeSancionar}
                  onChanged={() => setTick((n) => n + 1)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <Rodape
        mostrando={results?.length ?? 0}
        total={lista.total}
        temMais={lista.temMais}
        carregando={lista.carregando}
        onMais={() => void lista.mais()}
        nome="advogados"
      />
    </div>
  )
}

// ---- Aba: Suporte ao cliente ----
//
// A fila de chamados abertos pelos advogados. Cada item traz DE QUEM é (e-mail,
// nome, plano) e o contexto técnico que veio junto — sem isso o admin lê "não
// funciona" e não tem como reproduzir nada.

const TICKET_KIND_LABEL: Record<string, string> = {
  bug: 'Algo quebrado',
  duvida: 'Dúvida',
  conta: 'Conta ou plano',
  sugestao: 'Sugestão',
  outro: 'Outro',
}
const TICKET_STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em análise',
  resolved: 'Resolvido',
}
const TICKET_FILTERS = [
  { value: 'open', label: 'Abertos' },
  { value: 'in_progress', label: 'Em análise' },
  { value: 'resolved', label: 'Resolvidos' },
  { value: '', label: 'Todos' },
] as const

function SupportTab({ podeResponder }: { podeResponder: boolean }) {
  const [filtro, setFiltro] = useState<string>('open')
  const [aberto, setAberto] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const lista = usePaginado<AdminTicket>(
    (offset) => listTickets(filtro || undefined, offset),
    'Falha ao carregar os chamados.',
  )
  const { itens, erro, setErro } = lista
  const recarregar = lista.recomecar

  useEffect(() => {
    void recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  /**
   * A nota é o que o advogado lê em /suporte — e por isso é obrigatória. Fechar
   * um chamado sem uma linha de resposta é fechá-lo na cara de quem escreveu, e
   * o histórico ficaria com "resolvido" e nada mais.
   */
  async function mudar(id: string, status: 'open' | 'in_progress' | 'resolved') {
    const texto = (aberto === id ? nota : (itens?.find((t) => t.id === id)?.adminNote ?? '')).trim()
    if (texto.length < 5) {
      setAberto(id)
      setNota(itens?.find((t) => t.id === id)?.adminNote ?? '')
      setErro('Escreva a resposta antes de mudar a situação — é o que o advogado vai ler.')
      return
    }
    setBusy(id)
    setErro(null)
    try {
      await setTicketStatus(id, status, texto)
      setAberto(null)
      setNota('')
      await recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atualizar o chamado.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TICKET_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            aria-pressed={filtro === f.value}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              filtro === f.value
                ? 'border-burgundy bg-burgundy/[0.07] text-burgundy'
                : 'border-ink/15 text-ink-soft hover:border-brass/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && (
        <p className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
          {erro}
        </p>
      )}
      {!itens && !erro && <p className="py-10 text-center text-[13px] text-ink-faint">Carregando…</p>}
      {itens?.length === 0 && (
        <p className="py-10 text-center text-[13px] text-ink-faint">Nenhum chamado nesta situação.</p>
      )}

      <ul className="space-y-2.5">
        {(itens ?? []).map((t) => (
          <li key={t.id} className="rounded-xl2 border border-ink/10 bg-paper px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{t.subject}</span>
              <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                {TICKET_KIND_LABEL[t.kind] ?? t.kind}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  t.status === 'resolved'
                    ? 'bg-brass/20 text-brass-deep'
                    : t.status === 'in_progress'
                      ? 'bg-burgundy/10 text-burgundy'
                      : 'bg-ink/[0.06] text-ink-faint'
                }`}
              >
                {TICKET_STATUS_LABEL[t.status] ?? t.status}
              </span>
            </div>

            {/* De quem é o chamado: sem isso não há como reproduzir nem responder. */}
            <p className="mt-1 text-[12px] text-ink-faint">
              {t.user.profile?.name || 'Sem perfil'} · {t.user.email}
              {t.user.profile ? ` · ${t.user.profile.plan} · advoc.me/${t.user.profile.slug}` : ''}
              {' · '}
              {new Date(t.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>

            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
              {t.message}
            </p>

            {(t.pageUrl || t.userAgent) && (
              <p className="mt-2 break-all rounded-lg bg-paper-deep/60 px-2.5 py-2 text-[11px] leading-relaxed text-ink-faint">
                {t.pageUrl && (
                  <>
                    <span className="font-medium">Página:</span> {t.pageUrl}
                    <br />
                  </>
                )}
                {t.userAgent && (
                  <>
                    <span className="font-medium">Navegador:</span> {t.userAgent}
                  </>
                )}
              </p>
            )}

            {t.adminNote && aberto !== t.id && (
              <p className="mt-2 border-l-2 border-brass/50 pl-2.5 text-[12.5px] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">Resposta:</span> {t.adminNote}
              </p>
            )}

            {aberto === t.id && (
              <textarea
                rows={3}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Resposta para o advogado (aparece no chamado dele)…"
                className="mt-2.5 w-full resize-none rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
              />
            )}

            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setAberto((a) => (a === t.id ? null : t.id))
                  setNota(t.adminNote ?? '')
                }}
                disabled={!podeResponder}
                className="rounded-full border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-burgundy/40 hover:text-burgundy disabled:opacity-40"
              >
                {aberto === t.id ? 'Cancelar resposta' : t.adminNote ? 'Editar resposta' : 'Responder'}
              </button>
              {t.status !== 'in_progress' && (
                <button
                  type="button"
                  disabled={busy === t.id || !podeResponder}
                  onClick={() => mudar(t.id, 'in_progress')}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-burgundy/40 hover:text-burgundy disabled:opacity-50"
                >
                  Pôr em análise
                </button>
              )}
              {t.status !== 'resolved' ? (
                <button
                  type="button"
                  disabled={busy === t.id || !podeResponder}
                  onClick={() => mudar(t.id, 'resolved')}
                  className="inline-flex items-center gap-1 rounded-full bg-brass/20 px-3 py-1.5 text-[12.5px] font-semibold text-brass-deep transition-colors hover:bg-brass/30 disabled:opacity-50"
                >
                  <CheckIcon width={13} height={13} strokeWidth={2.6} /> Marcar resolvido
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === t.id || !podeResponder}
                  onClick={() => mudar(t.id, 'open')}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-burgundy/40 hover:text-burgundy disabled:opacity-50"
                >
                  Reabrir
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Rodape
        mostrando={itens?.length ?? 0}
        total={lista.total}
        temMais={lista.temMais}
        carregando={lista.carregando}
        onMais={() => void lista.mais()}
        nome="chamados"
      />
    </div>
  )
}
