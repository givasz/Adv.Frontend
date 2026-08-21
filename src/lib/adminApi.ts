// Camada de API do painel de administração (rota escondida).
// O painel sempre fala com o backend real (NestJS) — em dev, via proxy /api do Vite.
// O token de sessão é guardado em sessionStorage e enviado como Bearer.

import type { ModerationStatus, Profile, Report } from './types'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'advocme:admin:session'
// Sem backend configurado, o painel não teria como decidir nada — e o advogado
// ficaria "em análise" para sempre no ambiente de desenvolvimento. Só aqui (build
// de dev, sem VITE_API_URL) a fila de OAB usa o espelho local do api.ts; em
// produção o painel fala exclusivamente com o NestJS.
const MOCK_ADMIN =
  import.meta.env.DEV && import.meta.env.VITE_USE_REAL_API !== 'true' && !API_BASE

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function setAdminToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* sessionStorage indisponível */
  }
}
export function adminLogout() {
  setAdminToken(null)
}

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken()
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  return res
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
    setAdminToken('dev-local-session')
    return
  }
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await json<{ token: string }>(res)
  setAdminToken(data.token)
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
