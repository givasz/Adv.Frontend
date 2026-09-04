// Camada de API do painel de administração (rota escondida).
// O painel sempre fala com o backend real (NestJS) — em dev, via proxy /api do Vite.
//
// A sessão do painel é um cookie HttpOnly com caminho `/api/admin` (ver
// backend/src/admin/admin-auth.ts): este código não guarda nem consegue ler
// credencial nenhuma. Antes o token ficava no `sessionStorage` e ia como Bearer —
// legível por qualquer script que entrasse na página do painel.
//
// O que fica aqui é o token anti-CSRF, na memória do módulo. Ele não autentica
// sozinho (sem o cookie é inútil), mas o backend recusa toda ação do painel que
// não o traga no cabeçalho.
//
// Desde a fase da identidade, `/admin/me` devolve também QUEM está logado e o que
// esse papel abre. A tela não decide permissão — ela desenha o que o servidor
// disse que existe; quem recusa de verdade é sempre a API.

import type { ModerationStatus, Profile, Report } from './types'
import { CSRF_HEADER } from './http'

import { API_BASE, TEM_BACKEND } from './http'
// Sem backend configurado, o painel não teria como decidir nada. Só aqui (build
// de dev, sem VITE_API_URL) o painel abre em modo de mentira; em produção ele
// fala exclusivamente com o NestJS.
const MOCK_ADMIN = import.meta.env.DEV && !TEM_BACKEND

let csrfToken: string | null = null
let mockAutenticado = false

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS'])

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const [k, v] of new Headers(init.headers)) headers.set(k, v)
  if (!SEGUROS.has(method) && csrfToken) headers.set(CSRF_HEADER, csrfToken)
  return fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
    // Sem isto o cookie do painel não viaja quando o front e a API são sites
    // diferentes (Netlify + VPS) — e o painel responderia 403 para tudo.
    credentials: 'include',
  })
}

/** A mensagem que o Nest devolve vem embrulhada em JSON; o texto cru é o resto. */
function mensagemDe(bruto: string): string {
  try {
    const corpo = JSON.parse(bruto) as { message?: string | string[] }
    const m = corpo?.message
    return Array.isArray(m) ? m.join(' ') : (m ?? bruto)
  } catch {
    return bruto
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    // A mensagem do servidor é a que explica o "não" — "seu papel não permite",
    // "escreva o motivo", "configure o segundo fator". Trocá-la por "Erro 403"
    // faria o painel mentir sobre o que aconteceu.
    throw new Error(mensagemDe(msg) || `Erro ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---- Paginação ----
//
// As quatro listas do painel cortavam em silêncio: a busca devolvia 50 e nada
// dizia que havia um 51º. Agora toda lista diz de quantos ela é uma fatia.

/** Uma fatia de lista que sabe de que tamanho é o todo. */
export interface Pagina<T> {
  itens: T[]
  total: number
  offset: number
  limite: number
  temMais: boolean
}

/** Uma fatia de trilha: sem total, com o ponto de onde continuar. */
export interface Trilha<T> {
  itens: T[]
  proximo: string | null
  temMais: boolean
}

// ---- Tipos de resposta ----

export interface ReportGroup {
  profile: Pick<
    Profile,
    'name' | 'slug' | 'oabNumber' | 'city' | 'state' | 'published'
  > & { id: string; moderationStatus: ModerationStatus }
  reports: Report[]
  openCount: number
  total: number
}

export interface ModerationProfile extends Profile {
  id: string
  /** Dono da página — é por ele que se chega aos degraus 4 e 5. */
  userId: string
  hiddenSections: string
  /** Quando a medida vence sozinha. Nulo = sem prazo. */
  moderationUntil: string | null
  billingPausedAt: string | null
  reports: Report[]
}

export interface AdminProfile {
  id: string
  name: string
  slug: string
  oabNumber: string
  city: string
  state: string
  plan: 'free' | 'pro' | 'premium'
  published: boolean
  moderationStatus: ModerationStatus
}

// ---- Auth ----

export type AdminRole = 'owner' | 'moderator' | 'support' | 'readonly'

/** Quem está no painel e o que este papel abre. */
export interface AdminMe {
  csrfToken: string
  /** Nulo quando entrou pela credencial de emergência do .env. */
  id: string | null
  name: string
  role: AdminRole
  permissoes: string[]
  /** O papel exige segundo fator e ele ainda não foi configurado. */
  totpPendente: boolean
  /** Entrou pela credencial do .env porque ainda não há administrador criado. */
  emergencia: boolean
  producao: boolean
}

const ME_MOCK: AdminMe = {
  csrfToken: '',
  id: null,
  name: 'admin (desenvolvimento)',
  role: 'owner',
  permissoes: [
    'painel:abrir',
    'moderacao:ler',
    'moderacao:decidir',
    'contas:ler',
    'suporte:ler',
    'suporte:responder',
    'auditoria:ler',
    'metricas:ler',
    'admins:gerir',
  ],
  totpPendente: false,
  emergencia: true,
  producao: false,
}

/** Erro que o painel reconhece: a senha passou, falta o código de 6 dígitos. */
export class PrecisaSegundoFator extends Error {}

export async function adminLogin(
  username: string,
  password: string,
  totp?: string,
): Promise<AdminMe> {
  // Dev sem backend: as MESMAS credenciais padrão do NestJS (admin/dev-admin-123),
  // conferidas localmente só para abrir o painel do ambiente de desenvolvimento.
  if (MOCK_ADMIN) {
    if (username !== 'admin' || password !== 'dev-admin-123') throw new Error('Credenciais inválidas')
    mockAutenticado = true
    return ME_MOCK
  }
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, totp: totp || undefined }),
    credentials: 'include',
  })
  if (!res.ok) {
    const msg = mensagemDe(await res.text().catch(() => ''))
    // O servidor distingue "senha errada" de "faltou o código" de propósito:
    // quem já passou pela senha precisa saber o que falta, senão fica tentando
    // a senha de novo.
    if (/verifica[çc]/i.test(msg)) throw new PrecisaSegundoFator(msg)
    throw new Error(msg || 'Usuário ou senha inválidos.')
  }
  await res.json()
  // O login já devolve papel e prazo, mas quem monta a tela é sempre o /me: uma
  // fonte só evita a tela e o servidor discordarem sobre o que está aberto.
  const me = await adminSessao()
  if (!me) throw new Error('A sessão não foi aberta. Tente novamente.')
  return me
}

/**
 * O painel ainda está aberto neste navegador — e para quem?
 *
 * O cookie é HttpOnly: recarregar a página apaga tudo o que o JavaScript sabia, e
 * perguntar ao servidor é a única forma de descobrir que a sessão continua de pé.
 * De quebra, é aqui que o token anti-CSRF volta para a memória do módulo.
 */
export async function adminSessao(): Promise<AdminMe | null> {
  if (MOCK_ADMIN) return mockAutenticado ? ME_MOCK : null
  try {
    const res = await fetch(`${API_BASE}/api/admin/me`, { credentials: 'include' })
    if (!res.ok) return null
    const me = (await res.json()) as AdminMe
    csrfToken = me.csrfToken
    return me
  } catch {
    return null
  }
}

/** Sair do painel: o servidor apaga a sessão e manda descartar o cookie. */
export async function adminLogout(): Promise<void> {
  csrfToken = null
  mockAutenticado = false
  if (MOCK_ADMIN) return
  try {
    await fetch(`${API_BASE}/api/admin/logout`, { method: 'POST', credentials: 'include' })
  } catch {
    /* rede fora — a sessão vence sozinha no prazo */
  }
}

// ---- A própria conta ----

export async function trocarSenhaAdmin(atual: string, nova: string): Promise<void> {
  await json(
    await adminFetch('/admin/me/password', {
      method: 'POST',
      body: JSON.stringify({ atual, nova }),
    }),
  )
}

export async function totpIniciar(): Promise<{ segredo: string; otpauth: string }> {
  return json(await adminFetch('/admin/me/totp/start', { method: 'POST' }))
}

export async function totpLigar(codigo: string): Promise<void> {
  await json(
    await adminFetch('/admin/me/totp/enable', {
      method: 'POST',
      body: JSON.stringify({ codigo }),
    }),
  )
}

export async function totpDesligar(senha: string, codigo: string): Promise<void> {
  await json(
    await adminFetch('/admin/me/totp/disable', {
      method: 'POST',
      body: JSON.stringify({ senha, codigo }),
    }),
  )
}

// ---- Equipe do painel ----

export interface AdminConta {
  id: string
  email: string
  name: string
  role: AdminRole
  active: boolean
  totpEnabled: boolean
  createdAt: string
  lastLoginAt: string | null
  sessoes: number
}

export interface PapelInfo {
  id: AdminRole
  label: string
  descricao: string
}

export async function listarAdmins(): Promise<{ admins: AdminConta[]; papeis: PapelInfo[] }> {
  return json(await adminFetch('/admin/admins'))
}

export async function criarAdmin(dados: {
  email: string
  name: string
  password: string
  role: string
}): Promise<AdminConta> {
  return json(await adminFetch('/admin/admins', { method: 'POST', body: JSON.stringify(dados) }))
}

export async function atualizarAdmin(
  id: string,
  dados: { name?: string; role?: string; active?: boolean; reason?: string },
): Promise<AdminConta> {
  return json(
    await adminFetch(`/admin/admins/${id}`, { method: 'POST', body: JSON.stringify(dados) }),
  )
}

export async function revogarSessoesAdmin(
  id: string,
  reason: string,
): Promise<{ encerradas: number }> {
  return json(
    await adminFetch(`/admin/admins/${id}/revogar`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  )
}

// ---- Contestações ----
//
// O que torna o prazo real. A plataforma tem 10 dias para responder e, se não
// responder, a medida cai sozinha — o relógio é o `moderationUntil` encurtado
// na abertura, não uma máquina nova. Ver docs/politica-de-sancoes.md § 5.

export interface AdminAppeal {
  id: string
  alvo: 'profile' | 'account'
  medida: string
  texto: string
  respondeAte: string
  status: 'open' | 'accepted' | 'rejected' | 'expired'
  resposta: string
  decidedAt: string | null
  createdAt: string
  user: {
    email: string
    suspendedUntil: string | null
    closedAt: string | null
    profile: { id: string; name: string; slug: string; moderationNote: string } | null
  }
}

export async function listarContestacoes(
  status = 'open',
  offset = 0,
  limite = 25,
): Promise<Pagina<AdminAppeal>> {
  return json(await adminFetch(`/admin/appeals?status=${status}&offset=${offset}&limite=${limite}`))
}

export async function contadoresContestacoes(): Promise<{ abertas: number; vencendo: number }> {
  return json(await adminFetch('/admin/appeals/counts'))
}

export async function decidirContestacao(
  id: string,
  aceita: boolean,
  resposta: string,
): Promise<{ ok: boolean; aceita: boolean }> {
  return json(
    await adminFetch(`/admin/appeals/${id}/decidir`, {
      method: 'POST',
      body: JSON.stringify({ aceita, resposta }),
    }),
  )
}

// ---- Histórico ----

export interface AdminAcao {
  id: string
  adminLabel: string
  adminRole: string
  action: string
  targetType: string
  targetId: string
  reason: string
  before: string
  after: string
  createdAt: string
}

/**
 * O histórico é paginado por CURSOR: passe de volta o `proximo` que veio na
 * resposta anterior. Com deslocamento, uma ação registrada entre um "carregar
 * mais" e o seguinte empurraria a lista e a página seguinte repetiria o que já
 * estava na tela — numa trilha de auditoria isso é uma leitura errada do que houve.
 */
export async function listarAcoes(
  filtros: {
    action?: string
    targetType?: string
    targetId?: string
    limite?: number
    cursor?: string
  } = {},
): Promise<Trilha<AdminAcao>> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, String(v))
  const cauda = q.toString() ? `?${q}` : ''
  return json(await adminFetch(`/admin/actions${cauda}`))
}

// ---- Levantamentos ----

export interface Levantamentos {
  dias: number
  agora: {
    contas: number
    perfis: number
    publicados: number
    rascunhos: number
    escritorios: number
    porPlano: Record<string, number>
    porCobranca: Record<string, number>
    porModeracao: Record<string, number>
    emCortesia: number
    aceitePendente: number
    aceiteEmDia: number
  }
  serie: { dia: string; free: number; pro: number; premium: number; publicados: number }[]
  novasContas: { semana: string; total: number }[]
  eventosMes: { mes: string; eventos: Record<string, number> }[]
  porUf: { uf: string; total: number }[]
  cobertura: { desde: string | null; ate: string | null; dias: number; buracos: string[] }
}

/**
 * Os números da plataforma. `dias` recorta a SÉRIE; o retrato de "agora" é
 * sempre o de agora.
 */
export async function carregarLevantamentos(dias = 90): Promise<Levantamentos> {
  if (MOCK_ADMIN) return levantamentosDeMentira(dias)
  return json(await adminFetch(`/admin/levantamentos?dias=${dias}`))
}

/**
 * Números inventados para o painel de desenvolvimento — e para o teste de fumaça.
 *
 * Sem isto a aba abriria vazia em dev, e o `npm run smoke` (que percorre o painel
 * num navegador de verdade) nunca DESENHARIA um gráfico. É desenhando que se
 * descobre eixo estourado, rótulo colidindo e divisão por zero — nada disso
 * aparece no tsc nem no vitest.
 *
 * De propósito: a série tem um BURACO (o dia 12 não existe) e um mês com vários
 * eventos, para os dois caminhos menos percorridos serem os que o smoke pisa.
 */
function levantamentosDeMentira(dias: number): Levantamentos {
  const hoje = new Date()
  const serie: Levantamentos['serie'] = []
  for (let i = 21; i >= 0; i--) {
    if (i === 9) continue // o buraco
    const d = new Date(hoje)
    d.setDate(d.getDate() - i)
    const free = 12 + Math.round(Math.sin(i / 3) * 2) + Math.floor((21 - i) / 4)
    const pro = 4 + Math.floor((21 - i) / 7)
    const premium = 2 + Math.floor((21 - i) / 11)
    serie.push({
      dia: d.toISOString().slice(0, 10),
      free,
      pro,
      premium,
      publicados: free + pro + premium - 3,
    })
  }
  const semanas: Levantamentos['novasContas'] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje)
    d.setDate(d.getDate() - i * 7 - ((d.getDay() + 6) % 7))
    semanas.push({ semana: d.toISOString().slice(0, 10), total: 1 + ((i * 3) % 5) })
  }
  return {
    dias,
    agora: {
      contas: 24,
      perfis: 23,
      publicados: 17,
      rascunhos: 6,
      escritorios: 2,
      porPlano: { free: 16, pro: 5, premium: 2 },
      porCobranca: { active: 6, past_due: 1 },
      porModeracao: { active: 21, warned: 1, restricted: 1 },
      emCortesia: 1,
      aceitePendente: 3,
      aceiteEmDia: 21,
    },
    serie,
    novasContas: semanas,
    eventosMes: [
      { mes: mesDeMentira(hoje, 1), eventos: { view: 214, whatsapp: 63, scheduling: 18 } },
      { mes: mesDeMentira(hoje, 0), eventos: { view: 168, whatsapp: 51, social: 22, email: 9 } },
    ],
    porUf: [
      { uf: 'SP', total: 7 },
      { uf: 'MG', total: 5 },
      { uf: 'RJ', total: 3 },
      { uf: 'BA', total: 2 },
    ],
    cobertura: {
      desde: serie[0]?.dia ?? null,
      ate: serie[serie.length - 1]?.dia ?? null,
      dias: serie.length,
      buracos: [buracoDeMentira(hoje)],
    },
  }
}

function mesDeMentira(hoje: Date, atras: number): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - atras, 1)
  return d.toISOString().slice(0, 10)
}

function buracoDeMentira(hoje: Date): string {
  const d = new Date(hoje)
  d.setDate(d.getDate() - 9)
  return d.toISOString().slice(0, 10)
}

// ---- Denúncias / moderação ----

/** A fila é paginada por PERFIL: quarenta denúncias do mesmo perfil são uma linha. */
export async function listReports(
  status: 'open' | 'resolved' | 'dismissed' | 'all' = 'open',
  offset = 0,
  limite = 25,
): Promise<Pagina<ReportGroup>> {
  return json(await adminFetch(`/admin/reports?status=${status}&offset=${offset}&limite=${limite}`))
}

export async function getModerationProfile(id: string): Promise<ModerationProfile> {
  return json(await adminFetch(`/admin/profiles/${id}/moderation`))
}

/**
 * Aplica a decisão.
 *
 * `note` é o texto que o advogado lê no editor — e é ele que vale como motivo no
 * histórico. Ao LIBERAR o perfil o aviso sai da página, então o motivo vai em
 * `reason`, só para o registro. O servidor recusa a decisão sem um dos dois: uma
 * decisão sem motivo escrito é uma decisão que ninguém consegue contestar.
 */
export async function moderateProfile(
  id: string,
  body: {
    action: 'warn' | 'partial' | 'restrict' | 'clear'
    note?: string
    reason?: string
    /** Por quantos dias a medida vale. 0 = sem prazo. */
    dias?: number
    hiddenSections?: string[]
    reportIds?: string[]
  },
): Promise<ModerationProfile> {
  return json(
    await adminFetch(`/admin/profiles/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

export async function dismissReport(id: string, reason: string): Promise<{ ok: boolean }> {
  return json(
    await adminFetch(`/admin/reports/${id}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  )
}

// ---- A conta por trás do perfil ----
//
// Degraus 4 e 5 da escada (docs/politica-de-sancoes.md). Até esta fase o painel
// parava no perfil: dava para tirar a página do ar e não dava para impedir que a
// mesma pessoa publicasse outra no dia seguinte.

export interface ContaFicha {
  id: string
  email: string
  createdAt: string
  suspendedAt: string | null
  suspendedUntil: string | null
  suspendedReason: string
  closedAt: string | null
  closedReason: string
  sessoes: number
  chamados: number
  perfil: {
    id: string
    name: string
    slug: string
    plan: string
    published: boolean
    moderationStatus: ModerationStatus
    moderationUntil: string | null
    billingPausedAt: string | null
    oabNumber: string
    denuncias: number
  } | null
  historico: AdminAcao[]
}

export async function fichaDaConta(userId: string): Promise<ContaFicha> {
  return json(await adminFetch(`/admin/users/${userId}`))
}

export async function suspenderConta(
  userId: string,
  reason: string,
  dias?: number,
): Promise<{ ok: boolean; ate: string | null }> {
  return json(
    await adminFetch(`/admin/users/${userId}/suspender`, {
      method: 'POST',
      body: JSON.stringify({ reason, dias }),
    }),
  )
}

export async function reativarConta(userId: string, reason: string): Promise<{ ok: boolean }> {
  return json(
    await adminFetch(`/admin/users/${userId}/reativar`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  )
}

/** Definitivo. O servidor exige que a conta já esteja suspensa e o e-mail digitado. */
export async function encerrarConta(
  userId: string,
  reason: string,
  confirmacao: string,
): Promise<{ ok: boolean; enderecoLiberado: string | null }> {
  return json(
    await adminFetch(`/admin/users/${userId}/encerrar`, {
      method: 'POST',
      body: JSON.stringify({ reason, confirmacao }),
    }),
  )
}

// ---- Busca de advogados (painel) ----

export async function searchProfiles(
  q: string,
  offset = 0,
  limite = 25,
): Promise<Pagina<AdminProfile>> {
  return json(
    await adminFetch(
      `/admin/profiles?q=${encodeURIComponent(q)}&offset=${offset}&limite=${limite}`,
    ),
  )
}

// ---- Suporte ao cliente ----

export interface AdminTicket {
  id: string
  kind: 'bug' | 'duvida' | 'conta' | 'sugestao' | 'outro'
  subject: string
  message: string
  pageUrl: string
  userAgent: string
  status: 'open' | 'in_progress' | 'resolved'
  adminNote: string
  createdAt: string
  handledAt: string | null
  user: {
    email: string
    profile: { name: string; slug: string; plan: string; oabNumber: string } | null
  }
}

export async function listTickets(
  status?: string,
  offset = 0,
  limite = 25,
): Promise<Pagina<AdminTicket>> {
  const q = new URLSearchParams({ offset: String(offset), limite: String(limite) })
  if (status) q.set('status', status)
  return json(await adminFetch(`/admin/support?${q}`))
}

export async function ticketCounts(): Promise<Record<string, number>> {
  return json(await adminFetch('/admin/support/counts'))
}

/** A nota é o que o advogado lê em /suporte — por isso ela é obrigatória. */
export async function setTicketStatus(
  id: string,
  status: 'open' | 'in_progress' | 'resolved',
  note: string,
): Promise<{ ok: boolean }> {
  return json(
    await adminFetch(`/admin/support/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    }),
  )
}
