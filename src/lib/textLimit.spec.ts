// Trava do corte de texto ao limite do campo — é o que impede a IA de devolver
// algo que o servidor recusa salvar. ⚠️ Espelha fitToLimit em backend/src/ai/ai.service.ts.

import { describe, expect, it } from 'vitest'
import { fitToLimit } from './textLimit'
import { CHAR_LIMITS, FAQ_ANSWER_MAX } from './plans'

describe('fitToLimit', () => {
  it('não mexe no que já cabe', () => {
    expect(fitToLimit('Texto curto.', 400)).toBe('Texto curto.')
  })

  it('sem limite, devolve o texto (só aparado)', () => {
    expect(fitToLimit('  texto  ', 0)).toBe('texto')
  })

  it('termina na última frase completa que couber', () => {
    const t = 'Primeira frase aqui. Segunda frase aqui. Terceira frase que estoura o limite todo.'
    const out = fitToLimit(t, 45)
    expect(out.length).toBeLessThanOrEqual(45)
    expect(out).toBe('Primeira frase aqui. Segunda frase aqui.')
  })

  it('sem frase completa útil, corta na última palavra inteira', () => {
    const t = 'palavra outra mais algumas coisas compridas sem nenhuma pontuacao ate o fim'
    const out = fitToLimit(t, 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out.endsWith(' ')).toBe(false)
    // nunca corta no meio de uma palavra
    expect(t.startsWith(out)).toBe(true)
    expect(t[out.length]).toBe(' ')
  })

  it('respeita os tetos reais dos campos do perfil', () => {
    const longo = 'Atuação em direito ambiental com foco em licenciamento. '.repeat(20)
    for (const limite of [CHAR_LIMITS.premium.areaDesc, CHAR_LIMITS.free.bio, FAQ_ANSWER_MAX]) {
      expect(fitToLimit(longo, limite).length).toBeLessThanOrEqual(limite)
    }
  })
})
