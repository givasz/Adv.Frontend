// Autenticação de usuário (advogado) — cadastro/login por e-mail.
//
// A sessão vive num COOKIE HttpOnly escrito pelo servidor. Este arquivo nunca vê
// a credencial: ele não consegue lê-la, e é essa a intenção — um script injetado
// na página (XSS) não tem o que roubar, e fechar o navegador não desloga ninguém,
// porque o cookie tem prazo próprio e volta sozinho na próxima visita.
//
// O que fica aqui é só o retrato de quem está logado. Ao abrir o site,
// `/api/auth/me` confirma com o servidor (é a única forma de saber, já que o
// cookie é invisível para o JavaScript) e o retrato é atualizado.
//
// Espelha a camada `api.ts`: funciona em modo MOCK (contas no localStorage, sem
// backend) e em modo REAL (endpoints /api/auth/* do NestJS).
//
// Regra de produto: conta é OPCIONAL no Free (dá pra recuperar/editar depois) e
// OBRIGATÓRIA para assinar um plano pago. O gate vive na UI (ver `requireAccount`).

import { useSyncExternalStore } from 'react'
import { apiFetch, setCsrfToken } from './http'
import { passwordProblem } from './passwordStrength'

export interface AuthUser {
  id: string
  email: string
  name?: string
  /** plano do perfil vinculado (informativo) */
  plan?: string
}

export interface Session {
  user: AuthUser
  /** epoch ms — quando a sessão expira (informativo; quem manda é o cookie) */
  expiresAt?: number
  /** o login pediu para ser lembrado? */
  remember?: boolean
}

// Retrato de quem está logado — nome, e-mail, plano. NÃO é credencial: serve
// para a interface já abrir com o cabeçalho certo, em vez de piscar "deslogado"
// enquanto o servidor responde. Quem decide se a sessão vale é o cookie.
const USER_KEY = 'advocme:user'
const ACCOUNTS_KEY = 'advocme:accounts' // só no modo mock

// Modo real (backend) quando explicitamente ligado OU quando há backend
// configurado (VITE_API_URL). Assim, no Netlify, conta e perfil ficam no
// servidor. Em dev sem VITE_API_URL, mock.
const useReal =
  import.meta.env.VITE_USE_REAL_API === 'true' || !!(import.meta.env.VITE_API_URL ?? '')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---- Store reativo ----------------------------------------------------------

function lerRetrato(): Session | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    return s?.user?.id && s.user.email ? s : null
  } catch {
    return null
  }
}

let current: Session | null = lerRetrato()
let conferido = !useReal // no mock não há servidor a consultar
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
  try {
    if (s) localStorage.setItem(USER_KEY, JSON.stringify(s))
    else localStorage.removeItem(USER_KEY)
  } catch {
    /* armazenamento indisponível (aba privativa) — a sessão segue no cookie */
  }
  emit()
}

/**
 * Esquece quem estava logado NESTE navegador, sem falar com o servidor.
 *
 * Para quando não há mais sessão a encerrar do outro lado: a conta acabou de ser
 * excluída. Precisa passar por aqui (e não por um `localStorage.removeItem`
 * solto) porque é o store reativo que faz o cabeçalho parar de mostrar a pessoa
 * como logada — apagar a chave por fora não avisa ninguém.
 */
export function esquecerSessaoLocal(): void {
  setCsrfToken(null)
  setSession(null)
}

/** Sessão atual (não reativa) — para uso fora de componentes (ex.: api.ts). */
export function getSession(): Session | null {
  return current
}

export function isAuthenticated(): boolean {
  return !!current
}

/** A conferência inicial com o servidor já terminou? */
export function sessaoConferida(): boolean {
  return conferido
}

// ---- Conferência com o servidor ---------------------------------------------

interface RespostaSessao {
  user: AuthUser
  expiresAt?: number
  csrfToken?: string
  remember?: boolean
}

function aplicar(dados: RespostaSessao): Session {
  setCsrfToken(dados.csrfToken ?? null)
  const sessao: Session = {
    user: dados.user,
    expiresAt: dados.expiresAt,
    remember: dados.remember,
  }
  setSession(sessao)
  return sessao
}

/**
 * Pergunta ao servidor quem está logado neste navegador.
 *
 * É o que faz a sessão sobreviver a fechar e reabrir o navegador: o cookie volta
 * sozinho na primeira chamada e o servidor responde com a pessoa. Também é aqui
 * que a renovação deslizante acontece do outro lado — usar o site empurra o prazo
 * para a frente.
 *
 * Uma chamada por carregamento de página. Não vale a pena evitá-la: é a única
 * forma de saber, e o servidor responde a partir de um cache curto.
 */
export async function revalidarSessao(): Promise<Session | null> {
  if (!useReal) {
    conferido = true
    return current
  }
  try {
    const res = await apiFetch('/api/auth/me')
    if (res.ok) {
      const dados = (await res.json()) as RespostaSessao
      const sessao = aplicar(dados)
      conferido = true
      return sessao
    }
    // 401 = não há sessão. Qualquer outra falha é do servidor, não da sessão:
    // derrubar o retrato ali seria deslogar alguém por causa de um deploy.
    if (res.status === 401) {
      setCsrfToken(null)
      setSession(null)
    }
  } catch {
    /* rede fora — mantém o retrato e tenta de novo na próxima */
  }
  conferido = true
  emit()
  return current
}

// A conferência começa junto com o app. Sem `await`: a interface abre com o
// retrato guardado e se corrige em seguida, se for o caso.
if (useReal) void revalidarSessao()

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

function mockSession(user: AuthUser, remember: boolean): Session {
  return { user, remember, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 }
}

// ---- API pública ------------------------------------------------------------

// Validação do CADASTRO. O login não passa por aqui de propósito: endurecer a
// regra não pode trancar quem já tem conta com a senha antiga.
function validate(email: string, password: string) {
  if (!EMAIL_RE.test(email)) throw new Error('Informe um e-mail válido.')
  const problema = passwordProblem(password, email)
  if (problema) throw new Error(problema)
}

export async function signup(
  emailRaw: string,
  password: string,
  name?: string,
  remember = true,
): Promise<Session> {
  const email = emailRaw.trim().toLowerCase()
  validate(email, password)
  const cleanName = name?.trim() || undefined

  if (useReal) {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: cleanName, remember }),
    })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'Não foi possível criar a conta.')
    conferido = true
    return aplicar((await res.json()) as RespostaSessao)
  }

  const accounts = loadAccounts()
  if (accounts.some((a) => a.email === email)) {
    throw new Error('Já existe uma conta com este e-mail. Faça login.')
  }
  const user: AuthUser = { id: `u-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, email, name: cleanName }
  saveAccounts([...accounts, { ...user, password }])
  const session = mockSession(user, remember)
  setSession(session)
  return session
}

export async function login(
  emailRaw: string,
  password: string,
  remember = true,
): Promise<Session> {
  const email = emailRaw.trim().toLowerCase()

  if (useReal) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    })
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'E-mail ou senha incorretos.')
    conferido = true
    return aplicar((await res.json()) as RespostaSessao)
  }

  const account = loadAccounts().find((a) => a.email === email)
  if (!account || account.password !== password) {
    throw new Error('E-mail ou senha incorretos.')
  }
  const { password: _pw, ...user } = account
  const session = mockSession(user, remember)
  setSession(session)
  return session
}

/**
 * Sair. Avisa o servidor ANTES de esquecer quem estava logado: é lá que a sessão
 * é apagada e é de lá que vem a ordem de descartar o cookie. Sem esse aviso, sair
 * limparia só a aparência — o cookie continuaria valendo até vencer.
 *
 * A limpeza local acontece de qualquer jeito: se a rede falhar, a pessoa continua
 * saindo daqui.
 */
export async function logout(): Promise<void> {
  const eraReal = useReal && !!current
  setCsrfToken(null)
  setSession(null)
  if (!eraReal) return
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } catch {
    /* rede fora — o cookie expira sozinho no prazo */
  }
}

/**
 * Encerra a sessão de TODOS os aparelhos. Para quando o celular some ou a senha
 * vazou: derruba o que estiver aberto em qualquer lugar, e não só aqui.
 */
export async function logoutEverywhere(): Promise<number> {
  if (!useReal || !current) {
    setSession(null)
    return 0
  }
  const res = await apiFetch('/api/auth/logout-all', { method: 'POST' })
  setCsrfToken(null)
  setSession(null)
  if (!res.ok) throw new Error('Não foi possível encerrar as sessões.')
  const { encerradas } = (await res.json()) as { encerradas: number }
  return encerradas
}

/** Quantos aparelhos estão logados nesta conta agora. */
export async function countOpenSessions(): Promise<number | null> {
  if (!useReal || !current) return null
  try {
    const res = await apiFetch('/api/account/sessions')
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
