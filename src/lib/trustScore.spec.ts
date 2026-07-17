import { describe, expect, it } from 'vitest'
import { computeTrust, TRUST_FACTORS, trustLevel } from './trustScore'
import { sampleProfile } from './mockData'
import type { Profile } from './types'

// Perfil essencial recém-publicado (só o mínimo do onboarding).
const essential: Profile = {
  ...structuredClone(sampleProfile),
  avatarUrl: '',
  headline: '',
  socials: [],
  highlights: [],
  articles: [],
  contact: { whatsapp: '5511999999999' },
  branding: undefined,
  schedulingMode: 'off',
  oabStatus: 'none',
  oabVerified: false,
  plan: 'free',
  areas: [{ id: 'a', label: 'Direito de Família', description: '' }],
}

describe('trustScore — pesos', () => {
  it('a soma de todos os fatores é exatamente 100', () => {
    const total = TRUST_FACTORS.reduce((s, f) => s + f.points, 0)
    expect(total).toBe(100)
  })

  it('os fatores Free somam 72 (teto do plano gratuito)', () => {
    const free = TRUST_FACTORS.filter((f) => !f.plan).reduce((s, f) => s + f.points, 0)
    expect(free).toBe(72)
  })

  it('chaves de fator são únicas', () => {
    const keys = TRUST_FACTORS.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('computeTrust', () => {
  it('perfil vazio pontua 0', () => {
    const blank: Profile = {
      ...essential,
      name: '',
      city: '',
      state: '',
      oabNumber: '',
      bio: '',
      contact: {},
      areas: [{ id: 'a', label: '', description: '' }],
    }
    expect(computeTrust(blank).score).toBe(0)
  })

  it('perfil essencial pontua a base (>0 e < 72)', () => {
    const r = computeTrust(essential)
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(72)
    // nome+cidade+oab+bio+whatsapp+area1 = 5+5+7+8+7+6 = 38
    expect(r.score).toBe(38)
  })

  it('um perfil Free totalmente preenchido satura em 72, nunca mais', () => {
    const full: Profile = {
      ...essential,
      avatarUrl: 'https://x/y.jpg',
      headline: 'Advogada · Família',
      socials: [{ kind: 'instagram', url: 'https://instagram.com/x' }],
      contact: { whatsapp: '5511999999999', email: 'a@b.com' },
      highlights: [{ id: 'h', title: '10 anos', detail: '...' }],
      articles: [{ id: 'ar', title: 'T', summary: 'S', readingMinutes: 4 }],
      areas: [
        { id: 'a', label: 'Família', description: '' },
        { id: 'b', label: 'Sucessões', description: '' },
      ],
    }
    expect(computeTrust(full).score).toBe(72)
  })

  it('itens PRO/MAX ficam travados no Free e destravam pontos além de 72', () => {
    const r = computeTrust(essential)
    const agenda = TRUST_FACTORS.find((f) => f.key === 'agenda')!
    expect(r.locked(agenda)).toBe(true)
    // Mesmo com agenda "configurada", no Free ela não conta (resolveSchedulingMode = off).
    const withAgendaButFree = computeTrust({ ...essential, schedulingMode: 'native' })
    expect(withAgendaButFree.earned.some((f) => f.key === 'agenda')).toBe(false)
  })

  it('next vem ordenado do maior ganho para o menor', () => {
    const next = computeTrust(essential).next
    const pts = next.map((f) => f.points)
    expect(pts).toEqual([...pts].sort((a, b) => b - a))
  })
})

describe('trustLevel', () => {
  it('mapeia faixas para rótulos profissionais', () => {
    expect(trustLevel(0)).toBe('Em construção')
    expect(trustLevel(38)).toBe('Em construção')
    expect(trustLevel(45)).toBe('Bom começo')
    expect(trustLevel(65)).toBe('Perfil sólido')
    expect(trustLevel(80)).toBe('Perfil forte')
    expect(trustLevel(95)).toBe('Perfil excelente')
  })
})
