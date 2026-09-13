import { describe, expect, it } from 'vitest'
import { sampleProfile } from './mockData'
import { checkCompliance } from './oab'
import { conferirPergunta } from './triagemDados'
import { normalizarTriagem, perguntasDaConversa, triagemAtiva } from './triagem'

// O PERFIL-MODELO É A VITRINE DO RECURSO.
//
// Quem chega à home vê esta triagem antes de qualquer explicação — e o que ela
// pergunta é a primeira aula que o produto dá sobre o que perguntar. Uma vitrine
// que pedisse CPF ensinaria a pedir CPF, com a autoridade de ser "o exemplo".
//
// Por isso o exemplo passa pelo MESMO conferidor que a pergunta de qualquer
// advogado, e pelo mesmo motor de conformidade da OAB. É o único teste deste
// projeto em que um dado de demonstração é tratado como conteúdo de produção.

describe('a triagem do perfil-modelo', () => {
  it('está ligada e chega à conversa', () => {
    expect(triagemAtiva(sampleProfile)).toBe(true)
    expect(perguntasDaConversa(sampleProfile).length).toBeGreaterThan(2)
  })

  it('nenhuma pergunta pede dado pessoal ou sensível', () => {
    for (const q of sampleProfile.triage?.questions ?? []) {
      expect(conferirPergunta(q.label)).toEqual([])
      for (const o of q.options ?? []) expect(conferirPergunta(o)).toEqual([])
    }
  })

  it('nenhuma pergunta escorrega na publicidade da OAB', () => {
    for (const q of sampleProfile.triage?.questions ?? []) {
      expect(checkCompliance(q.label)).toEqual([])
      for (const o of q.options ?? []) expect(checkCompliance(o)).toEqual([])
    }
  })

  it('sobrevive inteira à normalização do servidor — nada é cortado no caminho', () => {
    const { questions } = normalizarTriagem(sampleProfile.triage)
    expect(questions).toEqual(sampleProfile.triage?.questions)
  })

  it('as opções de assunto são as áreas do próprio perfil', () => {
    const assunto = sampleProfile.triage?.questions[0]
    const areas = sampleProfile.areas.map((a) => a.label)
    for (const o of assunto?.options ?? []) {
      if (o === 'Outro assunto') continue
      expect(areas).toContain(o)
    }
  })
})
