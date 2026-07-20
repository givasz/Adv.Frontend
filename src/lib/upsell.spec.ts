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
    expect(quotaLabel(areaQuota('free', 2))).toBe('2/2 — Free')
    expect(quotaLabel(areaQuota('pro', 3))).toBe('3/6 — Pro')
    expect(quotaLabel(areaQuota('premium', 5))).toBe('5/20 — Max')
  })

  it('o limite vem de plans.ts (sem duplicar regra)', () => {
    expect(areaQuota('free', 0).limit).toBe(AREA_LIMIT.free)
    expect(areaQuota('pro', 0).limit).toBe(AREA_LIMIT.pro)
    expect(charQuota('free', 'bio', 0).limit).toBe(CHAR_LIMITS.free.bio)
    expect(charQuota('premium', 'bio', 0).limit).toBe(CHAR_LIMITS.premium.bio)
  })

  it('bio: contador de caracteres usa o texto atual vs limite do plano', () => {
    const q = charQuota('free', 'bio', 120)
    expect(quotaLabel(q)).toBe('120/300 — Free')
    expect(q.remaining).toBe(180)
    expect(q.atLimit).toBe(false)
  })
})

describe('upsell — slot fantasma ao atingir o limite', () => {
  it('Free com 2 áreas está no limite e destrava no Pro (2 → 6)', () => {
    const q = areaQuota('free', 2)
    expect(q.atLimit).toBe(true)
    expect(q.remaining).toBe(0)
    expect(q.unlockPlan).toBe('pro')
    expect(q.unlockLimit).toBe(6)
  })

  it('Pro no limite (6) destrava no Max (6 → 20)', () => {
    const q = areaQuota('pro', 6)
    expect(q.atLimit).toBe(true)
    expect(q.unlockPlan).toBe('premium')
    expect(q.unlockLimit).toBe(20)
  })

  it('Max não tem plano acima para destravar', () => {
    const q = areaQuota('premium', 20)
    expect(q.atLimit).toBe(true)
    expect(q.unlockPlan).toBeNull()
    expect(q.unlockLimit).toBeNull()
  })

  it('abaixo do limite não marca atLimit', () => {
    expect(areaQuota('free', 1).atLimit).toBe(false)
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
    expect(featurePoints('oab')).toBe(10)
    expect(featurePoints('branding')).toBe(10) // dominio (5) + marca (5)
  })

  it('recursos sem fator gated rendem 0 (chip não aparece)', () => {
    expect(featurePoints('areas')).toBe(0)
    expect(featurePoints('bio')).toBe(0)
    expect(featurePoints('themes')).toBe(0)
    expect(featurePoints('highlights')).toBe(0)
  })

  it('featureCompare traz os três planos, valores derivados e os pontos', () => {
    const areas = featureCompare('areas')
    expect(areas.rows.map((r) => r.plan)).toEqual(['free', 'pro', 'premium'])
    expect(areas.rows.map((r) => r.value)).toEqual(['2 áreas', '6 áreas', '20 áreas'])
    expect(areas.points).toBe(0)

    const agenda = featureCompare('agenda')
    expect(agenda.points).toBe(8)
    expect(agenda.rows.map((r) => r.value)).toEqual(['—', 'Incluído', 'Incluído'])
  })
})
