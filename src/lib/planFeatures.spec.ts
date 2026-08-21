import { describe, expect, it } from 'vitest'
import {
  featureProgress,
  featuresAddedBy,
  featuresIncluded,
  featuresPending,
  PLAN_FEATURES,
} from './planFeatures'
import { sampleProfile } from './mockData'
import type { Profile } from './types'
import { FAQ_LIMIT } from './plans'
import { DEFAULT_CARD } from './cardArt'

// Perfil recém-publicado no Free: só o essencial do onboarding.
const base: Profile = {
  ...structuredClone(sampleProfile),
  slug: 'marina-sales-4827',
  faqs: [],
  branding: undefined,
  card: undefined,
  schedulingMode: 'off',
  theme: 'papel',
  plan: 'free',
  bio: 'Atuo em Direito de Família.',
  areas: [{ id: 'a', label: 'Direito de Família', description: '' }],
}

describe('planFeatures — escada de planos', () => {
  it('cada recurso pertence a um plano pago', () => {
    expect(PLAN_FEATURES.every((f) => f.plan === 'pro' || f.plan === 'premium')).toBe(true)
  })

  it('chaves são únicas', () => {
    const keys = PLAN_FEATURES.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('o Free não inclui nenhum recurso pago', () => {
    expect(featuresIncluded('free')).toHaveLength(0)
  })

  it('o Max inclui tudo do Pro mais o dele', () => {
    const pro = featuresIncluded('pro').map((f) => f.key)
    const max = featuresIncluded('premium').map((f) => f.key)
    expect(pro.every((k) => max.includes(k))).toBe(true)
    expect(max.length).toBeGreaterThan(pro.length)
  })

  it('featuresAddedBy traz só o degrau daquele plano', () => {
    expect(featuresAddedBy('premium').every((f) => f.plan === 'premium')).toBe(true)
    expect(featuresAddedBy('pro').every((f) => f.plan === 'pro')).toBe(true)
  })
})

describe('planFeatures — checklist do que ainda não foi usado', () => {
  it('quem acabou de assinar o Pro vê o degrau inteiro como pendente', () => {
    const pending = featuresPending({ ...base, plan: 'pro' }).map((f) => f.key)
    expect(pending).toContain('agenda')
    // Itens automáticos (endereço, QR) não viram tarefa.
    expect(pending).not.toContain('endereco')
    expect(pending).not.toContain('qrcode')
  })

  it('configurar um recurso o remove do checklist — só sobra o que é novo', () => {
    const antes = featuresPending({ ...base, plan: 'pro' })
    const depois = featuresPending({ ...base, plan: 'pro', schedulingMode: 'assistant' })
    expect(depois.length).toBe(antes.length - 1)
    expect(depois.some((f) => f.key === 'agenda')).toBe(false)
  })

  it('subir de Pro para Max acrescenta apenas os itens do Max', () => {
    const pro = { ...base, plan: 'pro' as const }
    const max = { ...base, plan: 'premium' as const }
    const novos = featuresPending(max)
      .map((f) => f.key)
      .filter((k) => !featuresPending(pro).some((f) => f.key === k))
    // Sem 'dominio': o recurso saiu do checklist enquanto a plataforma não tem
    // domínio próprio no ar (ver planFeatures.ts).
    expect(novos.sort()).toEqual(['cartao', 'faq_max', 'marca', 'video'])
  })

  it('o FAQ começa no Pro e ganha um degrau no Max', () => {
    expect(FAQ_LIMIT.free).toBe(0)
    expect(FAQ_LIMIT.pro).toBe(2)
    expect(FAQ_LIMIT.premium).toBe(5)
    // No Free não há checklist; no Pro o FAQ aparece; o degrau extra é só do Max.
    expect(featuresPending({ ...base, plan: 'pro' }).some((f) => f.key === 'faq')).toBe(true)
    expect(featuresPending({ ...base, plan: 'pro' }).some((f) => f.key === 'faq_max')).toBe(false)
    expect(featuresPending({ ...base, plan: 'premium' }).some((f) => f.key === 'faq_max')).toBe(true)
  })

  it('um perfil Max inteiramente configurado zera o checklist', () => {
    const completo: Profile = {
      ...base,
      plan: 'premium',
      slug: 'marina-sales',
      schedulingMode: 'assistant',
      theme: 'toga',
      bio: 'x'.repeat(400),
      faqs: Array.from({ length: FAQ_LIMIT.premium }, (_, i) => ({
        id: `f${i}`,
        question: `P${i}`,
        answer: 'R',
      })),
      videoUrl: 'https://youtu.be/aqz-KE-bpKQ',
      areas: [
        { id: 'a', label: 'Família', description: '' },
        { id: 'b', label: 'Sucessões', description: '' },
        { id: 'c', label: 'Consumidor', description: '' },
      ],
      branding: { brandName: 'Sales Advocacia', customDomain: 'marinasales.adv.br' },
      card: DEFAULT_CARD,
    }
    expect(featuresPending(completo)).toHaveLength(0)
    const { done, total } = featureProgress(completo)
    expect(done).toBe(total)
  })

  it('o exemplo público demonstra os recursos que vendem o Max', () => {
    // A vitrine precisa mostrar de fato o que o plano alto entrega.
    const usados = featuresIncluded('premium')
      .filter((f) => f.done(sampleProfile))
      .map((f) => f.key)
    expect(sampleProfile.plan).toBe('premium')
    expect(usados).toEqual(
      expect.arrayContaining(['agenda', 'faq', 'faq_max', 'marca']),
    )
  })

  it('no Free não há checklist (nada foi comprado)', () => {
    expect(featuresPending(base)).toHaveLength(0)
    expect(featureProgress(base)).toEqual({ done: 0, total: 0 })
  })
})
