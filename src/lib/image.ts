// Processamento de foto no NAVEGADOR — o usuário escolhe uma imagem do celular
// ou do computador e nós recortamos em quadrado + reduzimos para um data URI
// pequeno, guardado direto no perfil (avatarUrl). Sem storage no servidor: o
// backend não tem disco para arquivo, então nada de upload. Quando houver object
// storage (Cloudinary/S3/Supabase), troca-se por upload real.
//
// FORMATO (13/09/2026): WebP quando o navegador sabe codificar, JPEG quando não
// sabe. Na mesma qualidade visual o WebP fica ~30% menor — e a foto vai inteira
// no JSON do perfil, em todo GET do editor, do painel e da página pública, além
// de dormir no banco. O Safari não codifica WebP pelo canvas (devolve PNG em
// silêncio), por isso a escolha é pelo PREFIXO do resultado, não por detecção
// de navegador. Todo consumidor já aceita os dois: o servidor
// (security/sanitize.ts, a rota /avatar), a prévia de link (WhatsApp lê WebP em
// og:image) e o cartão impresso (a foto entra numa <image> de SVG que o próprio
// navegador rasteriza).
//
// ENQUADRAMENTO (13/09/2026): o recorte deixou de ser só "o centro". O advogado
// arrasta a foto e aproxima (AvatarUpload) e o que ele vê na prévia é exatamente
// o que `recortarAvatar` grava — os dois desenham pela MESMA janela
// (`janelaDeRecorte`), só em tamanhos diferentes.

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024 // 12 MB antes de comprimir

/**
 * Teto do data URI que sai daqui. O servidor recusa acima de 400 mil caracteres
 * (AVATAR_MAX em backend/src/security/sanitize.ts) — e recusa em silêncio, a
 * foto some do perfil. Ficar bem abaixo é o que garante que uma foto ruidosa
 * (textura, grão, fundo de folhagem) nunca chegue lá em cima.
 */
export const AVATAR_DATA_URL_MAX = 300_000

/** O menor que a qualidade desce antes de desistir de caber no teto. */
const QUALIDADE_MINIMA = 0.6

/** Lado do quadrado gravado no perfil. */
export const AVATAR_LADO = 512

export type FonteDeImagem = ImageBitmap | HTMLImageElement

/**
 * O enquadramento escolhido: `zoom` ≥ 1 (1 = a maior janela quadrada que cabe
 * na foto) e o CENTRO da janela em frações da imagem (0,5 / 0,5 = o meio).
 * Frações, e não pixels, para o mesmo valor servir à prévia de 220 px e ao
 * recorte de 512 px.
 */
export interface Enquadramento {
  zoom: number
  cx: number
  cy: number
}

export const ENQUADRAMENTO_PADRAO: Enquadramento = { zoom: 1, cx: 0.5, cy: 0.5 }
export const ZOOM_MAX = 3

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/**
 * A janela quadrada de recorte, em pixels da imagem de origem. Pura — é o que
 * o teste confere. A janela nunca sai da foto: perto da borda, o centro pedido
 * é empurrado para dentro em vez de deixar uma faixa vazia.
 */
export function janelaDeRecorte(
  sw: number,
  sh: number,
  enq: Enquadramento,
): { sx: number; sy: number; lado: number } {
  const zoom = clamp(Number.isFinite(enq.zoom) ? enq.zoom : 1, 1, ZOOM_MAX)
  const lado = Math.min(sw, sh) / zoom
  const sx = clamp(enq.cx * sw - lado / 2, 0, sw - lado)
  const sy = clamp(enq.cy * sh - lado / 2, 0, sh - lado)
  return { sx, sy, lado }
}

/** Largura e altura da fonte, seja bitmap ou <img>. */
export function dimensoes(source: FonteDeImagem): { w: number; h: number } {
  return 'naturalWidth' in source
    ? { w: source.naturalWidth, h: source.naturalHeight }
    : { w: source.width, h: source.height }
}

/**
 * Desenha a janela de recorte num canvas quadrado de `size` px. A prévia do
 * editor e o recorte final chamam ISTO — é o que garante que o que se vê é o
 * que se grava.
 */
export function desenharRecorte(
  ctx: CanvasRenderingContext2D,
  source: FonteDeImagem,
  enq: Enquadramento,
  size: number,
): void {
  // Fundo branco (PNG com transparência não fica preto ao virar JPEG).
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  const { w, h } = dimensoes(source)
  const { sx, sy, lado } = janelaDeRecorte(w, h, enq)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source as CanvasImageSource, sx, sy, lado, lado, 0, 0, size, size)
}

/** Recorta a fonte pelo enquadramento e devolve o data URI (WebP ou JPEG). */
export function recortarAvatar(
  source: FonteDeImagem,
  enq: Enquadramento = ENQUADRAMENTO_PADRAO,
  size = AVATAR_LADO,
  quality = 0.82,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem neste dispositivo.')
  desenharRecorte(ctx, source, enq, size)
  return codificarAvatar(canvas, quality)
}

/** Devolve a memória do bitmap quando ele não serve mais. */
export function liberarImagem(source: FonteDeImagem): void {
  if ('close' in source && typeof source.close === 'function') source.close()
}

/**
 * Lê um arquivo de imagem, recorta no centro para um quadrado e devolve um data
 * URI (WebP ou JPEG) comprimido — o caminho SEM ajuste (logo do escritório).
 * Lança Error legível em caso de falha.
 */
export async function fileToAvatarDataUrl(file: File, size = AVATAR_LADO, quality = 0.82): Promise<string> {
  const source = await carregarImagem(file)
  try {
    return recortarAvatar(source, ENQUADRAMENTO_PADRAO, size, quality)
  } finally {
    liberarImagem(source)
  }
}

/** Só o que `codificarAvatar` usa de um canvas — para o teste passar um de mentira. */
export type CanvasCodificavel = Pick<HTMLCanvasElement, 'toDataURL'>

/**
 * Codifica o canvas no MENOR formato que o navegador sabe produzir, sem passar
 * do teto.
 *
 *  1. WebP na qualidade pedida. Se o navegador não codifica WebP, `toDataURL`
 *     devolve PNG em vez de falhar — daí conferir o prefixo — e cai para JPEG.
 *  2. Passou do teto (`AVATAR_DATA_URL_MAX`)? Desce a qualidade em degraus
 *     curtos até caber, sem ir abaixo de `QUALIDADE_MINIMA`. Uma foto que nem
 *     assim cabe sai como está — o servidor é que dirá não — em vez de virar
 *     uma mancha.
 */
export function codificarAvatar(canvas: CanvasCodificavel, quality = 0.82): string {
  const formato = codificaWebp(canvas) ? 'image/webp' : 'image/jpeg'
  let q = quality
  let out = canvas.toDataURL(formato, q)
  while (out.length > AVATAR_DATA_URL_MAX && q - 0.06 >= QUALIDADE_MINIMA) {
    q = Math.round((q - 0.06) * 100) / 100
    out = canvas.toDataURL(formato, q)
  }
  return out
}

function codificaWebp(canvas: CanvasCodificavel): boolean {
  try {
    return canvas.toDataURL('image/webp', 0.5).startsWith('data:image/webp')
  } catch {
    return false
  }
}

/**
 * Lê o arquivo escolhido como imagem decodificada, já com a orientação EXIF
 * aplicada (foto de celular deitada). Confere tipo e tamanho ANTES de decodificar.
 */
export async function carregarImagem(file: File): Promise<FonteDeImagem> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem (JPG ou PNG).')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Imagem muito grande — escolha uma até 12 MB.')

  // Caminho moderno: respeita a orientação EXIF (fotos de celular deitadas).
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* alguns navegadores não aceitam a opção — cai no fallback */
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler essa imagem. Tente outra.'))
    }
    img.src = url
  })
}
