// Story do perfil — o DESENHO, em pixels de story (1080 × 1920), como SVG.
//
// Mesmo princípio do cartão impresso (lib/cardArt.ts): função pura, entra perfil
// + configuração, sai uma string de SVG. A prévia da tela e o PNG que vai para o
// Instagram e o WhatsApp saem daqui. Não existe um segundo renderizador.
//
// Três decisões regem o arquivo:
//
// 1. O STORY É O TEMA DO PERFIL. Papel, tinta, fonte e o jeito da foto vêm de
//    lib/themes.ts (com a cor da marca por cima, no Max). Os modelos abaixo são
//    diagramações do mesmo tema, não identidades diferentes.
//
// 2. SÓ O QUE SE PODE DIZER EM QUALQUER REDE. Nome, inscrição na OAB, a frase de
//    apresentação, as áreas, a cidade e o endereço do perfil — tudo texto que já
//    passou pela checagem do editor. Nenhuma linha livre nova, nenhum convite a
//    contratar, nenhum preço. O ornamento é tipográfico: filete, versalete e
//    entreletra, como no timbre de um escritório.
//
// 3. O INSTAGRAM COBRE AS PONTAS. A barra de progresso e o nome da conta ficam no
//    alto; o campo de resposta, embaixo. Todo texto mora entre SAFE_TOP e
//    SAFE_BOTTOM — e quando o conteúdo não cabe, o desenho abre mão de peças
//    (frase, depois áreas, depois tamanho da foto) em vez de invadir a faixa.
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

/** Tamanho óptico pedido para o nome (grande na tela, corte de título). */
export const STORY_OPSZ = 72
/** Peso do nome: em corpo de 100 px, o 500 fica elegante; o 600 do cartão pesa. */
export const STORY_PESO_DISPLAY = 500
/** Um story não é o perfil: três áreas dizem o foco, doze diriam "faço tudo". */
export const STORY_AREAS_MAX = 3

/** Os textos fixos do desenho — um só lugar, conferido pelo teste de conformidade. */
export const STORY_ROTULO = 'Advocacia'
export const STORY_RODAPE = 'Perfil profissional'

export type StoryTemplate = 'moldura' | 'retrato' | 'coluna'

export interface StoryConfig {
  template: StoryTemplate
  showPhoto: boolean
  showHeadline: boolean
  showAreas: boolean
  showCity: boolean
}

export const DEFAULT_STORY: StoryConfig = {
  template: 'moldura',
  showPhoto: true,
  showHeadline: true,
  showAreas: true,
  showCity: true,
}

export const STORY_TEMPLATES: { id: StoryTemplate; name: string; blurb: string }[] = [
  { id: 'moldura', name: 'Moldura', blurb: 'Centralizado, com filete duplo em volta — o timbre do escritório.' },
  { id: 'retrato', name: 'Retrato', blurb: 'Sua foto em arco no alto e o nome logo abaixo.' },
  { id: 'coluna', name: 'Coluna', blurb: 'Tipografia à esquerda e as áreas em lista, como um índice.' },
]

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

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

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
  bg: string
  text: string
  muted: string
  faint: string
  accent: string
  border: string
  display: string
  body: string
  /** o tema escreve o nome em versalete */
  upper: boolean
  /** entreletra do nome, em em */
  nameTracking: number
  avatar: 'circle' | 'arch' | 'square'
}

export function storyInk(profile: Profile): StoryInk {
  const tema = getTheme(profile.theme)
  const v = { ...tema.vars, ...(profileVars(profile) as unknown as Record<string, string>) }
  return {
    bg: v['--c-bg'],
    text: v['--c-text'],
    muted: v['--c-muted'],
    faint: v['--c-faint'],
    accent: v['--c-accent'],
    border: v['--c-border'],
    display: v['--font-display'],
    body: v['--font-body'],
    upper: tema.style.nameCase === 'upper',
    nameTracking: parseFloat(v['--name-tracking'] ?? '0') || 0,
    avatar: tema.style.avatar,
  }
}

// ---- Peças de SVG ---------------------------------------------------------------

const r = (n: number) => Math.round(n * 10) / 10

interface Estilo {
  size: number
  fill: string
  font: string
  weight?: number
  anchor?: 'start' | 'middle'
  tracking?: number
  /** fixa o corte óptico de título (só o nome) */
  optical?: boolean
}

function texto(x: number, y: number, conteudo: string, o: Estilo): string {
  if (!conteudo) return ''
  const t = o.tracking ?? 0
  // A entreletra entra DEPOIS de cada letra, inclusive da última: centralizado,
  // o texto sairia meio espaço para a esquerda. Meia entreletra devolve o eixo.
  const xx = o.anchor === 'middle' ? x + t / 2 : x
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
  ]
    .filter(Boolean)
    .join(' ')
  return `<text ${attrs}>${esc(conteudo)}</text>`
}

const linha = (x1: number, y1: number, x2: number, y2: number, cor: string, w = 2, opacidade = 1) =>
  `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${cor}" stroke-width="${w}"${
    opacidade < 1 ? ` stroke-opacity="${opacidade}"` : ''
  }/>`

type Forma = 'circle' | 'arch' | 'square'

function contorno(forma: Forma, x: number, y: number, w: number, h: number): string {
  if (forma === 'circle') return `<circle cx="${r(x + w / 2)}" cy="${r(y + h / 2)}" r="${r(Math.min(w, h) / 2)}"/>`
  if (forma === 'square') return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="4"/>`
  return `<path d="M${r(x)} ${r(y + h)}V${r(y + w / 2)}A${r(w / 2)} ${r(w / 2)} 0 0 1 ${r(x + w)} ${r(y + w / 2)}V${r(y + h)}Z"/>`
}

/**
 * Foto recortada na forma do tema — ou, sem foto, o monograma no mesmo
 * contorno. `href` e `xlink:href` juntos: navegador antigo lê só o segundo.
 */
function retrato(
  id: string,
  forma: Forma,
  x: number,
  y: number,
  w: number,
  h: number,
  l: StoryLines,
  k: StoryInk,
  fonteDisplay: string,
): string {
  const molde = contorno(forma, x, y, w, h)
  if (l.photo) {
    return (
      `<clipPath id="${id}">${molde}</clipPath>` +
      `<image href="${esc(l.photo)}" xlink:href="${esc(l.photo)}" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" ` +
      `preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
    )
  }
  const tamanho = Math.min(w, h) * 0.34
  const borda = molde.replace('/>', ` fill="none" stroke="${k.accent}" stroke-width="2" stroke-opacity="0.55"/>`)
  return (
    borda +
    texto(x + w / 2, y + h / 2 + tamanho * 0.34 + (forma === 'arch' ? w * 0.06 : 0), l.iniciais, {
      size: tamanho,
      fill: k.accent,
      font: fonteDisplay,
      weight: STORY_PESO_DISPLAY,
      anchor: 'middle',
      tracking: tamanho * 0.04,
      optical: true,
    })
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

/** O nome: o maior corpo que cabe, preferindo uma linha quando `umaLinha`. */
function pecaNome(
  c: Contexto,
  x: number,
  anchor: 'start' | 'middle',
  maxW: number,
  { max, min, maxLinhas, umaLinha }: { max: number; min: number; maxLinhas: number; umaLinha: boolean },
): Peca {
  const nome = c.k.upper ? c.l.name.toLocaleUpperCase('pt-BR') : c.l.name
  const trackingEm = c.k.upper ? Math.max(c.k.nameTracking, 0.06) : c.k.nameTracking
  const medida = (s: number): Medida => ({
    font: c.k.display,
    size: s,
    weight: STORY_PESO_DISPLAY,
    tracking: s * trackingEm,
  })
  const inteiro = (linhas: string[]) => linhas.join(' ') === nome

  let escolha: { s: number; linhas: string[] } | null = null
  if (umaLinha) {
    for (let s = max; s >= Math.round(max * 0.7); s -= 2) {
      if (c.medir(nome, medida(s)) <= maxW) {
        escolha = { s, linhas: [nome] }
        break
      }
    }
  }
  if (!escolha) {
    for (let s = umaLinha ? Math.round(max * 0.9) : max; s >= min; s -= 2) {
      const linhas = quebrarLinhas(nome, maxW, maxLinhas, medida(s), c.medir)
      if (inteiro(linhas)) {
        escolha = { s, linhas }
        break
      }
    }
  }
  if (!escolha) escolha = { s: min, linhas: quebrarLinhas(nome, maxW, maxLinhas, medida(min), c.medir) }

  return bloco(
    escolha.linhas,
    x,
    {
      size: escolha.s,
      fill: c.k.text,
      font: c.fontes.display,
      weight: STORY_PESO_DISPLAY,
      anchor,
      tracking: escolha.s * trackingEm,
      optical: true,
    },
    escolha.s * 1.08,
  )
}

function pecaRotulo(c: Contexto, x: number, anchor: 'start' | 'middle', filetes: boolean, size = 28): Peca {
  const rotulo = STORY_ROTULO.toLocaleUpperCase('pt-BR')
  const tracking = size * 0.32
  const w = c.medir(rotulo, { font: c.k.body, size, weight: 400, tracking })
  return {
    h: size,
    desenhar: (topo) => {
      const y = base(topo, size)
      let out = texto(x, y, rotulo, { size, fill: c.k.accent, font: c.fontes.body, anchor, tracking })
      if (filetes && anchor === 'middle') {
        const meio = y - size * 0.32
        out += linha(x - w / 2 - 28 - 90, meio, x - w / 2 - 28, meio, c.k.accent, 1.5, 0.6)
        out += linha(x + w / 2 + 28, meio, x + w / 2 + 28 + 90, meio, c.k.accent, 1.5, 0.6)
      }
      return out
    },
  }
}

function pecaTexto(c: Contexto, conteudo: string, x: number, anchor: 'start' | 'middle', maxW: number, o: Partial<Estilo> & { size: number }): Peca {
  const estilo: Estilo = { fill: c.k.muted, font: c.fontes.body, anchor, ...o }
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
      fill: o.fill ?? c.k.muted,
      font: o.display ? c.fontes.display : c.fontes.body,
      weight: o.display ? STORY_PESO_DISPLAY : undefined,
      anchor,
      tracking: o.tracking,
      optical: o.display,
    },
    o.entrelinha,
  )
}

const pecaFilete = (x1: number, x2: number, cor: string, w = 3, opacidade = 1): Peca => ({
  h: w,
  desenhar: (topo) => linha(x1, topo + w / 2, x2, topo + w / 2, cor, w, opacidade),
})

/** Endereço do perfil no pé — é para ele que a figurinha de link aponta. */
function rodape(c: Contexto, x: number, anchor: 'start' | 'middle', maxW: number): string {
  const rotulo = STORY_RODAPE.toLocaleUpperCase('pt-BR')
  let out = texto(x, SAFE_BOTTOM - 74, rotulo, {
    size: 22,
    fill: c.k.faint,
    font: c.fontes.body,
    anchor,
    tracking: 22 * 0.3,
  })
  const medida: Medida = { font: c.k.body, size: 36, weight: 400 }
  let size = 36
  while (size > 24 && c.medir(c.l.urlLabel, { ...medida, size }) > maxW) size -= 2
  out += texto(x, SAFE_BOTTOM - 18, cortarParaCaber(c.l.urlLabel, maxW, { ...medida, size }, c.medir), {
    size,
    fill: c.k.text,
    font: c.fontes.body,
    anchor,
  })
  return out
}

/** Onde a pilha de conteúdo precisa terminar para não encostar no rodapé. */
const LIMITE_DA_PILHA = SAFE_BOTTOM - 150

/** A primeira variante que cabe; se nenhuma couber, a mais enxuta. */
function primeiraQueCabe<T>(variantes: T[], montar: (v: T) => Peca[], disponivel: number): Peca[] {
  for (const v of variantes) {
    const pecas = montar(v)
    if (alturaDe(pecas) <= disponivel) return pecas
  }
  return montar(variantes[variantes.length - 1])
}

// ---- Os modelos -------------------------------------------------------------------

function moldura(c: Contexto, cfg: StoryConfig, id: string): string {
  const cx = STORY_W / 2
  const maxW = 820
  const { l, k } = c
  let out =
    `<rect x="48" y="48" width="${STORY_W - 96}" height="${STORY_H - 96}" fill="none" stroke="${k.accent}" stroke-width="2" stroke-opacity="0.5"/>` +
    `<rect x="64" y="64" width="${STORY_W - 128}" height="${STORY_H - 128}" fill="none" stroke="${k.accent}" stroke-width="1" stroke-opacity="0.3"/>`

  const topo = SAFE_TOP + 30
  const disponivel = LIMITE_DA_PILHA - topo

  const pecas = primeiraQueCabe(
    [
      { lado: 320, frase: true, areas: 3 },
      { lado: 260, frase: true, areas: 3 },
      { lado: 260, frase: false, areas: 3 },
      { lado: 220, frase: false, areas: 2 },
      { lado: 200, frase: false, areas: 1 },
    ],
    (v) => {
      const p: Peca[] = [pecaRotulo(c, cx, 'middle', true), espaco(64)]
      if (cfg.showPhoto) {
        const w = k.avatar === 'arch' ? v.lado * 0.84 : v.lado
        const h = k.avatar === 'arch' ? v.lado * 1.06 : v.lado
        p.push({ h, desenhar: (t) => retrato(`${id}-f`, k.avatar, cx - w / 2, t, w, h, l, k, c.fontes.display) }, espaco(72))
      }
      p.push(
        pecaNome(c, cx, 'middle', maxW, { max: 104, min: 60, maxLinhas: 2, umaLinha: true }),
        espaco(36),
        pecaFilete(cx - 60, cx + 60, k.accent),
        espaco(46),
      )
      if (l.oab) p.push(pecaTexto(c, l.oab, cx, 'middle', maxW, { size: 34, tracking: 4 }))
      if (v.frase && l.headline) {
        p.push(espaco(52), pecaParagrafo(c, l.headline, cx, 'middle', maxW, 2, { size: 38, entrelinha: 54 }))
      }
      const areas = l.areas.slice(0, v.areas)
      if (areas.length) {
        p.push(
          espaco(60),
          bloco(
            areas.map((a) =>
              cortarParaCaber(a.toLocaleUpperCase('pt-BR'), maxW, { font: k.body, size: 28, weight: 400, tracking: 5.6 }, c.medir),
            ),
            cx,
            { size: 28, fill: k.accent, font: c.fontes.body, anchor: 'middle', tracking: 5.6 },
            56,
          ),
        )
      }
      if (l.city) p.push(espaco(48), pecaTexto(c, l.city, cx, 'middle', maxW, { size: 32, fill: k.faint }))
      return p
    },
    disponivel,
  )

  out += empilhar(pecas, topo + Math.max(0, (disponivel - alturaDe(pecas)) / 2))
  return out + rodape(c, cx, 'middle', maxW)
}

function retratoEmArco(c: Contexto, cfg: StoryConfig, id: string): string {
  const cx = STORY_W / 2
  const maxW = 860
  const { l, k } = c
  const forma: Forma = k.avatar === 'square' ? 'square' : 'arch'
  // O retrato é o modelo: com a foto desligada, o arco fica com o monograma.
  const linhas: StoryLines = cfg.showPhoto ? l : { ...l, photo: undefined }
  const yFoto = SAFE_TOP + 20

  let escolhido = { altura: 700, pecas: [] as Peca[] }
  // A foto encolhe ANTES de o texto sair: frase e áreas dizem mais sobre o
  // profissional do que cem pixels de retrato.
  const variantes = [
    { altura: 700, frase: true, areas: 3 },
    { altura: 620, frase: true, areas: 3 },
    { altura: 560, frase: true, areas: 3 },
    { altura: 480, frase: true, areas: 3 },
    { altura: 560, frase: false, areas: 3 },
    { altura: 480, frase: false, areas: 3 },
    { altura: 460, frase: false, areas: 2 },
    { altura: 420, frase: false, areas: 1 },
  ]
  for (const v of variantes) {
    const p: Peca[] = [
      pecaRotulo(c, cx, 'middle', true),
      espaco(40),
      pecaNome(c, cx, 'middle', maxW, { max: 92, min: 58, maxLinhas: 2, umaLinha: true }),
      espaco(30),
      pecaFilete(cx - 50, cx + 50, k.accent),
      espaco(40),
    ]
    if (l.oab) p.push(pecaTexto(c, l.oab, cx, 'middle', maxW, { size: 32, tracking: 4 }))
    if (v.frase && l.headline) p.push(espaco(40), pecaParagrafo(c, l.headline, cx, 'middle', maxW, 2, { size: 34, entrelinha: 48 }))
    const areas = l.areas.slice(0, v.areas)
    if (areas.length) {
      const medidaAreas: Medida = { font: k.body, size: 26, weight: 400, tracking: 4.2 }
      p.push(
        espaco(42),
        bloco(
          quebrarItens(areas.map((a) => a.toLocaleUpperCase('pt-BR')), ' · ', maxW, 2, medidaAreas, c.medir),
          cx,
          { size: 26, fill: k.accent, font: c.fontes.body, anchor: 'middle', tracking: 4.2 },
          44,
        ),
      )
    }
    if (l.city) p.push(espaco(36), pecaTexto(c, l.city, cx, 'middle', maxW, { size: 30, fill: k.faint }))
    escolhido = { altura: v.altura, pecas: p }
    if (yFoto + v.altura + 70 + alturaDe(p) <= LIMITE_DA_PILHA) break
  }

  const h = escolhido.altura
  const w = forma === 'square' ? h * 0.82 : h * 0.8
  // Sobrou altura (foto menor, perfil enxuto): a composição inteira desce até o
  // meio, em vez de deixar um vão entre a cidade e o endereço.
  const sobra = LIMITE_DA_PILHA - (yFoto + h + 70 + alturaDe(escolhido.pecas))
  const y0 = yFoto + Math.max(0, sobra / 2)
  let out = retrato(`${id}-f`, forma, cx - w / 2, y0, w, h, linhas, k, c.fontes.display)
  out += empilhar(escolhido.pecas, y0 + h + 70)
  return out + rodape(c, cx, 'middle', maxW)
}

function coluna(c: Contexto, cfg: StoryConfig, id: string): string {
  const x0 = 110
  const maxW = STORY_W - x0 * 2
  const { l, k } = c

  let out = `<rect x="${x0}" y="${SAFE_TOP + 50}" width="64" height="6" fill="${k.accent}"/>`
  out += empilhar([pecaRotulo(c, x0, 'start', false, 26)], SAFE_TOP + 86)

  const lado = 190
  if (cfg.showPhoto) {
    const w = k.avatar === 'arch' ? lado * 0.86 : lado
    const h = k.avatar === 'arch' ? lado * 1.08 : lado
    out += retrato(`${id}-f`, k.avatar, STORY_W - x0 - w, SAFE_TOP + 40, w, h, l, k, c.fontes.display)
  }
  const topo = cfg.showPhoto ? SAFE_TOP + 280 : SAFE_TOP + 200

  const pecas = primeiraQueCabe(
    [
      { frase: 3, areas: 3, nome: 124 },
      { frase: 2, areas: 3, nome: 112 },
      { frase: 0, areas: 3, nome: 112 },
      { frase: 0, areas: 2, nome: 100 },
      { frase: 0, areas: 1, nome: 92 },
    ],
    (v) => {
      const p: Peca[] = [pecaNome(c, x0, 'start', maxW, { max: v.nome, min: 72, maxLinhas: 3, umaLinha: false })]
      if (l.oab) p.push(espaco(36), pecaTexto(c, l.oab, x0, 'start', maxW, { size: 32, tracking: 3.5 }))
      p.push(espaco(56), pecaFilete(x0, x0 + maxW, k.border, 2))
      if (v.frase && l.headline) {
        p.push(
          espaco(52),
          pecaParagrafo(c, l.headline, x0, 'start', maxW, v.frase, { size: 44, entrelinha: 60, fill: k.text, display: true }),
        )
      }
      const areas = l.areas.slice(0, v.areas)
      if (areas.length) {
        const alturaLinha = 84
        p.push(espaco(52), {
          h: areas.length * alturaLinha + 2,
          desenhar: (t) =>
            areas
              .map((a, i) => {
                const y = t + i * alturaLinha
                const rotulo = cortarParaCaber(a, maxW - 92, { font: k.body, size: 34, weight: 400 }, c.medir)
                return (
                  linha(x0, y + 1, x0 + maxW, y + 1, k.border, 2) +
                  texto(x0, y + 56, String(i + 1).padStart(2, '0'), {
                    size: 24,
                    fill: k.accent,
                    font: c.fontes.body,
                    tracking: 2,
                  }) +
                  texto(x0 + 92, y + 56, rotulo, { size: 34, fill: k.text, font: c.fontes.body })
                )
              })
              .join('') + linha(x0, t + areas.length * alturaLinha + 1, x0 + maxW, t + areas.length * alturaLinha + 1, k.border, 2),
        })
      }
      if (l.city) p.push(espaco(44), pecaTexto(c, l.city, x0, 'start', maxW, { size: 30, fill: k.faint }))
      return p
    },
    LIMITE_DA_PILHA - topo,
  )

  out += empilhar(pecas, topo)
  out += `<rect x="${x0}" y="${SAFE_BOTTOM - 124}" width="48" height="3" fill="${k.accent}"/>`
  return out + rodape(c, x0, 'start', maxW)
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

export function renderStory(profile: Profile, config: StoryConfig, opts: StoryRenderOpts = {}): string {
  const cfg = resolveStory(config)
  const k = storyInk(profile)
  const c: Contexto = {
    l: storyLines(profile, cfg, opts.photo),
    k,
    fontes: opts.fonts ?? { display: k.display, body: k.body },
    medir: opts.medir ?? medirAproximado,
  }
  const id = nextId()
  const miolo = cfg.template === 'retrato' ? retratoEmArco(c, cfg, id) : cfg.template === 'coluna' ? coluna(c, cfg, id) : moldura(c, cfg, id)
  return (
    `<svg ${NS} width="${STORY_W}" height="${STORY_H}" viewBox="0 0 ${STORY_W} ${STORY_H}" ` +
    `role="img" aria-label="${esc(`Story do perfil de ${c.l.name}`)}">` +
    `<rect x="0" y="0" width="${STORY_W}" height="${STORY_H}" fill="${k.bg}"/>` +
    miolo +
    `</svg>`
  )
}
