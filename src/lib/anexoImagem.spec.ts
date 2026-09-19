import { describe, expect, it } from 'vitest'
import { ANEXO_DATA_URL_MAX, ANEXO_LADO_MAX, codificarAnexo, medidasDoAnexo } from './anexoImagem'
import type { CanvasCodificavel } from './image'

// Um canvas de mentira: o tamanho do data URI cresce com a área e com a
// qualidade — o bastante para exercitar a descida de qualidade e a redução.
function canvasFalso(lado: number, opts: { webp: boolean; bytesPorPixel: number }, pedidos: [string, number, number][]): CanvasCodificavel {
  return {
    toDataURL(type?: string, quality?: unknown) {
      const q = typeof quality === 'number' ? quality : 0.92
      pedidos.push([type ?? 'image/png', q, lado])
      const formato = type === 'image/webp' && !opts.webp ? 'image/png' : type ?? 'image/png'
      const n = Math.max(1, Math.round(lado * lado * opts.bytesPorPixel * q))
      return `data:${formato};base64,${'A'.repeat(n)}`
    },
  }
}

describe('medidasDoAnexo', () => {
  it('reduz pelo lado maior sem distorcer', () => {
    expect(medidasDoAnexo(1170, 2532)).toEqual({ w: 739, h: 1600 })
    expect(medidasDoAnexo(3840, 2160)).toEqual({ w: 1600, h: 900 })
  })

  it('nunca amplia uma imagem pequena', () => {
    expect(medidasDoAnexo(800, 600)).toEqual({ w: 800, h: 600 })
  })

  it('medida inválida não vira canvas de zero pixels', () => {
    expect(medidasDoAnexo(0, 0)).toEqual({ w: 1, h: 1 })
  })
})

describe('codificarAnexo — cabe no teto do servidor', () => {
  it('captura comum sai em WebP, na qualidade de partida e no tamanho cheio', () => {
    const pedidos: [string, number, number][] = []
    const out = codificarAnexo((l) => canvasFalso(l, { webp: true, bytesPorPixel: 0.05 }, pedidos), 2532)
    expect(out.startsWith('data:image/webp')).toBe(true)
    expect(pedidos[pedidos.length - 1]).toEqual(['image/webp', 0.85, ANEXO_LADO_MAX])
  })

  it('no Safari (sem WebP) sai JPEG, nunca PNG', () => {
    const pedidos: [string, number, number][] = []
    const out = codificarAnexo((l) => canvasFalso(l, { webp: false, bytesPorPixel: 0.05 }, pedidos), 1200)
    expect(out.startsWith('data:image/jpeg')).toBe(true)
  })

  it('desce a qualidade antes de reduzir a imagem', () => {
    const pedidos: [string, number, number][] = []
    // 1600² × 0,13 × 0,85 ≈ 283 mil: passa do teto só na qualidade de partida.
    const out = codificarAnexo((l) => canvasFalso(l, { webp: true, bytesPorPixel: 0.13 }, pedidos), 1600)
    expect(out.length).toBeLessThanOrEqual(ANEXO_DATA_URL_MAX + 30)
    // O primeiro pedido é a sondagem de WebP; os outros são as codificações.
    const codificacoes = pedidos.slice(1)
    expect(codificacoes.every(([, , lado]) => lado === 1600)).toBe(true)
    expect(codificacoes.map(([, q]) => q)).toEqual([0.85, 0.77])
  })

  it('imagem pesada é reduzida até caber', () => {
    const pedidos: [string, number, number][] = []
    const out = codificarAnexo((l) => canvasFalso(l, { webp: true, bytesPorPixel: 0.4 }, pedidos), 3000)
    expect(out.length).toBeLessThanOrEqual(ANEXO_DATA_URL_MAX + 30)
    expect(Math.min(...pedidos.map(([, , lado]) => lado))).toBeLessThan(1600)
  })

  it('o que não cabe nem no tamanho mínimo é recusado com uma frase, não mandado ao servidor', () => {
    expect(() => codificarAnexo((l) => canvasFalso(l, { webp: true, bytesPorPixel: 50 }, []), 4000)).toThrow(
      /recortar só a parte do problema/,
    )
  })

  it('o teto fica abaixo do que o servidor recusa', () => {
    // ANEXO_DATA_URI_MAX em backend/src/support/anexos.ts é 300_000.
    expect(ANEXO_DATA_URL_MAX).toBeLessThan(300_000)
  })
})
