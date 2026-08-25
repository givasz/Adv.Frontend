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

import type { ModerationStatus, Profile, Report } from './types'
import { CSRF_HEADER } from './http'

import { API_BASE, TEM_BACKEND } from './http'
// Sem backend configurado, o painel não teria como decidir nada — e o advogado
// ficaria "em análise" para sempre no ambiente de desenvolvimento. Só aqui (build
// de dev, sem VITE_API_URL) a fila de OAB usa o espelho local do api.ts; em
// produção o painel fala exclusivamente com o NestJS.
const MOCK_ADMIN =
  import.meta.env.DEV && !TEM_BACKEND

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

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `Erro ${res.status}`)
  }
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

export async function adminLogin(username: string, password: string): Promise<void> {
  // Dev sem backend: as MESMAS credenciais padrão do NestJS (admin/dev-admin-123),
  // conferidas localmente só para abrir o painel do ambiente de desenvolvimento.
  if (MOCK_ADMIN) {
    if (username !== 'admin' || password !== 'dev-admin-123') throw new Error('Credenciais inválidas')
    mockAutenticado = true
    return
  }
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include',
  })
  const data = await json<{ csrfToken: string }>(res)
  csrfToken = data.csrfToken
}

/**
 * O painel ainda está aberto neste navegador?
 *
 * O cookie é HttpOnly: recarregar a página apaga tudo o que o JavaScript sabia, e
 * perguntar ao servidor é a única forma de descobrir que a sessão continua de pé.
 * De quebra, é aqui que o token anti-CSRF volta para a memória do módulo.
 */
export async function adminSessaoAtiva(): Promise<boolean> {
  if (MOCK_ADMIN) return mockAutenticado
  try {
    const res = await fetch(`${API_BASE}/api/admin/me`, { credentials: 'include' })
    if (!res.ok) return false
    const { csrfToken: token } = (await res.json()) as { csrfToken: string }
    csrfToken = token
    return true
  } catch {
    return false
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

// ---- Denúncias / moderação ----

export async function listReports(
  status: 'open' | 'resolved' | 'dismissed' | 'all' = 'open',
): Promise<ReportGroup[]> {
  return json(await adminFetch(`/admin/reports?status=${status}`))
}

export async function getModerationProfile(id: string): Promise<ModerationProfile> {
  return json(await adminFetch(`/admin/profiles/${id}/moderation`))
}

export async function moderateProfile(
  id: string,
  body: {
    action: 'warn' | 'partial' | 'restrict' | 'clear'
    note?: string
    hiddenSections?: string[]
    reportIds?: string[]
  },
): Promise<ModerationProfile> {
  return json(await adminFetch(`/admin/profiles/${id}/moderate`, {
    method: 'POST',
    body: JSON.stringify(body),
  }))
}

export async function dismissReport(id: string): Promise<{ ok: boolean }> {
  return json(await adminFetch(`/admin/reports/${id}/dismiss`, { method: 'POST' }))
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

export async function setTicketStatus(
  id: string,
  status: 'open' | 'in_progress' | 'resolved',
  note?: string,
): Promise<{ ok: boolean }> {
  return json(
    await adminFetch(`/admin/support/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    }),
  )
}
