// Imagem anexada ao chamado de suporte — preparada no NAVEGADOR.
//
// O que chega do celular é uma captura de 2.500 px ou uma foto de 4 MB. O que
// sai daqui é um data URI que cabe no teto do servidor (ANEXO_DATA_URI_MAX em
// backend/src/support/anexos.ts), com três chamados de três imagens cabendo no
// limite de 1 MB do corpo da requisição.
//
// Diferente da foto do perfil (lib/image.ts), aqui NÃO há recorte: o que importa
// numa captura de tela é o texto dela. A imagem inteira é reduzida até o lado
// maior caber em 1.600 px — legível no celular e no computador do suporte — e só
// desce mais se nem na qualidade mínima couber.
//
// De quebra, a re-codificação pelo canvas joga fora o EXIF: a localização em que
// uma foto de celular foi tirada não vai junto para o suporte.

import { carregarImagem, codificaWebp, dimensoes, liberarImagem, type CanvasCodificavel, type FonteDeImagem } from './image'

export const ANEXOS_MAX = 3

/** Teto de UMA imagem, em caracteres do data URI. O servidor recusa acima de 300 mil. */
export const ANEXO_DATA_URL_MAX = 280_000

/** Lado maior de partida. Abaixo disso a imagem nunca é ampliada. */
export const ANEXO_LADO_MAX = 1600

/** Menor lado maior aceitável: abaixo disso o texto de uma captura some. */
const LADO_MINIMO = 640
const QUALIDADE_INICIAL = 0.85
const QUALIDADE_MINIMA = 0.6
const DEGRAU = 0.08

/** Medidas de desenho: o lado maior cabe em `ladoMax`, sem ampliar e sem distorcer. */
export function medidasDoAnexo(w: number, h: number, ladoMax = ANEXO_LADO_MAX): { w: number; h: number } {
  const maior = Math.max(w, h)
  if (!(maior > 0)) return { w: 1, h: 1 }
  const escala = Math.min(1, ladoMax / maior)
  return { w: Math.max(1, Math.round(w * escala)), h: Math.max(1, Math.round(h * escala)) }
}

/**
 * Codifica no menor formato que o navegador produz, sem passar do teto.
 *
 * `desenhar(ladoMax)` devolve um canvas com a imagem naquele tamanho — separado
 * assim para o teste passar um canvas de mentira. A ordem é: WebP (ou JPEG, no
 * Safari) na qualidade inicial; desce a qualidade em degraus até a mínima; e só
 * então reduz a imagem em 25% e recomeça. Se nem no tamanho mínimo couber, a
 * pessoa lê o porquê — em vez de ver o servidor recusar depois de esperar.
 */
export function codificarAnexo(
  desenhar: (ladoMax: number) => CanvasCodificavel,
  maiorLadoOriginal: number,
): string {
  let lado = Math.min(ANEXO_LADO_MAX, Math.max(1, maiorLadoOriginal))
  let formato: 'image/webp' | 'image/jpeg' | null = null
  for (;;) {
    const canvas = desenhar(lado)
    formato ??= codificaWebp(canvas) ? 'image/webp' : 'image/jpeg'
    let q = QUALIDADE_INICIAL
    let out = canvas.toDataURL(formato, q)
    while (out.length > ANEXO_DATA_URL_MAX && q - DEGRAU >= QUALIDADE_MINIMA - 1e-9) {
      q = Math.round((q - DEGRAU) * 100) / 100
      out = canvas.toDataURL(formato, q)
    }
    if (out.length <= ANEXO_DATA_URL_MAX) return out
    if (lado <= LADO_MINIMO) {
      throw new Error('Essa imagem ficou grande demais mesmo reduzida. Tente recortar só a parte do problema.')
    }
    lado = Math.max(LADO_MINIMO, Math.round(lado * 0.75))
  }
}

/** Lê o arquivo escolhido (ou colado) e devolve o data URI pronto para anexar. */
export async function prepararAnexo(file: File): Promise<string> {
  const fonte: FonteDeImagem = await carregarImagem(file)
  try {
    const { w, h } = dimensoes(fonte)
    return codificarAnexo((ladoMax) => {
      const m = medidasDoAnexo(w, h, ladoMax)
      const canvas = document.createElement('canvas')
      canvas.width = m.w
      canvas.height = m.h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Não foi possível processar a imagem neste dispositivo.')
      // Fundo branco: captura com transparência não fica preta ao virar JPEG.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, m.w, m.h)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(fonte as CanvasImageSource, 0, 0, m.w, m.h)
      return canvas
    }, Math.max(w, h))
  } finally {
    liberarImagem(fonte)
  }
}
