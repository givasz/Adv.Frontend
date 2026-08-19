import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BRAND_HOST, profileUrl, profileUrlLabel, publicOrigin } from './publicUrl'

// A regressão que estes testes travam: o cartão digital gerava o QR apontando
// para https://advoc.me/<slug> — um domínio que não existe. Quem escaneava não
// abria nada, e o advogado só descobria depois de imprimir.
//
// Os testes rodam em Node (sem DOM), então o `window` é simulado: o que importa
// aqui é o CONTRATO — a URL sai da origem real do app, nunca da marca.

const ORIGIN = 'https://advocme.netlify.app'

beforeAll(() => {
  ;(globalThis as { window?: unknown }).window = { location: { origin: ORIGIN } }
})
afterAll(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('publicUrl — o endereço que vai para o QR', () => {
  it('usa a origem real do app, não a marca', () => {
    expect(publicOrigin()).toBe(ORIGIN)
    expect(publicOrigin()).not.toContain(BRAND_HOST)
  })

  it('monta uma URL absoluta e navegável', () => {
    const url = profileUrl('marina-sales')
    expect(url).toBe(`${ORIGIN}/marina-sales`)
    expect(url).toMatch(/^https?:\/\//)
    expect(() => new URL(url)).not.toThrow()
  })

  it('o rótulo exibido descreve exatamente a mesma URL', () => {
    // Rótulo e código não podem divergir: imprimir uma coisa e entregar outra é
    // pior do que não ter cartão nenhum.
    const slug = 'givanildo-barbosa'
    expect(profileUrl(slug)).toContain(profileUrlLabel(slug))
    expect(profileUrlLabel(slug)).not.toMatch(/^https?:\/\//)
    expect(profileUrlLabel(slug)).toBe('advocme.netlify.app/givanildo-barbosa')
  })

  it('BRAND_HOST é só rótulo de venda — nunca vira link', () => {
    expect(BRAND_HOST).toBe('advoc.me')
    expect(profileUrl('x')).not.toContain(BRAND_HOST)
  })
})
