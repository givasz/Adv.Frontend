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

/**
 * Lê um arquivo de imagem, recorta no centro para um quadrado `size`×`size` e
 * devolve um data URI (WebP ou JPEG) comprimido. Lança Error legível em caso de falha.
 */
export async function fileToAvatarDataUrl(file: File, size = 512, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem (JPG ou PNG).')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Imagem muito grande — escolha uma até 12 MB.')

  const source = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem neste dispositivo.')

  // Fundo branco (PNG com transparência não fica preto ao virar JPEG).
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  const sw = 'width' in source ? source.width : (source as HTMLImageElement).naturalWidth
  const sh = 'height' in source ? source.height : (source as HTMLImageElement).naturalHeight
  // "cover": preenche o quadrado e recorta o excedente, centralizado.
  const scale = Math.max(size / sw, size / sh)
  const w = sw * scale
  const h = sh * scale
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source as CanvasImageSource, (size - w) / 2, (size - h) / 2, w, h)

  if ('close' in source && typeof (source as ImageBitmap).close === 'function') {
    ;(source as ImageBitmap).close()
  }
  return codificarAvatar(canvas, quality)
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

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
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
