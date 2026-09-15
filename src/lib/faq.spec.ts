// Travas do FAQ do perfil — as mesmas regras do backend (src/plans.ts e o
// faqRows de profiles.service.ts). Se um dos dois lados mudar sozinho, aqui quebra.

import { describe, expect, it } from 'vitest'
import { canUseFaq, FAQ_ANSWER_MAX, FAQ_LIMIT, FAQ_QUESTION_MAX } from './plans'
import { faqQuota } from './upsell'
import { faqIdeas } from './faqIdeas'
import { sampleProfile } from './mockData'
import { hasBlockingIssue } from './oab'

describe('limites do FAQ por plano', () => {
  it('Free tem 1; Pro tem 4; Max tem 8 — e o portão lê a tabela', () => {
    // O Free tinha ZERO até 04/09/2026. Uma pergunta basta para o recurso existir
    // e ser entendido, e é o que dá sentido ao teto dos planos pagos. Pro e Max
    // subiram de 2 e 5 para 4 e 8 em 15/09/2026.
    expect(FAQ_LIMIT.free).toBe(1)
    expect(FAQ_LIMIT.pro).toBe(4)
    expect(FAQ_LIMIT.premium).toBe(8)
    // `canUseFaq` deixou de perguntar o nome do plano e passou a ler a cota —
    // assim o portão nunca discorda do número anunciado.
    for (const p of ['free', 'pro', 'premium'] as const) {
      expect(canUseFaq(p)).toBe(FAQ_LIMIT[p] > 0)
    }
  })

  it('os textos são curtos — FAQ é orientação, não parecer', () => {
    for (const p of ['free', 'pro', 'premium'] as const) {
      expect(FAQ_QUESTION_MAX[p]).toBeLessThanOrEqual(120)
      // Baixado de 300 para 220 em 27/08: a 300 a IA escrevia até encostar no teto
      // e a resposta virava cinco linhas no celular. O teto é o que a IA recebe
      // como instrução (ver ai.service.ts), então mexer aqui muda o texto gerado.
      expect(FAQ_ANSWER_MAX[p]).toBeLessThanOrEqual(240)
    }
  })

  it('no Free os campos são MAIS curtos — cota de uma com campo largo se anula', () => {
    // Com uma pergunta só, um campo generoso é convite a empilhar duas numa. O
    // teto curto e a trava de campoUnico.ts trabalham juntos: um cuida do
    // tamanho, a outra da forma.
    expect(FAQ_QUESTION_MAX.free).toBeLessThan(FAQ_QUESTION_MAX.pro)
    expect(FAQ_ANSWER_MAX.free).toBeLessThan(FAQ_ANSWER_MAX.pro)
  })

  it('a cota aponta o plano que destrava o próximo slot', () => {
    expect(faqQuota('free', 0).atLimit).toBe(false)
    expect(faqQuota('free', 1).atLimit).toBe(true)
    expect(faqQuota('free', 1).unlockPlan).toBe('pro')
    expect(faqQuota('pro', FAQ_LIMIT.pro - 1).atLimit).toBe(false)
    expect(faqQuota('pro', FAQ_LIMIT.pro).atLimit).toBe(true)
    expect(faqQuota('pro', FAQ_LIMIT.pro).unlockPlan).toBe('premium')
    // No maior plano não há para onde subir: o slot fantasma some.
    expect(faqQuota('premium', FAQ_LIMIT.premium).atLimit).toBe(true)
    expect(faqQuota('premium', FAQ_LIMIT.premium).unlockPlan).toBeFalsy()
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
      expect(f.question.length).toBeLessThanOrEqual(FAQ_QUESTION_MAX.premium)
      expect(f.answer.trim().length).toBeGreaterThan(0)
      expect(f.answer.length).toBeLessThanOrEqual(FAQ_ANSWER_MAX.premium)
      expect(hasBlockingIssue(`${f.question} ${f.answer}`)).toBe(false)
    }
  })
})
