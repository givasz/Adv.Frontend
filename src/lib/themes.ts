// Sistema de temas — cada tema é uma identidade visual COMPLETA: paleta (CSS vars),
// TIPOGRAFIA própria (display + corpo) e traços estruturais (tile, avatar, filete,
// cabeçalho, acabamento) via `style`.
//
// Duas decisões que regem tudo aqui:
//
// 1. NADA DE DINGBAT. Losango, fleurão e bolinha saíram: um símbolo decorativo
//    envelhece mal, some no contraste e faz um perfil de advogado parecer convite
//    de casamento. O ornamento agora é TIPOGRÁFICO — filete, versalete, entreletra
//    e peso. É o que faz um impresso jurídico parecer sério, e é o que sobrevive
//    em qualquer tamanho de tela.
//
// 2. TEMA É ESCOLA TIPOGRÁFICA, não troca de cor. Cada um tem sua fonte de
//    display (e às vezes de corpo); trocar de tema muda a VOZ do perfil, não só o
//    matiz. Fontes carregadas em index.html; o navegador só baixa a do tema em uso.
//
// A escada por plano continua legível:
//   free    → chapado, uma cor, sem metal (limpo, "de entrada")
//   pro     → paleta encorpada + um traço estrutural forte, ainda chapado
//   premium → fundo dramático (escuro/mármore) + foil metálico animado + vidro

export type ThemeId =
  | 'papel'
  | 'nevoa'
  | 'esmeralda'
  | 'toga'
  | 'ardosia'
  | 'meia-noite'
  | 'obsidian'
  | 'marmore'

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

export interface ThemeStyle {
  tile: 'card' | 'outline' | 'underline' | 'glass' | 'filled'
  avatar: 'circle' | 'arch' | 'square' | 'ornate'
  rule: RuleStyle
  header: 'centered' | 'letterhead' | 'editorial'
  finish: 'flat' | 'foil'
  surface: 'plain' | 'vignette' | 'marble'
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

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

// Pilha de fontes por tema. O fallback final nunca é uma fonte de sistema
// genérica solta: cada pilha cai para uma família do mesmo gênero.
const SANS = "'Hanken Grotesk', 'Segoe UI', system-ui, sans-serif"
const FRAUNCES = `'Fraunces', Georgia, serif`
const PLAYFAIR = `'Playfair Display', 'Fraunces', Georgia, serif`
const NEWSREADER = `'Newsreader', 'Fraunces', Georgia, serif`
const LORA = `'Lora', 'Fraunces', Georgia, serif`
const CORMORANT = `'Cormorant Garamond', 'Playfair Display', Georgia, serif`
const ARCHIVO = `'Archivo', 'Hanken Grotesk', system-ui, sans-serif`
const SYNE = `'Syne', 'Hanken Grotesk', system-ui, sans-serif`

export const THEMES: Theme[] = [
  // ---------------- FREE ----------------
  {
    id: 'papel',
    name: 'Papel',
    tier: 'free',
    dark: false,
    blurb: 'Timbre de escritório — marfim, tinta e bordô, com serifa clássica.',
    swatch: { bg: '#f4efe4', accent: '#7a2532', text: '#211c17' },
    style: {
      tile: 'card',
      avatar: 'circle',
      rule: 'hairline',
      header: 'letterhead',
      finish: 'flat',
      surface: 'plain',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#f4efe4',
      '--c-bg-image': 'none',
      '--c-surface': '#fbf7ee',
      '--c-text': '#211c17',
      '--c-muted': '#443b32',
      '--c-faint': '#6b6155',
      '--c-border': 'rgba(33,28,23,0.10)',
      '--c-accent': '#7a2532',
      '--c-accent-ink': '#fbf7ee',
      // Um tema, UM matiz de acento. Antes o soft/ring eram dourados enquanto o
      // acento era bordô: duas cores de destaque brigando sem intenção nenhuma.
      '--c-accent-soft': 'rgba(122,37,50,0.10)',
      '--c-ring': 'rgba(122,37,50,0.30)',
      '--c-grain': '0.05',
      '--c-noise': NOISE,
      '--font-display': FRAUNCES,
      '--font-body': SANS,
      '--display-tracking': '-0.01em',
      '--name-tracking': '-0.015em',
      '--label-tracking': '0.18em',
      '--tile-radius': '14px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'nevoa',
    name: 'Névoa',
    tier: 'free',
    dark: false,
    blurb: 'Grotesca fria e muito respiro — links em lista, quase sem moldura.',
    swatch: { bg: '#f1f4f5', accent: '#2d5f70', text: '#16212a' },
    style: {
      tile: 'underline',
      avatar: 'circle',
      rule: 'tapered',
      header: 'centered',
      finish: 'flat',
      surface: 'plain',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#f1f4f5',
      '--c-bg-image': 'none',
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
  // ---------------- PRO ----------------
  {
    id: 'esmeralda',
    name: 'Esmeralda',
    tier: 'pro',
    dark: false,
    blurb: 'Verde profundo sobre marfim, serifa de jornal e foto em arco.',
    swatch: { bg: '#f3f1ea', accent: '#14503f', text: '#1a2620' },
    style: {
      tile: 'outline',
      avatar: 'arch',
      rule: 'capline',
      header: 'letterhead',
      finish: 'flat',
      surface: 'plain',
      nameCase: 'none',
    },
    vars: {
      // Fundo marfim NEUTRO: o cinza-esverdeado anterior tingia o verde do acento
      // e o conjunto ficava lavado, com cara de formulário.
      '--c-bg': '#f3f1ea',
      '--c-bg-image': 'none',
      '--c-surface': '#fcfbf6',
      '--c-text': '#1a2620',
      '--c-muted': '#3d4c44',
      // Escurecido para passar em 4.5:1 sobre o fundo E sobre a superfície: é
      // texto pequeno (tempo de leitura, nota de região, rodapé), não decoração.
      '--c-faint': '#636f68',
      '--c-border': 'rgba(20,80,63,0.20)',
      '--c-accent': '#14503f',
      '--c-accent-ink': '#f6f5ef',
      // Antes o realce era dourado sobre um acento verde — duas famílias de cor
      // sem parentesco. Agora tudo desce do próprio verde.
      '--c-accent-soft': 'rgba(20,80,63,0.09)',
      '--c-ring': 'rgba(20,80,63,0.34)',
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
  {
    id: 'toga',
    name: 'Toga',
    tier: 'pro',
    dark: false,
    blurb: 'Vinho encorpado sobre areia, serifa de leitura e barra de acento.',
    swatch: { bg: '#f5eee3', accent: '#7a1f2b', text: '#291a1c' },
    style: {
      tile: 'filled',
      avatar: 'circle',
      rule: 'bar',
      header: 'centered',
      finish: 'flat',
      surface: 'plain',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#f5eee3',
      '--c-bg-image': 'none',
      '--c-surface': '#fcf6ec',
      '--c-text': '#291a1c',
      '--c-muted': '#503c3f',
      // Antes #8a7370: tinha ~3.4:1 sobre o fundo, abaixo do mínimo para texto
      // pequeno. Escurecido para passar em AA.
      '--c-faint': '#6f5a57',
      '--c-border': 'rgba(41,26,28,0.12)',
      '--c-accent': '#7a1f2b',
      '--c-accent-ink': '#fcf6ec',
      '--c-accent-soft': 'rgba(122,31,43,0.09)',
      '--c-ring': 'rgba(122,31,43,0.30)',
      '--c-grain': '0.04',
      '--c-noise': NOISE,
      '--font-display': LORA,
      '--font-body': SANS,
      '--display-tracking': '-0.005em',
      '--name-tracking': '-0.01em',
      '--label-tracking': '0.16em',
      '--tile-radius': '16px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'ardosia',
    name: 'Ardósia',
    tier: 'pro',
    dark: false,
    blurb: 'Grotesca corporativa em grafite — cantos retos, filete duplo.',
    swatch: { bg: '#eaedef', accent: '#1f2d3a', text: '#1c2630' },
    style: {
      tile: 'card',
      avatar: 'square',
      rule: 'double',
      header: 'letterhead',
      finish: 'flat',
      surface: 'plain',
      nameCase: 'upper',
    },
    vars: {
      '--c-bg': '#eaedef',
      '--c-bg-image': 'none',
      '--c-surface': '#ffffff',
      '--c-text': '#1c2630',
      '--c-muted': '#44525f',
      // Escurecido para passar em 4.5:1 sobre o fundo E sobre a superfície: é
      // texto pequeno (tempo de leitura, nota de região, rodapé), não decoração.
      '--c-faint': '#5f6b77',
      '--c-border': 'rgba(31,45,58,0.18)',
      '--c-accent': '#1f2d3a',
      '--c-accent-ink': '#ffffff',
      '--c-accent-soft': 'rgba(31,45,58,0.08)',
      '--c-ring': 'rgba(31,45,58,0.32)',
      '--c-grain': '0.015',
      '--c-noise': NOISE,
      // Único tema com a MESMA família no display e no corpo: é o gesto
      // corporativo — um sistema tipográfico só, sem contraste editorial.
      '--font-display': ARCHIVO,
      '--font-body': ARCHIVO,
      '--display-tracking': '0.02em',
      '--name-tracking': '0.08em',
      '--label-tracking': '0.22em',
      '--tile-radius': '3px',
      '--btn-radius': '4px',
    },
  },
  // ---------------- PREMIUM ----------------
  {
    id: 'meia-noite',
    name: 'Meia-noite',
    tier: 'premium',
    dark: true,
    blurb: 'Navy gradiente e vidro, com serifa de alto contraste em foil.',
    swatch: { bg: '#0f1420', accent: '#e0c088', text: '#eef1f8' },
    style: {
      tile: 'glass',
      avatar: 'ornate',
      rule: 'tapered',
      header: 'centered',
      finish: 'foil',
      surface: 'vignette',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#0f1420',
      '--c-bg-image':
        'radial-gradient(120% 90% at 50% -10%, #1e2a49 0%, #141d31 45%, #0f1420 100%)',
      '--c-surface': 'rgba(232,236,245,0.055)',
      '--c-text': '#eef1f8',
      '--c-muted': '#aab3c6',
      '--c-faint': '#8a94aa',
      '--c-border': 'rgba(232,236,245,0.14)',
      '--c-accent': '#e0c088',
      '--c-accent-ink': '#0f1420',
      '--c-accent-soft': 'rgba(224,192,136,0.16)',
      '--c-ring': 'rgba(224,192,136,0.55)',
      '--c-grain': '0.05',
      '--c-noise': NOISE,
      // Cormorant tem hastes finíssimas: aqui ela ganha corpo pelo TAMANHO do
      // nome, e o alto contraste é justamente o que brilha no fundo escuro.
      '--font-display': CORMORANT,
      '--font-body': SANS,
      '--display-tracking': '0.005em',
      '--name-tracking': '0.01em',
      '--label-tracking': '0.2em',
      '--tile-radius': '18px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'obsidian',
    name: 'Obsidiana',
    tier: 'premium',
    dark: true,
    blurb: 'Preto absoluto e bronze, display contemporâneo em caixa alta.',
    swatch: { bg: '#0c0c0d', accent: '#c9a888', text: '#ece7df' },
    style: {
      tile: 'glass',
      avatar: 'ornate',
      rule: 'bar',
      header: 'centered',
      finish: 'foil',
      surface: 'plain',
      nameCase: 'upper',
    },
    vars: {
      '--c-bg': '#0c0c0d',
      '--c-bg-image': 'radial-gradient(120% 80% at 50% 0%, #1b1b1f 0%, #0c0c0d 60%)',
      '--c-surface': 'rgba(255,255,255,0.045)',
      '--c-text': '#ece7df',
      '--c-muted': '#b0a89c',
      '--c-faint': '#8d857a',
      '--c-border': 'rgba(255,255,255,0.12)',
      '--c-accent': '#c9a888',
      '--c-accent-ink': '#0c0c0d',
      '--c-accent-soft': 'rgba(201,168,136,0.15)',
      '--c-ring': 'rgba(201,168,136,0.52)',
      '--c-grain': '0.06',
      '--c-noise': NOISE,
      '--font-display': SYNE,
      '--font-body': SANS,
      '--display-tracking': '0.04em',
      '--name-tracking': '0.12em',
      '--label-tracking': '0.26em',
      '--tile-radius': '16px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'marmore',
    name: 'Mármore',
    tier: 'premium',
    dark: false,
    blurb: 'Mármore e ouro, Playfair em caixa alta — déco, cantos vivos.',
    swatch: { bg: '#f4f1ea', accent: '#7d6229', text: '#23201b' },
    style: {
      tile: 'outline',
      avatar: 'square',
      rule: 'double',
      header: 'letterhead',
      finish: 'foil',
      surface: 'marble',
      nameCase: 'upper',
    },
    vars: {
      '--c-bg': '#f4f1ea',
      '--c-bg-image':
        'radial-gradient(90% 60% at 12% 0%, rgba(125,98,41,0.09) 0%, transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(125,98,41,0.07) 0%, transparent 50%)',
      '--c-surface': '#fffefb',
      '--c-text': '#23201b',
      '--c-muted': '#4d473d',
      '--c-faint': '#756d5e',
      '--c-border': 'rgba(125,98,41,0.34)',
      // Ouro escurecido: o anterior (#8a6d34) ficava em 3.9:1 sobre o mármore e
      // não passava em AA quando usado como texto de acento.
      '--c-accent': '#7d6229',
      '--c-accent-ink': '#fffdf8',
      '--c-accent-soft': 'rgba(125,98,41,0.12)',
      '--c-ring': 'rgba(125,98,41,0.5)',
      '--c-grain': '0.03',
      '--c-noise': NOISE,
      '--font-display': PLAYFAIR,
      '--font-body': SANS,
      '--display-tracking': '0.03em',
      '--name-tracking': '0.14em',
      '--label-tracking': '0.28em',
      '--tile-radius': '2px',
      '--btn-radius': '2px',
    },
  },
]

const tierRank: Record<Tier, number> = { free: 0, pro: 1, premium: 2 }

export const DEFAULT_THEME: ThemeId = 'papel'

export function getTheme(id: ThemeId | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function isThemeUnlocked(theme: Theme, plan: Tier): boolean {
  return tierRank[theme.tier] <= tierRank[plan]
}

export function themeStyle(id: ThemeId | undefined): React.CSSProperties {
  return getTheme(id).vars as React.CSSProperties
}
