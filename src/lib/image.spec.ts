import { describe, expect, it } from 'vitest'
import { AVATAR_DATA_URL_MAX, codificarAvatar, ENQUADRAMENTO_PADRAO, janelaDeRecorte, ZOOM_MAX, type CanvasCodificavel } from './image'

// Um canvas de mentira: devolve um data URI do formato pedido, com tamanho
// proporcional à qualidade — o bastante para exercitar a escolha do formato e
// a descida de qualidade sem um navegador de verdade.
function canvasFalso(opts: { webp: boolean; bytesNaQualidade1: number }): CanvasCodificavel & { pedidos: [string, number][] } {
  const pedidos: [string, number][] = []
  return {
    pedidos,
    toDataURL(type?: string, quality?: unknown) {
      const q = typeof quality === 'number' ? quality : 0.92
      pedidos.push([type ?? 'image/png', q])
      // Safari: pediu WebP, sai PNG.
      const formato = type === 'image/webp' && !opts.webp ? 'image/png' : type ?? 'image/png'
      const n = Math.max(1, Math.round(opts.bytesNaQualidade1 * q))
      return `data:${formato};base64,${'A'.repeat(n)}`
    },
  }
}

describe('codificarAvatar — o formato da foto do perfil', () => {
  it('prefere WebP quando o navegador codifica', () => {
    const c = canvasFalso({ webp: true, bytesNaQualidade1: 50_000 })
    const out = codificarAvatar(c, 0.82)
    expect(out.startsWith('data:image/webp')).toBe(true)
    // A codificação final foi na qualidade pedida.
    expect(c.pedidos[c.pedidos.length - 1]).toEqual(['image/webp', 0.82])
  })

  it('cai para JPEG quando o pedido de WebP volta como PNG (Safari)', () => {
    const c = canvasFalso({ webp: false, bytesNaQualidade1: 50_000 })
    const out = codificarAvatar(c, 0.82)
    expect(out.startsWith('data:image/jpeg')).toBe(true)
    expect(out.startsWith('data:image/png')).toBe(false)
  })

  it('desce a qualidade até caber no teto, e não abaixo do mínimo', () => {
    // A 0,82 daria ~328 mil caracteres — acima do teto (300 mil); cabe a 0,70.
    const c = canvasFalso({ webp: true, bytesNaQualidade1: 400_000 })
    const out = codificarAvatar(c, 0.82)
    expect(out.length).toBeLessThanOrEqual(AVATAR_DATA_URL_MAX + 40)
    const qualidades = c.pedidos.filter(([t]) => t === 'image/webp').map(([, q]) => q)
    // Degraus de 0,06 a partir da qualidade pedida.
    expect(qualidades.slice(1, 3)).toEqual([0.82, 0.76])
    expect(Math.min(...qualidades.slice(1))).toBeGreaterThanOrEqual(0.6)
  })

  it('foto que não cabe nem na qualidade mínima sai como está — o servidor decide', () => {
    const c = canvasFalso({ webp: true, bytesNaQualidade1: 2_000_000 })
    const out = codificarAvatar(c, 0.82)
    const qualidades = c.pedidos.filter(([t]) => t === 'image/webp').map(([, q]) => q).slice(1)
    expect(Math.min(...qualidades)).toBeGreaterThanOrEqual(0.6)
    expect(out.length).toBeGreaterThan(AVATAR_DATA_URL_MAX)
  })

  it('o teto fica abaixo do que o servidor recusa', () => {
    // AVATAR_MAX em backend/src/security/sanitize.ts é 400_000.
    expect(AVATAR_DATA_URL_MAX).toBeLessThan(400_000)
  })
})

describe('janelaDeRecorte — o enquadramento que a prévia e o recorte compartilham', () => {
  it('padrão: a maior janela que cabe, no centro (o recorte automático de antes)', () => {
    expect(janelaDeRecorte(800, 500, ENQUADRAMENTO_PADRAO)).toEqual({ sx: 150, sy: 0, lado: 500 })
    expect(janelaDeRecorte(500, 800, ENQUADRAMENTO_PADRAO)).toEqual({ sx: 0, sy: 150, lado: 500 })
  })

  it('zoom 2 reduz a janela à metade, ainda centrada', () => {
    expect(janelaDeRecorte(800, 500, { zoom: 2, cx: 0.5, cy: 0.5 })).toEqual({ sx: 275, sy: 125, lado: 250 })
  })

  it('o centro segue o arrasto, e a janela nunca sai da foto', () => {
    // Centro pedido no canto: a janela encosta na borda em vez de vazar.
    expect(janelaDeRecorte(800, 500, { zoom: 1, cx: 0, cy: 0 })).toEqual({ sx: 0, sy: 0, lado: 500 })
    expect(janelaDeRecorte(800, 500, { zoom: 1, cx: 1, cy: 1 })).toEqual({ sx: 300, sy: 0, lado: 500 })
    // Com zoom, o centro tem para onde ir.
    expect(janelaDeRecorte(800, 500, { zoom: 2, cx: 0.25, cy: 0.5 })).toEqual({ sx: 75, sy: 125, lado: 250 })
  })

  it('zoom fora da faixa é trazido de volta', () => {
    expect(janelaDeRecorte(800, 500, { zoom: 0.2, cx: 0.5, cy: 0.5 }).lado).toBe(500)
    expect(janelaDeRecorte(800, 500, { zoom: 99, cx: 0.5, cy: 0.5 }).lado).toBeCloseTo(500 / ZOOM_MAX)
    expect(janelaDeRecorte(800, 500, { zoom: Number.NaN, cx: 0.5, cy: 0.5 }).lado).toBe(500)
  })
})
