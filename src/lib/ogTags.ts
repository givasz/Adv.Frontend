// A PRÉVIA DO LINK — o que aparece quando alguém cola o perfil no WhatsApp.
//
// ---------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE
//
// O produto se vende como "o link na bio". O link era a única coisa que não
// funcionava: as meta tags eram escritas por JavaScript (lib/seo.ts), e os robôs
// que montam a prévia — WhatsApp, LinkedIn, Telegram, Instagram, Slack — NÃO
// executam JavaScript. Eles baixam o HTML cru e leem o que está lá.
//
// O HTML cru era o index.html do app, igual para todo mundo. Então um advogado
// que compartilhasse o próprio perfil via aparecer, para o cliente dele:
//
//     advoc.me — o link na bio, para advogados
//     A página de perfil única e compartilhável para advogados.
//
// O nome dele, não. A foto, não. A cidade, não. O produto anunciava a si mesmo
// no lugar de anunciar o cliente que pagou por ele.
//
// A correção é servir o HTML já preenchido: netlify/edge-functions/perfil.ts
// intercepta `/:slug`, busca o perfil na API e injeta o que este arquivo monta.
// ---------------------------------------------------------------------------
//
// ESTE ARQUIVO É A FONTE ÚNICA das duas pontas. `seoTitle`/`seoDescription`
// moravam em seo.ts e agora moram aqui — seo.ts os reimporta. Duas listas de
// meta tags (uma no servidor, outra no navegador) divergiriam no primeiro ajuste
// de copy, e a que o cliente do advogado vê é a do servidor, que é justamente a
// que ninguém abre para conferir.
//
// SOBRE O TOM: o texto é FACTUAL — "Advogada de Direito de Família em São
// Paulo/SP". Descrição de área e de foro geográfico é permitida (Prov. 205/2021
// Art. 2º); superlativo, promessa de resultado e chamariz não entram. A prévia é
// publicidade do advogado tanto quanto a página, e uma prévia é MAIS exposta que
// a página: circula em grupo de WhatsApp, sem contexto e sem o resto do perfil
// para qualificá-la. Ver REGRAS.md.

/**
 * O mínimo de um perfil para montar a prévia.
 *
 * Interface estreita de propósito, e não `Profile`: quem consome isto do outro
 * lado é uma edge function rodando em Deno, que não deve arrastar o tipo inteiro
 * do app (com tema, plano, agenda, moderação) só para escrever um título.
 * `Profile` satisfaz esta forma estruturalmente — nada a converter.
 */
export interface PerfilCompartilhavel {
  slug: string
  name: string
  oabNumber: string
  headline: string
  bio: string
  city: string
  state: string
  avatarUrl?: string
  areas: { label: string }[]
  faqs?: { question: string; answer: string }[]
  contact?: { email?: string }
  /**
   * Endereço do escritório — os mesmos campos de lib/endereco.ts, redeclarados
   * aqui em vez de importados. Não é descuido: quem lê este arquivo do outro
   * lado é uma edge function em Deno, que exige extensão `.ts` em todo import;
   * um `import './endereco'` daqui derrubaria a geração das meta tags de TODO
   * perfil. A forma é estrutural — `Endereco` satisfaz esta declaração.
   */
  address?: {
    cep?: string
    rua?: string
    numero?: string
    bairro?: string
    publico?: boolean
  }
}

/** Frase de SEO factual: "Advogado(a) de [áreas] em [cidade]/[UF]". */
export function seoTitle(p: PerfilCompartilhavel): string {
  const areas = p.areas.map((a) => a.label).filter(Boolean)
  const areaPart = areas.length ? ` de ${areas.slice(0, 2).join(' e ')}` : ''
  const local = [p.city, p.state].filter(Boolean).join('/')
  const localPart = local ? ` em ${local}` : ''
  return `${p.name} — Advogado(a)${areaPart}${localPart}`
}

export function seoDescription(p: PerfilCompartilhavel): string {
  const areas = p.areas.map((a) => a.label).filter(Boolean)
  const local = [p.city, p.state].filter(Boolean).join('/')
  const areaPart = areas.length ? `Atuação em ${areas.slice(0, 3).join(', ')}. ` : ''
  const localPart = local ? `Atendimento em ${local}. ` : ''
  const base = `${areaPart}${localPart}${p.oabNumber}.`.trim()
  // fallback para a headline/bio se faltar dado estruturado
  return base.length > 12 ? base : p.headline || p.bio.slice(0, 150)
}

/**
 * Endereço da foto servível — NÃO o `avatarUrl` do perfil.
 *
 * `avatarUrl` costuma ser um data URI (`data:image/png;base64,…`), e data URI em
 * `og:image` não produz imagem nenhuma: o robô do mensageiro busca a imagem por
 * HTTP, num processo separado que nem carrega a página. Quem serve os bytes é
 * `GET /api/profiles/:slug/avatar` (ver backend/src/profiles/profiles.controller).
 *
 * Sem foto, cai na imagem padrão da plataforma — uma prévia sem imagem alguma
 * aparece como um retângulo cinza, que lê como link quebrado.
 */
export function ogImageUrl(p: PerfilCompartilhavel, origem: string): string {
  return p.avatarUrl
    ? `${origem}/api/profiles/${encodeURIComponent(p.slug)}/avatar`
    : `${origem}${OG_PADRAO}`
}

/** Imagem de prévia da própria plataforma (home e perfis sem foto). */
export const OG_PADRAO = '/og-padrao.jpg'

/** Marca as tags que nós gerenciamos, para o app saber quais remover ao navegar. */
export const MANAGED = 'data-advocme-seo'

/**
 * Escapa texto para dentro de um atributo HTML.
 *
 * Não é zelo teórico: `name` e `bio` são texto que o advogado escreve, e aqui
 * eles entram num `content="…"` montado por concatenação de strings. Sem escapar,
 * um nome com aspas fecha o atributo — e o que vem depois vira marcação. É o
 * caminho clássico de XSS, e este HTML é servido pela NOSSA origem, onde vive o
 * cookie de sessão de quem estiver logado.
 *
 * Os cinco caracteres cobrem atributo e corpo do documento; `&` primeiro, senão
 * as substituições seguintes seriam escapadas de novo.
 */
export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function attorneyJsonLd(p: PerfilCompartilhavel, url: string, imagem: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Attorney',
    name: p.name,
    description: seoDescription(p),
    url,
    image: imagem,
    areaServed: [p.city, p.state].filter(Boolean).join(', ') || undefined,
    // Endereço estruturado. Rua, bairro e CEP entram SÓ quando o advogado
    // mandou o endereço aparecer: este JSON-LD é lido por buscador, e um
    // endereço que a página esconde não pode vazar pelo dado estruturado dela.
    // É o mesmo cuidado do vCard (ver lib/vcard.ts).
    address: {
      '@type': 'PostalAddress',
      ...(p.address && p.address.publico !== false && p.address.rua
        ? {
            streetAddress:
              [p.address.rua, p.address.numero].filter(Boolean).join(', ') || undefined,
            ...(p.address.bairro ? { addressNeighborhood: p.address.bairro } : {}),
            ...(p.address.cep ? { postalCode: p.address.cep } : {}),
          }
        : {}),
      addressLocality: p.city || undefined,
      addressRegion: p.state || undefined,
      addressCountry: 'BR',
    },
    knowsAbout: p.areas.map((a) => a.label).filter(Boolean),
    ...(p.contact?.email ? { email: p.contact.email } : {}),
  }
}

/**
 * FAQPage (schema.org) a partir das perguntas respondidas no perfil. É o dado
 * estruturado que o Google usa para mostrar as perguntas direto no resultado da
 * busca — e é de graça para quem já respondeu. Só entra pergunta COM resposta.
 */
function faqJsonLd(p: PerfilCompartilhavel) {
  const faqs = (p.faqs ?? []).filter((f) => f.question.trim() && f.answer.trim())
  if (!faqs.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question.trim(),
      acceptedAnswer: { '@type': 'Answer', text: f.answer.trim() },
    })),
  }
}

/**
 * O JSON-LD não pode ser embutido cru num `<script>`.
 *
 * `JSON.stringify` escapa aspas para JSON, mas o parser de HTML não lê JSON: ele
 * procura `</script` e fecha o bloco ali, esteja onde estiver — inclusive dentro
 * de uma string. Uma bio contendo `</script><img onerror=…>` quebraria para fora
 * do dado e viraria marcação executável. Escapar a barra resolve na origem: o
 * JSON continua idêntico (`<\/script>` e `</script>` são a mesma string), e o
 * parser de HTML não enxerga mais um fechamento.
 */
function jsonLdSeguro(dados: unknown): string {
  return JSON.stringify(dados).replace(/</g, '\\u003c')
}

/**
 * Uma tag do `<head>`, descrita e ainda não escrita.
 *
 * A lista é estruturada, e não uma string de HTML, porque os dois consumidores
 * precisam de coisas diferentes da MESMA decisão: a edge function renderiza para
 * texto (a página ainda não existe), e o navegador precisa ATUALIZAR o que já
 * está no documento. Quando isto era só HTML, o navegador acrescentava uma
 * segunda `<meta name="description">` ao lado da estática do index.html e o
 * buscador ficava com duas descrições concorrentes para a mesma página.
 */
export type TagDeCabecalho =
  | { tipo: 'title'; texto: string }
  | { tipo: 'meta'; attr: 'name' | 'property'; chave: string; valor: string }
  | { tipo: 'link'; rel: string; href: string }
  | { tipo: 'ld'; dados: unknown }

/**
 * Tudo que o `<head>` da página de um perfil precisa dizer — a DECISÃO, sem
 * formato.
 *
 * `url` é o endereço público do perfil e `origem` é de onde a API e os arquivos
 * são servidos — hoje o mesmo host, mas a distinção importa: o `og:url` precisa
 * ser o endereço que a pessoa vai abrir.
 */
export function tagsDoPerfil(
  p: PerfilCompartilhavel,
  url: string,
  origem: string,
): TagDeCabecalho[] {
  const title = seoTitle(p)
  const description = seoDescription(p)
  const imagem = ogImageUrl(p, origem)
  const meta = (attr: 'name' | 'property', chave: string, valor: string): TagDeCabecalho => ({
    tipo: 'meta',
    attr,
    chave,
    valor,
  })

  const tags: TagDeCabecalho[] = [
    { tipo: 'title', texto: `${title} · advoc.me` },
    meta('name', 'description', description),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:type', 'profile'),
    meta('property', 'og:url', url),
    meta('property', 'og:image', imagem),
    meta('property', 'og:site_name', 'advoc.me'),
    meta('property', 'og:locale', 'pt_BR'),
    // `summary_large_image` e não `summary`: o card grande é o que o LinkedIn e o
    // Twitter/X mostram com a imagem em destaque. Com `summary` a foto vira uma
    // miniatura quadrada ao lado do texto — que é praticamente não aparecer.
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', imagem),
    // Canônica: o mesmo perfil abre por caminhos com e sem barra final, e com
    // parâmetros de campanha colados por quem compartilha. Sem esta linha o
    // buscador trata cada variação como página distinta e divide o que cada uma vale.
    { tipo: 'link', rel: 'canonical', href: url },
    { tipo: 'ld', dados: attorneyJsonLd(p, url, imagem) },
  ]
  const faq = faqJsonLd(p)
  if (faq) tags.push({ tipo: 'ld', dados: faq })
  return tags
}

/** As mesmas tags como HTML, para injetar no documento servido pela edge function. */
export function headDoPerfil(p: PerfilCompartilhavel, url: string, origem: string): string {
  return tagsDoPerfil(p, url, origem).map(renderTag).join('\n    ')
}

function renderTag(t: TagDeCabecalho): string {
  switch (t.tipo) {
    case 'title':
      return `<title ${MANAGED}>${escapeHtml(t.texto)}</title>`
    case 'meta':
      return `<meta ${t.attr}="${t.chave}" content="${escapeHtml(t.valor)}" ${MANAGED}>`
    case 'link':
      return `<link rel="${t.rel}" href="${escapeHtml(t.href)}" ${MANAGED}>`
    case 'ld':
      return `<script type="application/ld+json" ${MANAGED}>${jsonLdSeguro(t.dados)}</script>`
  }
}

/**
 * Caminhos de UM segmento que NÃO são perfil de advogado.
 *
 * O roteador do app trata `/:slug` como o último caso, depois de tudo. A edge
 * function não tem essa ordem — ela vê só o caminho — então precisa da lista.
 * Se `entrar` não estivesse aqui, abrir a tela de login dispararia uma busca por
 * um perfil chamado "entrar", que não existe: 404 na API e a página servida em
 * seguida com um head errado.
 *
 * Mantenha em pé de igualdade com as rotas de App.tsx. O teste
 * `ogTags.spec.ts` compara as duas listas e falha quando uma rota nova aparece
 * lá e é esquecida aqui.
 */
export const ROTAS_RESERVADAS = new Set([
  'entrar',
  'criar-conta',
  'comecar',
  'painel',
  'editor',
  'suporte',
  'contestar',
  'conta',
  'planos',
  'assinar',
  // /plano/mudar/:plano — descer de plano. Reservado como qualquer outra rota do
  // app: sem isto, um advogado poderia pegar o endereço advoc.me/plano e a página
  // dele passaria a disputar o caminho com a tela de mudança de assinatura.
  'plano',
  'legal',
  'escritorio',
  '__preview',
  'api',
  'assets',
])

/**
 * Este caminho é o perfil público de um advogado?
 *
 * Recusa também o que tem ponto no nome (`favicon.ico`, `robots.txt`,
 * `og-padrao.png`): arquivo estático não é slug, e o Netlify serve esses antes de
 * chegar aqui — mas a função é chamada de dois lugares e não deve depender disso.
 */
export function ehSlugDePerfil(pathname: string): boolean {
  const partes = pathname.split('/').filter(Boolean)
  if (partes.length !== 1) return false
  const slug = partes[0]
  if (!slug || slug.includes('.')) return false
  if (ROTAS_RESERVADAS.has(slug.toLowerCase())) return false
  // Mesmo alfabeto que `slugify` produz no backend (src/plans.ts).
  return /^[a-z0-9-]+$/.test(slug)
}
