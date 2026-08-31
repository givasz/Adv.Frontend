// Cartão de visita — o DESENHO, em milímetros, como SVG.
//
// Este arquivo é puro: entra perfil + configuração, sai uma string de SVG. É o
// mesmo princípio do ProfileView — a prévia da tela, o PNG e a folha que vai para
// a gráfica saem TODOS daqui. Não existe um segundo renderizador para divergir do
// que o advogado viu.
//
// Duas decisões que regem o arquivo:
//
// 1. MILÍMETRO É A UNIDADE. O viewBox é o cartão físico (96 × 56 mm, já com
//    sangria), então "5" no código é 5 mm no papel. Nada de converter pixel para
//    milímetro em três lugares diferentes e errar em um.
//
// 2. O CARTÃO É O TEMA DO PERFIL. Cor, fonte e traço vêm de lib/themes.ts. Trocar
//    o tema troca o cartão; não existe uma segunda identidade visual para manter.
//    Os modelos abaixo são DIAGRAMAÇÕES do mesmo tema, não marcas diferentes.
//
// O fundo é sempre um <rect> desenhado, nunca um `background` de CSS: quem
// imprime pelo navegador costuma esquecer de ligar "gráficos de plano de fundo",
// e aí um fundo de CSS sai branco. Como elemento, sai sempre.

import { create as createQr } from 'qrcode'
import { enderecoVisivel, linhaLogradouro } from './endereco'
import type { Profile } from './types'
import { getTheme } from './themes'
import { maskBrLocal } from './brFormat'
import { profileUrl, profileUrlLabel } from './publicUrl'

// ---- Medidas do papel -------------------------------------------------------

/** Medidas do cartão, em milímetros. Padrão brasileiro: 90 × 50 mm. */
export const CARD_MM = {
  /** corte final — é este o tamanho do cartão na mão de quem recebe */
  trimW: 90,
  trimH: 50,
  /** sangria: fundo que passa da linha de corte para o corte nunca sair com filete branco */
  bleed: 3,
  /** margem de segurança a partir do corte — nada de texto aqui para dentro */
  safe: 4,
} as const

/** Largura total com sangria (96 mm). */
export const BLEED_W = CARD_MM.trimW + CARD_MM.bleed * 2
/** Altura total com sangria (56 mm). */
export const BLEED_H = CARD_MM.trimH + CARD_MM.bleed * 2
/** Origem da área segura dentro do SVG com sangria (7 mm em cada eixo). */
const PAD = CARD_MM.bleed + CARD_MM.safe
/** Largura útil de texto (82 mm). */
const INNER_W = BLEED_W - PAD * 2

/** Resolução de impressão. 300 dpi é o que toda gráfica pede. */
export const PRINT_DPI = 300
/** Lado do PNG em pixels, com sangria: 96 mm a 300 dpi = 1134 px. */
export const pxAt300 = (mm: number) => Math.round((mm / 25.4) * PRINT_DPI)

// ---- Configuração que o advogado mexe --------------------------------------

export type CardTemplate = 'timbre' | 'razao' | 'reto'
export type CardSide = 'frente' | 'verso'

export interface CardConfig {
  template: CardTemplate
  /** foto no cartão (usa a mesma do perfil) */
  showPhoto: boolean
  /** verso com o QR do perfil; sem ele, o verso repete o timbre */
  showQr: boolean
  showWhatsapp: boolean
  showEmail: boolean
  showCity: boolean
  /**
   * Rua e número no cartão impresso. Ligado por padrão: um cartão de visita de
   * advogado com endereço é o caso comum, e quem não quiser desliga aqui. Só
   * sai se o endereço existir E estiver marcado como público no perfil — o
   * interruptor de privacidade vale para o papel também.
   */
  showAddress: boolean
  showAreas: boolean
  /** linha livre sob o nome — passa pela checagem de conformidade */
  tagline: string
}

export const CARD_TAGLINE_MAX = 48

export const DEFAULT_CARD: CardConfig = {
  template: 'timbre',
  showPhoto: false,
  showQr: true,
  showWhatsapp: true,
  showEmail: true,
  showCity: true,
  showAddress: true,
  showAreas: true,
  tagline: '',
}

export const CARD_TEMPLATES: { id: CardTemplate; name: string; blurb: string }[] = [
  { id: 'timbre', name: 'Timbre', blurb: 'Tudo centralizado, com filete sob o nome.' },
  { id: 'razao', name: 'Razão', blurb: 'Barra de acento à esquerda e dados em coluna.' },
  { id: 'reto', name: 'Reto', blurb: 'Só tipografia, alinhado à esquerda. Máximo silêncio.' },
]

/** Normaliza o que veio do servidor/rascunho — campo desconhecido cai no padrão. */
export function resolveCard(raw: Partial<CardConfig> | undefined | null): CardConfig {
  const t = raw?.template
  return {
    template: CARD_TEMPLATES.some((x) => x.id === t) ? (t as CardTemplate) : DEFAULT_CARD.template,
    showPhoto: raw?.showPhoto ?? DEFAULT_CARD.showPhoto,
    showQr: raw?.showQr ?? DEFAULT_CARD.showQr,
    showWhatsapp: raw?.showWhatsapp ?? DEFAULT_CARD.showWhatsapp,
    showEmail: raw?.showEmail ?? DEFAULT_CARD.showEmail,
    showCity: raw?.showCity ?? DEFAULT_CARD.showCity,
    showAddress: raw?.showAddress ?? DEFAULT_CARD.showAddress,
    showAreas: raw?.showAreas ?? DEFAULT_CARD.showAreas,
    tagline: String(raw?.tagline ?? '').slice(0, CARD_TAGLINE_MAX),
  }
}

// ---- Utilitários de texto ---------------------------------------------------

/**
 * Escapa texto para dentro do SVG. O cartão carrega texto DIGITADO pelo advogado
 * e o resultado é injetado como HTML na prévia — sem isto, um `<` no nome
 * quebraria o desenho (e seria uma porta aberta).
 */
export function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Largura média de um caractere, em fração do corpo da fonte. Não é métrica real
// (não temos a fonte carregada aqui), é o suficiente para DECIDIR SE ENCOLHE —
// e errar para o lado seguro é o que mantém o texto dentro da área segura.
const W_DISPLAY = 0.56
const W_BODY = 0.53

const textWidth = (text: string, size: number, factor: number, tracking = 0) =>
  text.length * (size * factor + tracking)

/**
 * Corpo de fonte que faz o texto caber em `maxW`, nunca abaixo de `min`. Devolve
 * também o texto já cortado quando nem no corpo mínimo cabe.
 */
export function fitText(
  text: string,
  maxW: number,
  size: number,
  { min = size * 0.62, factor = W_BODY, tracking = 0 } = {},
): { text: string; size: number } {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (!clean) return { text: '', size }
  const needed = textWidth(clean, size, factor, tracking)
  if (needed <= maxW) return { text: clean, size }
  const shrunk = Math.max(min, (maxW / clean.length - tracking) / factor)
  if (textWidth(clean, shrunk, factor, tracking) <= maxW) return { text: clean, size: shrunk }
  const cabe = Math.max(1, Math.floor(maxW / (shrunk * factor + tracking)) - 1)
  return { text: `${clean.slice(0, cabe).trimEnd()}…`, size: shrunk }
}

// ---- Dados do perfil que viram linhas do cartão -----------------------------

/** WhatsApp guardado como "5511999999999" → "(11) 99999-9999". */
export function phoneLabel(whatsapp?: string): string {
  const d = (whatsapp ?? '').replace(/\D/g, '')
  if (!d) return ''
  const local = d.startsWith('55') ? d.slice(2) : d
  return maskBrLocal(local)
}

export interface CardLines {
  name: string
  oab: string
  tagline: string
  areas: string
  contacts: string[]
  url: string
  urlLabel: string
  photo?: string
}

/** O que cada modelo tem para desenhar — uma vez só, para os três reusarem. */
export function cardLines(profile: Profile, card: CardConfig): CardLines {
  const areas = (profile.areas ?? [])
    .map((a) => (a?.label ?? '').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ')

  const contacts: string[] = []
  if (card.showWhatsapp && profile.contact?.whatsapp) contacts.push(phoneLabel(profile.contact.whatsapp))
  if (card.showEmail && profile.contact?.email) contacts.push(profile.contact.email.trim())
  // Rua ANTES de cidade/UF: é a ordem em que endereço se lê, e no cartão as
  // duas linhas ficam vizinhas.
  if (card.showAddress && enderecoVisivel(profile.address)) {
    contacts.push(linhaLogradouro(profile.address))
  }
  if (card.showCity && (profile.city || profile.state)) {
    contacts.push([profile.city, profile.state].filter(Boolean).join('/'))
  }

  return {
    name: (profile.name || 'Seu nome').trim(),
    oab: (profile.oabNumber || '').trim(),
    tagline: card.tagline.trim(),
    areas: card.showAreas ? areas : '',
    contacts: contacts.filter(Boolean),
    url: profileUrl(profile.slug),
    urlLabel: profileUrlLabel(profile.slug),
    photo: card.showPhoto ? profile.avatarUrl : undefined,
  }
}

// ---- Peças de SVG -----------------------------------------------------------

interface Ink {
  bg: string
  surface: string
  text: string
  muted: string
  faint: string
  accent: string
  display: string
  body: string
}

/**
 * Troca das pilhas de fonte na hora de EXPORTAR. O PNG embute a fonte com um
 * nome próprio (ver lib/cardExport.ts) porque um navegador — o do Safari —
 * confunde duas faces da mesma família dentro de uma SVG rasterizada.
 */
export interface CardFonts {
  display: string
  body: string
}

/** Cores e fontes do cartão — vêm do tema escolhido no perfil. */
export function cardInk(profile: Profile): Ink {
  const v = getTheme(profile.theme).vars
  return {
    bg: v['--c-bg'],
    surface: v['--c-surface'],
    text: v['--c-text'],
    muted: v['--c-muted'],
    faint: v['--c-faint'],
    accent: v['--c-accent'],
    display: v['--font-display'],
    body: v['--font-body'],
  }
}

/**
 * Tamanho óptico do NOME. O corpo aqui é em milímetros (6,2 mm), e o navegador
 * escolhe o corte de uma fonte variável por esse número: 6 é lido como "texto
 * miúdo" e sai a versão encorpada, de nota de rodapé. No papel esses 6,2 mm são
 * ~17 pt, então fixamos em 24 — o corte de nome próprio, o mesmo que o perfil
 * usa na tela.
 */
export const DISPLAY_OPSZ = 24

// Vai como `style` no próprio elemento, não como regra de folha: o rasterizador
// do WebKit (o do Safari) ignora seletor de classe dentro de SVG carregada em
// <img>, e o PNG saía com o corte errado enquanto a tela mostrava o certo.
// `&#39;` é aspa simples escapada — o atributo já está entre aspas duplas.
const OPTICAL_STYLE = (opsz: number) =>
  `font-optical-sizing:none;font-variation-settings:&#39;opsz&#39; ${opsz}`

interface TextOpts {
  size: number
  /** tamanho óptico (eixo `opsz`) a fixar — só o texto de display usa */
  optical?: number
  fill: string
  font: string
  anchor?: 'start' | 'middle' | 'end'
  weight?: number
  tracking?: number
  upper?: boolean
}

function tspan(x: number, y: number, raw: string, o: TextOpts): string {
  if (!raw) return ''
  const txt = o.upper ? raw.toLocaleUpperCase('pt-BR') : raw
  const attrs = [
    `x="${round(x)}"`,
    `y="${round(y)}"`,
    `font-family="${esc(o.font)}"`,
    `font-size="${round(o.size)}"`,
    `fill="${o.fill}"`,
    o.weight ? `font-weight="${o.weight}"` : '',
    o.anchor ? `text-anchor="${o.anchor}"` : '',
    o.tracking ? `letter-spacing="${round(o.tracking)}"` : '',
    o.optical ? `style="${OPTICAL_STYLE(o.optical)}"` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return `<text ${attrs}>${esc(txt)}</text>`
}

const round = (n: number) => Math.round(n * 1000) / 1000

const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w = 0.25) =>
  `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="butt"/>`

/**
 * Foto do advogado. O avatar já é um data URI (ver lib/image.ts), então entra no
 * SVG sem depender de rede — e o PNG exportado não fica "sujo" por origem
 * cruzada, que é o que quebraria o download em Firefox e Safari.
 *
 * `href` e `xlink:href` juntos de propósito: navegador antigo lê só o segundo.
 */
function photo(x: number, y: number, size: number, src: string, id: string, round_: boolean): string {
  const shape = round_
    ? `<circle cx="${round(x + size / 2)}" cy="${round(y + size / 2)}" r="${round(size / 2)}"/>`
    : `<rect x="${round(x)}" y="${round(y)}" width="${round(size)}" height="${round(size)}" rx="0.8"/>`
  return (
    `<clipPath id="${id}">${shape}</clipPath>` +
    `<image href="${esc(src)}" xlink:href="${esc(src)}" x="${round(x)}" y="${round(y)}" ` +
    `width="${round(size)}" height="${round(size)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
  )
}

/**
 * QR do perfil desenhado como um caminho único. Usamos `create()` (síncrono) em
 * vez do `toDataURL` para o cartão continuar sendo uma função pura: o mesmo
 * desenho sai no navegador e no teste.
 */
export function qrPath(url: string, x: number, y: number, size: number, fill: string): string {
  const qr = createQr(url, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const data = qr.modules.data
  const cell = size / n
  let d = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!data[r * n + c]) continue
      d += `M${round(x + c * cell)} ${round(y + r * cell)}h${round(cell)}v${round(cell)}h-${round(cell)}z`
    }
  }
  return `<path d="${d}" fill="${fill}" shape-rendering="crispEdges"/>`
}

// ---- Os modelos -------------------------------------------------------------

function frenteTimbre(l: CardLines, k: Ink, id: string): string {
  const cx = BLEED_W / 2
  let y = l.photo ? 26 : 22.5
  let out = ''

  if (l.photo) out += photo(cx - 7, 8, 14, l.photo, `${id}-foto`, true)

  const nome = fitText(l.name, INNER_W, 6.2, { factor: W_DISPLAY, min: 3.8 })
  out += tspan(cx, y, nome.text, {
    size: nome.size,
    fill: k.text,
    font: k.display,
    anchor: 'middle',
    weight: 600,
    optical: DISPLAY_OPSZ,
  })

  y += 3.4
  out += line(cx - 14, y, cx + 14, y, k.accent, 0.3)

  y += 4
  if (l.oab) {
    out += tspan(cx, y, l.oab, { size: 2.5, fill: k.muted, font: k.body, anchor: 'middle', tracking: 0.12 })
    y += 3.6
  }
  const sub = l.tagline || l.areas
  if (sub) {
    const f = fitText(sub, INNER_W, 2.4)
    out += tspan(cx, y, f.text, { size: f.size, fill: k.faint, font: k.body, anchor: 'middle' })
  }

  if (l.contacts.length) {
    const junto = l.contacts.join('   ·   ')
    const f = fitText(junto, INNER_W, 2.5)
    out += tspan(cx, BLEED_H - PAD - 1, f.text, { size: f.size, fill: k.muted, font: k.body, anchor: 'middle' })
  }
  return out
}

function frenteRazao(l: CardLines, k: Ink, id: string): string {
  const x = PAD + 2.4
  const maxW = BLEED_W - x - PAD - (l.photo ? 18 : 0)
  let out = `<rect x="0" y="0" width="${round(CARD_MM.bleed + 1.8)}" height="${BLEED_H}" fill="${k.accent}"/>`

  if (l.photo) out += photo(BLEED_W - PAD - 15, PAD + 1, 15, l.photo, `${id}-foto`, false)

  const nome = fitText(l.name, maxW, 5.6, { factor: W_DISPLAY, min: 3.6 })
  out += tspan(x, 17.5, nome.text, { size: nome.size, fill: k.text, font: k.display, weight: 600, optical: DISPLAY_OPSZ })

  if (l.oab) out += tspan(x, 22, l.oab, { size: 2.5, fill: k.muted, font: k.body, tracking: 0.1 })

  out += line(x, 25.5, x + 22, 25.5, k.accent, 0.5)

  const sub = l.tagline || l.areas
  if (sub) {
    const f = fitText(sub, maxW, 2.4)
    out += tspan(x, 29.5, f.text, { size: f.size, fill: k.faint, font: k.body })
  }

  let y = BLEED_H - PAD - (l.contacts.length - 1) * 3.6
  for (const c of l.contacts) {
    const f = fitText(c, maxW, 2.5)
    out += tspan(x, y, f.text, { size: f.size, fill: k.muted, font: k.body })
    y += 3.6
  }
  return out
}

function frenteReto(l: CardLines, k: Ink, id: string): string {
  const x = PAD
  const maxW = INNER_W - (l.photo ? 18 : 0)
  let out = ''

  if (l.photo) out += photo(BLEED_W - PAD - 15, PAD, 15, l.photo, `${id}-foto`, false)

  const nome = fitText(l.name, maxW, 6.4, { factor: W_DISPLAY, min: 3.6 })
  out += tspan(x, PAD + 6, nome.text, {
    size: nome.size,
    fill: k.text,
    font: k.display,
    weight: 600,
    tracking: -0.05,
    optical: DISPLAY_OPSZ,
  })

  if (l.oab) out += tspan(x, PAD + 10.5, l.oab, { size: 2.4, fill: k.faint, font: k.body, tracking: 0.1 })

  const sub = l.tagline || l.areas
  if (sub) {
    const f = fitText(sub, maxW, 2.4, { tracking: 0.25 })
    // Sem peso: quem dá ênfase aqui é a caixa alta, a entreletra e o acento. Uma
    // segunda espessura do corpo obrigaria a embutir outra fonte no PNG.
    out += tspan(x, PAD + 15.5, f.text, {
      size: f.size,
      fill: k.accent,
      font: k.body,
      tracking: 0.25,
      upper: true,
    })
  }

  // O filete fica PERTO da linha de contato: solto no meio do vazio ele parecia
  // um risco esquecido em vez de um remate.
  out += line(x, BLEED_H - PAD - 4.5, x + 10, BLEED_H - PAD - 4.5, k.accent, 0.7)

  const junto = l.contacts.join('   ·   ')
  if (junto) {
    const f = fitText(junto, INNER_W, 2.5)
    out += tspan(x, BLEED_H - PAD, f.text, { size: f.size, fill: k.muted, font: k.body })
  }
  return out
}

/** Verso: o QR que leva ao perfil — é o que faz o papel virar visita ao site. */
function versoQr(l: CardLines, k: Ink): string {
  const cx = BLEED_W / 2
  const s = 22
  let out = `<rect x="${round(cx - s / 2 - 1.6)}" y="${round(12 - 1.6)}" width="${round(s + 3.2)}" height="${round(s + 3.2)}" rx="1" fill="#ffffff"/>`
  out += qrPath(l.url, cx - s / 2, 12, s, '#111111')
  const f = fitText(l.urlLabel, INNER_W, 2.6)
  out += tspan(cx, 40.5, f.text, { size: f.size, fill: k.muted, font: k.body, anchor: 'middle' })
  out += tspan(cx, 45.5, 'Aponte a câmera', {
    size: 2,
    fill: k.faint,
    font: k.body,
    anchor: 'middle',
    tracking: 0.25,
    upper: true,
  })
  return out
}

/** Verso sem QR: o timbre de novo, em silêncio. */
function versoTimbre(l: CardLines, k: Ink): string {
  const cx = BLEED_W / 2
  const nome = fitText(l.name, INNER_W, 5.4, { factor: W_DISPLAY, min: 3.4 })
  let out = tspan(cx, 27, nome.text, {
    size: nome.size,
    fill: k.text,
    font: k.display,
    anchor: 'middle',
    weight: 600,
    optical: DISPLAY_OPSZ,
  })
  out += line(cx - 12, 30.4, cx + 12, 30.4, k.accent, 0.3)
  if (l.oab) {
    out += tspan(cx, 34.5, l.oab, { size: 2.4, fill: k.muted, font: k.body, anchor: 'middle', tracking: 0.12 })
  }
  return out
}

// ---- Montagem ---------------------------------------------------------------

let seq = 0
/** ids únicos por chamada: dois cartões na mesma folha não podem dividir clipPath. */
const nextId = () => `c${(seq = (seq + 1) % 100000)}`

/**
 * Miolo do cartão (sem o elemento <svg> de fora) — serve tanto para o cartão
 * solto quanto para o cartão encaixado na folha A4.
 */
// O corpo da fonte aqui é em MILÍMETROS (6,2 mm de nome), e o navegador escolhe o
// tamanho óptico de uma fonte variável a partir desse número — 6 é lido como
// "texto miúdo" e sai o corte mais encorpado, de nota de rodapé. No papel esses
// 6,2 mm são ~17 pt, então fixamos o tamanho óptico em 24: é o corte de nome
// próprio, o mesmo que o perfil usa na tela.
function cardBody(profile: Profile, card: CardConfig, side: CardSide, fonts?: CardFonts): string {
  const l = cardLines(profile, card)
  const k = { ...cardInk(profile), ...(fonts ?? {}) }
  const id = nextId()
  const fundo =
    side === 'verso'
      ? `<rect x="0" y="0" width="${BLEED_W}" height="${BLEED_H}" fill="${k.surface}"/>`
      : `<rect x="0" y="0" width="${BLEED_W}" height="${BLEED_H}" fill="${k.bg}"/>`

  if (side === 'verso') return fundo + (card.showQr ? versoQr(l, k) : versoTimbre(l, k))
  if (card.template === 'razao') return fundo + frenteRazao(l, k, id)
  if (card.template === 'reto') return fundo + frenteReto(l, k, id)
  return fundo + frenteTimbre(l, k, id)
}

const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'

/**
 * Um lado do cartão. Com sangria (padrão) são 96 × 56 mm — é o arquivo que vai
 * para a gráfica. Sem sangria, o recorte mostra os 90 × 50 mm que a pessoa
 * recebe na mão: é assim que a PRÉVIA aparece, senão a tela promete uma borda de
 * 3 mm que a guilhotina leva embora.
 */
export function renderCard(
  profile: Profile,
  card: CardConfig,
  side: CardSide,
  { sangria = true, fonts }: { sangria?: boolean; fonts?: CardFonts } = {},
): string {
  const b = CARD_MM.bleed
  const w = sangria ? BLEED_W : CARD_MM.trimW
  const h = sangria ? BLEED_H : CARD_MM.trimH
  const viewBox = sangria ? `0 0 ${BLEED_W} ${BLEED_H}` : `${b} ${b} ${CARD_MM.trimW} ${CARD_MM.trimH}`
  return (
    `<svg ${NS} width="${w}mm" height="${h}mm" viewBox="${viewBox}" ` +
    `role="img" aria-label="${esc(`Cartão de visita de ${profile.name || 'advogado'} — ${side}`)}">` +
    cardBody(profile, card, side, fonts) +
    `</svg>`
  )
}

// ---- Folha para a gráfica ---------------------------------------------------

const A4_W = 210
const A4_H = 297

/** Marcas de corte de um cartão colocado em (x, y) na folha, já com a sangria. */
function cropMarks(x: number, y: number, k: string): string {
  const t = CARD_MM.bleed // as linhas de corte ficam a 3 mm da borda da arte
  const len = 4
  // A marca começa FORA da sangria. Desenhada por cima da arte, ela viraria um
  // risco impresso na peça se o corte saísse um milímetro torto.
  const gap = CARD_MM.bleed + 1
  const L = x + t
  const R = x + BLEED_W - t
  const T = y + t
  const B = y + BLEED_H - t
  const marks = [
    // horizontais (esquerda/direita de cada canto)
    [L - gap - len, T, L - gap, T],
    [R + gap, T, R + gap + len, T],
    [L - gap - len, B, L - gap, B],
    [R + gap, B, R + gap + len, B],
    // verticais (acima/abaixo de cada canto)
    [L, T - gap - len, L, T - gap],
    [L, B + gap, L, B + gap + len],
    [R, T - gap - len, R, T - gap],
    [R, B + gap, R, B + gap + len],
  ]
  return marks.map(([x1, y1, x2, y2]) => line(x1, y1, x2, y2, k, 0.2)).join('')
}

/**
 * Folha A4 com frente e verso em tamanho real, marcas de corte e a ficha técnica
 * que a gráfica pede. É esta folha que o navegador imprime em PDF.
 *
 * Por que A4 e não uma página de 96 × 56 mm: `@page { size }` com medida própria
 * só vale em parte dos navegadores — o Safari ignora. A4 todo mundo imprime
 * igual, e a arte continua em tamanho exato dentro da folha.
 */
export function renderSheet(profile: Profile, card: CardConfig): string {
  const x = (A4_W - BLEED_W) / 2
  const yF = 34
  const yV = yF + BLEED_H + 26
  const marca = '#8a8a8a'

  const rotulo = (y: number, txt: string) =>
    tspan(x, y, txt, { size: 3.2, fill: '#555555', font: 'Helvetica, Arial, sans-serif', tracking: 0.4, upper: true })

  const ficha = [
    `${CARD_MM.trimW} × ${CARD_MM.trimH} mm de corte final`,
    `${CARD_MM.bleed} mm de sangria em cada lado`,
    `${PRINT_DPI} dpi · cores em RGB (converter para CMYK na gráfica)`,
    'Converter as fontes em curvas antes de imprimir',
  ]

  const fichaSvg = ficha
    .map((t, i) =>
      tspan(x, yV + BLEED_H + 16 + i * 5, `— ${t}`, {
        size: 3,
        fill: '#555555',
        font: 'Helvetica, Arial, sans-serif',
      }),
    )
    .join('')

  const bloco = (y: number, side: CardSide, titulo: string) =>
    rotulo(y - 7, titulo) +
    `<svg x="${round(x)}" y="${round(y)}" width="${BLEED_W}" height="${BLEED_H}" viewBox="0 0 ${BLEED_W} ${BLEED_H}" overflow="visible">` +
    cardBody(profile, card, side) +
    `</svg>` +
    cropMarks(x, y, marca)

  return (
    `<svg ${NS} width="${A4_W}mm" height="${A4_H}mm" viewBox="0 0 ${A4_W} ${A4_H}">` +
    `<rect x="0" y="0" width="${A4_W}" height="${A4_H}" fill="#ffffff"/>` +
    tspan(x, 20, `Cartão de visita — ${profile.name || 'perfil'}`, {
      size: 4.2,
      fill: '#222222',
      font: 'Helvetica, Arial, sans-serif',
      weight: 700,
    }) +
    bloco(yF, 'frente', 'Frente') +
    bloco(yV, 'verso', 'Verso') +
    tspan(x, yV + BLEED_H + 10, 'Para a gráfica', {
      size: 3.4,
      fill: '#222222',
      font: 'Helvetica, Arial, sans-serif',
      weight: 700,
    }) +
    fichaSvg +
    `</svg>`
  )
}
