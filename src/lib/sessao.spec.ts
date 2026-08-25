// O contrato da sessão do lado do navegador.
//
// Estes testes existem por causa de uma falha que passou por tudo: quem criava
// conta caía num perfil em branco. A causa não era uma linha errada, e sim três
// decisões tomadas no escuro — "tem sessão?" respondida antes de o servidor
// responder, "não tem perfil" confundido com "não tem sessão", e o rascunho de
// uma conta sobrevivendo à saída da outra no mesmo navegador.
//
// Nada aqui depende de React: é o store e a camada de dados, direto.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const USER_KEY = 'advocme:user'
const DRAFT_KEY = 'advocme:profile:draft'

// localStorage de mentira — o ambiente do vitest aqui é node puro.
class MemoriaLocal {
  private dados = new Map<string, string>()
  getItem(k: string) {
    return this.dados.has(k) ? (this.dados.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.dados.set(k, String(v))
  }
  removeItem(k: string) {
    this.dados.delete(k)
  }
  clear() {
    this.dados.clear()
  }
}

const retrato = {
  user: { id: 'u1', email: 'ana@exemplo.com', name: 'Ana' },
  expiresAt: Date.now() + 3_600_000,
  remember: true,
}

/**
 * Carrega auth.ts + api.ts do zero, no modo REAL, com o `fetch` que o teste
 * mandar. Precisa ser por import dinâmico: os dois módulos decidem o modo e
 * disparam a conferência da sessão no momento em que são carregados.
 */
async function carregarModulos(fetchFalso: typeof fetch) {
  vi.resetModules()
  vi.stubGlobal('localStorage', new MemoriaLocal())
  vi.stubGlobal('document', { cookie: '' })
  vi.stubGlobal('fetch', fetchFalso)
  vi.stubEnv('VITE_USE_REAL_API', 'true')
  vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com')
  return { auth: await import('./auth'), api: await import('./api') }
}

function resposta(status: number, corpo: unknown = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
    text: async () => (corpo === null ? '' : JSON.stringify(corpo)),
  } as unknown as Response
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('conferência inicial da sessão', () => {
  it('espera o servidor antes de dizer que ninguém está logado', async () => {
    let liberar: (r: Response) => void = () => {}
    const emEspera = new Promise<Response>((r) => (liberar = r))
    const { auth } = await carregarModulos(() => emEspera)

    // Enquanto a resposta não chega, o estado é "conferindo" — e é isso que
    // impede o RequireAuth de expulsar quem tem cookie válido.
    expect(auth.sessaoConferida()).toBe(false)

    liberar(resposta(200, { user: retrato.user, csrfToken: 't', expiresAt: retrato.expiresAt }))
    await auth.aguardarSessao()

    expect(auth.sessaoConferida()).toBe(true)
    expect(auth.isAuthenticated()).toBe(true)
  })

  it('401 na conferência esquece o retrato guardado', async () => {
    vi.resetModules()
    const memoria = new MemoriaLocal()
    memoria.setItem(USER_KEY, JSON.stringify(retrato))
    vi.stubGlobal('localStorage', memoria)
    vi.stubGlobal('document', { cookie: '' })
    // A recusa demora um instante — como na vida real. É nesse instante que a
    // interface tem de abrir com o retrato, em vez de piscar "deslogado".
    let recusar: (r: Response) => void = () => {}
    vi.stubGlobal('fetch', () => new Promise<Response>((r) => (recusar = r)))
    vi.stubEnv('VITE_USE_REAL_API', 'true')
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com')

    const auth = await import('./auth')
    expect(auth.isAuthenticated()).toBe(true) // abre com o retrato
    recusar(resposta(401))
    await auth.aguardarSessao()
    expect(auth.isAuthenticated()).toBe(false) // e se corrige
    expect(memoria.getItem(USER_KEY)).toBeNull()
  })
})

describe('getDraft com conta', () => {
  it('não decide antes da conferência — o perfil vem do servidor', async () => {
    const chamadas: string[] = []
    const { api } = await carregarModulos(async (url) => {
      const caminho = String(url)
      chamadas.push(caminho)
      if (caminho.endsWith('/api/auth/me')) {
        return resposta(200, { user: retrato.user, csrfToken: 't' })
      }
      return resposta(200, { slug: 'ana-silva-4821', name: 'Ana Silva', published: true })
    })

    const p = await api.api.getDraft()
    expect(chamadas.some((c) => c.endsWith('/api/profiles/me'))).toBe(true)
    expect(p.slug).toBe('ana-silva-4821')
    expect(p.published).toBe(true)
  })

  it('não mistura o rascunho de outra conta guardado no navegador', async () => {
    vi.resetModules()
    const memoria = new MemoriaLocal()
    // Resíduo de quem usou este computador antes.
    memoria.setItem(
      DRAFT_KEY,
      JSON.stringify({ slug: 'joao-antigo', name: 'João Antigo', bio: 'bio do João' }),
    )
    vi.stubGlobal('localStorage', memoria)
    vi.stubGlobal('document', { cookie: '' })
    vi.stubGlobal('fetch', async (url: RequestInfo | URL) =>
      String(url).endsWith('/api/auth/me')
        ? resposta(200, { user: retrato.user, csrfToken: 't' })
        : resposta(200, { slug: 'ana-silva-4821', name: 'Ana Silva' }),
    )
    vi.stubEnv('VITE_USE_REAL_API', 'true')
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com')

    const { api } = await import('./api')
    const p = await api.getDraft()
    expect(p.name).toBe('Ana Silva')
    expect(p.bio).toBe('') // e NÃO a bio do João
  })

  it('401 vira SessaoExpirada — não um perfil em branco', async () => {
    const { api, auth } = await carregarModulos(async (url) =>
      String(url).endsWith('/api/auth/me')
        ? resposta(200, { user: retrato.user, csrfToken: 't' })
        : resposta(401),
    )
    await expect(api.api.getDraft()).rejects.toBeInstanceOf(api.SessaoExpirada)
    // E o retrato cai junto, para as telas protegidas levarem ao login.
    expect(auth.isAuthenticated()).toBe(false)
  })
})

describe('saveDraft com conta', () => {
  it('sem sessão, recusa em vez de gravar no navegador em silêncio', async () => {
    const { api } = await carregarModulos(async () => resposta(401))
    const perfil = { slug: 'x', name: 'X' } as never
    await expect(api.api.saveDraft(perfil)).rejects.toBeInstanceOf(api.SessaoExpirada)
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })
})

describe('sair', () => {
  it('apaga o rascunho local junto com o retrato', async () => {
    const { auth } = await carregarModulos(async (url) =>
      String(url).endsWith('/api/auth/me')
        ? resposta(200, { user: retrato.user, csrfToken: 't' })
        : resposta(204),
    )
    await auth.aguardarSessao()
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ slug: 'ana', name: 'Ana' }))

    await auth.logout()

    expect(auth.isAuthenticated()).toBe(false)
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
    expect(localStorage.getItem(USER_KEY)).toBeNull()
  })
})

describe('a API é servida no mesmo endereço do site', () => {
  // Este bloco existe por causa de um bug que passou por 296 testes, por dois
  // builds e por um smoke em navegador de verdade — e ainda assim deixava o app
  // inutilizável em TODO iPhone.
  //
  // Enquanto as chamadas iam para o endereço absoluto do backend, o navegador
  // via dois SITES diferentes e o cookie da sessão era "de terceiros". Safari
  // descarta esses cookies: o login respondia 201, o cookie era gravado e jogado
  // fora, e a chamada seguinte chegava deslogada. Em Chromium tudo funcionava,
  // que é por isso que ninguém viu.
  //
  // A regra que não pode voltar a ser quebrada: mesmo com VITE_API_URL definida,
  // a chamada sai RELATIVA. Quem serve o /api é o proxy (Netlify em produção,
  // Vite em desenvolvimento).

  it('chama caminho relativo mesmo com VITE_API_URL definida', async () => {
    const chamadas: string[] = []
    await carregarModulos(async (url) => {
      chamadas.push(String(url))
      return resposta(401)
    })
    const { apiFetch } = await import('./http')
    await apiFetch('/api/auth/me')

    for (const url of chamadas) {
      expect(url.startsWith('/')).toBe(true)
      expect(url).not.toContain('api.exemplo.com')
    }
  })

  it('VITE_API_DIRECT é a única forma de sair do mesmo site', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', new MemoriaLocal())
    vi.stubGlobal('document', { cookie: '' })
    vi.stubGlobal('fetch', async () => resposta(401))
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com')
    vi.stubEnv('VITE_API_DIRECT', 'https://depuracao.exemplo.com')

    const { API_BASE, TEM_BACKEND } = await import('./http')
    expect(API_BASE).toBe('https://depuracao.exemplo.com')
    expect(TEM_BACKEND).toBe(true)
  })
})
