import { describe, expect, it } from 'vitest'
import { exampleProfiles } from './mockData'
import { EXAMPLE_SLUGS, isExampleSlug } from './perfilPublico'

// Trava de paridade: os slugs copiados em perfilPublico.ts (para o minisite não
// precisar baixar o mockData inteiro) têm de ser EXATAMENTE os das fixtures.
// Um slug novo em mockData sem o espelho aqui faria o "Ver um exemplo" da home
// cair no fetch real e devolver "perfil não encontrado" — em silêncio.
describe('perfilPublico', () => {
  it('EXAMPLE_SLUGS espelha os perfis-modelo de mockData', () => {
    expect([...EXAMPLE_SLUGS].sort()).toEqual(exampleProfiles.map((p) => p.slug).sort())
  })

  it('reconhece exemplo e não confunde perfil real', () => {
    expect(isExampleSlug('marina-sales')).toBe(true)
    expect(isExampleSlug('guilherme-sales23')).toBe(true)
    expect(isExampleSlug('joao-da-silva')).toBe(false)
  })
})
