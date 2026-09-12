// O QUE A PÁGINA DIZ ANTES DE EXISTIR — servido na borda, para todo mundo.
//
// Roda no Netlify Edge (Deno), na frente de todas as páginas HTML. Por caminho:
//
//   • `/`                  → head da home (título único, Organization/WebSite
//                            em JSON-LD) e o texto da home dentro do #root;
//   • `/:slug`             → busca o perfil na API e injeta as meta tags do
//                            advogado, o dado estruturado e o perfil em HTML
//                            simples dentro do #root;
//   • `/escritorio/:slug`  → o mesmo, para a página da sociedade;
//   • qualquer outra       → `noindex` (painel, editor, login, /x/agendar…).
//
// E em TODA página HTML: canônica absoluta e `og:image` absoluto.
//
// Ver src/lib/ogTags.ts para o porquê de cada tag — em resumo: robô de prévia
// não executa JavaScript, então tudo que o app escreve no <head> depois de
// carregar é invisível para o WhatsApp. E robô de busca por IA (ChatGPT,
// Perplexity, Claude) não executa também — para eles, uma <div id="root">
// vazia é uma página vazia. O corpo estático é a resposta: o React o substitui
// ao montar, e quem não roda JavaScript fica com ele.
//
// O endereço absoluto sai da origem da própria requisição: funciona hoje em
// advocme.netlify.app, funciona em cada prévia de deploy, e funciona no domínio
// próprio — sem tocar em nada. Mesmo raciocínio do `Sitemap:` em robots.ts.
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

import {
  corpoDaHome,
  corpoDoEscritorio,
  corpoDoPerfil,
  ehSlugDePerfil,
  OG_PADRAO,
  paginaIndexavel,
  renderHead,
  ROBOTS_NAO_INDEXAR,
  slugDeEscritorio,
  tagsDaHome,
  tagsDoEscritorio,
  tagsDoPerfil,
  urlCanonica,
  type EscritorioCompartilhavel,
  type PerfilCompartilhavel,
} from '../../src/lib/ogTags.ts'

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
  const headers = new Headers(resposta.headers)

  // og:image absoluto, em toda página.
  //
  // A SUBSTITUIÇÃO é uma FUNÇÃO, aqui e em todo replace abaixo — nunca uma
  // string. `String.replace` interpreta padrões `$` na string de troca ($&, $`,
  // $'), e texto que passa por aqui carrega conteúdo que não controlamos: um `$'`
  // no nome do advogado (que o escapeHtml transforma em `$&#39;`, criando um
  // `$&`) injetava o casamento no meio do atributo, e um ``$` `` repetia TODO o
  // prefixo do documento a cada ocorrência — ~4 KB por caractere, uma bomba de
  // amplificação numa URL pública (auditoria de 03/09). Com função, `$` é só um
  // cifrão.
  html = html.replace(`content="${OG_PADRAO}"`, () => `content="${url.origin}${OG_PADRAO}"`)

  const pagina = await decidir(url)

  if (pagina) {
    html = trocarHead(html, renderHead(pagina.head))
    if (pagina.corpo) html = trocarCorpo(html, pagina.corpo)
    // O HTML agora varia por página: sem isto, a borda poderia guardar a página
    // de um advogado e entregá-la no endereço de outro.
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  } else {
    // Página do app (painel, login, editor…): fora do índice, com canônica. A
    // `robots` genérica do index.html sai — duas na mesma página é o Google
    // escolhendo a mais restritiva, mas é melhor não deixar escolha.
    const extra =
      `<meta name="robots" content="${ROBOTS_NAO_INDEXAR}" data-advocme-seo>\n    ` +
      `<link rel="canonical" href="${urlCanonica(url.origin, url.pathname)}" data-advocme-seo>`
    html = html.replace(/<meta\s+name="robots"[\s\S]*?\/>/i, '')
    html = html.includes('</head>') ? html.replace('</head>', () => `    ${extra}\n  </head>`) : html
  }

  // O comprimento mudou; deixar o antigo trunca a resposta.
  headers.delete('content-length')
  return new Response(html, { status: resposta.status, headers })
}

interface Pagina {
  head: ReturnType<typeof tagsDaHome>
  corpo: string | null
}

/** Que página é esta e o que ela diz de si. `null` = página do app, só noindex. */
async function decidir(url: URL): Promise<Pagina | null> {
  const origem = url.origin
  const canonica = urlCanonica(origem, url.pathname)

  if (url.pathname === '/' || url.pathname === '') {
    return { head: tagsDaHome(origem), corpo: corpoDaHome() }
  }

  if (ehSlugDePerfil(url.pathname)) {
    const slug = url.pathname.split('/').filter(Boolean)[0]
    const perfil = await buscar<PerfilCompartilhavel>(origem, `/api/profiles/${encodeURIComponent(slug)}?origem=borda`)
    // Perfil que não existe: a página do app vai dizer "não encontrado", e ela
    // não deve entrar no índice — nem levar o título genérico da home.
    if (!perfil) return { head: tagsDoNaoEncontrado(canonica), corpo: null }
    return { head: tagsDoPerfil(perfil, canonica, origem), corpo: corpoDoPerfil(perfil, origem) }
  }

  const escritorio = slugDeEscritorio(url.pathname)
  if (escritorio) {
    const firm = await buscar<EscritorioCompartilhavel>(origem, `/api/firms/${encodeURIComponent(escritorio)}`)
    if (!firm) return { head: tagsDoNaoEncontrado(canonica), corpo: null }
    return { head: tagsDoEscritorio(firm, canonica, origem), corpo: corpoDoEscritorio(firm) }
  }

  if (paginaIndexavel(url.pathname)) {
    // Documentos legais: o título vem do app; aqui só o que a borda sabe —
    // canônica e permissão de indexar.
    return {
      head: [
        { tipo: 'meta', attr: 'name', chave: 'robots', valor: 'index, follow' },
        { tipo: 'link', rel: 'canonical', href: canonica },
      ],
      corpo: null,
    }
  }

  return null
}

function tagsDoNaoEncontrado(canonica: string): Pagina['head'] {
  return [
    { tipo: 'title', texto: 'Página não encontrada · advoc.me' },
    { tipo: 'meta', attr: 'name', chave: 'robots', valor: ROBOTS_NAO_INDEXAR },
    { tipo: 'link', rel: 'canonical', href: canonica },
  ]
}

/**
 * Tira do index.html o que a página vai dizer por conta própria. Quando a mesma
 * propriedade aparece duas vezes, os leitores de Open Graph honram a PRIMEIRA —
 * então o <title>, a description e as og: genéricas precisam sair, ou
 * continuariam vencendo as da página.
 */
function trocarHead(html: string, head: string): string {
  const limpo = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="(?:description|robots|twitter:card)"[\s\S]*?\/>/gi, '')
    .replace(/<meta\s+property="og:[a-z:_]+"[\s\S]*?\/>/gi, '')
  return limpo.includes('</head>') ? limpo.replace('</head>', () => `    ${head}\n  </head>`) : limpo
}

/** O corpo estático entra DENTRO do #root: é o React quem o substitui ao montar. */
function trocarCorpo(html: string, corpo: string): string {
  return html.replace('<div id="root"></div>', () => `<div id="root">${corpo}</div>`)
}

async function buscar<T extends { name?: unknown }>(origem: string, caminho: string): Promise<T | null> {
  try {
    // Chamada relativa à própria origem: o `/api/*` do netlify.toml repassa ao
    // backend. Apontar direto para o host da VPS deixaria o endereço da API
    // escrito em dois lugares — e um deles fora do controle de variável de ambiente.
    const r = await fetch(`${origem}${caminho}`, {
      signal: AbortSignal.timeout(PRAZO_MS),
      headers: { accept: 'application/json' },
    })
    if (!r.ok) return null
    const p = (await r.json()) as T
    // Um JSON sem nome não é um perfil — provavelmente é uma página de erro.
    return p && typeof p.name === 'string' && p.name ? p : null
  } catch {
    return null
  }
}
