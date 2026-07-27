// Processamento de foto no NAVEGADOR — o usuário escolhe uma imagem do celular
// ou do computador e nós recortamos em quadrado + reduzimos para um data URI
// pequeno, guardado direto no perfil (avatarUrl). Sem storage no servidor: o
// backend no Render tem disco efêmero, então nada de arquivo no disco. Quando
// houver object storage (Cloudinary/S3/Supabase), troca-se por upload real.

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024 // 12 MB antes de comprimir

/**
 * Lê um arquivo de imagem, recorta no centro para um quadrado `size`×`size` e
 * devolve um data URI JPEG comprimido. Lança Error legível em caso de falha.
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
  return canvas.toDataURL('image/jpeg', quality)
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
