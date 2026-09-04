import { describe, expect, it } from 'vitest'
import {
  areaQuota,
  charQuota,
  featureCompare,
  featurePoints,
  nextPlan,
  quotaLabel,
} from './upsell'
import { AREA_LIMIT, CHAR_LIMITS } from './plans'

describe('upsell — contador de cota por plano', () => {
  it('áreas: rótulo "usado/limite — Plano" reflete o plano atual', () => {
    // Lidos da tabela, nunca digitados: estes números já mudaram duas vezes num
    // dia (Free 2→1, Pro 6→4, Max 20→12) e o teste quebrava por estar certo.
    expect(quotaLabel(areaQuota('free', 1))).toBe(`1/${AREA_LIMIT.free} — Free`)
    expect(quotaLabel(areaQuota('pro', 3))).toBe(`3/${AREA_LIMIT.pro} — Pro`)
    expect(quotaLabel(areaQuota('premium', 5))).toBe(`5/${AREA_LIMIT.premium} — Max`)
  })

  it('o limite vem de plans.ts (sem duplicar regra)', () => {
    expect(areaQuota('free', 0).limit).toBe(AREA_LIMIT.free)
    expect(areaQuota('pro', 0).limit).toBe(AREA_LIMIT.pro)
    expect(charQuota('free', 'bio', 0).limit).toBe(CHAR_LIMITS.free.bio)
    expect(charQuota('premium', 'bio', 0).limit).toBe(CHAR_LIMITS.premium.bio)
  })

  it('bio: contador de caracteres usa o texto atual vs limite do plano', () => {
    const q = charQuota('free', 'bio', 120)
    expect(quotaLabel(q)).toBe(`120/${CHAR_LIMITS.free.bio} — Free`)
    expect(q.remaining).toBe(CHAR_LIMITS.free.bio - 120)
    expect(q.atLimit).toBe(false)
  })
})

describe('upsell — slot fantasma ao atingir o limite', () => {
  it('a escada de áreas sobe, e cada degrau aponta o seguinte', () => {
    const free = areaQuota('free', AREA_LIMIT.free)
    expect(free.atLimit).toBe(true)
    expect(free.remaining).toBe(0)
    expect(free.unlockPlan).toBe('pro')
    expect(free.unlockLimit).toBe(AREA_LIMIT.pro)

    const pro = areaQuota('pro', AREA_LIMIT.pro)
    expect(pro.atLimit).toBe(true)
    expect(pro.unlockPlan).toBe('premium')
    expect(pro.unlockLimit).toBe(AREA_LIMIT.premium)

    // A escada precisa SUBIR de verdade: com dois planos empatados, o slot
    // fantasma apontaria um upgrade que não entrega área nenhuma a mais.
    expect(AREA_LIMIT.free).toBeLessThan(AREA_LIMIT.pro)
    expect(AREA_LIMIT.pro).toBeLessThan(AREA_LIMIT.premium)
  })

  it('Max não tem plano acima para destravar', () => {
    const q = areaQuota('premium', AREA_LIMIT.premium)
    expect(q.atLimit).toBe(true)
    expect(q.unlockPlan).toBeNull()
    expect(q.unlockLimit).toBeNull()
  })

  it('abaixo do limite não marca atLimit', () => {
    expect(areaQuota('free', 0).atLimit).toBe(false)
    expect(areaQuota('pro', AREA_LIMIT.pro - 1).atLimit).toBe(false)
  })

  it('nextPlan sobe a escada e para no topo', () => {
    expect(nextPlan('free')).toBe('pro')
    expect(nextPlan('pro')).toBe('premium')
    expect(nextPlan('premium')).toBeNull()
  })
})

describe('upsell — pontos do Índice de Confiança por recurso', () => {
  it('recursos gated por plano expõem os pontos de trustScore', () => {
    expect(featurePoints('agenda')).toBe(8)
    expect(featurePoints('branding')).toBe(10) // marca (10) — não há fator de domínio
  })

  it('recursos sem fator gated rendem 0 (chip não aparece)', () => {
    expect(featurePoints('areas')).toBe(0)
    expect(featurePoints('bio')).toBe(0)
    expect(featurePoints('themes')).toBe(0)
  })

  it('featureCompare traz os três planos, valores derivados e os pontos', () => {
    const areas = featureCompare('areas')
    expect(areas.rows.map((r) => r.plan)).toEqual(['free', 'pro', 'premium'])
    expect(areas.rows.map((r) => r.value)).toEqual([
      `${AREA_LIMIT.free} área`,
      `${AREA_LIMIT.pro} áreas`,
      `${AREA_LIMIT.premium} áreas`,
    ])
    expect(areas.points).toBe(0)

    const agenda = featureCompare('agenda')
    expect(agenda.points).toBe(8)
    expect(agenda.rows.map((r) => r.value)).toEqual(['—', 'Incluído', 'Incluído'])
  })
})
