// Toda chamada à API passa por aqui.
//
// Existe por causa de duas coisas que, esquecidas UMA vez, quebram a sessão ou a
// segurança dela em silêncio:
//
//   • `credentials: 'include'` — sem isso o navegador não anexa o cookie da
//     sessão numa chamada para outro site (o front no Netlify, a API na VPS), e
//     a requisição chega deslogada sem nenhum erro visível.
//   • o cabeçalho anti-CSRF nos métodos que escrevem. O servidor recusa (403) um
//     POST/PUT/DELETE autenticado que não o traga.
//
// A credencial em si nunca passa por aqui: ela mora num cookie HttpOnly que este
// código não consegue ler — e é exatamente esse o ponto. Nada de token no
// localStorage, nada que um XSS possa carregar embora.

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Cabeçalho onde o token anti-CSRF volta. Espelha backend/src/auth/csrf.ts. */
export const CSRF_HEADER = 'x-csrf-token'

const CSRF_COOKIE = 'advocme_csrf'
const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS'])

// O token vem em duas vias, porque o deploy tem duas formas:
//   • mesmo site (advoc.me + api.advoc.me): o cookie legível chega ao navegador
//     e este código o lê direto;
//   • sites diferentes (Netlify + VPS): o cookie é do domínio da API e a página
//     não o alcança — então o valor vem no corpo de /auth/login e /auth/me e
//     fica aqui na memória.
// Memória, e não localStorage: o token sozinho não autentica nada (sem o cookie
// HttpOnly ele é inútil), mas guardar o mínimo é sempre mais barato de defender.
let tokenEmMemoria: string | null = null

/** Guarda o token anti-CSRF devolvido pelo login/`/auth/me`. */
export function setCsrfToken(token: string | null): void {
  tokenEmMemoria = token
}

function doCookie(): string | null {
  if (typeof document === 'undefined') return null
  for (const parte of document.cookie.split(';')) {
    const i = parte.indexOf('=')
    if (i < 1) continue
    const nome = parte.slice(0, i).trim()
    if (nome === CSRF_COOKIE || nome === `__Host-${CSRF_COOKIE}`) {
      try {
        return decodeURIComponent(parte.slice(i + 1).trim())
      } catch {
        return parte.slice(i + 1).trim()
      }
    }
  }
  return null
}

/** Token anti-CSRF atual, se houver sessão. */
export function csrfToken(): string | null {
  return tokenEmMemoria ?? doCookie()
}

/**
 * `fetch` para a API. O caminho começa em `/api/...`; a base do backend entra
 * aqui (em dev sem VITE_API_URL, o proxy do Vite resolve).
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (!SEGUROS.has(method)) {
    const token = csrfToken()
    if (token) headers.set(CSRF_HEADER, token)
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    method: init.method,
    headers,
    // O cookie da sessão só viaja com isto — inclusive entre sites diferentes.
    credentials: 'include',
  })
}
