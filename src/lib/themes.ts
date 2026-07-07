// Sistema de temas — cada tema é uma identidade visual COMPLETA: paleta (CSS vars) +
// traços estruturais (tile, avatar, divisor, cabeçalho, acabamento) via `style`.
// Os temas escalam por plano de forma legível:
//   free    → chapado, uma cor, sem metal (limpo, "de entrada")
//   pro     → tons jóia + um floreio (arco/quadrado, déco), ainda chapado
//   premium → fundo dramático (escuro/mármore) + foil metálico animado + vidro (o "uau")

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

export interface ThemeStyle {
  tile: 'card' | 'outline' | 'underline' | 'glass' | 'filled'
  avatar: 'circle' | 'arch' | 'square' | 'ornate'
  divider: 'line' | 'diamond' | 'deco' | 'fleuron'
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

const FRAUNCES = "'Fraunces', Georgia, serif"
const PLAYFAIR = "'Playfair Display', 'Fraunces', Georgia, serif"

export const THEMES: Theme[] = [
  // ---------------- FREE ----------------
  {
    id: 'papel',
    name: 'Papel',
    tier: 'free',
    dark: false,
    blurb: 'Timbre de escritório — marfim, tinta e bordô.',
    swatch: { bg: '#f4efe4', accent: '#7a2532', text: '#211c17' },
    style: {
      tile: 'card',
      avatar: 'circle',
      divider: 'line',
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
      '--c-accent-soft': 'rgba(154,123,63,0.14)',
      '--c-ring': 'rgba(154,123,63,0.42)',
      '--c-grain': '0.05',
      '--c-noise': NOISE,
      '--font-display': FRAUNCES,
      '--tile-radius': '14px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'nevoa',
    name: 'Névoa',
    tier: 'free',
    dark: false,
    blurb: 'Minimalista e frio — links em lista, muito respiro.',
    swatch: { bg: '#f5f6f7', accent: '#3b4b5c', text: '#1f2933' },
    style: {
      tile: 'underline',
      avatar: 'circle',
      divider: 'line',
      header: 'centered',
      finish: 'flat',
      surface: 'plain',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#f5f6f7',
      '--c-bg-image': 'none',
      '--c-surface': '#ffffff',
      '--c-text': '#1f2933',
      '--c-muted': '#52606d',
      '--c-faint': '#8794a0',
      '--c-border': 'rgba(31,41,51,0.12)',
      '--c-accent': '#3b4b5c',
      '--c-accent-ink': '#ffffff',
      '--c-accent-soft': 'rgba(59,75,92,0.10)',
      '--c-ring': 'rgba(59,75,92,0.26)',
      '--c-grain': '0.015',
      '--c-noise': NOISE,
      '--font-display': FRAUNCES,
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
    blurb: 'Verde profundo, foto em arco e divisor déco dourado.',
    swatch: { bg: '#eef0e9', accent: '#0d4c3c', text: '#17241d' },
    style: {
      tile: 'outline',
      avatar: 'arch',
      divider: 'deco',
      header: 'letterhead',
      finish: 'flat',
      surface: 'plain',
      nameCase: 'upper',
    },
    vars: {
      '--c-bg': '#eef0e9',
      '--c-bg-image': 'none',
      '--c-surface': '#fbfbf5',
      '--c-text': '#17241d',
      '--c-muted': '#3c4a41',
      '--c-faint': '#6b776e',
      '--c-border': 'rgba(23,36,29,0.14)',
      '--c-accent': '#0d4c3c',
      '--c-accent-ink': '#f4f1eb',
      '--c-accent-soft': 'rgba(154,123,63,0.18)',
      '--c-ring': 'rgba(154,123,63,0.5)',
      '--c-grain': '0.035',
      '--c-noise': NOISE,
      '--font-display': FRAUNCES,
      '--tile-radius': '8px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'toga',
    name: 'Toga',
    tier: 'pro',
    dark: false,
    blurb: 'Vinho encorpado sobre bege, tiles preenchidos e fleurão.',
    swatch: { bg: '#f4ede2', accent: '#7a1f2b', text: '#2a1a1c' },
    style: {
      tile: 'filled',
      avatar: 'circle',
      divider: 'fleuron',
      header: 'centered',
      finish: 'flat',
      surface: 'plain',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#f4ede2',
      '--c-bg-image': 'none',
      '--c-surface': '#fbf5ec',
      '--c-text': '#2a1a1c',
      '--c-muted': '#574044',
      '--c-faint': '#8a7370',
      '--c-border': 'rgba(42,26,28,0.10)',
      '--c-accent': '#7a1f2b',
      '--c-accent-ink': '#fbf5ec',
      '--c-accent-soft': 'rgba(122,31,43,0.09)',
      '--c-ring': 'rgba(122,31,43,0.30)',
      '--c-grain': '0.04',
      '--c-noise': NOISE,
      '--font-display': FRAUNCES,
      '--tile-radius': '16px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'ardosia',
    name: 'Ardósia',
    tier: 'pro',
    dark: false,
    blurb: 'Platina e grafite — monocromático, sóbrio e corporativo.',
    swatch: { bg: '#eceff1', accent: '#2c3e50', text: '#26303a' },
    style: {
      tile: 'card',
      avatar: 'square',
      divider: 'line',
      header: 'letterhead',
      finish: 'flat',
      surface: 'plain',
      nameCase: 'upper',
    },
    vars: {
      '--c-bg': '#eceff1',
      '--c-bg-image': 'none',
      '--c-surface': '#ffffff',
      '--c-text': '#26303a',
      '--c-muted': '#4b5865',
      '--c-faint': '#808d99',
      '--c-border': 'rgba(44,62,80,0.16)',
      '--c-accent': '#2c3e50',
      '--c-accent-ink': '#ffffff',
      '--c-accent-soft': 'rgba(44,62,80,0.09)',
      '--c-ring': 'rgba(44,62,80,0.30)',
      '--c-grain': '0.02',
      '--c-noise': NOISE,
      '--font-display': FRAUNCES,
      '--tile-radius': '4px',
      '--btn-radius': '6px',
    },
  },
  // ---------------- PREMIUM ----------------
  {
    id: 'meia-noite',
    name: 'Meia-noite',
    tier: 'premium',
    dark: true,
    blurb: 'Navy gradiente, vidro, nome em foil champanhe e vinheta.',
    swatch: { bg: '#0f1420', accent: '#e0c088', text: '#eef1f8' },
    style: {
      tile: 'glass',
      avatar: 'ornate',
      divider: 'diamond',
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
      '--c-faint': '#79839a',
      '--c-border': 'rgba(232,236,245,0.14)',
      '--c-accent': '#e0c088',
      '--c-accent-ink': '#0f1420',
      '--c-accent-soft': 'rgba(224,192,136,0.16)',
      '--c-ring': 'rgba(224,192,136,0.55)',
      '--c-grain': '0.05',
      '--c-noise': NOISE,
      '--font-display': FRAUNCES,
      '--tile-radius': '18px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'obsidian',
    name: 'Obsidiana',
    tier: 'premium',
    dark: true,
    blurb: 'Preto absoluto com bronze — black-tie, foil e vidro.',
    swatch: { bg: '#0c0c0d', accent: '#c9a888', text: '#ece7df' },
    style: {
      tile: 'glass',
      avatar: 'ornate',
      divider: 'diamond',
      header: 'centered',
      finish: 'foil',
      surface: 'plain',
      nameCase: 'none',
    },
    vars: {
      '--c-bg': '#0c0c0d',
      '--c-bg-image': 'radial-gradient(120% 80% at 50% 0%, #1b1b1f 0%, #0c0c0d 60%)',
      '--c-surface': 'rgba(255,255,255,0.045)',
      '--c-text': '#ece7df',
      '--c-muted': '#b0a89c',
      '--c-faint': '#7d766b',
      '--c-border': 'rgba(255,255,255,0.12)',
      '--c-accent': '#c9a888',
      '--c-accent-ink': '#0c0c0d',
      '--c-accent-soft': 'rgba(201,168,136,0.15)',
      '--c-ring': 'rgba(201,168,136,0.52)',
      '--c-grain': '0.06',
      '--c-noise': NOISE,
      '--font-display': FRAUNCES,
      '--tile-radius': '16px',
      '--btn-radius': '999px',
    },
  },
  {
    id: 'marmore',
    name: 'Mármore',
    tier: 'premium',
    dark: false,
    blurb: 'Mármore e ouro, Playfair em caixa alta — art déco de luxo.',
    swatch: { bg: '#f4f1ea', accent: '#8a6d34', text: '#23201b' },
    style: {
      tile: 'outline',
      avatar: 'square',
      divider: 'deco',
      header: 'letterhead',
      finish: 'foil',
      surface: 'marble',
      nameCase: 'upper',
    },
    vars: {
      '--c-bg': '#f4f1ea',
      '--c-bg-image':
        'radial-gradient(90% 60% at 12% 0%, rgba(138,109,52,0.09) 0%, transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(138,109,52,0.07) 0%, transparent 50%)',
      '--c-surface': '#fffefb',
      '--c-text': '#23201b',
      '--c-muted': '#4d473d',
      '--c-faint': '#837b6d',
      '--c-border': 'rgba(138,109,52,0.34)',
      '--c-accent': '#8a6d34',
      '--c-accent-ink': '#fffdf8',
      '--c-accent-soft': 'rgba(138,109,52,0.12)',
      '--c-ring': 'rgba(138,109,52,0.5)',
      '--c-grain': '0.03',
      '--c-noise': NOISE,
      '--font-display': PLAYFAIR,
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
