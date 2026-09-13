// Sistema de temas — cada tema é uma identidade visual COMPLETA: paleta (CSS vars),
// TIPOGRAFIA própria (display + corpo) e traços estruturais (tile, avatar, filete,
// cabeçalho) via `style`.
//
// REDESENHO DE 13/09/2026 — minimalismo com a elegância do impresso jurídico.
// A coleção anterior (Esmeralda, Toga, Meia-noite, Grafite, Ofício…) apostava em
// relevo metálico no nome, textura de mármore, vinheta e anel duplo na foto. Tudo
// isso saiu, e não só por gosto: o REGRAS.md (§2, "Design chamativo ou mercantil")
// lista foil metálico, mármore brilhante e fonte cursiva extravagante como o que
// contraria a sobriedade exigida do advogado (Prov. 205/2021, Art. 3º caput; CED
// Art. 44). O que restou é o que um bom timbre de escritório sempre teve: UM
// papel, UMA tinta, uma família de letra e réguas. Cor discreta — grafite, marinho,
// sépia, oliva, o bordô da casa — e nunca ouro.
//
// Duas decisões que regem tudo aqui:
//
// 1. NADA DE DINGBAT nem de acabamento. Losango, fleurão, foil e textura saíram:
//    o ornamento é TIPOGRÁFICO — filete, versalete, entreletra e peso. É o que faz
//    um impresso jurídico parecer sério, e o que sobrevive em qualquer tela.
//
// 2. TEMA É ESCOLA TIPOGRÁFICA, não troca de cor. Cada um tem sua fonte de
//    display (e às vezes de corpo); trocar de tema muda a VOZ do perfil, não só o
//    matiz. Fontes carregadas em index.html; o navegador só baixa a do tema em uso.
//
// A escada por plano é ESCADA DE OFÍCIO, não de ostentação — e é o que vende o
// plano, já que o Free entrega só o neutro:
//   free    → Papel, o neutro de todo perfil (é também o fallback de tema inválido)
//   pro     → três temas de papel claro com uma tinta própria cada
//   premium → os quatro mais resolvidos, inclusive o Névoa, que subiu de plano
//             (13/09/2026) por ser o mais bem acabado da coleção antiga
//
// Nomes e descrições evitam vocabulário de luxo ("ouro", "mármore", "esmeralda"):
// a peça é a mesma, mas a divulgação de advogado tem de primar pela discrição, e
// isso vale para como NÓS a vendemos.

export type ThemeId =
  | 'papel'
  | 'linho'
  | 'ardosia'
  | 'oliva'
  | 'nevoa'
  | 'timbre'
  | 'nanquim'
  | 'marinho'

export type Tier = 'free' | 'pro' | 'premium'

/**
 * Como o tema desenha os filetes e os títulos de seção. Todas as variantes são
 * feitas de RÉGUA E TIPO — nenhuma usa símbolo decorativo.
 *   hairline → filete fino dos dois lados do rótulo, centralizado (clássico)
 *   tapered  → filete que se dissolve nas pontas (suave, arejado)
 *   double   → rótulo à esquerda e filete duplo (livro-razão, corporativo)
 *   capline  → filete curto e GROSSO acima do rótulo (editorial)
 *   bar      → barra sólida de acento à esquerda do rótulo (impresso moderno)
 */
export type RuleStyle = 'hairline' | 'tapered' | 'double' | 'capline' | 'bar'

/**
 * Traços estruturais. Só o que se faz com borda, forma e alinhamento — os
 * acabamentos (`finish: foil`, `surface: marble | vignette`) e o anel duplo da
 * foto (`avatar: ornate`) deixaram de existir em 13/09/2026: eram justamente os
 * elementos que o REGRAS.md aponta como incompatíveis com a sobriedade.
 *   tile      → card (superfície + sombra leve) · outline (só borda) · underline (lista)
 *   avatar    → circle · arch (retrato em arco) · square (cantos quase retos)
 *   header    → centered · letterhead (filete acima e abaixo) · editorial (à esquerda)
 */
export interface ThemeStyle {
  tile: 'card' | 'outline' | 'underline'
  avatar: 'circle' | 'arch' | 'square'
  rule: RuleStyle
  header: 'centered' | 'letterhead' | 'editorial'
  nameCase: 'none' | 'upper'
}

export interface Theme {
  id: ThemeId
  name: string
  tier: Tier
  dark: boolean
  blurb: string
  swatch: { bg: string; accent: string; text: string }
  style: ThemeStyle
  vars: Record<string, string>
}

// width/height EXPLÍCITOS, não só o viewBox: SVG sem dimensão intrínseca usado
// como background ESTICA para o tamanho do elemento — e o elemento aqui é o
// perfil inteiro (.themed::before, inset:0). O feTurbulence rasterizava uma
// textura da altura da página (caro em GPU de celular) e o grão mudava de
// escala com o tamanho do perfil. Com 240×240 intrínseco o navegador rasteriza
// UMA vez e ladrilha; o stitchTiles já faz a emenda ser invisível.
//
// O grão é a única "textura" que ficou, e é quase invisível (≤ 0,04): dá ao
// fundo chapado um leve ar de papel sem virar efeito.
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg width='240' height='240' viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

// Pilha de fontes por tema. O fallback final nunca é uma fonte de sistema
// genérica solta: cada pilha cai para uma família do mesmo gênero.
const SANS = "'Hanken Grotesk', 'Segoe UI', system-ui, sans-serif"
const FRAUNCES = `'Fraunces', Georgia, serif`
const PLAYFAIR = `'Playfair Display', 'Fraunces', Georgia, serif`
const NEWSREADER = `'Newsreader', 'Fraunces', Georgia, serif`
const LORA = `'Lora', 'Fraunces', Georgia, serif`
const CORMORANT = `'Cormorant Garamond', 'Playfair Display', Georgia, serif`
const SOURCE_SERIF = `'Source Serif 4', 'Newsreader', Georgia, serif`
const ARCHIVO = `'Archivo', 'Hanken Grotesk', system-ui, sans-serif`
const PLEX = `'IBM Plex Sans', 'Hanken Grotesk', system-ui, sans-serif`

export const THEMES: Theme[] = [
  // ---------------- FREE ----------------
  {
    // O neutro. É o tema de quem nunca escolheu um, e o destino de qualquer id
    // desconhecido ou acima do plano (ver getTheme e backend/src/plans.ts).
    id: 'papel',
    name: 'Papel',
    tier: 'free',
    dark: false,
    blurb: 'Marfim, tinta e um só bordô — o neutro de todo perfil.',
    swatch: { bg: '#f5f1e8', accent: '#6b2131', text: '#1f1b17' },
    style: {
      tile: 'card',
      avatar: 'circle',
      rule: 'hairline',
      header: 'centered',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#f5f1e8',
      '--c-surface': '#fcfaf5',
      '--c-text': '#1f1b17',
      '--c-muted': '#4a423a',
      '--c-faint': '#6a6157',
      '--c-border': 'rgba(31,27,23,0.10)',
      // O bordô da marca, e só ele: um tema, UM matiz de acento.
      '--c-accent': '#6b2131',
      '--c-accent-ink': '#fbf7ee',
      '--c-accent-soft': 'rgba(107,33,49,0.09)',
      '--c-ring': 'rgba(107,33,49,0.30)',
      '--c-grain': '0.03',
      '--c-noise': NOISE,
      '--font-display': FRAUNCES,
      '--font-body': SANS,
      '--display-tracking': '-0.01em',
      '--name-tracking': '-0.015em',
      '--label-tracking': '0.18em',
      '--tile-radius': '12px',
      '--btn-radius': '999px',
    },
  },
  // ---------------- PRO ----------------
  {
    id: 'linho',
    name: 'Linho',
    tier: 'pro',
    dark: false,
    blurb: 'Papel de linho, serifa de leitura e tinta sépia — quieto e quente.',
    swatch: { bg: '#f6f3ec', accent: '#5a4331', text: '#201d19' },
    style: {
      tile: 'underline',
      avatar: 'circle',
      rule: 'tapered',
      header: 'letterhead',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#f6f3ec',
      '--c-surface': '#fdfbf6',
      '--c-text': '#201d19',
      '--c-muted': '#4b453d',
      '--c-faint': '#6b645a',
      '--c-border': 'rgba(32,29,25,0.12)',
      // Sépia: a tinta de caneta-tinteiro sobre papel de linho. Passa em AA
      // (8,3:1) e continua sendo tinta, não cor.
      '--c-accent': '#5a4331',
      '--c-accent-ink': '#fbf8f1',
      '--c-accent-soft': 'rgba(90,67,49,0.09)',
      '--c-ring': 'rgba(90,67,49,0.30)',
      '--c-grain': '0.035',
      '--c-noise': NOISE,
      '--font-display': LORA,
      '--font-body': SANS,
      '--display-tracking': '-0.005em',
      '--name-tracking': '-0.01em',
      '--label-tracking': '0.16em',
      '--tile-radius': '8px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'ardosia',
    name: 'Ardósia',
    tier: 'pro',
    dark: false,
    blurb: 'Grafite sobre cinza claro, sem serifa e à esquerda — o tom corporativo.',
    swatch: { bg: '#eef0f2', accent: '#2a3542', text: '#1b232c' },
    style: {
      tile: 'outline',
      avatar: 'square',
      rule: 'bar',
      header: 'editorial',
      nameCase: 'upper',
    },
    vars: {
      '--c-bg': '#eef0f2',
      '--c-surface': '#ffffff',
      '--c-text': '#1b232c',
      '--c-muted': '#434e5a',
      '--c-faint': '#5d6873',
      '--c-border': 'rgba(27,35,44,0.16)',
      '--c-accent': '#2a3542',
      '--c-accent-ink': '#ffffff',
      '--c-accent-soft': 'rgba(42,53,66,0.08)',
      '--c-ring': 'rgba(42,53,66,0.32)',
      '--c-grain': '0.012',
      '--c-noise': NOISE,
      // Único tema com a MESMA família no display e no corpo: é o gesto
      // corporativo — um sistema tipográfico só, sem contraste editorial.
      '--font-display': PLEX,
      '--font-body': PLEX,
      '--display-tracking': '0.01em',
      '--name-tracking': '0.08em',
      '--label-tracking': '0.22em',
      '--tile-radius': '3px',
      '--btn-radius': '4px',
    },
  },
  {
    id: 'oliva',
    name: 'Oliva',
    tier: 'pro',
    dark: false,
    blurb: 'Verde-oliva sobre marfim, serifa de jornal e foto em arco.',
    swatch: { bg: '#f4f3ec', accent: '#4c5a2b', text: '#1d2018' },
    style: {
      tile: 'outline',
      avatar: 'arch',
      rule: 'capline',
      header: 'centered',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#f4f3ec',
      '--c-surface': '#fbfaf5',
      '--c-text': '#1d2018',
      '--c-muted': '#454a3c',
      '--c-faint': '#656a5a',
      '--c-border': 'rgba(29,32,24,0.11)',
      // Oliva, não esmeralda: verde de folha seca, terroso, sem brilho de pedra.
      '--c-accent': '#4c5a2b',
      '--c-accent-ink': '#f7f6ee',
      '--c-accent-soft': 'rgba(76,90,43,0.10)',
      '--c-ring': 'rgba(76,90,43,0.34)',
      '--c-grain': '0.03',
      '--c-noise': NOISE,
      '--font-display': NEWSREADER,
      '--font-body': SANS,
      '--display-tracking': '-0.015em',
      '--name-tracking': '-0.02em',
      '--label-tracking': '0.16em',
      '--tile-radius': '6px',
      '--btn-radius': '999px',
    },
  },
  // ---------------- MAX ----------------
  {
    // Subiu do Free para o Max em 13/09/2026: é o tema mais bem resolvido da
    // coleção anterior e passou a ser um dos motivos de assinar. Segue sendo o
    // tema do perfil de exemplo (mockData), que já é um perfil Max.
    id: 'nevoa',
    name: 'Névoa',
    tier: 'premium',
    dark: false,
    blurb: 'Grotesca fria e muito respiro — links em lista, quase sem moldura.',
    swatch: { bg: '#f1f4f5', accent: '#2d5f70', text: '#16212a' },
    style: {
      tile: 'underline',
      avatar: 'circle',
      rule: 'tapered',
      header: 'centered',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#f1f4f5',
      '--c-surface': '#ffffff',
      '--c-text': '#16212a',
      '--c-muted': '#46545f',
      // Escurecido para passar em 4.5:1 sobre o fundo E sobre a superfície: é
      // texto pequeno (tempo de leitura, nota de região, rodapé), não decoração.
      '--c-faint': '#626d76',
      '--c-border': 'rgba(22,33,42,0.12)',
      // Petróleo no lugar do azul-cinza: frio como o tema pede, mas com matiz
      // próprio — o anterior era indistinguível do texto acinzentado.
      '--c-accent': '#2d5f70',
      '--c-accent-ink': '#ffffff',
      '--c-accent-soft': 'rgba(45,95,112,0.10)',
      '--c-ring': 'rgba(45,95,112,0.26)',
      '--c-grain': '0.012',
      '--c-noise': NOISE,
      '--font-display': ARCHIVO,
      '--font-body': SANS,
      '--display-tracking': '-0.022em',
      '--name-tracking': '-0.03em',
      '--label-tracking': '0.2em',
      '--tile-radius': '8px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'timbre',
    name: 'Timbre',
    tier: 'premium',
    dark: false,
    blurb: 'Azul-marinho sobre creme, versalete e filete duplo — papel timbrado.',
    swatch: { bg: '#f8f5ee', accent: '#1f3350', text: '#1c1f27' },
    style: {
      tile: 'outline',
      avatar: 'square',
      rule: 'double',
      header: 'letterhead',
      nameCase: 'upper',
    },
    vars: {
      '--c-bg': '#f8f5ee',
      '--c-surface': '#fffdf8',
      '--c-text': '#1c1f27',
      '--c-muted': '#454a56',
      '--c-faint': '#626874',
      '--c-border': 'rgba(31,51,80,0.22)',
      // Marinho de tinta sobre creme: a combinação do papel timbrado clássico
      // (11,7:1). Nada de dourado — o REGRAS.md sugere justamente marinho.
      '--c-accent': '#1f3350',
      '--c-accent-ink': '#f8f5ee',
      '--c-accent-soft': 'rgba(31,51,80,0.08)',
      '--c-ring': 'rgba(31,51,80,0.36)',
      '--c-grain': '0.03',
      '--c-noise': NOISE,
      // Cormorant tem hastes finas: em versalete com entreletra larga ela vira
      // gravação de timbre, e o tamanho do nome dá o corpo que falta.
      '--font-display': CORMORANT,
      '--font-body': SANS,
      '--display-tracking': '0.02em',
      '--name-tracking': '0.12em',
      '--label-tracking': '0.26em',
      '--tile-radius': '3px',
      '--btn-radius': '3px',
    },
  },
  {
    id: 'nanquim',
    name: 'Nanquim',
    tier: 'premium',
    dark: false,
    blurb: 'Só preto e branco, serifa de alto contraste — nada além do essencial.',
    swatch: { bg: '#ffffff', accent: '#121212', text: '#121212' },
    style: {
      tile: 'underline',
      avatar: 'circle',
      rule: 'hairline',
      header: 'editorial',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#ffffff',
      '--c-surface': '#ffffff',
      '--c-text': '#121212',
      '--c-muted': '#3d3d3d',
      '--c-faint': '#5e5e5e',
      '--c-border': 'rgba(18,18,18,0.14)',
      // Uma tinta só: o acento É o texto. O botão de WhatsApp sai preto com letra
      // branca — o mais discreto que um botão consegue ser.
      '--c-accent': '#121212',
      '--c-accent-ink': '#ffffff',
      '--c-accent-soft': 'rgba(18,18,18,0.06)',
      '--c-ring': 'rgba(18,18,18,0.30)',
      // Branco absoluto, sem grão: papel couché, não papel de carta.
      '--c-grain': '0',
      '--c-noise': NOISE,
      '--font-display': PLAYFAIR,
      '--font-body': SANS,
      '--display-tracking': '-0.01em',
      '--name-tracking': '-0.015em',
      '--label-tracking': '0.2em',
      '--tile-radius': '0px',
      '--btn-radius': '2px',
    },
  },
  {
    id: 'marinho',
    name: 'Marinho',
    tier: 'premium',
    dark: true,
    blurb: 'Fundo azul-marinho e tinta clara — leitura calma no escuro.',
    swatch: { bg: '#0f1b2d', accent: '#d8d0bf', text: '#eceff4' },
    style: {
      tile: 'outline',
      avatar: 'circle',
      rule: 'tapered',
      header: 'centered',
      nameCase: 'none',
    },
    vars: {
      // Chapado. O Meia-noite tinha gradiente radial + vinheta; aqui o fundo é
      // uma cor só — o escuro já é o gesto, não precisa de profundidade fingida.
      '--c-bg': '#0f1b2d',
      '--c-surface': 'rgba(255,255,255,0.045)',
      '--c-text': '#eceff4',
      '--c-muted': '#b7c0cd',
      '--c-faint': '#94a0b0',
      '--c-border': 'rgba(236,239,244,0.16)',
      // Pedra clara, não ouro: sobre o marinho lê como papel sobre a mesa
      // (11,2:1) e não como metal.
      '--c-accent': '#d8d0bf',
      '--c-accent-ink': '#0f1b2d',
      '--c-accent-soft': 'rgba(216,208,191,0.12)',
      '--c-ring': 'rgba(216,208,191,0.50)',
      '--c-grain': '0.04',
      '--c-noise': NOISE,
      // Serifa de haste firme: no fundo escuro a fina (Cormorant) some.
      '--font-display': SOURCE_SERIF,
      '--font-body': SANS,
      '--display-tracking': '0',
      '--name-tracking': '-0.005em',
      '--label-tracking': '0.2em',
      '--tile-radius': '10px',
      '--btn-radius': '999px',
    },
  },
]

const tierRank: Record<Tier, number> = { free: 0, pro: 1, premium: 2 }

export const DEFAULT_THEME: ThemeId = 'papel'

/**
 * Ids da coleção anterior (até 13/09/2026) → sucessor mais próximo. Os ids
 * antigos estão GRAVADOS nos perfis que os escolheram; sem este mapa, cada um
 * deles cairia em silêncio para o neutro. O sucessor é o que preserva a
 * intenção (a mesma fonte, o mesmo tom de fundo), não o mesmo nome. ESPELHA
 * LEGACY_THEME de backend/src/plans.ts — o servidor grava o id novo no
 * próximo salvamento.
 */
export const LEGACY_THEME: Record<string, ThemeId> = {
  esmeralda: 'oliva', // Newsreader, foto em arco, capline — só o verde mudou
  toga: 'linho', // Lora sobre papel quente
  'meia-noite': 'marinho', // o escuro azul
  obsidian: 'marinho', // o outro escuro
  marmore: 'timbre', // timbre claro em versalete e filete duplo
}

export function getTheme(id: ThemeId | string | undefined): Theme {
  const real = id && Object.prototype.hasOwnProperty.call(LEGACY_THEME, id) ? LEGACY_THEME[id] : id
  return THEMES.find((t) => t.id === real) ?? THEMES[0]
}

export function isThemeUnlocked(theme: Theme, plan: Tier): boolean {
  return tierRank[theme.tier] <= tierRank[plan]
}

export function themeStyle(id: ThemeId | undefined): React.CSSProperties {
  return getTheme(id).vars as React.CSSProperties
}
