// Travas do FAQ do perfil — as mesmas regras do backend (src/plans.ts e o
// faqRows de profiles.service.ts). Se um dos dois lados mudar sozinho, aqui quebra.

import { describe, expect, it } from 'vitest'
import { canUseFaq, FAQ_ANSWER_MAX, FAQ_LIMIT, FAQ_QUESTION_MAX } from './plans'
import { faqQuota } from './upsell'
import { faqIdeas } from './faqIdeas'
import { sampleProfile } from './mockData'
import { hasBlockingIssue } from './oab'

describe('limites do FAQ por plano', () => {
  it('Free não tem FAQ; Pro tem 2; Max tem 5', () => {
    expect(FAQ_LIMIT.free).toBe(0)
    expect(FAQ_LIMIT.pro).toBe(2)
    expect(FAQ_LIMIT.premium).toBe(5)
    expect(canUseFaq('free')).toBe(false)
    expect(canUseFaq('pro')).toBe(true)
    expect(canUseFaq('premium')).toBe(true)
  })

  it('os textos são curtos — FAQ é orientação, não parecer', () => {
    expect(FAQ_QUESTION_MAX).toBeLessThanOrEqual(120)
    expect(FAQ_ANSWER_MAX).toBeLessThanOrEqual(300)
  })

  it('a cota aponta o plano que destrava o próximo slot', () => {
    expect(faqQuota('free', 0).atLimit).toBe(true)
    expect(faqQuota('free', 0).unlockPlan).toBe('pro')
    expect(faqQuota('pro', 1).atLimit).toBe(false)
    expect(faqQuota('pro', 2).atLimit).toBe(true)
    expect(faqQuota('pro', 2).unlockPlan).toBe('premium')
    // No maior plano não há para onde subir: o slot fantasma some.
    expect(faqQuota('premium', 5).atLimit).toBe(true)
    expect(faqQuota('premium', 5).unlockPlan).toBeFalsy()
  })
})

describe('sugestões de pergunta', () => {
  it('saem das áreas do perfil e nunca repetem o que já foi usado', () => {
    const areas = ['Direito de Família', 'Sucessões e Inventário']
    const primeiras = faqIdeas(areas, 0, 3)
    expect(primeiras).toHaveLength(3)
    const usadas = primeiras.map((i) => i.question)
    const seguintes = faqIdeas(areas, 0, 3, usadas)
    expect(seguintes.some((i) => usadas.includes(i.question))).toBe(false)
  })

  it('funcionam mesmo em uma área que não está no catálogo', () => {
    const ideas = faqIdeas(['Direito Marítimo'], 0, 2)
    expect(ideas.length).toBeGreaterThan(0)
    expect(ideas.every((i) => i.question.includes('Direito Marítimo'))).toBe(true)
  })

  it('nenhuma pergunta sugerida esbarra nas normas de publicidade', () => {
    const todas = faqIdeas(
      [
        'Direito de Família',
        'Sucessões e Inventário',
        'Direito Trabalhista',
        'Direito Criminal',
        'Direito do Consumidor',
        'Direito Empresarial',
        'Direito Previdenciário',
        'Direito Imobiliário',
        'Direito Digital',
      ],
      0,
      27,
    )
    for (const idea of todas) {
      expect(hasBlockingIssue(idea.question)).toBe(false)
    }
  })
})

describe('perfil-modelo', () => {
  it('mostra o FAQ no limite do Max, com resposta e dentro da OAB', () => {
    const faqs = sampleProfile.faqs ?? []
    expect(faqs).toHaveLength(FAQ_LIMIT.premium)
    for (const f of faqs) {
      expect(f.question.trim().length).toBeGreaterThan(0)
      expect(f.question.length).toBeLessThanOrEqual(FAQ_QUESTION_MAX)
      expect(f.answer.trim().length).toBeGreaterThan(0)
      expect(f.answer.length).toBeLessThanOrEqual(FAQ_ANSWER_MAX)
      expect(hasBlockingIssue(`${f.question} ${f.answer}`)).toBe(false)
    }
  })
})
