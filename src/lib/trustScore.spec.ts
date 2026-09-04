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
  faqs: [],
  contact: { whatsapp: '5511999999999' },
  branding: undefined,
  schedulingMode: 'off',
  plan: 'free',
  areas: [{ id: 'a', label: 'Direito de Família', description: '' }],
}

describe('trustScore — pesos', () => {
  it('a soma de todos os fatores é exatamente 100', () => {
    const total = TRUST_FACTORS.reduce((s, f) => s + f.points, 0)
    expect(total).toBe(100)
  })

  it('os fatores Free somam 73 (teto do plano gratuito)', () => {
    // Era 82 até 04/09/2026, quando o Free passou a entregar UMA área e a "2ª
    // área" (9 pontos) virou item de plano pago. Sem essa marcação, o painel
    // ofereceria um cartão que o editor não deixa concluir.
    const free = TRUST_FACTORS.filter((f) => !f.plan).reduce((s, f) => s + f.points, 0)
    expect(free).toBe(73)
  })

  it('nenhum fator do Free depende de cota que o Free não tem', () => {
    // A trava que impede o 82 de voltar por descuido: um fator sem `plan` precisa
    // ser concluível com o que o plano gratuito entrega de verdade.
    const semPlano = TRUST_FACTORS.filter((f) => !f.plan).map((f) => f.key)
    expect(semPlano).not.toContain('area2')
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

  it('perfil essencial pontua a base (>0 e < 73)', () => {
    const r = computeTrust(essential)
    expect(r.score).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(73)
    // nome+cidade+oab+bio+whatsapp+area1 = 5+5+7+8+7+6 = 38
    expect(r.score).toBe(38)
  })

  it('um perfil Free totalmente preenchido satura em 73, nunca mais', () => {
    // UMA área — que é o que o Free entrega desde 04/09/2026. O perfil está
    // completo até onde o plano gratuito permite chegar.
    const full: Profile = {
      ...essential,
      avatarUrl: 'https://x/y.jpg',
      headline: 'Advogada · Família',
      socials: [{ kind: 'instagram', url: 'https://instagram.com/x' }],
      contact: { whatsapp: '5511999999999', email: 'a@b.com' },
      faqs: [{ id: 'f', question: 'P', answer: 'R' }],
      areas: [{ id: 'a', label: 'Família', description: '' }],
    }
    expect(computeTrust(full).score).toBe(73)
  })

  it('itens PRO/MAX ficam travados no Free e destravam pontos além de 73', () => {
    const r = computeTrust(essential)
    const agenda = TRUST_FACTORS.find((f) => f.key === 'agenda')!
    expect(r.locked(agenda)).toBe(true)
    // Mesmo com agenda "configurada", no Free ela não conta (resolveSchedulingMode = off).
    const withAgendaButFree = computeTrust({ ...essential, schedulingMode: 'whatsapp' })
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
