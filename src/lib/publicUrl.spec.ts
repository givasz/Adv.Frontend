import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hostLabel, profileUrl, profileUrlLabel, publicOrigin } from './publicUrl'

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
    expect(publicOrigin()).not.toContain('advoc.me/')
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

  it('o host mostrado nas telas é o mesmo que vai para o QR', () => {
    // Antes havia dois: `hostLabel()` (real) e `BRAND_HOST` (a marca). Três telas
    // do editor pegaram o segundo e passaram a exibir um endereço que não abre.
    expect(profileUrl('x')).toContain(hostLabel())
  })
})

describe('o endereço mostrado é o endereço que abre', () => {
  // `advoc.me` é a MARCA; o endereço é onde o perfil está de fato. Um
  // `BRAND_HOST = 'advoc.me'` existia "para textos de venda" e vazou para três
  // telas do editor, que passaram a dizer ao advogado que o endereço dele era
  // `advoc.me/joao-silva`. Quem copiasse dali compartilhava um link morto.
  it('nenhuma tela usa a marca como se fosse host', async () => {
    const mod = await import('./publicUrl')
    expect('BRAND_HOST' in mod).toBe(false)
  })

  it('hostLabel devolve o host real, sem esquema', () => {
    expect(hostLabel()).toBe(publicOrigin().replace(/^https?:\/\//, ''))
    expect(hostLabel()).not.toMatch(/^https?:/)
  })
})
