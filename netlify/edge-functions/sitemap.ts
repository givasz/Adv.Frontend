// /sitemap.xml — a lista de endereços que o buscador pode indexar.
//
// Precisa ser gerado na hora, e não no build: perfis são publicados o tempo todo,
// e um mapa congelado no último deploy deixa de fora justamente quem acabou de
// entrar. Quem responde a lista é `GET /api/sitemap` (backend), que devolve só
// `slug` e data — ver o comentário de ProfilesService.sitemap sobre por que o
// `/directory` não serve para isto.
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

const PRAZO_MS = 5000

// As páginas fixas que valem indexação. O painel, o editor e as telas de conta
// ficam de fora de propósito: exigem sessão, então o buscador só encontraria a
// tela de login — e um resultado de busca que leva a um login é um resultado
// ruim, que a plataforma paga em posição.
const FIXAS: { caminho: string; prioridade: string; frequencia: string }[] = [
  { caminho: '/', prioridade: '1.0', frequencia: 'weekly' },
  { caminho: '/legal/termos', prioridade: '0.3', frequencia: 'monthly' },
  { caminho: '/legal/privacidade', prioridade: '0.3', frequencia: 'monthly' },
  { caminho: '/legal/lgpd', prioridade: '0.3', frequencia: 'monthly' },
  { caminho: '/legal/cookies', prioridade: '0.3', frequencia: 'monthly' },
  { caminho: '/legal/moderacao', prioridade: '0.3', frequencia: 'monthly' },
  { caminho: '/legal/denuncias', prioridade: '0.3', frequencia: 'monthly' },
  { caminho: '/legal/ia', prioridade: '0.3', frequencia: 'monthly' },
]

export default async function handler(req: Request, _ctx: ContextoNetlify): Promise<Response> {
  const origem = new URL(req.url).origin
  const perfis = await buscarPerfis(origem)

  const urls = [
    ...FIXAS.map(
      (f) =>
        `  <url>\n    <loc>${escaparXml(origem + f.caminho)}</loc>\n` +
        `    <changefreq>${f.frequencia}</changefreq>\n    <priority>${f.prioridade}</priority>\n  </url>`,
    ),
    ...perfis.map(
      (p) =>
        `  <url>\n    <loc>${escaparXml(`${origem}/${p.slug}`)}</loc>\n` +
        `    <lastmod>${escaparXml(p.updatedAt.slice(0, 10))}</lastmod>\n` +
        `    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ),
  ]

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Uma hora: o buscador não relê o mapa a cada minuto, e um perfil novo
      // aparece na próxima passagem dele de qualquer forma.
      'cache-control': 'public, max-age=3600',
    },
  })
}

async function buscarPerfis(origem: string): Promise<EntradaDoMapa[]> {
  try {
    const r = await fetch(`${origem}/api/sitemap`, {
      signal: AbortSignal.timeout(PRAZO_MS),
      headers: { accept: 'application/json' },
    })
    if (!r.ok) return []
    const dados = await r.json()
    return Array.isArray(dados) ? (dados as EntradaDoMapa[]) : []
  } catch {
    return []
  }
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
