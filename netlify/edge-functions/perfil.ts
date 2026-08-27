// A PRÉVIA DO LINK, servida antes da página existir.
//
// Roda no Netlify Edge (Deno), na frente de todas as páginas. Duas tarefas:
//
//   1. Numa página de perfil (`/:slug`), busca o perfil na API e injeta as meta
//      tags do advogado no index.html.
//   2. Em qualquer página, transforma o `og:image` relativo do index.html em
//      endereço absoluto.
//
// Ver src/lib/ogTags.ts para o porquê da primeira — em resumo: robô de prévia não
// executa JavaScript, então tudo que o app escreve no <head> depois de carregar é
// invisível para o WhatsApp.
//
// A segunda existe porque o padrão Open Graph pede URL absoluta em `og:image`.
// Facebook e WhatsApp resolvem um caminho relativo assim mesmo; o LinkedIn não —
// e advogado compartilha no LinkedIn. Escrever o endereço absoluto no index.html
// exigiria saber o domínio no momento do build, que é justamente o que ainda não
// foi decidido. Na borda, ele sai da origem da própria requisição: funciona hoje
// em advocme.netlify.app, funciona em cada prévia de deploy, e funciona no
// domínio próprio no dia em que existir — sem tocar em nada. Mesmo raciocínio do
// `Sitemap:` em robots.ts.
//
// SERVE PARA TODO MUNDO, não só para os robôs.
//
// Dava para detectar o User-Agent do WhatsApp e entregar o HTML enriquecido só a
// ele. Não fazemos, por duas razões. A primeira é que isso é *cloaking* — servir
// conteúdo diferente a buscador e a pessoa — e é o que os buscadores punem. A
// segunda é operacional: um caminho que só roda para robôs é um caminho que
// ninguém testa, e a lista de User-Agents de mensageiro muda sem aviso. Todo
// mundo recebendo o mesmo HTML é mais simples e mais honesto.
//
// FALHA PARA O LADO SEGURO. Se a API não responder, se o perfil não existir, se
// qualquer coisa der errado — devolve o HTML sem as tags do perfil. O pior
// desfecho possível é a prévia genérica que já existia; a página funciona
// normalmente, porque quem desenha o perfil é o React, não esta função.

import { ehSlugDePerfil, headDoPerfil, OG_PADRAO, type PerfilCompartilhavel } from '../../src/lib/ogTags.ts'

/** Só o que esta função usa do contexto do Netlify — sem depender do pacote de tipos. */
interface ContextoNetlify {
  next(): Promise<Response>
}

// A API demora o que demorar, mas a página não pode ficar refém dela: passado o
// prazo, servimos o HTML sem as tags do perfil. Três segundos é folgado para uma
// consulta por slug indexado e curto o bastante para o robô do WhatsApp não
// desistir antes — eles costumam cortar em torno de 10s, e ainda temos de
// entregar o documento.
const PRAZO_MS = 3000

export default async function handler(req: Request, ctx: ContextoNetlify): Promise<Response> {
  const url = new URL(req.url)
  const resposta = await ctx.next()

  // Só mexemos em HTML: o resto (assets, respostas da API, redirecionamentos)
  // passa intocado e sem custo de leitura de corpo.
  const tipo = resposta.headers.get('content-type') ?? ''
  if (!tipo.includes('text/html')) return resposta

  let html = await resposta.text()

  // (2) og:image absoluto, em toda página.
  html = html.replace(`content="${OG_PADRAO}"`, `content="${url.origin}${OG_PADRAO}"`)

  // (1) Página de perfil: as tags do advogado por cima das genéricas.
  const perfil = ehSlugDePerfil(url.pathname)
    ? await buscarPerfil(url.origin, url.pathname.split('/').filter(Boolean)[0])
    : null

  const headers = new Headers(resposta.headers)

  if (perfil) {
    const slug = url.pathname.split('/').filter(Boolean)[0]
    const head = headDoPerfil(perfil, `${url.origin}/${slug}`, url.origin)
    // Quando a mesma propriedade aparece duas vezes, os leitores de Open Graph
    // honram a PRIMEIRA — então o <title>, a description e as og: genéricas do
    // index.html precisam sair, ou continuariam vencendo as do advogado.
    html = html
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace(/<meta\s+name="description"[\s\S]*?\/>/i, '')
      .replace(/<meta\s+property="og:(?:type|title|description|image)"[\s\S]*?\/>/gi, '')
      .replace(/<meta\s+name="twitter:card"[\s\S]*?\/>/i, '')
    html = html.includes('</head>') ? html.replace('</head>', `    ${head}\n  </head>`) : html
    // O HTML agora varia por perfil: sem isto, a borda poderia guardar a página
    // de um advogado e entregá-la no endereço de outro.
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  }

  // O comprimento mudou; deixar o antigo trunca a resposta.
  headers.delete('content-length')
  return new Response(html, { status: resposta.status, headers })
}

async function buscarPerfil(origem: string, slug: string): Promise<PerfilCompartilhavel | null> {
  try {
    // Chamada relativa à própria origem: o `/api/*` do netlify.toml repassa ao
    // backend. Apontar direto para o host da VPS deixaria o endereço da API
    // escrito em dois lugares — e um deles fora do controle de variável de ambiente.
    const r = await fetch(`${origem}/api/profiles/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(PRAZO_MS),
      headers: { accept: 'application/json' },
    })
    if (!r.ok) return null
    const p = (await r.json()) as PerfilCompartilhavel
    // Um JSON sem nome não é um perfil — provavelmente é uma página de erro.
    return p && typeof p.name === 'string' && p.name ? p : null
  } catch {
    return null
  }
}
