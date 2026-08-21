// Autenticação de usuário (advogado) — cadastro/login por e-mail.
//
// Espelha a camada `api.ts`: funciona em modo MOCK (contas em localStorage, sem
// backend) e em modo REAL (endpoints /api/auth/* do NestJS). A sessão fica em
// localStorage e um pequeno store reativo (useSyncExternalStore) avisa a UI.
//
// Regra de produto: conta é OPCIONAL no Free (dá pra recuperar/editar depois) e
// OBRIGATÓRIA para assinar um plano pago. O gate vive na UI (ver `requireAccount`).

import { useSyncExternalStore } from 'react'
import { passwordProblem } from './passwordStrength'

export interface AuthUser {
  id: string
  email: string
  name?: string
  /** plano do perfil vinculado (informativo) */
  plan?: string
}

export interface Session {
  token: string
  user: AuthUser
  /** epoch ms — quando a sessão expira (opcional no mock) */
  expiresAt?: number
}

const SESSION_KEY = 'advocme:session'
const ACCOUNTS_KEY = 'advocme:accounts' // só no modo mock

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
// Segue o MESMO modo dos perfis (api.ts): backend real quando VITE_USE_REAL_API=true
// OU quando há backend configurado (VITE_API_URL). Assim, no Netlify, conta e perfil
// ficam no backend do Render (sem localStorage). Em dev sem VITE_API_URL, mock.
const useReal = import.meta.env.VITE_USE_REAL_API === 'true' || !!API_BASE

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---- Store reativo ----------------------------------------------------------

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (s?.expiresAt && s.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return s && s.token && s.user ? s : null
  } catch {
    return null
  }
}

let current: Session | null = loadSession()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function snapshot() {
  return current
}

function setSession(s: Session | null) {
  current = s
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  else localStorage.removeItem(SESSION_KEY)
  emit()
}

/** Sessão atual (não reativa) — para uso fora de componentes (ex.: api.ts). */
export function getSession(): Session | null {
  return current
}

/** Header de autorização para anexar às chamadas de API (vazio se deslogado). */
export function authHeader(): Record<string, string> {
  return current?.token ? { Authorization: `Bearer ${current.token}` } : {}
}

export function isAuthenticated(): boolean {
  return !!current
}

// ---- Mock (localStorage) ----------------------------------------------------

interface MockAccount extends AuthUser {
  password: string
}

function loadAccounts(): MockAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function saveAccounts(list: MockAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
}

function mockSession(user: AuthUser): Session {
  return { token: `mock-${user.id}`, user, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 }
}

// ---- API pública ------------------------------------------------------------

// Validação do CADASTRO. O login não passa por aqui de propósito: endurecer a
// regra não pode trancar quem já tem conta com a senha antiga.
function validate(email: string, password: string) {
  if (!EMAIL_RE.test(email)) throw new Error('Informe um e-mail válido.')
  const problema = passwordProblem(password, email)
  if (problema) throw new Error(problema)
}

export async function signup(emailRaw: string, password: string, name?: string): Promise<Session> {
  const email = emailRaw.trim().toLowerCase()
  validate(email, password)
  const cleanName = name?.trim() || undefined

  if (useReal) {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: cleanName }),
    })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'Não foi possível criar a conta.')
    const session = (await res.json()) as Session
    setSession(session)
    return session
  }

  const accounts = loadAccounts()
  if (accounts.some((a) => a.email === email)) {
    throw new Error('Já existe uma conta com este e-mail. Faça login.')
  }
  const user: AuthUser = { id: `u-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, email, name: cleanName }
  saveAccounts([...accounts, { ...user, password }])
  const session = mockSession(user)
  setSession(session)
  return session
}

export async function login(emailRaw: string, password: string): Promise<Session> {
  const email = emailRaw.trim().toLowerCase()

  if (useReal) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'E-mail ou senha incorretos.')
    const session = (await res.json()) as Session
    setSession(session)
    return session
  }

  const account = loadAccounts().find((a) => a.email === email)
  if (!account || account.password !== password) {
    throw new Error('E-mail ou senha incorretos.')
  }
  const { password: _pw, ...user } = account
  const session = mockSession(user)
  setSession(session)
  return session
}

/**
 * Sair. Avisa o servidor ANTES de esquecer o token: é lá que a sessão é apagada.
 * Sem esse aviso, sair só limpava este navegador — um token copiado antes seguia
 * entrando por até 7 dias, porque o servidor não tinha como saber que a sessão
 * tinha acabado.
 *
 * A limpeza local acontece de qualquer jeito: se a rede falhar, a pessoa continua
 * saindo daqui. O token vencerá sozinho no prazo dele.
 */
export async function logout(): Promise<void> {
  const token = current?.token
  setSession(null)
  if (!useReal || !token) return
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* rede fora — o token expira sozinho no prazo */
  }
}

/**
 * Encerra a sessão de TODOS os aparelhos. Para quando o celular some ou a senha
 * vazou: derruba o que estiver aberto em qualquer lugar, e não só aqui.
 */
export async function logoutEverywhere(): Promise<number> {
  const token = current?.token
  if (!useReal || !token) {
    setSession(null)
    return 0
  }
  const res = await fetch(`${API_BASE}/api/auth/logout-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  setSession(null)
  if (!res.ok) throw new Error('Não foi possível encerrar as sessões.')
  const { encerradas } = (await res.json()) as { encerradas: number }
  return encerradas
}

/** Quantos aparelhos estão logados nesta conta agora. */
export async function countOpenSessions(): Promise<number | null> {
  if (!useReal || !current?.token) return null
  try {
    const res = await fetch(`${API_BASE}/api/account/sessions`, { headers: authHeader() })
    if (!res.ok) return null
    const { abertas } = (await res.json()) as { abertas: number }
    return abertas
  } catch {
    return null
  }
}

// ---- Hook -------------------------------------------------------------------

export function useAuth() {
  const session = useSyncExternalStore(subscribe, snapshot, snapshot)
  return {
    session,
    user: session?.user ?? null,
    isAuthed: !!session,
    signup,
    login,
    logout,
    logoutEverywhere,
  }
}
