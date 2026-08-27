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
  hiddenSections: string
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

export async function listarAcoes(
  filtros: { action?: string; targetType?: string; targetId?: string; limite?: number } = {},
): Promise<AdminAcao[]> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, String(v))
  const cauda = q.toString() ? `?${q}` : ''
  return json(await adminFetch(`/admin/actions${cauda}`))
}

// ---- Denúncias / moderação ----

export async function listReports(
  status: 'open' | 'resolved' | 'dismissed' | 'all' = 'open',
): Promise<ReportGroup[]> {
  return json(await adminFetch(`/admin/reports?status=${status}`))
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

// ---- Busca de advogados (painel) ----

export async function searchProfiles(q: string): Promise<AdminProfile[]> {
  return json(await adminFetch(`/admin/profiles?q=${encodeURIComponent(q)}`))
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

export async function listTickets(status?: string): Promise<AdminTicket[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return json(await adminFetch(`/admin/support${q}`))
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
