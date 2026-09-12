// /sitemap.xml — a lista de endereços que o buscador pode indexar.
//
// Precisa ser gerado na hora, e não no build: perfis são publicados o tempo todo,
// e um mapa congelado no último deploy deixa de fora justamente quem acabou de
// entrar. Quem responde a lista é `GET /api/sitemap` (backend), que devolve só
// `slug` e data dos perfis e dos escritórios — ver ProfilesService.sitemap sobre
// por que o `/directory` não serve para isto.
//
// Só `<loc>` e `<lastmod>`. O Google documenta que ignora `priority` e
// `changefreq`, e que só usa `lastmod` quando ele é "consistentemente correto" —
// o nosso vem do `updatedAt` do banco, que muda quando o dono salva, e de mais
// nada. Inventar uma data para as páginas fixas seria justamente o que faz o
// Google parar de acreditar nas outras.
//
// Falha para o lado seguro: sem a API, devolve um mapa só com as páginas fixas.
// Um sitemap incompleto é bem melhor que um 500 — o buscador que recebe erro
// repetido reduz a frequência com que volta.

interface ContextoNetlify {
  next(): Promise<Response>
}

interface EntradaDoMapa {
  slug: string
  updatedAt: string
}

interface MapaDaApi {
  perfis: EntradaDoMapa[]
  escritorios: EntradaDoMapa[]
}

const PRAZO_MS = 5000

// As páginas fixas que valem indexação. O painel, o editor e as telas de conta
// ficam de fora de propósito: exigem sessão, então o buscador só encontraria a
// tela de login — e um resultado de busca que leva a um login é um resultado
// ruim, que a plataforma paga em posição. (Elas também recebem `noindex` na
// borda — ver perfil.ts.)
const FIXAS = [
  '/',
  '/legal/termos',
  '/legal/privacidade',
  '/legal/lgpd',
  '/legal/cookies',
  '/legal/moderacao',
  '/legal/denuncias',
  '/legal/ia',
]

export default async function handler(req: Request, _ctx: ContextoNetlify): Promise<Response> {
  const origem = new URL(req.url).origin
  const mapa = await buscarMapa(origem)

  const urls = [
    ...FIXAS.map((caminho) => entrada(origem + caminho)),
    ...mapa.perfis.map((p) => entrada(`${origem}/${p.slug}`, p.updatedAt)),
    ...mapa.escritorios.map((e) => entrada(`${origem}/escritorio/${e.slug}`, e.updatedAt)),
  ]

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Uma hora: o buscador não relê o mapa a cada minuto, e um perfil novo
      // aparece na próxima passagem dele de qualquer forma — e antes disso o
      // IndexNow já avisou o Bing (backend/src/seo/indexnow.ts).
      'cache-control': 'public, max-age=3600',
    },
  })
}

function entrada(loc: string, lastmod?: string): string {
  const data = lastmod && /^\d{4}-\d{2}-\d{2}/.test(lastmod) ? lastmod.slice(0, 10) : ''
  return (
    `  <url>\n    <loc>${escaparXml(loc)}</loc>\n` +
    (data ? `    <lastmod>${data}</lastmod>\n` : '') +
    `  </url>`
  )
}

async function buscarMapa(origem: string): Promise<MapaDaApi> {
  const vazio: MapaDaApi = { perfis: [], escritorios: [] }
  try {
    const r = await fetch(`${origem}/api/sitemap`, {
      signal: AbortSignal.timeout(PRAZO_MS),
      headers: { accept: 'application/json' },
    })
    if (!r.ok) return vazio
    const dados = (await r.json()) as unknown
    // O formato antigo da API era a lista de perfis, crua. A borda e o backend
    // sobem em deploys separados; aceitar os dois é o que evita um sitemap sem
    // perfil nenhum na janela entre eles.
    if (Array.isArray(dados)) return { perfis: filtrar(dados), escritorios: [] }
    if (dados && typeof dados === 'object') {
      const o = dados as Partial<MapaDaApi>
      return { perfis: filtrar(o.perfis), escritorios: filtrar(o.escritorios) }
    }
    return vazio
  } catch {
    return vazio
  }
}

function filtrar(lista: unknown): EntradaDoMapa[] {
  if (!Array.isArray(lista)) return []
  return lista.filter(
    (x): x is EntradaDoMapa =>
      !!x && typeof x === 'object' && typeof (x as EntradaDoMapa).slug === 'string' && /^[a-z0-9-]+$/.test((x as EntradaDoMapa).slug),
  )
}

/**
 * Escapa para XML. O slug é `[a-z0-9-]`, então na prática nada aqui precisa de
 * escape — mas um `&` que escapasse para dentro de um `<loc>` invalidaria o
 * documento INTEIRO, e um sitemap malformado é descartado por completo, não em
 * parte. O custo de estar certo é uma linha.
 */
function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
