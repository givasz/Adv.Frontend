// Cartão de visita — TIRAR DO NAVEGADOR: PDF para a gráfica, PNG de 300 dpi e SVG.
//
// O desenho vem inteiro de lib/cardArt.ts. Aqui só tratamos do que é sujo e
// depende do navegador — e é aqui que moram as diferenças entre Chrome, Firefox
// e Safari. Cada gambiarra abaixo tem o navegador que a exige escrito ao lado.
//
// PDF é a saída principal: é vetorial, sai com a fonte de verdade e é o que a
// gráfica pede. PNG é a saída de reserva (WhatsApp da gráfica); SVG é para quem
// vai abrir no Illustrator.

import {
  BLEED_H,
  BLEED_W,
  cardInk,
  DISPLAY_OPSZ,
  pxAt300,
  renderCard,
  renderSheet,
  type CardConfig,
  type CardSide,
} from './cardArt'
import type { Profile } from './types'
import { downloadFile } from './vcard'
import { slugify } from './brFormat'

/** As mesmas fontes que o index.html carrega — a folha de impressão precisa delas. */
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400..700&family=Cormorant+Garamond:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,400..600&family=Hanken+Grotesk:wght@400;500;600;700&family=Lora:wght@400..700&family=Newsreader:opsz,wght@6..72,400..700&family=Playfair+Display:ital,wght@0,400..800;1,400..600&family=Syne:wght@400..800&display=swap'

const fileBase = (profile: Profile) => `cartao-${slugify(profile.name) || 'advogado'}`

// ---- Fontes embutidas (só para PNG e SVG) ----------------------------------

/**
 * Primeira família de uma pilha CSS: "'Fraunces', Georgia, serif" → "Fraunces".
 */
function familyName(stack: string): string | null {
  const m = /'([^']+)'/.exec(stack)
  return m ? m[1] : null
}

const fontCache = new Map<string, string>()

/**
 * Famílias do index.html que têm eixo de TAMANHO ÓPTICO — só elas levam o eixo
 * no endereço da folha de estilo.
 */
const COM_OPSZ = new Set(['Fraunces', 'Newsreader'])

/**
 * Nome com que a fonte entra no arquivo exportado. NÃO é o nome real da família,
 * e isso é de propósito: o rasterizador do WebKit (o do Safari) erra ao escolher
 * entre duas faces declaradas com o MESMO nome dentro de uma SVG desenhada em
 * `<img>` — todos os pesos saíam com o corte mais pesado. Um nome por papel,
 * uma face por nome, e os três navegadores desenham igual.
 */
const ALIAS = { display: 'AdvCardDisplay', body: 'AdvCardBody' } as const

/** Peso de cada papel. Um só por família — ver ALIAS. */
const PESO = { display: 600, body: 400 } as const

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf)
  let bin = ''
  // Em pedaços: `String.fromCharCode(...bytes)` com um arquivo de fonte inteiro
  // estoura o limite de argumentos e derruba a aba.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)) as unknown as number[])
  }
  return btoa(bin)
}

/**
 * Uma face embutida em base64, já renomeada. Devolve '' se a rede falhar.
 *
 * O tamanho óptico vai PEDIDO NO ENDEREÇO (a instância já vem pronta do Google)
 * em vez de ajustado por `font-variation-settings` no SVG: o WebKit ignora esse
 * ajuste ao rasterizar dentro de `<img>`.
 *
 * Só o subconjunto `latin` é baixado — ele já cobre todo o português (á, ç, õ
 * estão abaixo de U+00FF).
 */
async function faceEmbutida(stack: string, alias: string, peso: number): Promise<string> {
  const familia = familyName(stack)
  if (!familia) return ''
  const chave = `${familia}|${peso}|${alias}`
  const emCache = fontCache.get(chave)
  if (emCache !== undefined) return emCache

  let face = ''
  try {
    const nome = familia.replace(/ /g, '+')
    const eixo = COM_OPSZ.has(familia) ? `opsz,wght@${DISPLAY_OPSZ},${peso}` : `wght@${peso}`
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${nome}:${eixo}&display=swap`).then((r) =>
      r.ok ? r.text() : Promise.reject(new Error('css')),
    )
    const bloco = css
      .split('@font-face')
      .slice(1)
      .find((b) => b.includes('U+0000-00FF') && !/font-style:\s*italic/.test(b))
    // Da PRIMEIRA chave até a que a fecha: cortar pelas pontas do pedaço deixava
    // o comentário `/* latin */` da próxima entrar na regra e o navegador
    // descartava o @font-face inteiro.
    const corpo = bloco ? /\{([\s\S]*?)\}/.exec(bloco)?.[1] : undefined
    const m = corpo ? /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(corpo) : null
    if (corpo && m) {
      const buf = await fetch(m[1]).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('woff2'))))
      face =
        '@font-face{' +
        corpo
          .replace(m[1], `data:font/woff2;base64,${toBase64(buf)}`)
          .replace(/font-family:\s*'[^']+'/, `font-family: '${alias}'`)
          // Faixa aberta de peso: com uma face só, o navegador usa esta para
          // qualquer peso pedido em vez de engrossar a letra por conta própria.
          .replace(/font-weight:\s*[^;]+;/, 'font-weight: 100 900;') +
        '}'
    }
  } catch {
    face = ''
  }
  fontCache.set(chave, face)
  return face
}

/**
 * As duas fontes do cartão, embutidas, mais as pilhas a usar no SVG.
 *
 * Por que embutir: uma SVG rasterizada dentro de `<img>` NÃO enxerga as fontes
 * da página — em nenhum navegador. Sem isto o PNG sairia com a fonte de reserva
 * e a prévia teria mentido. Falhando a rede, `completo` vem false e a tela avisa.
 */
async function fontesEmbutidas(ink: { display: string; body: string }) {
  const [d, b] = await Promise.all([
    faceEmbutida(ink.display, ALIAS.display, PESO.display),
    faceEmbutida(ink.body, ALIAS.body, PESO.body),
  ])
  return {
    style: d + b,
    completo: !!d && !!b,
    fonts: {
      // A pilha do tema fica atrás do apelido: se a face embutida faltar, o
      // desenho ainda cai na fonte certa quando ela existir no aparelho.
      display: `'${ALIAS.display}', ${ink.display}`,
      body: `'${ALIAS.body}', ${ink.body}`,
    },
  }
}

/** Enfia o `<style>` das fontes logo depois da abertura do <svg>. */
function withFonts(svg: string, style: string): string {
  if (!style) return svg
  return svg.replace(/>/, `><defs><style type="text/css">${style}</style></defs>`)
}

// ---- Rasterização (PNG) -----------------------------------------------------

/**
 * Troca as medidas em milímetros do <svg> por pixels. O Safari rasteriza a
 * imagem no tamanho INTRÍNSECO dela e só depois escala — com `96mm` o PNG saía
 * borrado. Com o tamanho final em pixels, sai nítido nos três navegadores.
 */
function withPixelSize(svg: string, w: number, h: number): string {
  return svg.replace(/width="[^"]*"\s+height="[^"]*"/, `width="${w}" height="${h}"`)
}

const svgToUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível desenhar o cartão nesta versão do navegador.'))
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // toBlob não existe em navegador antigo — cai no toDataURL, que existe desde sempre.
    if (!canvas.toBlob) {
      try {
        const url = canvas.toDataURL('image/png')
        const bin = atob(url.split(',')[1])
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        resolve(new Blob([bytes], { type: 'image/png' }))
      } catch (e) {
        reject(e instanceof Error ? e : new Error('png'))
      }
      return
    }
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png')
  })
}

/** PNG de um lado do cartão, com sangria, a 300 dpi. */
export async function cardPng(profile: Profile, card: CardConfig, side: CardSide): Promise<{ blob: Blob; comFonte: boolean }> {
  const { style, completo, fonts } = await fontesEmbutidas(cardInk(profile))
  const w = pxAt300(BLEED_W)
  const h = pxAt300(BLEED_H)
  const svg = withPixelSize(withFonts(renderCard(profile, card, side, { fonts }), style), w, h)

  const img = await loadImage(svgToUrl(svg))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este navegador não conseguiu gerar a imagem. Use o PDF.')
  // Fundo branco por baixo: PNG sem fundo vira preto em muita gráfica.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return { blob: await canvasToBlob(canvas), comFonte: completo }
}

// ---- Downloads --------------------------------------------------------------

export async function baixarPng(profile: Profile, card: CardConfig, side: CardSide): Promise<boolean> {
  const { blob, comFonte } = await cardPng(profile, card, side)
  await entregarArquivo(blob, `${fileBase(profile)}-${side}.png`)
  return comFonte
}

export async function baixarSvg(profile: Profile, card: CardConfig, side: CardSide): Promise<void> {
  const { style, fonts } = await fontesEmbutidas(cardInk(profile))
  const svg = withFonts(renderCard(profile, card, side, { fonts }), style)
  downloadFile(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${fileBase(profile)}-${side}.svg`)
}

/**
 * Entrega o arquivo. No iPhone o atributo `download` é ignorado e o arquivo abre
 * numa aba em vez de salvar — quando o aparelho tem compartilhamento de arquivo,
 * usamos a folha do sistema, que é o gesto que a pessoa conhece.
 */
async function entregarArquivo(blob: Blob, nome: string): Promise<void> {
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean
    share?: (d: { files: File[]; title?: string }) => Promise<void>
  }
  const podeCompartilhar = typeof File !== 'undefined' && !!nav.canShare && !!nav.share
  if (podeCompartilhar) {
    try {
      const file = new File([blob], nome, { type: blob.type })
      if (nav.canShare!({ files: [file] })) {
        await nav.share!({ files: [file], title: nome })
        return
      }
    } catch {
      // cancelou ou o navegador recusou — segue para o download normal
    }
  }
  downloadFile(blob, nome)
}

// ---- PDF (pelo diálogo de impressão) ---------------------------------------

/**
 * Abre o diálogo de impressão com a folha A4 pronta para a gráfica. Quem imprime
 * escolhe "Salvar como PDF" e recebe um arquivo VETORIAL, com a fonte de verdade.
 *
 * É um iframe, não `window.open`: janela nova morre no bloqueador de pop-up (e no
 * Safari do iPhone quase sempre). O iframe também deixa a tela do editor intacta
 * por baixo — nada de esconder o app inteiro com CSS de impressão.
 */
export function imprimirFolha(profile: Profile, card: CardConfig): void {
  const svg = renderSheet(profile, card)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('title', 'Folha de impressão do cartão')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
      `<title>${fileBase(profile)}</title>` +
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
      `<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}">` +
      `<style>@page{size:A4;margin:0}` +
      `html,body{margin:0;padding:0;background:#fff}` +
      `svg{display:block;width:210mm;height:297mm}` +
      // Impede o navegador de reduzir a arte para caber na margem da impressora:
      // o cartão TEM de sair em tamanho exato.
      `@media print{html,body{width:210mm;height:297mm}}</style>` +
      `</head><body>${svg}</body></html>`,
  )
  doc.close()

  const janela = iframe.contentWindow
  if (!janela) {
    document.body.removeChild(iframe)
    return
  }

  const limpar = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }

  const disparar = () => {
    try {
      janela.focus() // Safari não imprime iframe sem foco
      janela.print()
    } catch {
      /* impressão indisponível — o PNG e o SVG continuam ali */
    }
    // O iframe some depois: tirar na hora cancela a impressão no Firefox.
    janela.addEventListener?.('afterprint', limpar)
    setTimeout(limpar, 60000)
  }

  // Espera as fontes do documento novo. Sem isto o PDF sai com a fonte de reserva
  // no primeiro clique e certo no segundo — o clássico "só funciona na segunda".
  const fontes = (doc as Document & { fonts?: FontFaceSet }).fonts
  if (fontes?.ready) {
    fontes.ready.then(() => setTimeout(disparar, 120)).catch(() => disparar())
  } else {
    setTimeout(disparar, 500)
  }
}
