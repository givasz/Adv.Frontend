// A função de borda, de ponta a ponta, sobre o index.html DE VERDADE.
//
// ogTags.spec.ts prova que as tags e o corpo estático são montados certo. Este
// arquivo prova o que acontece com eles: que entram no documento que o Netlify
// serve, que as tags genéricas do index.html SAEM (leitor de Open Graph honra a
// primeira ocorrência), que o corpo vai para dentro do #root, e que as páginas
// do app recebem noindex. A função é TypeScript puro sem API do Deno — por isso
// o Node a importa como qualquer módulo.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../netlify/edge-functions/perfil.ts'
import { HOME } from './ogTags'

const INDEX = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf-8')
const ORIGEM = 'https://advocme.netlify.app'

const ctx = {
  next: async () => new Response(INDEX, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
}

const perfil = {
  slug: 'ana-ribeiro',
  name: 'Ana Ribeiro',
  oabNumber: 'OAB/SP 123.456',
  headline: 'Advogada',
  bio: 'Atuação em direito de família.',
  city: 'São Paulo',
  state: 'SP',
  areas: [{ label: 'Direito de Família' }],
}

function apiRespondendo(corpo: unknown, status = 200) {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(corpo), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function servir(caminho: string): Promise<string> {
  const r = await handler(new Request(`${ORIGEM}${caminho}`), ctx)
  return r.text()
}

afterEach(() => vi.unstubAllGlobals())

describe('a página de um perfil', () => {
  it('leva as tags do advogado, sem as genéricas, e o corpo dentro do #root', async () => {
    const fetchMock = apiRespondendo(perfil)
    const html = await servir('/ana-ribeiro')

    // A borda busca sem contar visita: o navegador do visitante vai contar.
    expect(fetchMock.mock.calls[0][0]).toBe(`${ORIGEM}/api/profiles/ana-ribeiro?origem=borda`)

    expect(html).toContain('<title data-advocme-seo>Ana Ribeiro — Advogado(a) de Direito de Família em São Paulo/SP · advoc.me</title>')
    // Uma só de cada — a do index.html saiu.
    expect(html.match(/<title/g)).toHaveLength(1)
    expect(html.match(/name="description"/g)).toHaveLength(1)
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
    expect(html.match(/property="og:image"/g)).toHaveLength(1)
    expect(html.match(/name="robots"/g)).toHaveLength(1)
    expect(html).toContain(`<link rel="canonical" href="${ORIGEM}/ana-ribeiro"`)
    expect(html).toContain('"@type":"ProfilePage"')
    // O corpo estático, dentro do #root, para o React substituir.
    expect(html).toContain('<div id="root"><style data-advocme-estatico>')
    expect(html).toContain('<h1>Ana Ribeiro</h1>')
    // O app continua sendo carregado: nada disto substitui o React.
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>')
  })

  it('a URL com barra final e parâmetros de campanha tem a mesma canônica', async () => {
    apiRespondendo(perfil)
    const html = await servir('/ana-ribeiro/?utm_source=instagram')
    expect(html).toContain(`<link rel="canonical" href="${ORIGEM}/ana-ribeiro"`)
  })

  it('perfil inexistente: noindex, sem título da home, sem corpo', async () => {
    apiRespondendo({ statusCode: 404 }, 404)
    const html = await servir('/ninguem-aqui')
    expect(html).toContain('<title data-advocme-seo>Página não encontrada · advoc.me</title>')
    expect(html).toContain('content="noindex, follow"')
    expect(html).toContain('<div id="root"></div>')
  })

  it('API fora do ar: o documento sai inteiro, com o head genérico', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('rede')
      }),
    )
    const html = await servir('/ana-ribeiro')
    expect(html).toContain('<div id="root"></div>')
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>')
  })
})

describe('a home', () => {
  it('leva Organization/WebSite, canônica, og:image absoluto e o texto da home', async () => {
    const fetchMock = apiRespondendo(perfil)
    const html = await servir('/')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(html).toContain(`<title data-advocme-seo>${HOME.title}</title>`)
    expect(html.match(/<title/g)).toHaveLength(1)
    expect(html).toContain('"@type":"Organization"')
    expect(html).toContain(`content="${ORIGEM}/og-padrao.jpg"`)
    expect(html).not.toContain('content="/og-padrao.jpg"')
    expect(html).toContain(`<link rel="canonical" href="${ORIGEM}/"`)
    expect(html).toContain('<h1>Seu escritório começa aqui.</h1>')
  })
})

describe('as páginas do app', () => {
  it.each(['/painel', '/entrar', '/ana-ribeiro/agendar', '/__preview/classic', '/escritorio/editar'])(
    '%s recebe noindex e canônica, sem buscar nada na API',
    async (caminho) => {
      const fetchMock = apiRespondendo(perfil)
      const html = await servir(caminho)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(html).toContain('<meta name="robots" content="noindex, follow" data-advocme-seo>')
      // Uma robots só: a do index.html ("index, follow…") saiu.
      expect(html.match(/name="robots"/g)).toHaveLength(1)
      expect(html).toContain(`<link rel="canonical" href="${ORIGEM}${caminho}"`)
      expect(html).toContain('<div id="root"></div>')
    },
  )

  it('documento legal: indexável, com canônica, sem corpo', async () => {
    const html = await servir('/legal/termos')
    expect(html).toContain('content="index, follow"')
    expect(html).toContain(`<link rel="canonical" href="${ORIGEM}/legal/termos"`)
  })
})

describe('a página de um escritório', () => {
  it('busca em /api/firms e monta LegalService', async () => {
    const fetchMock = apiRespondendo({
      slug: 'ribeiro-advogados',
      name: 'Ribeiro Advogados',
      oabRegistry: 'OAB/SP 12.345',
      tagline: '',
      about: '',
      city: 'São Paulo',
      state: 'SP',
      areas: [],
      lawyers: [{ slug: 'ana-ribeiro', name: 'Ana Ribeiro', oabNumber: 'OAB/SP 1', area: 'Família' }],
    })
    const html = await servir('/escritorio/ribeiro-advogados')
    expect(fetchMock.mock.calls[0][0]).toBe(`${ORIGEM}/api/firms/ribeiro-advogados`)
    expect(html).toContain('"@type":"LegalService"')
    expect(html).toContain('<h1>Ribeiro Advogados</h1>')
  })
})

describe('o que não é HTML passa intocado', () => {
  it('JSON da API não é lido nem alterado', async () => {
    const corpo = '{"a":1}'
    const r = await handler(new Request(`${ORIGEM}/api/x`), {
      next: async () => new Response(corpo, { headers: { 'content-type': 'application/json' } }),
    })
    expect(await r.text()).toBe(corpo)
  })
})
