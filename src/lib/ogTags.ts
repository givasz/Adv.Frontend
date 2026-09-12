// O QUE A PÁGINA DIZ DE SI MESMA ANTES DE EXISTIR — prévia de link, dados
// estruturados, decisão de indexação e o HTML estático que o robô lê.
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
//
// Em 12/09/2026 o mesmo raciocínio foi levado até o fim: não são só os
// mensageiros que não executam JavaScript. Os robôs das buscas por IA (ChatGPT,
// Perplexity, Claude) também não, e o Google renderiza numa fila à parte, dias
// depois de ler o HTML. Então, além do <head>, a borda passou a servir o TEXTO
// do perfil dentro do <div id="root"> — nome, OAB, áreas, bio, perguntas — num
// HTML simples que o React substitui ao montar (`corpoDoPerfil`). Todo mundo
// recebe o mesmo documento; não há versão "para robô".
// ---------------------------------------------------------------------------
//
// ESTE ARQUIVO É A FONTE ÚNICA das duas pontas. `seoTitle`/`seoDescription`
// moravam em seo.ts e agora moram aqui — seo.ts os reimporta. Duas listas de
// meta tags (uma no servidor, outra no navegador) divergiriam no primeiro ajuste
// de copy, e a que o cliente do advogado vê é a do servidor, que é justamente a
// que ninguém abre para conferir.
//
// SEM IMPORTS, de propósito. Quem lê este arquivo do outro lado é uma edge
// function rodando em Deno, que exige extensão `.ts` em todo import e não
// resolve o alias `@/`. Um `import './endereco'` daqui derrubaria a geração das
// meta tags de TODO perfil — em silêncio, no aparelho de quem recebeu o link.
// As formas de que ele precisa são redeclaradas aqui, estreitas, e os tipos do
// app as satisfazem estruturalmente.
//
// SOBRE O TOM: o texto é FACTUAL — "Advogada de Direito de Família em São
// Paulo/SP". Descrição de área e de foro geográfico é permitida (Prov. 205/2021
// Art. 2º); superlativo, promessa de resultado e chamariz não entram. A prévia é
// publicidade do advogado tanto quanto a página, e uma prévia é MAIS exposta que
// a página: circula em grupo de WhatsApp, sem contexto e sem o resto do perfil
// para qualificá-la. Ver REGRAS.md.

/**
 * O mínimo de um perfil para montar a prévia, o dado estruturado e o texto
 * estático. Interface estreita de propósito, e não `Profile`: a edge function
 * não deve arrastar o tipo inteiro do app (tema, plano, agenda, moderação).
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
  areas: { label: string; description?: string }[]
  faqs?: { question: string; answer: string }[]
  contact?: { email?: string; whatsapp?: string }
  /** redes do advogado — viram `sameAs` no dado estruturado (só https). */
  socials?: { kind: string; url: string }[]
  serviceMode?: { inPerson?: boolean; online?: boolean }
  /** "Atendimento em toda a Grande SP" */
  regionNote?: string
  /**
   * Endereço do escritório — os mesmos campos de lib/endereco.ts. Rua, bairro e
   * CEP só saem daqui quando `publico !== false`: um endereço que a página
   * esconde não pode vazar pelo dado estruturado dela.
   */
  address?: {
    cep?: string
    rua?: string
    numero?: string
    bairro?: string
    publico?: boolean
  }
}

/** O mínimo da página de um ESCRITÓRIO para a prévia e o dado estruturado. */
export interface EscritorioCompartilhavel {
  slug: string
  name: string
  oabRegistry: string
  tagline: string
  about: string
  city: string
  state: string
  address?: PerfilCompartilhavel['address']
  contact?: { phone?: string; email?: string; whatsapp?: string; instagram?: string; linkedin?: string }
  areas: { label: string }[]
  lawyers: { slug: string; name: string; oabNumber: string; area: string }[]
}

// ---------------------------------------------------------------------------
// Perfis e escritório de DEMONSTRAÇÃO
//
// São pessoas e dados fictícios (fixtures de lib/mockData.ts e lib/escritorio.ts).
// Precisam de duas coisas que os perfis de verdade não precisam: NÃO entrar no
// índice de busca — "Marina Sales, advogada em São Paulo" aparecendo no Google
// como se existisse seria informação enganosa — e não ter link de contato no
// HTML estático (o número inventado pode ser de alguém de verdade; ver
// lib/exemplo.ts). A fonte única dos slugs mora aqui porque este é o único
// arquivo que os dois lados (borda e app) conseguem importar; perfilPublico.ts
// e escritorio.ts reexportam, e os testes de paridade com as fixtures continuam
// valendo lá.
// ---------------------------------------------------------------------------
export const EXAMPLE_SLUGS = ['marina-sales', 'guilherme-sales23'] as const
export const ESCRITORIO_DE_EXEMPLO = 'andrade-vieira'

export function ehSlugDeExemplo(slug: string): boolean {
  return (EXAMPLE_SLUGS as readonly string[]).includes(slug)
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Frase de SEO factual: "Nome — Advogado(a) de [áreas] em [cidade]/[UF]". */
export function seoTitle(p: PerfilCompartilhavel): string {
  const areas = rotulos(p.areas)
  const areaPart = areas.length ? ` de ${areas.slice(0, 2).join(' e ')}` : ''
  const local = localDe(p)
  const localPart = local ? ` em ${local}` : ''
  return `${p.name} — Advogado(a)${areaPart}${localPart}`
}

/**
 * Descrição factual, até ~155 caracteres — o Google não fixa limite, mas corta
 * pela largura da tela, e o WhatsApp mostra por volta de 80. O que importa vem
 * PRIMEIRO: a frase do advogado, as áreas, o foro, a inscrição.
 */
export function seoDescription(p: PerfilCompartilhavel): string {
  const areas = rotulos(p.areas)
  const local = localDe(p)
  const modo = modoDeAtendimento(p)
  const frases = [
    limpar(p.headline),
    areas.length ? `Atuação em ${listar(areas.slice(0, 3))}` : '',
    local ? `Atendimento em ${local}${modo ? `, ${modo}` : ''}` : modo ? capitalizar(modo) : '',
    limpar(p.oabNumber),
  ].filter(Boolean)
  const texto = frases.map(pontuar).join(' ')
  if (texto.length > 12) return cortar(texto, 155)
  return cortar(limpar(p.bio), 155)
}

/** Título e descrição da página de um escritório. */
export function seoTitleEscritorio(e: EscritorioCompartilhavel): string {
  const local = localDe(e)
  return `${e.name} — Escritório de advocacia${local ? ` em ${local}` : ''}`
}

export function seoDescriptionEscritorio(e: EscritorioCompartilhavel): string {
  const areas = rotulos(e.areas)
  const frases = [
    limpar(e.tagline),
    areas.length ? `Atuação em ${listar(areas.slice(0, 3))}` : '',
    localDe(e) ? `Sede em ${localDe(e)}` : '',
    e.lawyers.length ? `${e.lawyers.length} advogado(a)s` : '',
    limpar(e.oabRegistry),
  ].filter(Boolean)
  const texto = frases.map(pontuar).join(' ')
  return cortar(texto.length > 12 ? texto : limpar(e.about), 155)
}

/**
 * A HOME. Um título só, aqui, para as três pontas (index.html, a borda e o
 * Landing.tsx) — havia dois títulos diferentes para a mesma página, e o buscador
 * escolhe um deles sem critério que a gente controle.
 */
export const HOME = {
  title: 'advoc.me — link na bio e página profissional para advogados',
  description:
    'Crie sua página profissional em minutos: áreas de atuação, contato pelo WhatsApp, ' +
    'assistente de agendamento e cartão digital. Conferida antes de ir ao ar, dentro das normas da OAB.',
} as const

function rotulos(areas: { label: string }[]): string[] {
  return areas.map((a) => limpar(a.label)).filter(Boolean)
}

function localDe(p: { city: string; state: string }): string {
  return [limpar(p.city), limpar(p.state)].filter(Boolean).join('/')
}

function modoDeAtendimento(p: PerfilCompartilhavel): string {
  const m = p.serviceMode
  if (!m) return ''
  if (m.inPerson && m.online) return 'presencial e on-line'
  if (m.online) return 'on-line'
  if (m.inPerson) return 'presencial'
  return ''
}

function listar(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

function limpar(texto: string | undefined | null): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim()
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}

function pontuar(frase: string): string {
  return /[.!?…]$/.test(frase) ? frase : `${frase}.`
}

/** Corta no limite, na última palavra inteira, com reticência. */
function cortar(texto: string, max: number): string {
  if (texto.length <= max) return texto
  const corte = texto.slice(0, max - 1)
  const ultimoEspaco = corte.lastIndexOf(' ')
  return `${(ultimoEspaco > max * 0.6 ? corte.slice(0, ultimoEspaco) : corte).replace(/[,;:.\s]+$/, '')}…`
}

// ---------------------------------------------------------------------------
// Imagem
// ---------------------------------------------------------------------------

/** Imagem de prévia da própria plataforma (home e perfis sem foto). */
export const OG_PADRAO = '/og-padrao.jpg'
/** Medidas reais do arquivo em public/ — o Facebook pede ≥1200×630, e é isso. */
export const OG_PADRAO_LARGURA = 1200
export const OG_PADRAO_ALTURA = 630
/** A foto que o app grava é sempre este quadrado (lib/image.ts, fileToAvatarDataUrl). */
export const AVATAR_LADO = 512

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
  const foto = (p.avatarUrl ?? '').trim()
  if (!foto) return `${origem}${OG_PADRAO}`
  // O formato NOVO do JSON público (desde 2026-09-03): a foto já chega como o
  // caminho da nossa rota, com a versão (`/api/profiles/:slug/avatar?v=hash`).
  // Só falta a origem absoluta — og:image relativa não vale para robô nenhum.
  if (foto.startsWith('/api/')) return `${origem}${foto}`
  // Foto guardada por nós no formato antigo (data URI dentro do JSON) — vale
  // para o rascunho do dono e para um backend ainda não atualizado. Quem serve
  // os bytes é a nossa rota.
  if (foto.startsWith('data:image/')) {
    return `${origem}/api/profiles/${encodeURIComponent(p.slug)}/avatar`
  }
  // Foto hospedada fora ("colar link"): o og:image aponta DIRETO para o host
  // dela. Passar por `/api/.../avatar` fazia a nossa rota responder 302 para um
  // endereço que o dono do perfil escolhe — um redirecionamento aberto no nosso
  // domínio, e o domínio é justamente o que quem recebe o link confere. A rota
  // deixou de redirecionar (backend/src/profiles/profiles.service.ts); aqui é o
  // outro lado da mesma decisão.
  //
  // Só https: `safeImageSrc` já recusa o resto na gravação, e esta é a segunda
  // camada — vale também para o que já está no banco.
  if (foto.startsWith('https://')) return foto
  return `${origem}${OG_PADRAO}`
}

/**
 * Medidas da imagem de prévia, quando são conhecidas. O Facebook documenta que
 * `og:image:width/height` é o que evita a PRIMEIRA partilha sair sem imagem (o
 * robô ainda não baixou a foto quando monta o cartão). A foto hospedada fora
 * tem o tamanho que tiver — melhor não dizer nada do que dizer errado.
 */
function medidasDaImagem(url: string, origem: string): { largura: number; altura: number } | null {
  if (url === `${origem}${OG_PADRAO}`) return { largura: OG_PADRAO_LARGURA, altura: OG_PADRAO_ALTURA }
  if (url.startsWith(`${origem}/api/profiles/`)) return { largura: AVATAR_LADO, altura: AVATAR_LADO }
  return null
}

// ---------------------------------------------------------------------------
// Indexação
// ---------------------------------------------------------------------------

/**
 * Um perfil publicado é sempre servível — mas nem sempre vale um resultado de
 * busca. Publicar exige só nome e OAB; um perfil sem área e sem bio é uma
 * página com dois campos, e páginas assim, às centenas, é o que o Google chama
 * de conteúdo raso e cobra do domínio INTEIRO, não só delas. `noindex` nelas
 * tira-as da conta (e a prévia no WhatsApp continua funcionando igual). Quando o
 * advogado preenche uma área ou uma bio, a decisão vira sozinha.
 *
 * Os exemplos nunca entram: são pessoas fictícias.
 */
export function perfilIndexavel(p: PerfilCompartilhavel): boolean {
  if (ehSlugDeExemplo(p.slug)) return false
  if (!limpar(p.name)) return false
  return rotulos(p.areas).length > 0 || limpar(p.bio).length >= 80
}

export function escritorioIndexavel(e: EscritorioCompartilhavel): boolean {
  if (e.slug === ESCRITORIO_DE_EXEMPLO) return false
  return Boolean(limpar(e.name)) && (e.lawyers.length > 0 || limpar(e.about).length >= 80)
}

/**
 * O que o buscador pode mostrar. `max-image-preview:large` é o que deixa a foto
 * do advogado sair em tamanho cheio no resultado (o padrão é uma miniatura);
 * `max-snippet:-1` libera o trecho inteiro — e, desde 2025, é também o que
 * decide se a página pode ser citada nas respostas por IA do próprio Google.
 */
export const ROBOTS_INDEXAR = 'index, follow, max-image-preview:large, max-snippet:-1'
export const ROBOTS_NAO_INDEXAR = 'noindex, follow'

// ---------------------------------------------------------------------------
// Escape
// ---------------------------------------------------------------------------

/**
 * Escapa texto para dentro de um atributo HTML ou do corpo do documento.
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

/** Só endereços https entram em link e em `sameAs` — o resto é descartado. */
function httpsOuNada(url: string | undefined): string | undefined {
  const u = limpar(url)
  return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : undefined
}

/** Telefone em E.164 a partir do WhatsApp guardado (só dígitos, com o 55). */
function telefoneDe(whatsapp: string | undefined): string | undefined {
  const digitos = (whatsapp ?? '').replace(/\D/g, '')
  return digitos.length >= 10 ? `+${digitos}` : undefined
}

// ---------------------------------------------------------------------------
// Dados estruturados (schema.org)
// ---------------------------------------------------------------------------

/** A ressalva também no dado ESTRUTURADO, não só no que a pessoa lê. */
const RESSALVA =
  'Informações declaradas pelo próprio profissional e publicadas por ele. ' +
  'O advoc.me hospeda a página e não confere, não valida e não endossa a ' +
  'inscrição na OAB nem os demais dados.'

function enderecoPostal(
  p: { city: string; state: string; address?: PerfilCompartilhavel['address'] },
) {
  // Rua, bairro e CEP entram SÓ quando o dono mandou o endereço aparecer: este
  // JSON-LD é lido por buscador, e um endereço que a página esconde não pode
  // vazar pelo dado estruturado dela. É o mesmo cuidado do vCard (lib/vcard.ts).
  const a = p.address && p.address.publico !== false && limpar(p.address.rua) ? p.address : null
  return {
    '@type': 'PostalAddress',
    ...(a
      ? {
          streetAddress: [limpar(a.rua), limpar(a.numero)].filter(Boolean).join(', '),
          ...(limpar(a.bairro) ? { addressNeighborhood: limpar(a.bairro) } : {}),
          ...(limpar(a.cep) ? { postalCode: limpar(a.cep) } : {}),
        }
      : {}),
    ...(limpar(p.city) ? { addressLocality: limpar(p.city) } : {}),
    ...(limpar(p.state) ? { addressRegion: limpar(p.state) } : {}),
    addressCountry: 'BR',
  }
}

function temEnderecoPublico(p: { address?: PerfilCompartilhavel['address'] }): boolean {
  return Boolean(p.address && p.address.publico !== false && limpar(p.address.rua))
}

/**
 * O dado estruturado de um perfil.
 *
 * `ProfilePage` com `mainEntity: Person` é o único tipo que o Google documenta
 * para "página de perfil de uma pessoa" (2024). `Attorney`, que usávamos, foi
 * DEPRECIADO pelo schema.org em favor de `LegalService` — e `LegalService` é um
 * negócio local, que o Google só reconhece com endereço. Então:
 *
 *   • toda página: ProfilePage → Person (nome, ocupação, OAB como identificador,
 *     redes em `sameAs`, áreas em `knowsAbout`, cidade, telefone);
 *   • quando o advogado publicou o endereço do escritório: também um
 *     LegalService com esse endereço, ligado à pessoa por `worksFor`/`founder`.
 *     É o sinal de "advogado em [cidade]" que o buscador local entende.
 *
 * `FAQPage` saiu: o Google deixou de mostrar perguntas no resultado para sites
 * que não são governo ou saúde (2023) e descontinuou o recurso de vez em
 * 05/2026. As perguntas continuam servidas como TEXTO no HTML estático
 * (`corpoDoPerfil`), que é o que os robôs de IA leem de fato.
 *
 * Nada de `priceRange`: honorários não entram (Prov. 205/2021).
 */
function perfilJsonLd(p: PerfilCompartilhavel, url: string, origem: string, imagem: string) {
  const pessoaId = `${url}#pessoa`
  const escritorioId = `${url}#escritorio`
  const areas = rotulos(p.areas)
  const sameAs = (p.socials ?? []).map((s) => httpsOuNada(s.url)).filter((u): u is string => !!u)
  const telefone = telefoneDe(p.contact?.whatsapp)
  const email = limpar(p.contact?.email)
  const comEscritorio = temEnderecoPublico(p)

  const pessoa = {
    '@type': 'Person',
    '@id': pessoaId,
    name: p.name,
    jobTitle: 'Advogado(a)',
    description: seoDescription(p),
    disambiguatingDescription: RESSALVA,
    url,
    image: imagem,
    identifier: { '@type': 'PropertyValue', name: 'OAB', value: p.oabNumber },
    ...(sameAs.length ? { sameAs } : {}),
    ...(areas.length ? { knowsAbout: areas } : {}),
    address: enderecoPostal(p),
    ...(telefone ? { telephone: telefone } : {}),
    ...(email ? { email } : {}),
    ...(comEscritorio ? { worksFor: { '@id': escritorioId } } : {}),
  }

  const grafo: unknown[] = [
    {
      '@type': 'ProfilePage',
      '@id': `${url}#pagina`,
      url,
      name: seoTitle(p),
      description: seoDescription(p),
      inLanguage: 'pt-BR',
      isPartOf: { '@id': `${origem}/#site` },
      mainEntity: { '@id': pessoaId },
    },
    pessoa,
  ]

  if (comEscritorio) {
    grafo.push({
      '@type': 'LegalService',
      '@id': escritorioId,
      name: `${p.name} — Advocacia`,
      url,
      image: imagem,
      address: enderecoPostal(p),
      ...(telefone ? { telephone: telefone } : {}),
      ...(email ? { email } : {}),
      ...(areas.length ? { knowsAbout: areas } : {}),
      founder: { '@id': pessoaId },
      disambiguatingDescription: RESSALVA,
    })
  }

  return { '@context': 'https://schema.org', '@graph': grafo }
}

function escritorioJsonLd(e: EscritorioCompartilhavel, url: string, origem: string, imagem: string) {
  const areas = rotulos(e.areas)
  const sameAs = [e.contact?.instagram, e.contact?.linkedin]
    .map(httpsOuNada)
    .filter((u): u is string => !!u)
  const telefone = telefoneDe(e.contact?.whatsapp) ?? telefoneDe(e.contact?.phone)
  const email = limpar(e.contact?.email)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#pagina`,
        url,
        name: seoTitleEscritorio(e),
        description: seoDescriptionEscritorio(e),
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${origem}/#site` },
        about: { '@id': `${url}#escritorio` },
      },
      {
        '@type': 'LegalService',
        '@id': `${url}#escritorio`,
        name: e.name,
        url,
        image: imagem,
        description: seoDescriptionEscritorio(e),
        disambiguatingDescription: RESSALVA,
        identifier: { '@type': 'PropertyValue', name: 'Registro na OAB', value: e.oabRegistry },
        address: enderecoPostal(e),
        ...(telefone ? { telephone: telefone } : {}),
        ...(email ? { email } : {}),
        ...(sameAs.length ? { sameAs } : {}),
        ...(areas.length ? { knowsAbout: areas } : {}),
        // Ordem alfabética, como na página: nenhuma hierarquia entre os sócios.
        member: e.lawyers
          .filter((l) => limpar(l.name))
          .map((l) => ({
            '@type': 'Person',
            name: l.name,
            jobTitle: 'Advogado(a)',
            ...(l.oabNumber ? { identifier: { '@type': 'PropertyValue', name: 'OAB', value: l.oabNumber } } : {}),
            ...(l.slug ? { url: `${origem}/${l.slug}` } : {}),
          })),
      },
    ],
  }
}

/**
 * A HOME conta quem publica o site. `Organization` com logo é o que o Google
 * lê para o painel da marca; `WebSite` é o nó a que toda página se liga por
 * `isPartOf`. Sem `SearchAction`: o Google retirou a caixa de busca dos
 * resultados em 11/2024, e o site não tem busca.
 */
function homeJsonLd(origem: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origem}/#organizacao`,
        name: 'advoc.me',
        url: `${origem}/`,
        logo: { '@type': 'ImageObject', url: `${origem}/logo.png`, width: 501, height: 360 },
        description: HOME.description,
      },
      {
        '@type': 'WebSite',
        '@id': `${origem}/#site`,
        name: 'advoc.me',
        url: `${origem}/`,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${origem}/#organizacao` },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// As tags do <head>
// ---------------------------------------------------------------------------

/** Marca as tags que nós gerenciamos, para o app saber quais remover ao navegar. */
export const MANAGED = 'data-advocme-seo'

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

const meta = (attr: 'name' | 'property', chave: string, valor: string): TagDeCabecalho => ({
  tipo: 'meta',
  attr,
  chave,
  valor,
})

interface Cartao {
  title: string
  description: string
  url: string
  imagem: string
  imagemAlt: string
  tipo: 'website' | 'profile'
  indexar: boolean
}

/** As tags que TODA página pública compartilha: título, prévia, canônica, robots. */
function tagsDoCartao(c: Cartao, origem: string): TagDeCabecalho[] {
  const medidas = medidasDaImagem(c.imagem, origem)
  return [
    // A marca uma vez só: a home já a carrega no próprio título.
    { tipo: 'title', texto: c.title.includes('advoc.me') ? c.title : `${c.title} · advoc.me` },
    meta('name', 'description', c.description),
    meta('name', 'robots', c.indexar ? ROBOTS_INDEXAR : ROBOTS_NAO_INDEXAR),
    meta('property', 'og:title', c.title),
    meta('property', 'og:description', c.description),
    meta('property', 'og:type', c.tipo),
    meta('property', 'og:url', c.url),
    meta('property', 'og:image', c.imagem),
    ...(medidas
      ? [
          meta('property', 'og:image:width', String(medidas.largura)),
          meta('property', 'og:image:height', String(medidas.altura)),
        ]
      : []),
    meta('property', 'og:image:alt', c.imagemAlt),
    meta('property', 'og:site_name', 'advoc.me'),
    meta('property', 'og:locale', 'pt_BR'),
    // `summary_large_image` e não `summary`: o card grande é o que o LinkedIn e o
    // Twitter/X mostram com a imagem em destaque. Com `summary` a foto vira uma
    // miniatura quadrada ao lado do texto — que é praticamente não aparecer.
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', c.title),
    meta('name', 'twitter:description', c.description),
    meta('name', 'twitter:image', c.imagem),
    meta('name', 'twitter:image:alt', c.imagemAlt),
    // Canônica: a mesma página abre por caminhos com e sem barra final, e com
    // parâmetros de campanha colados por quem compartilha. Sem esta linha o
    // buscador trata cada variação como página distinta e divide o que cada uma vale.
    { tipo: 'link', rel: 'canonical', href: c.url },
  ]
}

/**
 * Tudo que o `<head>` da página de um perfil precisa dizer — a DECISÃO, sem
 * formato.
 *
 * `url` é o endereço público do perfil e `origem` é de onde a API e os arquivos
 * são servidos — hoje o mesmo host, mas a distinção importa: o `og:url` precisa
 * ser o endereço que a pessoa vai abrir.
 */
export function tagsDoPerfil(p: PerfilCompartilhavel, url: string, origem: string): TagDeCabecalho[] {
  const imagem = ogImageUrl(p, origem)
  const tags = tagsDoCartao(
    {
      title: seoTitle(p),
      description: seoDescription(p),
      url,
      imagem,
      imagemAlt: imagem.endsWith(OG_PADRAO) ? 'advoc.me' : `Foto de ${p.name}`,
      tipo: 'profile',
      indexar: perfilIndexavel(p),
    },
    origem,
  )
  // `og:type=profile` aceita o nome separado; o Facebook e o LinkedIn usam.
  const partes = limpar(p.name).split(' ')
  if (partes.length > 1) {
    tags.push(meta('property', 'profile:first_name', partes[0]))
    tags.push(meta('property', 'profile:last_name', partes.slice(1).join(' ')))
  }
  tags.push({ tipo: 'ld', dados: perfilJsonLd(p, url, origem, imagem) })
  return tags
}

export function tagsDoEscritorio(e: EscritorioCompartilhavel, url: string, origem: string): TagDeCabecalho[] {
  const imagem = `${origem}${OG_PADRAO}`
  const tags = tagsDoCartao(
    {
      title: seoTitleEscritorio(e),
      description: seoDescriptionEscritorio(e),
      url,
      imagem,
      imagemAlt: 'advoc.me',
      tipo: 'website',
      indexar: escritorioIndexavel(e),
    },
    origem,
  )
  tags.push({ tipo: 'ld', dados: escritorioJsonLd(e, url, origem, imagem) })
  return tags
}

export function tagsDaHome(origem: string): TagDeCabecalho[] {
  const tags = tagsDoCartao(
    {
      title: HOME.title,
      description: HOME.description,
      url: `${origem}/`,
      imagem: `${origem}${OG_PADRAO}`,
      imagemAlt: 'advoc.me — link na bio para advogados',
      tipo: 'website',
      indexar: true,
    },
    origem,
  )
  tags.push({ tipo: 'ld', dados: homeJsonLd(origem) })
  return tags
}

/** As mesmas tags como HTML, para injetar no documento servido pela edge function. */
export function headDoPerfil(p: PerfilCompartilhavel, url: string, origem: string): string {
  return renderHead(tagsDoPerfil(p, url, origem))
}

export function renderHead(tags: TagDeCabecalho[]): string {
  return tags.map(renderTag).join('\n    ')
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

// ---------------------------------------------------------------------------
// O CORPO estático — o que o robô lê no lugar de uma <div id="root"> vazia
// ---------------------------------------------------------------------------

/** Marca o bloco estático; o React o substitui inteiro ao montar. */
export const SNAPSHOT = 'data-advocme-estatico'

/**
 * A folha do bloco estático. Sistema, sem fonte externa e sem classe do
 * Tailwind (a folha do app ainda não chegou quando isto é pintado). Cores da
 * marca (tailwind.config.js), para a troca pelo React não ser um piscar de
 * branco para bege.
 */
const ESTILO =
  `[${SNAPSHOT}]{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;` +
  `background:#f5f0e6;color:#1f1b17;min-height:100dvh;margin:0;padding:32px 20px 48px;line-height:1.55}` +
  `[${SNAPSHOT}]>article,[${SNAPSHOT}]>section{max-width:640px;margin:0 auto}` +
  `[${SNAPSHOT}] h1{font-size:28px;line-height:1.15;margin:12px 0 4px}` +
  `[${SNAPSHOT}] h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;margin:28px 0 8px;color:#6b5f52}` +
  `[${SNAPSHOT}] p,[${SNAPSHOT}] li,[${SNAPSHOT}] dd{margin:0 0 8px}` +
  `[${SNAPSHOT}] img{border-radius:50%;display:block}` +
  `[${SNAPSHOT}] a{color:#6d1f2c}` +
  `[${SNAPSHOT}] dt{font-weight:600;margin-top:10px}` +
  `[${SNAPSHOT}] small{color:#6b5f52;display:block;margin-top:32px;font-size:12.5px}`

function estilo(): string {
  return `<style ${SNAPSHOT}>${ESTILO}</style>`
}

/**
 * O perfil como HTML simples e semântico — o mesmo conteúdo que o React vai
 * desenhar, sem o React. Não é uma versão "para robô": é o que qualquer pessoa
 * vê por um instante até o app montar, e o que vê para sempre se o JavaScript
 * não rodar.
 *
 * Num exemplo, nenhum link de contato: os dados são inventados (ver lib/exemplo.ts).
 */
export function corpoDoPerfil(p: PerfilCompartilhavel, origem: string): string {
  const e = escapeHtml
  const exemplo = ehSlugDeExemplo(p.slug)
  const foto = ogImageUrl(p, origem)
  const comFoto = !foto.endsWith(OG_PADRAO)
  const local = localDe(p)
  const modo = modoDeAtendimento(p)
  const areas = p.areas.filter((a) => limpar(a.label))
  const faqs = (p.faqs ?? []).filter((f) => limpar(f.question) && limpar(f.answer))
  const enderecoPublico = temEnderecoPublico(p) ? p.address! : null
  const telefone = exemplo ? undefined : (p.contact?.whatsapp ?? '').replace(/\D/g, '')
  const email = exemplo ? '' : limpar(p.contact?.email)
  const redes = exemplo
    ? []
    : (p.socials ?? [])
        .map((s) => ({ kind: limpar(s.kind), url: httpsOuNada(s.url) }))
        .filter((s): s is { kind: string; url: string } => !!s.url)

  const partes: string[] = []
  partes.push(`<header>`)
  if (comFoto) {
    partes.push(
      `<img src="${e(foto)}" alt="Foto de ${e(p.name)}" width="96" height="96" loading="eager" fetchpriority="high">`,
    )
  }
  partes.push(`<h1>${e(p.name)}</h1>`)
  if (limpar(p.headline)) partes.push(`<p><strong>${e(limpar(p.headline))}</strong></p>`)
  partes.push(`<p>${e([limpar(p.oabNumber), local].filter(Boolean).join(' · '))}</p>`)
  partes.push(`</header>`)

  if (limpar(p.bio)) {
    partes.push(`<section><h2>Sobre</h2>${paragrafos(p.bio)}</section>`)
  }
  if (areas.length) {
    partes.push(
      `<section><h2>Áreas de atuação</h2><ul>` +
        areas
          .map((a) =>
            limpar(a.description)
              ? `<li><strong>${e(limpar(a.label))}</strong> — ${e(limpar(a.description))}</li>`
              : `<li>${e(limpar(a.label))}</li>`,
          )
          .join('') +
        `</ul></section>`,
    )
  }
  const atendimento = [modo ? capitalizar(modo) : '', limpar(p.regionNote)].filter(Boolean)
  if (atendimento.length || enderecoPublico) {
    partes.push(`<section><h2>Atendimento</h2>`)
    if (atendimento.length) partes.push(`<p>${e(atendimento.map(pontuar).join(' '))}</p>`)
    if (enderecoPublico) {
      const linha1 = [limpar(enderecoPublico.rua), limpar(enderecoPublico.numero)].filter(Boolean).join(', ')
      const linha2 = [limpar(enderecoPublico.bairro), local].filter(Boolean).join(' · ')
      const cep = limpar(enderecoPublico.cep)
      partes.push(
        `<address>${[linha1, linha2, cep ? `CEP ${cep}` : ''].filter(Boolean).map(e).join('<br>')}</address>`,
      )
    }
    partes.push(`</section>`)
  }
  if (faqs.length) {
    partes.push(
      `<section><h2>Perguntas frequentes</h2><dl>` +
        faqs.map((f) => `<dt>${e(limpar(f.question))}</dt><dd>${e(limpar(f.answer))}</dd>`).join('') +
        `</dl></section>`,
    )
  }
  const contatos: string[] = []
  if (telefone && telefone.length >= 10) {
    contatos.push(`<li><a href="https://wa.me/${e(telefone)}" rel="nofollow">WhatsApp</a></li>`)
  }
  if (email) contatos.push(`<li><a href="mailto:${e(email)}" rel="nofollow">${e(email)}</a></li>`)
  for (const r of redes) {
    contatos.push(`<li><a href="${e(r.url)}" rel="me nofollow noopener">${e(nomeDaRede(r.kind))}</a></li>`)
  }
  if (contatos.length) partes.push(`<section><h2>Contato</h2><ul>${contatos.join('')}</ul></section>`)

  partes.push(
    `<small>${e(RESSALVA)} Consulte a inscrição no Cadastro Nacional dos Advogados (CNA) da OAB.</small>`,
  )
  partes.push(`<small><a href="/">advoc.me</a> — link na bio e página profissional para advogados.</small>`)

  return `${estilo()}<main ${SNAPSHOT}><article>${partes.join('')}</article></main>`
}

export function corpoDoEscritorio(esc: EscritorioCompartilhavel): string {
  const e = escapeHtml
  const exemplo = esc.slug === ESCRITORIO_DE_EXEMPLO
  const local = localDe(esc)
  const areas = rotulos(esc.areas)
  const enderecoPublico = temEnderecoPublico(esc) ? esc.address! : null
  const partes: string[] = []
  partes.push(`<header><h1>${e(esc.name)}</h1>`)
  if (limpar(esc.tagline)) partes.push(`<p><strong>${e(limpar(esc.tagline))}</strong></p>`)
  partes.push(`<p>${e([limpar(esc.oabRegistry), local].filter(Boolean).join(' · '))}</p></header>`)
  if (limpar(esc.about)) partes.push(`<section><h2>Sobre o escritório</h2>${paragrafos(esc.about)}</section>`)
  if (areas.length) {
    partes.push(`<section><h2>Áreas de atuação</h2><ul>${areas.map((a) => `<li>${e(a)}</li>`).join('')}</ul></section>`)
  }
  const advogados = esc.lawyers.filter((l) => limpar(l.name))
  if (advogados.length) {
    partes.push(
      `<section><h2>Advogados</h2><ul>` +
        advogados
          .map((l) => {
            const nome = l.slug && !exemplo ? `<a href="/${e(l.slug)}">${e(l.name)}</a>` : e(l.name)
            const resto = [limpar(l.oabNumber), limpar(l.area)].filter(Boolean).join(' · ')
            return `<li>${nome}${resto ? ` — ${e(resto)}` : ''}</li>`
          })
          .join('') +
        `</ul></section>`,
    )
  }
  if (enderecoPublico || local) {
    partes.push(`<section><h2>Sede</h2>`)
    if (enderecoPublico) {
      const linha1 = [limpar(enderecoPublico.rua), limpar(enderecoPublico.numero)].filter(Boolean).join(', ')
      const linha2 = [limpar(enderecoPublico.bairro), local].filter(Boolean).join(' · ')
      const cep = limpar(enderecoPublico.cep)
      partes.push(
        `<address>${[linha1, linha2, cep ? `CEP ${cep}` : ''].filter(Boolean).map(e).join('<br>')}</address>`,
      )
    } else {
      partes.push(`<p>${e(local)}</p>`)
    }
    partes.push(`</section>`)
  }
  if (!exemplo) {
    const contatos: string[] = []
    const zap = (esc.contact?.whatsapp ?? '').replace(/\D/g, '')
    if (zap.length >= 10) contatos.push(`<li><a href="https://wa.me/${e(zap)}" rel="nofollow">WhatsApp</a></li>`)
    const email = limpar(esc.contact?.email)
    if (email) contatos.push(`<li><a href="mailto:${e(email)}" rel="nofollow">${e(email)}</a></li>`)
    for (const [kind, url] of [
      ['instagram', esc.contact?.instagram],
      ['linkedin', esc.contact?.linkedin],
    ] as const) {
      const u = httpsOuNada(url)
      if (u) contatos.push(`<li><a href="${e(u)}" rel="me nofollow noopener">${e(nomeDaRede(kind))}</a></li>`)
    }
    if (contatos.length) partes.push(`<section><h2>Contato</h2><ul>${contatos.join('')}</ul></section>`)
  }
  partes.push(`<small>${e(RESSALVA)}</small>`)
  partes.push(`<small><a href="/">advoc.me</a> — link na bio e página profissional para advogados.</small>`)
  return `${estilo()}<main ${SNAPSHOT}><article>${partes.join('')}</article></main>`
}

/**
 * A home em texto. Reflete o que o Landing.tsx desenha — as mesmas seções, na
 * mesma ordem, com as mesmas âncoras — porque é o que o Google compara quando
 * decide se o HTML servido e a página renderizada são a mesma coisa.
 */
export function corpoDaHome(): string {
  return (
    `${estilo()}<main ${SNAPSHOT}>` +
    `<section><h1>Presença digital profissional, dentro das regras.</h1>` +
    `<p>Tenha um perfil profissional sem decorar as regras da OAB. A gente confere seu conteúdo antes de publicar — e mostra o que ajustar.</p>` +
    `<p><a href="/criar-conta">Criar meu perfil</a> · <a href="/${EXAMPLE_SLUGS[0]}">Ver um exemplo</a></p></section>` +
    `<section id="problema"><h2>O problema</h2><p>Divulgar-se como advogado tem regra — e risco. O Provimento 205/2021 da OAB diz o que pode e o que não pode na publicidade da advocacia, e o advoc.me confere cada texto do perfil antes de ele ir ao ar.</p></section>` +
    `<section id="assistente"><h2>Assistente virtual</h2><p>Quem chega ao seu perfil conversa com o seu assistente virtual: ele oferece apenas os dias e horários que você marcou, pergunta o assunto e entrega o pedido pronto no seu WhatsApp. Quem confirma é você.</p></section>` +
    `<section id="contratos"><h2>Contratos e procurações</h2><p>Modelos de contrato de honorários e procuração preenchidos no seu aparelho, com registro de autenticidade conferível pelo cliente.</p></section>` +
    `<section id="como-funciona"><h2>Como funciona</h2><ol><li>Crie a conta e escolha o seu endereço advoc.me/seu-nome.</li><li>Preencha áreas de atuação, cidade, contato e a sua apresentação.</li><li>O conteúdo é conferido com as normas da OAB antes de publicar.</li><li>Publique e coloque o link na bio do Instagram, no WhatsApp e no cartão.</li></ol></section>` +
    `<section id="planos"><h2>Planos</h2><p>Planos claros, sem letra miúda. Comece no Free; os planos Pro, Max e Escritório abrem perguntas frequentes, assistente de agendamento, vídeo de apresentação, cartão de visita e página da sociedade. Preço por mês, sem fidelidade.</p></section>` +
    `<section><h2>Uma presença digital que respeita a profissão</h2><p>Comece no Free. Um perfil sóbrio, claro e conferido antes de ir ao ar.</p>` +
    `<p><a href="/criar-conta">Criar meu perfil agora</a> · <a href="/legal/termos">Termos de uso</a> · <a href="/legal/privacidade">Privacidade</a></p></section>` +
    `</main>`
  )
}

function paragrafos(texto: string): string {
  return texto
    .split(/\n{2,}|\r\n\r\n/)
    .map((t) => limpar(t))
    .filter(Boolean)
    .map((t) => `<p>${escapeHtml(t)}</p>`)
    .join('')
}

function nomeDaRede(kind: string): string {
  switch (kind) {
    case 'instagram':
      return 'Instagram'
    case 'linkedin':
      return 'LinkedIn'
    case 'facebook':
      return 'Facebook'
    case 'youtube':
      return 'YouTube'
    case 'tiktok':
      return 'TikTok'
    case 'website':
      return 'Site'
    default:
      return capitalizar(kind)
  }
}

// ---------------------------------------------------------------------------
// Que página é esta? — a borda vê só o caminho
// ---------------------------------------------------------------------------

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
  // Os links que chegam por e-mail. Um perfil em advoc.me/redefinir-senha tomaria
  // o lugar da tela para a qual o botão do e-mail aponta.
  'esqueci-senha',
  'redefinir-senha',
  'confirmar-email',
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
  // /agenda — a conversa do advogado com o próprio assistente sobre os horários
  // já ocupados. Reservada como as demais rotas do app: um perfil em
  // advoc.me/agenda passaria a disputar o caminho com ela, e a prévia de link
  // dessa página iria buscar um perfil que não existe.
  'agenda',
  // /contratos (e /contratos/conferir, /contratos/rascunho/:id) — os documentos
  // do advogado e a conferência pública de um PDF registrado.
  'contratos',
  'escritorio',
  '__preview',
  'api',
  'assets',
])

/** Mesmo alfabeto que `slugify` produz no backend (src/plans.ts). */
const SLUG_RE = /^[a-z0-9-]+$/

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
  return SLUG_RE.test(slug)
}

/** `/escritorio/:slug` — a página pública de uma sociedade (não o editor dela). */
export function slugDeEscritorio(pathname: string): string | null {
  const partes = pathname.split('/').filter(Boolean)
  if (partes.length !== 2 || partes[0] !== 'escritorio') return null
  const slug = partes[1]
  if (slug === 'editar' || !SLUG_RE.test(slug)) return null
  return slug
}

/**
 * As páginas que VALEM um resultado de busca: a home, os documentos legais, as
 * páginas de escritório e os perfis. Tudo o mais — painel, editor, login,
 * subpáginas de ação do perfil (/x/agendar), prévia interna de temas — recebe
 * `noindex`.
 *
 * `noindex` na META, e não `Disallow` no robots.txt, porque são coisas
 * diferentes: o Disallow proíbe a LEITURA, e uma página que o Google não pode
 * ler ele ainda indexa pelo endereço quando alguém linka ("nenhuma informação
 * disponível para esta página"). Só o `noindex` tira do índice — e para lê-lo o
 * robô precisa poder entrar. Ver netlify/edge-functions/robots.ts.
 *
 * Uma rota pública NOVA nasce com `noindex` até ser listada aqui. É o lado
 * seguro do erro: melhor uma página a menos no Google por uma semana do que a
 * tela de login indexada por um ano.
 */
export function paginaIndexavel(pathname: string): boolean {
  const partes = pathname.split('/').filter(Boolean)
  if (partes.length === 0) return true
  if (partes[0] === 'legal') return partes.length <= 2
  if (slugDeEscritorio(pathname)) return true
  return ehSlugDePerfil(pathname)
}

/**
 * O endereço canônico de qualquer caminho: sem query (parâmetros de campanha,
 * `?voltar=`), sem barra final, sem maiúscula no host.
 */
export function urlCanonica(origem: string, pathname: string): string {
  const limpo = pathname.replace(/\/+$/, '')
  return `${origem}${limpo || '/'}`
}
