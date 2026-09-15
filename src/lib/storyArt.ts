// Story do perfil — o DESENHO, em pixels de story (1080 × 1920), como SVG.
//
// Mesmo princípio do cartão impresso (lib/cardArt.ts): função pura, entra perfil
// + configuração, sai uma string de SVG. A prévia da tela e o PNG que vai para o
// Instagram e o WhatsApp saem daqui. Não existe um segundo renderizador.
//
// REDESENHO DE 15/09/2026. A primeira versão era o cartão de visita esticado:
// tudo pequeno, centrado, com muito papel em volta — o usuário olhou e não quis
// postar. Um story se lê em dois segundos numa tela de 6 polegadas, e o que o
// faz parecer feito por alguém é o oposto do cartão: a FOTO ocupa a tela, o NOME
// é enorme, e há poucas peças além disso. Três decisões regem o arquivo:
//
// 1. A FOTO É O FUNDO. No modelo principal ela cobre a tela inteira, desfocada e
//    sob um véu escuro na cor do tema, e a mesma foto nítida ocupa a LARGURA
//    TODA em cima, morrendo em degradê na própria versão desfocada — é onde o
//    nome entra. A foto do perfil tem 512 px de lado (lib/image.ts): esticada
//    nítida a 1920 ela viria borrada, e é por isso que o fundo é DESFOCADO de
//    propósito e a nítida para em ~1000 px, com o grão por cima disfarçando o
//    resto.
//
//    SEM ARCO E SEM MOLDURA (15/09/2026, à noite): a primeira versão recortava
//    o retrato num arco com um filete em volta, e o usuário viu "a janela de
//    uma igreja". Retrato em arco é o gesto do PERFIL (tema Oliva); no story,
//    solto sobre um fundo escuro, vira vitral. Aqui a foto é reta e sangra
//    pelas bordas, como um pôster — nenhuma forma recorta rosto no story.
//
// 2. O STORY É O TEMA DO PERFIL. Papel, tinta, fonte e o formato da foto vêm de
//    lib/themes.ts (com a cor da marca por cima, no Max). O escuro de cada tema é
//    o acento dele quase preto; a tinta clara sobre ele é o próprio papel do tema.
//    Os modelos são diagramações do mesmo tema, não identidades diferentes.
//
// 3. SÓ O QUE SE PODE DIZER EM QUALQUER REDE. Nome, inscrição na OAB, a frase de
//    apresentação, as áreas, a cidade e o endereço do perfil — tudo texto que já
//    passou pela checagem do editor. Nenhuma linha livre, nenhum convite a
//    contratar, nenhum preço. O ornamento é tipográfico: régua, versalete,
//    entreletra — nada de dingbat, foil ou mármore (REGRAS.md §2).
//
// O Instagram cobre as pontas (barra de progresso e nome em cima, campo de
// resposta embaixo): todo TEXTO mora entre SAFE_TOP e SAFE_BOTTOM. Foto e fundo
// podem passar por baixo — é o que dá a sensação de tela cheia. Quando o texto
// não cabe, o desenho abre mão de peças (foto menor, depois frase, depois áreas)
// em vez de invadir a faixa. Traços têm no mínimo 2 px: a compressão do
// Instagram engole filete mais fino.
//
// Medir texto: a função recebe um `medir`. No navegador ele usa a métrica real
// da fonte (lib/storyExport.ts); nos testes e antes de a fonte carregar, a
// aproximação abaixo — que erra para o lado largo, que é o lado seguro.

import type { Profile } from './types'
import { getTheme, profileVars } from './themes'
import { AREA_LIMIT } from './plans'
import { profileUrlLabel } from './publicUrl'
import { esc } from './cardArt'

export const STORY_W = 1080
export const STORY_H = 1920
/** Abaixo disto o Instagram desenha a barra de progresso e o nome da conta. */
export const SAFE_TOP = 250
/** Acima disto fica o campo "Enviar mensagem" e as reações. */
export const SAFE_BOTTOM = 1630
/** Margem lateral do texto. */
const M = 72

/**
 * Tamanho óptico pedido para o nome. Corpo de 100–140 px pede o corte de
 * título; cada família tem o seu teto e o navegador (e o cardExport, ao
 * embutir) encostam nele.
 */
export const STORY_OPSZ = 120
/** Peso do nome: em corpo grande o 500 é elegante; o 600 do cartão pesa. */
export const STORY_PESO_DISPLAY = 500
/** Um story não é o perfil: três áreas dizem o foco, doze diriam "faço tudo". */
export const STORY_AREAS_MAX = 3

/** Os textos fixos do desenho — um só lugar, conferido pelo teste de conformidade. */
export const STORY_ROTULO = 'Advocacia'
export const STORY_RODAPE = 'Perfil profissional'

export type StoryTemplate = 'retrato' | 'capa' | 'noturno'

export interface StoryConfig {
  template: StoryTemplate
  showPhoto: boolean
  showHeadline: boolean
  showAreas: boolean
  showCity: boolean
}

export const DEFAULT_STORY: StoryConfig = {
  template: 'retrato',
  showPhoto: true,
  showHeadline: true,
  showAreas: true,
  showCity: true,
}

export const STORY_TEMPLATES: { id: StoryTemplate; name: string; blurb: string }[] = [
  { id: 'retrato', name: 'Retrato', blurb: 'Sua foto de borda a borda, dissolvendo no escuro do tema; o nome entra em serifa clara.' },
  { id: 'capa', name: 'Capa', blurb: 'Papel claro, foto reta à direita e o nome enorme, como capa de revista.' },
  { id: 'noturno', name: 'Noturno', blurb: 'Fundo escuro chapado, moldura dupla e as áreas em coluna — papel timbrado à noite.' },
]

// ---- Cor ------------------------------------------------------------------------

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')

/**
 * Mistura sólida de duas cores (`t` = quanto de `b`). Sempre sólida, nunca
 * rgba: a cor com alfa em atributo de SVG rasterizado dentro de <img> não é
 * garantida em todo motor, e a sólida sai igual nos três.
 */
export function misturar(a: string, b: string, t: number): string {
  const A = rgb(a)
  const B = rgb(b)
  if (!A || !B) return A ? a : b
  return `#${A.map((v, i) => hex2(v + (B[i] - v) * t)).join('')}`
}

// ---- Medida de texto ---------------------------------------------------------

export interface Medida {
  font: string
  size: number
  weight: number
  /** entreletra em px, somada a cada caractere */
  tracking?: number
}

export type Medidor = (texto: string, m: Medida) => number

/**
 * Largura estimada, sem fonte carregada. Caixa alta é mais larga que caixa
 * baixa; peso maior também. Os fatores são generosos de propósito.
 */
export const medirAproximado: Medidor = (texto, m) => {
  const caixaAlta = /[A-ZÀ-Ý]/.test(texto) && texto === texto.toLocaleUpperCase('pt-BR')
  const fator = (m.weight >= 500 ? 0.58 : 0.54) + (caixaAlta ? 0.12 : 0)
  return texto.length * (m.size * fator + (m.tracking ?? 0))
}

/** Corta o texto e põe reticências até caber em `maxW`. */
export function cortarParaCaber(texto: string, maxW: number, m: Medida, medir: Medidor): string {
  if (medir(texto, m) <= maxW) return texto
  let t = texto
  while (t.length > 1 && medir(`${t.trimEnd()}…`, m) > maxW) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/**
 * Quebra por palavra em no máximo `maxLinhas`. O que sobra vai para a última
 * linha, cortada com reticências — nunca uma linha a mais, nunca uma linha que
 * passa da largura.
 */
export function quebrarLinhas(texto: string, maxW: number, maxLinhas: number, m: Medida, medir: Medidor): string[] {
  const palavras = texto.trim().split(/\s+/).filter(Boolean)
  const linhas: string[] = []
  let atual = ''
  for (let i = 0; i < palavras.length; i++) {
    const tentativa = atual ? `${atual} ${palavras[i]}` : palavras[i]
    if (!atual || medir(tentativa, m) <= maxW) {
      atual = tentativa
      continue
    }
    if (linhas.length === maxLinhas - 1) {
      atual = cortarParaCaber(`${atual} ${palavras.slice(i).join(' ')}`, maxW, m, medir)
      linhas.push(atual)
      return linhas
    }
    linhas.push(atual)
    atual = palavras[i]
  }
  if (atual) linhas.push(cortarParaCaber(atual, maxW, m, medir))
  return linhas
}

/**
 * Quebra uma LISTA em linhas sem partir item: nenhuma linha começa com o
 * separador, e o item que não cabe fica de fora inteiro — área pela metade não
 * diz nada.
 */
export function quebrarItens(
  itens: string[],
  separador: string,
  maxW: number,
  maxLinhas: number,
  m: Medida,
  medir: Medidor,
): string[] {
  const linhas: string[] = []
  let atual = ''
  for (const item of itens) {
    const tentativa = atual ? `${atual}${separador}${item}` : item
    if (!atual || medir(tentativa, m) <= maxW) {
      atual = tentativa
      continue
    }
    if (linhas.length === maxLinhas - 1) break
    linhas.push(atual)
    atual = item
  }
  if (atual && linhas.length < maxLinhas) linhas.push(cortarParaCaber(atual, maxW, m, medir))
  return linhas
}

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

/**
 * Divide um nome em DUAS linhas, as mais equilibradas que couberem — "Marina" /
 * "Sales", "João Pedro" / "de Albuquerque". Partícula no fim da primeira linha
 * só em último caso. Sem divisão que caiba, devolve null.
 */
export function dividirNome(nome: string, maxW: number, m: Medida, medir: Medidor): [string, string] | null {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  if (p.length < 2) return null
  let melhor: [string, string] | null = null
  let melhorLargura = Infinity
  for (let i = 1; i < p.length; i++) {
    const a = p.slice(0, i).join(' ')
    const b = p.slice(i).join(' ')
    const wa = medir(a, m)
    const wb = medir(b, m)
    if (wa > maxW || wb > maxW) continue
    const largura = Math.max(wa, wb) + (PARTICULAS.has(p[i - 1].toLowerCase()) ? 10_000 : 0)
    if (largura < melhorLargura) {
      melhorLargura = largura
      melhor = [a, b]
    }
  }
  return melhor
}

// ---- Dados do perfil que viram o story ----------------------------------------

export interface StoryLines {
  name: string
  oab: string
  headline: string
  areas: string[]
  city: string
  urlLabel: string
  /** a foto a desenhar; ausente com `showPhoto` ligado = monograma */
  photo?: string
  iniciais: string
}

export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => p && !PARTICULAS.has(p.toLowerCase()))
  if (!partes.length) return ''
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return `${primeira}${ultima}`.toLocaleUpperCase('pt-BR')
}

export function storyLines(profile: Profile, config: StoryConfig, photo?: string): StoryLines {
  // Só as áreas DENTRO da cota do plano: quem desceu de plano tem áreas
  // guardadas que o perfil não mostra, e o story não pode mostrar mais que ele.
  const areas = (profile.areas ?? [])
    .map((a) => (a?.label ?? '').trim())
    .filter(Boolean)
    .slice(0, AREA_LIMIT[profile.plan] ?? 1)
    .slice(0, STORY_AREAS_MAX)
  const name = (profile.name || 'Seu nome').trim()
  return {
    name,
    oab: (profile.oabNumber || '').trim(),
    headline: config.showHeadline ? (profile.headline || '').trim() : '',
    areas: config.showAreas ? areas : [],
    city: config.showCity ? [profile.city, profile.state].filter(Boolean).join(' · ') : '',
    urlLabel: profileUrlLabel(profile.slug),
    photo: config.showPhoto ? photo ?? profile.avatarUrl : undefined,
    iniciais: iniciaisDe(name),
  }
}

// ---- Tinta ----------------------------------------------------------------------

export interface StoryInk {
  /** o papel do tema */
  bg: string
  text: string
  muted: string
  faint: string
  accent: string
  /** o escuro do tema: o acento quase preto (no tema escuro, o próprio fundo) */
  deep: string
  /** a tinta clara sobre `deep`: o papel do tema */
  onDeep: string
  /** o acento clareado, para ler sobre `deep` */
  accentLight: string
  display: string
  body: string
  /** o tema escreve o nome em versalete */
  upper: boolean
  /** entreletra do nome, em em */
  nameTracking: number
  /**
   * Formato do retrato pequeno (só o Noturno usa): redondo, ou quadrado nos
   * temas de foto quadrada. Nenhum modelo recorta a foto em arco — ver o
   * cabeçalho do arquivo.
   */
  forma: 'circle' | 'rect'
}

export function storyInk(profile: Profile): StoryInk {
  const tema = getTheme(profile.theme)
  const v = { ...tema.vars, ...(profileVars(profile) as unknown as Record<string, string>) }
  const accent = v['--c-accent']
  const bg = v['--c-bg']
  return {
    bg,
    text: v['--c-text'],
    muted: v['--c-muted'],
    faint: v['--c-faint'],
    accent,
    deep: tema.dark ? bg : misturar(accent, '#0a0908', 0.74),
    onDeep: tema.dark ? v['--c-text'] : bg,
    accentLight: tema.dark ? accent : misturar(accent, '#ffffff', 0.5),
    display: v['--font-display'],
    body: v['--font-body'],
    upper: tema.style.nameCase === 'upper',
    nameTracking: parseFloat(v['--name-tracking'] ?? '0') || 0,
    forma: tema.style.avatar === 'square' ? 'rect' : 'circle',
  }
}

/** As cores que as peças compartilhadas usam — cada modelo monta a sua. */
interface Paleta {
  text: string
  muted: string
  faint: string
  accent: string
  rule: string
}

// ---- Peças de SVG ---------------------------------------------------------------

const r = (n: number) => Math.round(n * 10) / 10

interface Estilo {
  size: number
  fill: string
  font: string
  weight?: number
  anchor?: 'start' | 'middle' | 'end'
  tracking?: number
  /** fixa o corte óptico de título (só o nome) */
  optical?: boolean
  transform?: string
}

function texto(x: number, y: number, conteudo: string, o: Estilo): string {
  if (!conteudo) return ''
  const t = o.tracking ?? 0
  // A entreletra entra DEPOIS de cada letra, inclusive da última: centralizado,
  // o texto sairia meio espaço para a esquerda. Meia entreletra devolve o eixo.
  const xx = o.anchor === 'middle' ? x + t / 2 : o.anchor === 'end' ? x + t : x
  const attrs = [
    `x="${r(xx)}"`,
    `y="${r(y)}"`,
    `font-family="${esc(o.font)}"`,
    `font-size="${r(o.size)}"`,
    `fill="${o.fill}"`,
    o.weight ? `font-weight="${o.weight}"` : '',
    o.anchor ? `text-anchor="${o.anchor}"` : '',
    t ? `letter-spacing="${r(t)}"` : '',
    o.optical ? `style="font-optical-sizing:none;font-variation-settings:&#39;opsz&#39; ${STORY_OPSZ}"` : '',
    o.transform ? `transform="${o.transform}"` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return `<text ${attrs}>${esc(conteudo)}</text>`
}

const linha = (x1: number, y1: number, x2: number, y2: number, cor: string, w = 2) =>
  `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${cor}" stroke-width="${w}"/>`

/** `bleed` é o retângulo sem canto arredondado — a foto que sangra pela borda. */
type Forma = 'bleed' | 'rect' | 'circle'

/** O contorno de uma forma, como elemento SVG sem atributos de pintura. */
function contorno(forma: Forma, x: number, y: number, w: number, h: number, extra = ''): string {
  if (forma === 'circle') {
    return `<circle cx="${r(x + w / 2)}" cy="${r(y + h / 2)}" r="${r(Math.min(w, h) / 2)}"${extra}/>`
  }
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${forma === 'rect' ? 10 : 0}"${extra}/>`
}

/**
 * Foto recortada na forma, com o pé dissolvendo no fundo (`fade`) e, se pedida,
 * uma moldura fina a 22 px do recorte. `href` e `xlink:href` juntos: navegador
 * antigo lê só o segundo.
 */
function retrato(
  id: string,
  forma: Forma,
  x: number,
  y: number,
  w: number,
  h: number,
  src: string,
  { fade = 0, moldura }: { fade?: number; moldura?: string } = {},
): string {
  let defs = `<clipPath id="${id}-c">${contorno(forma, x, y, w, h)}</clipPath>`
  let mask = ''
  if (fade > 0) {
    defs +=
      `<linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="${r(1 - fade)}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
      `<mask id="${id}-m"><rect x="${r(x - 40)}" y="${r(y)}" width="${r(w + 80)}" height="${r(h)}" fill="url(#${id}-g)"/></mask>`
    mask = ` mask="url(#${id}-m)"`
  }
  const img =
    `<image href="${esc(src)}" xlink:href="${esc(src)}" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" ` +
    `preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-c)"/>`
  const borda = moldura
    ? contorno(forma, x - 22, y - 22, w + 44, h + 22, ` fill="none" stroke="${moldura}" stroke-width="2"`)
    : ''
  return `<defs>${defs}</defs><g${mask}>${img}${borda}</g>`
}

/** Sem foto: o monograma dentro do contorno da forma. */
function monograma(
  forma: Forma,
  x: number,
  y: number,
  w: number,
  h: number,
  iniciais: string,
  cor: string,
  anel: string,
  font: string,
): string {
  const tamanho = Math.min(w, h) * 0.36
  const cy = y + h / 2
  return (
    contorno(forma, x, y, w, h, ` fill="none" stroke="${anel}" stroke-width="2"`) +
    texto(x + w / 2, cy + tamanho * 0.34, iniciais, {
      size: tamanho,
      fill: cor,
      font,
      weight: STORY_PESO_DISPLAY,
      anchor: 'middle',
      tracking: tamanho * 0.05,
      optical: true,
    })
  )
}

/**
 * A foto como FUNDO: cobre a tela com sobra, desfocada e dessaturada, sob um
 * véu vertical na tinta escura que quase fecha na metade de baixo — é ali que o
 * texto vai. A sobra de 140 px é para a borda do desfoque (que sai transparente)
 * ficar fora da tela.
 */
function fundoDeFoto(id: string, src: string, deep: string): string {
  return (
    `<defs>` +
    `<filter id="${id}-b" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur stdDeviation="48"/><feColorMatrix type="saturate" values="0.5"/></filter>` +
    `<linearGradient id="${id}-v" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${deep}" stop-opacity="0.38"/>` +
    `<stop offset="0.42" stop-color="${deep}" stop-opacity="0.5"/>` +
    `<stop offset="0.64" stop-color="${deep}" stop-opacity="0.9"/>` +
    `<stop offset="1" stop-color="${deep}" stop-opacity="0.98"/></linearGradient></defs>` +
    `<image href="${esc(src)}" xlink:href="${esc(src)}" x="-140" y="-140" width="${STORY_W + 280}" height="${STORY_H + 280}" ` +
    `preserveAspectRatio="xMidYMid slice" filter="url(#${id}-b)" opacity="0.62"/>` +
    `<rect x="0" y="0" width="${STORY_W}" height="${STORY_H}" fill="url(#${id}-v)"/>`
  )
}

/** Grão de papel sobre tudo — quase invisível, tira o "chapado de computador". */
function grao(id: string, opacidade: number): string {
  return (
    `<defs><filter id="${id}-n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter></defs>` +
    `<rect x="0" y="0" width="${STORY_W}" height="${STORY_H}" filter="url(#${id}-n)" opacity="${opacidade}"/>`
  )
}

// ---- Empilhamento vertical --------------------------------------------------------

interface Peca {
  h: number
  desenhar: (topo: number) => string
}

const espaco = (h: number): Peca => ({ h, desenhar: () => '' })
const alturaDe = (pecas: Peca[]) => pecas.reduce((s, p) => s + p.h, 0)

function empilhar(pecas: Peca[], topo: number): string {
  let y = topo
  let svg = ''
  for (const p of pecas) {
    svg += p.desenhar(y)
    y += p.h
  }
  return svg
}

/** Linha de base de um texto de corpo `size` cujo topo visual está em `topo`. */
const base = (topo: number, size: number) => topo + size * 0.8

interface Contexto {
  l: StoryLines
  k: StoryInk
  p: Paleta
  fontes: { display: string; body: string }
  medir: Medidor
}

/** Peça de várias linhas já quebradas. */
function bloco(linhas: string[], x: number, o: Estilo, entrelinha: number): Peca {
  return {
    h: linhas.length ? o.size + (linhas.length - 1) * entrelinha : 0,
    desenhar: (topo) => linhas.map((t, i) => texto(x, base(topo, o.size) + i * entrelinha, t, o)).join(''),
  }
}

/**
 * O nome: o maior corpo que cabe. `duasLinhas` divide o nome em duas linhas
 * equilibradas (o gesto de capa); sem isso, prefere uma linha e só quebra
 * quando não cabe.
 */
function pecaNome(
  c: Contexto,
  x: number,
  anchor: 'start' | 'middle',
  maxW: number,
  { max, min, duasLinhas = false }: { max: number; min: number; duasLinhas?: boolean },
): Peca {
  const nome = c.k.upper ? c.l.name.toLocaleUpperCase('pt-BR') : c.l.name
  const trackingEm = c.k.upper ? Math.max(c.k.nameTracking, 0.06) : Math.min(c.k.nameTracking, -0.01)
  const medida = (s: number): Medida => ({
    font: c.k.display,
    size: s,
    weight: STORY_PESO_DISPLAY,
    tracking: s * trackingEm,
  })

  let escolha: { s: number; linhas: string[] } | null = null
  for (let s = max; s >= min && !escolha; s -= 2) {
    const m = medida(s)
    if (duasLinhas) {
      const div = dividirNome(nome, maxW, m, c.medir)
      if (div) escolha = { s, linhas: div }
      else if (!nome.includes(' ') && c.medir(nome, m) <= maxW) escolha = { s, linhas: [nome] }
    } else if (c.medir(nome, m) <= maxW) {
      escolha = { s, linhas: [nome] }
    }
  }
  if (!escolha) {
    // Não coube nem no mínimo: quebra em até três linhas e corta o resto.
    for (let s = Math.round(max * 0.85); s >= min && !escolha; s -= 2) {
      const linhas = quebrarLinhas(nome, maxW, 3, medida(s), c.medir)
      if (linhas.join(' ') === nome) escolha = { s, linhas }
    }
    if (!escolha) escolha = { s: min, linhas: quebrarLinhas(nome, maxW, 3, medida(min), c.medir) }
  }

  return bloco(
    escolha.linhas,
    x,
    {
      size: escolha.s,
      fill: c.p.text,
      font: c.fontes.display,
      weight: STORY_PESO_DISPLAY,
      anchor,
      tracking: escolha.s * trackingEm,
      optical: true,
    },
    escolha.s * (duasLinhas ? 1.0 : 1.08),
  )
}

/** "ADVOCACIA" em versalete tracejado; com `filetes`, uma régua de cada lado. */
function pecaRotulo(c: Contexto, x: number, anchor: 'start' | 'middle', filetes: boolean, size = 28): Peca {
  const rotulo = STORY_ROTULO.toLocaleUpperCase('pt-BR')
  const tracking = size * 0.34
  const w = c.medir(rotulo, { font: c.k.body, size, weight: 400, tracking })
  return {
    h: size,
    desenhar: (topo) => {
      const y = base(topo, size)
      let out = texto(x, y, rotulo, { size, fill: c.p.accent, font: c.fontes.body, anchor, tracking })
      if (filetes && anchor === 'middle') {
        const meio = y - size * 0.32
        out += linha(x - w / 2 - 34 - 96, meio, x - w / 2 - 34, meio, c.p.rule)
        out += linha(x + w / 2 + 34, meio, x + w / 2 + 34 + 96, meio, c.p.rule)
      }
      return out
    },
  }
}

function pecaTexto(
  c: Contexto,
  conteudo: string,
  x: number,
  anchor: 'start' | 'middle',
  maxW: number,
  o: Partial<Estilo> & { size: number },
): Peca {
  const estilo: Estilo = { fill: c.p.muted, font: c.fontes.body, anchor, ...o }
  const medida: Medida = { font: c.k.body, size: o.size, weight: 400, tracking: o.tracking }
  return bloco([cortarParaCaber(conteudo, maxW, medida, c.medir)], x, estilo, o.size)
}

function pecaParagrafo(
  c: Contexto,
  conteudo: string,
  x: number,
  anchor: 'start' | 'middle',
  maxW: number,
  maxLinhas: number,
  o: Partial<Estilo> & { size: number; entrelinha: number; display?: boolean; upper?: boolean },
): Peca {
  const t = o.upper ? conteudo.toLocaleUpperCase('pt-BR') : conteudo
  const medida: Medida = {
    font: o.display ? c.k.display : c.k.body,
    size: o.size,
    weight: o.display ? STORY_PESO_DISPLAY : 400,
    tracking: o.tracking,
  }
  const linhas = quebrarLinhas(t, maxW, maxLinhas, medida, c.medir)
  return bloco(
    linhas,
    x,
    {
      size: o.size,
      fill: o.fill ?? c.p.muted,
      font: o.display ? c.fontes.display : c.fontes.body,
      weight: o.display ? STORY_PESO_DISPLAY : undefined,
      anchor,
      tracking: o.tracking,
      optical: o.display,
    },
    o.entrelinha,
  )
}

/** As áreas em versalete tracejado, centradas, sem partir item. */
function pecaAreasCaps(c: Contexto, areas: string[], x: number, maxW: number, size = 27): Peca {
  const tracking = size * 0.22
  const medida: Medida = { font: c.k.body, size, weight: 400, tracking }
  return bloco(
    quebrarItens(areas.map((a) => a.toLocaleUpperCase('pt-BR')), '   ·   ', maxW, 3, medida, c.medir),
    x,
    { size, fill: c.p.accent, font: c.fontes.body, anchor: 'middle', tracking },
    size * 1.75,
  )
}

const pecaFilete = (x1: number, x2: number, cor: string, w = 3): Peca => ({
  h: w,
  desenhar: (topo) => linha(x1, topo + w / 2, x2, topo + w / 2, cor, w),
})

/** Endereço do perfil no pé — é para ele que a figurinha de link aponta. */
function rodape(c: Contexto, x: number, anchor: 'start' | 'middle', maxW: number): string {
  const rotulo = STORY_RODAPE.toLocaleUpperCase('pt-BR')
  let out = texto(x, SAFE_BOTTOM - 76, rotulo, {
    size: 22,
    fill: c.p.faint,
    font: c.fontes.body,
    anchor,
    tracking: 22 * 0.3,
  })
  const medida: Medida = { font: c.k.body, size: 36, weight: 400 }
  let size = 36
  while (size > 24 && c.medir(c.l.urlLabel, { ...medida, size }) > maxW) size -= 2
  out += texto(x, SAFE_BOTTOM - 18, cortarParaCaber(c.l.urlLabel, maxW, { ...medida, size }, c.medir), {
    size,
    fill: c.p.text,
    font: c.fontes.body,
    anchor,
  })
  return out
}

/** Onde a pilha de conteúdo precisa terminar para não encostar no rodapé. */
const LIMITE_DA_PILHA = SAFE_BOTTOM - 150

/**
 * Escolhe o CONTEÚDO e o TAMANHO DA FOTO em dois tempos. Primeiro, a lista de
 * variantes em ordem de preferência decide o conteúdo: a primeira que cabe
 * ganha (ela costuma ser a de foto menor com tudo escrito — texto vale mais
 * que cem pixels de retrato). Depois, para esse conteúdo, a foto volta a ser a
 * MAIOR em que ele ainda cabe. Sem nada que caiba, a variante mais enxuta.
 */
function escolher<T>(variantes: T[], montar: (v: T) => Peca[], disponivel: (v: T) => number): { v: T; pecas: Peca[] } {
  let pecas: Peca[] | null = null
  for (const v of variantes) {
    const p = montar(v)
    if (alturaDe(p) <= disponivel(v)) {
      pecas = p
      break
    }
  }
  if (!pecas) pecas = montar(variantes[variantes.length - 1])
  const h = alturaDe(pecas)
  const v = variantes.find((x) => disponivel(x) >= h) ?? variantes[variantes.length - 1]
  return { v, pecas }
}

// ---- Os modelos -------------------------------------------------------------------

/**
 * RETRATO — a foto toma a tela. Fundo desfocado sob o véu escuro do tema; a
 * mesma foto nítida de borda a borda em cima, dissolvendo na versão desfocada
 * onde o nome começa — a emenda é invisível porque é a mesma imagem dos dois
 * lados. Sem foto, o monograma num círculo sobre o escuro chapado.
 */
function modeloRetrato(c: Contexto, id: string): string {
  const cx = STORY_W / 2
  const maxW = STORY_W - M * 2
  const { l, k } = c
  let out = `<rect x="0" y="0" width="${STORY_W}" height="${STORY_H}" fill="${k.deep}"/>`
  if (l.photo) out += fundoDeFoto(id, l.photo, k.deep)

  type V = { h: number; frase: boolean; areas: number }
  // A foto é quadrada (512 × 512): a 1080 de largura, 1080 de altura mostra
  // ela INTEIRA, sem corte — é a primeira variante. As mais altas cortam um
  // pouco das laterais; as mais baixas, do alto e do pé.
  const variantes: V[] = [
    { h: 1160, frase: true, areas: 3 },
    { h: 1080, frase: true, areas: 3 },
    { h: 1000, frase: true, areas: 3 },
    { h: 920, frase: true, areas: 3 },
    { h: 1000, frase: false, areas: 3 },
    { h: 920, frase: false, areas: 3 },
    { h: 860, frase: false, areas: 2 },
    { h: 800, frase: false, areas: 1 },
  ]
  const yFoto = 0
  // A pilha começa no pé do degradê da foto, onde ela já virou fundo: é o que
  // costura foto e nome sem o rótulo pousar em cima do rosto.
  const topoDaPilha = (v: V) => (l.photo ? yFoto + v.h - 110 : SAFE_TOP + 560)

  const { v, pecas } = escolher(
    variantes,
    (v) => {
      const p: Peca[] = [
        pecaRotulo(c, cx, 'middle', true),
        espaco(34),
        pecaNome(c, cx, 'middle', maxW, { max: 118, min: 64 }),
        espaco(30),
        pecaFilete(cx - 48, cx + 48, c.p.accent),
        espaco(38),
      ]
      if (l.oab) p.push(pecaTexto(c, l.oab, cx, 'middle', maxW, { size: 34, tracking: 5, fill: c.p.text }))
      if (v.frase && l.headline) {
        p.push(espaco(38), pecaParagrafo(c, l.headline, cx, 'middle', maxW, 2, { size: 38, entrelinha: 52 }))
      }
      const areas = l.areas.slice(0, v.areas)
      if (areas.length) p.push(espaco(46), pecaAreasCaps(c, areas, cx, maxW))
      if (l.city) p.push(espaco(38), pecaTexto(c, l.city, cx, 'middle', maxW, { size: 30, fill: c.p.faint }))
      return p
    },
    (v) => LIMITE_DA_PILHA - topoDaPilha(v),
  )

  if (l.photo) {
    out += retrato(id, 'bleed', 0, yFoto, STORY_W, v.h, l.photo, { fade: 0.36 })
  } else {
    const s = 400
    out += monograma('circle', cx - s / 2, topoDaPilha(v) - s - 72, s, s, l.iniciais, k.accentLight, misturar(k.onDeep, k.deep, 0.5), c.fontes.display)
  }
  out += empilhar(pecas, topoDaPilha(v))
  out += rodape(c, cx, 'middle', maxW)
  return out + grao(id, 0.08)
}

/**
 * CAPA — papel claro do tema, a foto alta e reta à direita dissolvendo no papel
 * e o nome em duas linhas enormes logo abaixo, como capa de revista.
 * "ADVOCACIA" corre na vertical pela margem esquerda; as áreas viram um
 * sumário numerado.
 */
function modeloCapa(c: Contexto, id: string): string {
  const x0 = M
  const maxW = STORY_W - M * 2
  const { l, k } = c
  let out = `<rect x="0" y="0" width="${STORY_W}" height="${STORY_H}" fill="${k.bg}"/>`

  const xFoto = 300
  const wFoto = STORY_W - M - xFoto
  const yFoto = 176
  type V = { h: number; frase: number; areas: number; nome: number }
  const variantes: V[] = [
    { h: 900, frase: 2, areas: 3, nome: 138 },
    { h: 820, frase: 2, areas: 3, nome: 138 },
    { h: 760, frase: 2, areas: 3, nome: 128 },
    { h: 700, frase: 2, areas: 3, nome: 120 },
    { h: 640, frase: 2, areas: 3, nome: 116 },
    { h: 600, frase: 2, areas: 3, nome: 108 },
    { h: 640, frase: 0, areas: 3, nome: 116 },
    { h: 600, frase: 0, areas: 2, nome: 108 },
    { h: 560, frase: 0, areas: 1, nome: 104 },
  ]
  // O nome entra na zona em que a foto já se dissolveu no papel.
  const topoDaPilha = (v: V) => yFoto + v.h - (l.photo ? 96 : 0) + 8

  const { v, pecas } = escolher(
    variantes,
    (v) => {
      const p: Peca[] = [pecaNome(c, x0, 'start', maxW, { max: v.nome, min: 76, duasLinhas: true }), espaco(36), pecaFilete(x0, x0 + maxW, c.p.accent)]
      if (l.oab || l.city) {
        p.push(espaco(24), {
          h: 26,
          desenhar: (t) =>
            texto(x0, base(t, 26), l.oab, { size: 26, fill: c.p.muted, font: c.fontes.body, tracking: 4 }) +
            texto(x0 + maxW, base(t, 26), l.city, { size: 26, fill: c.p.faint, font: c.fontes.body, tracking: 2, anchor: 'end' }),
        })
      }
      if (v.frase && l.headline) {
        p.push(espaco(46), pecaParagrafo(c, l.headline, x0, 'start', maxW, v.frase, { size: 40, entrelinha: 50, fill: c.p.text, display: true }))
      }
      const areas = l.areas.slice(0, v.areas)
      if (areas.length) {
        const alt = 66
        p.push(espaco(44), {
          h: areas.length * alt + 2,
          desenhar: (t) =>
            areas
              .map((a, i) => {
                const y = t + i * alt
                const rotulo = cortarParaCaber(a, maxW - 96, { font: k.body, size: 32, weight: 400 }, c.medir)
                return (
                  linha(x0, y + 1, x0 + maxW, y + 1, c.p.rule) +
                  texto(x0, y + 45, String(i + 1).padStart(2, '0'), { size: 22, fill: c.p.accent, font: c.fontes.body, tracking: 2 }) +
                  texto(x0 + 96, y + 46, rotulo, { size: 32, fill: c.p.text, font: c.fontes.body })
                )
              })
              .join('') + linha(x0, t + areas.length * alt + 1, x0 + maxW, t + areas.length * alt + 1, c.p.rule),
        })
      }
      return p
    },
    (v) => LIMITE_DA_PILHA - topoDaPilha(v),
  )

  if (l.photo) {
    out += retrato(id, 'bleed', xFoto, yFoto, wFoto, v.h, l.photo, { fade: 0.26 })
  } else {
    const hm = Math.min(v.h, 560)
    out += monograma('bleed', xFoto + (wFoto - hm * 0.8) / 2, yFoto + v.h - hm, hm * 0.8, hm, l.iniciais, k.accent, c.p.rule, c.fontes.display)
  }

  // "ADVOCACIA" na vertical, subindo pela margem esquerda ao lado da foto. O
  // pivô fica logo acima do nome — antes ficava no pé da foto e a primeira
  // linha do nome cobria o "A".
  const rotulo = STORY_ROTULO.toLocaleUpperCase('pt-BR')
  const yRot = Math.min(topoDaPilha(v) - 30, SAFE_BOTTOM)
  const lenRot = c.medir(rotulo, { font: k.body, size: 26, weight: 400, tracking: 26 * 0.38 })
  out += texto(x0 + 20, yRot, rotulo, {
    size: 26,
    fill: c.p.accent,
    font: c.fontes.body,
    tracking: 26 * 0.38,
    transform: `rotate(-90 ${r(x0 + 20)} ${r(yRot)})`,
  })
  out += `<rect x="${x0}" y="${r(yRot - lenRot - 40 - 150)}" width="4" height="150" fill="${c.p.accent}"/>`

  out += empilhar(pecas, topoDaPilha(v))
  out += `<rect x="${x0}" y="${SAFE_BOTTOM - 126}" width="56" height="3" fill="${c.p.accent}"/>`
  out += rodape(c, x0, 'start', maxW)
  return out + grao(id, 0.05)
}

/**
 * NOTURNO — o escuro do tema chapado, moldura dupla e tudo centrado; as áreas
 * descem em coluna separadas por réguas curtas. É o papel timbrado de um
 * escritório, à noite.
 */
function modeloNoturno(c: Contexto, id: string): string {
  const cx = STORY_W / 2
  const maxW = STORY_W - 200
  const { l, k } = c
  const moldura = misturar(k.onDeep, k.deep, 0.62)
  const molduraFina = misturar(k.onDeep, k.deep, 0.8)
  let out =
    `<rect x="0" y="0" width="${STORY_W}" height="${STORY_H}" fill="${k.deep}"/>` +
    `<rect x="52" y="52" width="${STORY_W - 104}" height="${STORY_H - 104}" fill="none" stroke="${moldura}" stroke-width="2"/>` +
    `<rect x="70" y="70" width="${STORY_W - 140}" height="${STORY_H - 140}" fill="none" stroke="${molduraFina}" stroke-width="1.5"/>`

  const forma: Forma = k.forma
  type V = { foto: number; frase: boolean; areas: number }
  const variantes: V[] = [
    { foto: 440, frase: true, areas: 3 },
    { foto: 380, frase: true, areas: 3 },
    { foto: 340, frase: true, areas: 3 },
    { foto: 380, frase: false, areas: 3 },
    { foto: 320, frase: false, areas: 3 },
    { foto: 300, frase: false, areas: 2 },
    { foto: 280, frase: false, areas: 1 },
  ]
  const yFoto = SAFE_TOP + 40
  const topoDaPilha = (v: V) => yFoto + v.foto + 64

  const { v, pecas } = escolher(
    variantes,
    (v) => {
      const p: Peca[] = [
        pecaRotulo(c, cx, 'middle', true, 26),
        espaco(36),
        pecaNome(c, cx, 'middle', maxW, { max: 112, min: 60 }),
        espaco(30),
        pecaFilete(cx - 44, cx + 44, c.p.accent),
        espaco(38),
      ]
      if (l.oab) p.push(pecaTexto(c, l.oab, cx, 'middle', maxW, { size: 32, tracking: 5, fill: c.p.text }))
      if (v.frase && l.headline) {
        p.push(espaco(40), pecaParagrafo(c, l.headline, cx, 'middle', maxW, 2, { size: 36, entrelinha: 50 }))
      }
      const areas = l.areas.slice(0, v.areas)
      if (areas.length) {
        const alt = 64
        p.push(espaco(48), {
          h: areas.length * alt - 20,
          desenhar: (t) =>
            areas
              .map((a, i) => {
                const y = t + i * alt
                const rotulo = cortarParaCaber(a, maxW, { font: k.body, size: 30, weight: 400, tracking: 1 }, c.medir)
                return (
                  (i ? linha(cx - 28, y - 18, cx + 28, y - 18, c.p.rule) : '') +
                  texto(cx, y + 26, rotulo, { size: 30, fill: c.p.text, font: c.fontes.body, anchor: 'middle', tracking: 1 })
                )
              })
              .join(''),
        })
      }
      if (l.city) p.push(espaco(44), pecaTexto(c, l.city, cx, 'middle', maxW, { size: 28, fill: c.p.faint, tracking: 2 }))
      return p
    },
    (v) => LIMITE_DA_PILHA - topoDaPilha(v),
  )

  const s = v.foto
  if (l.photo) {
    out += retrato(id, forma, cx - s / 2, yFoto, s, s, l.photo, { moldura })
  } else {
    out += monograma(forma, cx - s / 2, yFoto, s, s, l.iniciais, k.accentLight, moldura, c.fontes.display)
  }
  out += empilhar(pecas, topoDaPilha(v))
  out += rodape(c, cx, 'middle', maxW)
  return out + grao(id, 0.07)
}

// ---- Montagem ---------------------------------------------------------------------

let seq = 0
const nextId = () => `s${(seq = (seq + 1) % 100000)}`

const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'

export interface StoryRenderOpts {
  /** pilhas a usar no SVG — o PNG passa as fontes embutidas com nome próprio */
  fonts?: { display: string; body: string }
  /** a foto já embutida (data URI); sem ela, usa a do perfil */
  photo?: string
  medir?: Medidor
}

export function resolveStory(raw: Partial<StoryConfig> | null | undefined): StoryConfig {
  const t = raw?.template
  return {
    template: STORY_TEMPLATES.some((x) => x.id === t) ? (t as StoryTemplate) : DEFAULT_STORY.template,
    showPhoto: raw?.showPhoto ?? DEFAULT_STORY.showPhoto,
    showHeadline: raw?.showHeadline ?? DEFAULT_STORY.showHeadline,
    showAreas: raw?.showAreas ?? DEFAULT_STORY.showAreas,
    showCity: raw?.showCity ?? DEFAULT_STORY.showCity,
  }
}

/** A paleta de um modelo escuro: tinta clara do tema sobre o escuro dele. */
function paletaEscura(k: StoryInk): Paleta {
  return {
    text: k.onDeep,
    muted: misturar(k.onDeep, k.deep, 0.22),
    faint: misturar(k.onDeep, k.deep, 0.42),
    accent: k.accentLight,
    rule: misturar(k.onDeep, k.deep, 0.6),
  }
}

/** A paleta do modelo claro: o tema como ele é. */
function paletaClara(k: StoryInk): Paleta {
  return {
    text: k.text,
    muted: k.muted,
    faint: k.faint,
    accent: k.accent,
    rule: misturar(k.text, k.bg, 0.8),
  }
}

export function renderStory(profile: Profile, config: StoryConfig, opts: StoryRenderOpts = {}): string {
  const cfg = resolveStory(config)
  const k = storyInk(profile)
  const c: Contexto = {
    l: storyLines(profile, cfg, opts.photo),
    k,
    p: cfg.template === 'capa' ? paletaClara(k) : paletaEscura(k),
    fontes: opts.fonts ?? { display: k.display, body: k.body },
    medir: opts.medir ?? medirAproximado,
  }
  const id = nextId()
  const miolo =
    cfg.template === 'capa' ? modeloCapa(c, id) : cfg.template === 'noturno' ? modeloNoturno(c, id) : modeloRetrato(c, id)
  return (
    `<svg ${NS} width="${STORY_W}" height="${STORY_H}" viewBox="0 0 ${STORY_W} ${STORY_H}" ` +
    `role="img" aria-label="${esc(`Story do perfil de ${c.l.name}`)}">` +
    miolo +
    `</svg>`
  )
}
