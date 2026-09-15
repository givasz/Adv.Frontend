// Story — TIRAR DO NAVEGADOR: o PNG de 1080 × 1920 e a entrega para o Instagram,
// o WhatsApp ou qualquer app que o celular ofereça.
//
// O desenho vem inteiro de lib/storyArt.ts. As partes sujas (fonte embutida,
// rasterização) são as mesmas do cartão impresso e moram em lib/cardExport.ts —
// cada gambiarra de navegador está anotada lá, uma vez só.
//
// Por que a folha de compartilhar do sistema e não um "botão do Instagram": um
// site não consegue abrir o editor de stories com uma imagem (o atalho do
// Instagram só aceita chamada de aplicativo nativo). A folha do sistema é o
// caminho que existe — e é nela que o Instagram (Stories), o WhatsApp (Status),
// o Facebook e o LinkedIn aparecem, cada um com o nome que a pessoa conhece.

import type { Profile } from './types'
import { canvasToBlob, fontesEmbutidas, loadImage, svgToUrl, withFonts } from './cardExport'
import {
  STORY_H,
  STORY_OPSZ,
  STORY_PESO_DISPLAY,
  STORY_W,
  medirAproximado,
  renderStory,
  storyInk,
  type Medidor,
  type StoryConfig,
} from './storyArt'
import { downloadFile } from './vcard'
import { slugify } from './brFormat'

export const nomeDoStory = (profile: Profile) => `story-${slugify(profile.name) || 'perfil'}.png`

/**
 * A foto como data URI. Uma SVG desenhada dentro de <img> não carrega NADA de
 * fora — nem imagem do próprio site —, então a foto que vem por endereço (a do
 * perfil de exemplo, a rota /avatar) precisa entrar no arquivo. Falhou a busca:
 * o desenho cai no monograma em vez de sair com um buraco.
 */
export async function fotoEmbutida(src?: string): Promise<string | undefined> {
  if (!src) return undefined
  if (src.startsWith('data:')) return src
  try {
    const resposta = await fetch(src)
    if (!resposta.ok) return undefined
    const blob = await resposta.blob()
    if (!blob.type.startsWith('image/')) return undefined
    return await new Promise<string | undefined>((resolve) => {
      const leitor = new FileReader()
      leitor.onload = () => resolve(typeof leitor.result === 'string' ? leitor.result : undefined)
      leitor.onerror = () => resolve(undefined)
      leitor.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

/**
 * Medidor com a métrica REAL da fonte, pelo canvas. Espera as duas famílias do
 * tema carregarem: medir com a fonte de reserva faria o nome quebrar numa
 * largura e aparecer em outra.
 */
export async function prepararMedidor(profile: Profile): Promise<Medidor> {
  const k = storyInk(profile)
  const fontes = (document as Document & { fonts?: FontFaceSet }).fonts
  try {
    await Promise.all([
      fontes?.load(`${STORY_PESO_DISPLAY} 100px ${k.display}`),
      fontes?.load(`400 40px ${k.body}`),
    ])
  } catch {
    /* sem a fonte, mede com a que houver */
  }
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return medirAproximado
  return (texto, m) => {
    ctx.font = `${m.weight} ${m.size}px ${m.font}`
    return ctx.measureText(texto).width + (m.tracking ?? 0) * texto.length
  }
}

/** O PNG do story. `comFonte` false = a fonte original não veio (sem rede). */
export async function storyPng(profile: Profile, config: StoryConfig): Promise<{ blob: Blob; comFonte: boolean }> {
  const k = storyInk(profile)
  const [embutidas, photo, medir] = await Promise.all([
    fontesEmbutidas(k, { opsz: STORY_OPSZ, pesoDisplay: STORY_PESO_DISPLAY }),
    fotoEmbutida(profile.avatarUrl),
    prepararMedidor(profile),
  ])
  const svg = withFonts(renderStory(profile, config, { fonts: embutidas.fonts, photo, medir }), embutidas.style)
  const img = await loadImage(svgToUrl(svg))
  const canvas = document.createElement('canvas')
  canvas.width = STORY_W
  canvas.height = STORY_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este navegador não conseguiu gerar a imagem.')
  ctx.fillStyle = k.bg.startsWith('#') ? k.bg : '#ffffff'
  ctx.fillRect(0, 0, STORY_W, STORY_H)
  ctx.drawImage(img, 0, 0, STORY_W, STORY_H)
  return { blob: await canvasToBlob(canvas), comFonte: embutidas.completo }
}

type NavegadorComArquivo = Navigator & {
  canShare?: (d: { files: File[] }) => boolean
  share?: (d: { files: File[]; title?: string }) => Promise<void>
}

/**
 * O aparelho abre a folha de compartilhar com uma imagem? Só no toque: no
 * Windows o Chrome também sabe, e abriria a folha do sistema em vez de baixar —
 * mesma regra de lib/cardExport.ts e lib/contratos/entrega.ts.
 */
export function podeCompartilharImagem(): boolean {
  const nav = navigator as NavegadorComArquivo
  const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (!toque || typeof File === 'undefined' || !nav.canShare || !nav.share) return false
  try {
    return nav.canShare({ files: [new File([''], 'story.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

/**
 * Navegador embutido do Instagram, do Facebook ou do LinkedIn: não compartilha
 * arquivo e costuma engolir o download sem avisar.
 */
export function navegadorDeAplicativo(): boolean {
  return typeof navigator !== 'undefined' && /Instagram|FBAN|FBAV|LinkedInApp|Line\//i.test(navigator.userAgent)
}

export type Entrega = 'compartilhou' | 'baixou' | 'desistiu' | 'sem-gesto'

/**
 * Entrega a imagem. `sem-gesto` quer dizer que o navegador recusou abrir a folha
 * porque o toque "esfriou" enquanto a imagem era gerada — a tela pede um toque
 * de novo, e da segunda vez a imagem já está pronta.
 */
export async function compartilharStory(blob: Blob, nome: string): Promise<Entrega> {
  if (podeCompartilharImagem()) {
    const nav = navigator as NavegadorComArquivo
    try {
      await nav.share!({ files: [new File([blob], nome, { type: 'image/png' })] })
      return 'compartilhou'
    } catch (e) {
      const nomeDoErro = (e as { name?: string } | null)?.name
      if (nomeDoErro === 'AbortError') return 'desistiu'
      if (nomeDoErro === 'NotAllowedError') return 'sem-gesto'
    }
  }
  downloadFile(blob, nome)
  return 'baixou'
}
