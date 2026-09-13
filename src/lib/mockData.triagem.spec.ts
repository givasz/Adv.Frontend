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
      for (const o of q.options ?? []) expect(conferirPergunta(o.texto)).toEqual([])
    }
  })

  it('nenhuma pergunta escorrega na publicidade da OAB', () => {
    for (const q of sampleProfile.triage?.questions ?? []) {
      expect(checkCompliance(q.label)).toEqual([])
      for (const o of q.options ?? []) expect(checkCompliance(o.texto)).toEqual([])
    }
  })

  it('sobrevive inteira à normalização do servidor — nada é cortado no caminho', () => {
    const { questions } = normalizarTriagem(sampleProfile.triage)
    const escrito = sampleProfile.triage?.questions ?? []
    expect(questions).toHaveLength(escrito.length)
    // Igualdade campo a campo, e não `toEqual` do objeto inteiro: o normalizador
    // PREENCHE as opções fixas de "sim/não" e de atendimento, que o autor não
    // escreve. O que se confere aqui é que nada do que ele escreveu se perdeu.
    questions.forEach((q, i) => {
      expect(q.id).toBe(escrito[i].id)
      expect(q.kind).toBe(escrito[i].kind)
      expect(q.label).toBe(escrito[i].label)
      for (const [j, o] of (escrito[i].options ?? []).entries()) {
        expect(q.options?.[j]).toEqual(o)
      }
    })
  })

  it('o normalizador põe as opções fixas onde o autor não escreve nenhuma', () => {
    const { questions } = normalizarTriagem(sampleProfile.triage)
    const simNao = questions.find((q) => q.kind === 'sim-nao')
    const formato = questions.find((q) => q.kind === 'atendimento')
    expect(simNao?.options?.map((o) => o.texto)).toEqual(['Sim', 'Não'])
    expect(formato?.options?.map((o) => o.texto)).toEqual(['Presencial', 'Online'])
  })

  it('as opções de assunto são as áreas do próprio perfil', () => {
    const assunto = sampleProfile.triage?.questions[0]
    const areas = sampleProfile.areas.map((a) => a.label)
    for (const o of assunto?.options ?? []) {
      if (o.texto === 'Outro assunto') continue
      expect(areas).toContain(o.texto)
    }
  })
})
