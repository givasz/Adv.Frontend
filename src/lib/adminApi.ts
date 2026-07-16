// Camada de API do painel de administração (rota escondida).
// O painel sempre fala com o backend real (NestJS) — em dev, via proxy /api do Vite.
// O token de sessão é guardado em sessionStorage e enviado como Bearer.

import type { ModerationStatus, Profile, Report } from './types'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'advocme:admin:session'

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

export interface PendingOab {
  id: string
  name: string
  oabNumber: string
  city: string
  state: string
  slug: string
  updatedAt: string
}

// Um evento do histórico de conferência de OAB (append-only no backend).
export interface OabEvent {
  id: string
  fromStatus: string
  toStatus: string
  method: string
  reviewer: string
  reason: string
  createdAt: string
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
  oabStatus: string
}

// ---- Auth ----

export async function adminLogin(username: string, password: string): Promise<void> {
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

// ---- Fila de OAB (reaproveita endpoints existentes) ----

export async function listPendingOab(): Promise<PendingOab[]> {
  return json(await adminFetch('/admin/oab/pending'))
}

export async function decideOab(
  id: string,
  decision: 'verify' | 'reject',
  reason?: string,
): Promise<unknown> {
  return json(await adminFetch(`/admin/profiles/${id}/oab/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  }))
}

export async function oabHistory(id: string): Promise<OabEvent[]> {
  return json(await adminFetch(`/admin/profiles/${id}/oab/history`))
}
