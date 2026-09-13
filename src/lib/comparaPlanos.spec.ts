import { describe, expect, it } from 'vitest'
import { AREA_LIMIT, CHAR_LIMITS } from './plans'
import { PLAN_COMPARE, type CompareRow } from './planOffer'
import {
  escalaDaLinha,
  ganhoSobreAnterior,
  ganhosDoPlano,
  gruposVisiveis,
  numeroDaCelula,
  planoAnterior,
  PLANOS_COMPARADOS,
} from './comparaPlanos'

// A comparação do celular é uma LEITURA da tabela. Se a régua ou a marca de
// ganho mentirem, o erro aparece exatamente onde a pessoa está decidindo pagar.
const linha = (re: RegExp): CompareRow => {
  const r = PLAN_COMPARE.flatMap((g) => g.rows).find((r) => re.test(r.label))
  if (!r) throw new Error(`linha não encontrada: ${re}`)
  return r
}

describe('a escada dos planos', () => {
  it('Free é o chão; Pro vem depois do Free; Max depois do Pro', () => {
    expect(PLANOS_COMPARADOS).toEqual(['free', 'pro', 'premium'])
    expect(planoAnterior('free')).toBeNull()
    expect(planoAnterior('pro')).toBe('free')
    expect(planoAnterior('premium')).toBe('pro')
  })
})

describe('a régua', () => {
  it('só número (ou "não tem") vira medida; ✓ e texto não', () => {
    expect(numeroDaCelula('600')).toBe(600)
    expect(numeroDaCelula(false)).toBe(0)
    expect(numeroDaCelula(true)).toBeNull()
    expect(numeroDaCelula('3 de 8')).toBeNull()
    expect(numeroDaCelula('com número no fim')).toBeNull()
  })

  it('a escala de uma linha de limites é o maior plano, calculado dos mesmos limites do editor', () => {
    expect(escalaDaLinha(linha(/^Áreas/))).toBe(
      Math.max(AREA_LIMIT.free, AREA_LIMIT.pro, AREA_LIMIT.premium),
    )
    expect(escalaDaLinha(linha(/bio/i))).toBe(
      Math.max(CHAR_LIMITS.free.bio, CHAR_LIMITS.pro.bio, CHAR_LIMITS.premium.bio),
    )
  })

  it('linha de texto ou de ✓ não ganha régua', () => {
    expect(escalaDaLinha(linha(/^Endereço do perfil/))).toBeNull()
    expect(escalaDaLinha(linha(/^Temas visuais/))).toBeNull()
    expect(escalaDaLinha(linha(/^Vídeo/))).toBeNull()
  })
})

describe('o ganho sobre o plano anterior', () => {
  it('o Free não ganha nada sobre ninguém', () => {
    for (const r of PLAN_COMPARE.flatMap((g) => g.rows)) {
      expect(ganhoSobreAnterior(r, 'free')).toBeNull()
    }
  })

  it('limite que sobe mostra a diferença exata', () => {
    expect(ganhoSobreAnterior(linha(/^Áreas/), 'pro')).toEqual({
      tipo: 'mais',
      delta: AREA_LIMIT.pro - AREA_LIMIT.free,
    })
    expect(ganhoSobreAnterior(linha(/bio/i), 'premium')).toEqual({
      tipo: 'mais',
      delta: CHAR_LIMITS.premium.bio - CHAR_LIMITS.pro.bio,
    })
  })

  it('recurso que passa a existir é "novo" — e só no plano em que aparece', () => {
    const video = linha(/^Vídeo/)
    expect(ganhoSobreAnterior(video, 'pro')).toBeNull()
    expect(ganhoSobreAnterior(video, 'premium')).toEqual({ tipo: 'novo' })
  })

  it('pedir cartão NUNCA aparece como ganho', () => {
    // "não pede" → ✓ no Pro: carimbar "novo" ali venderia como vantagem o fato
    // de o plano pago pedir cartão.
    const cartao = linha(/Cartão de crédito/i)
    for (const p of PLANOS_COMPARADOS) expect(ganhoSobreAnterior(cartao, p)).toBeNull()
  })

  it('o filtro "só o que muda" mostra exatamente as linhas contadas, sem grupo vazio', () => {
    for (const p of ['pro', 'premium'] as const) {
      const grupos = gruposVisiveis(p, true)
      const linhas = grupos.flatMap((g) => g.rows)
      expect(linhas.length).toBe(ganhosDoPlano(p))
      expect(linhas.length).toBeGreaterThan(0)
      expect(grupos.every((g) => g.rows.length > 0)).toBe(true)
      expect(linhas.every((r) => ganhoSobreAnterior(r, p) !== null)).toBe(true)
    }
    // Sem degrau abaixo, o filtro não esconde nada.
    expect(gruposVisiveis('free', true)).toEqual(PLAN_COMPARE)
  })
})
