import { describe, expect, it } from 'vitest'
import { checkCompliance } from './oab'
import { conferirPergunta } from './triagemDados'
import {
  AVISO_DOS_MODELOS,
  modelosDeTriagem,
  novaPergunta,
  TIPO_META,
  TIPOS_NA_ORDEM,
} from './triagemModelos'
import {
  normalizarTriagem,
  perguntasUtilizaveis,
  TIPOS_DE_PERGUNTA,
  TRIAGEM_LABEL_MAX,
  TRIAGEM_MAX_OPCOES,
  TRIAGEM_MAX_PERGUNTAS,
  TRIAGEM_OPCAO_MAX,
} from './triagem'

const MODELOS = modelosDeTriagem(['Direito de Família', 'Direito do Trabalho'])

// A TRAVA QUE MAIS IMPORTA DESTE ARQUIVO: um modelo é o caminho recomendado na
// tela, então ele não pode ser o caminho pelo qual um pedido de CPF entra num
// perfil. Modelo novo que peça dado sensível derruba o teste.
describe('nenhum modelo pede dado sensível', () => {
  it.each(MODELOS.map((m) => [m.nome, m] as const))('%s', (_nome, modelo) => {
    for (const q of modelo.questions) {
      expect(conferirPergunta(q.label)).toEqual([])
      for (const o of q.options ?? []) expect(conferirPergunta(o)).toEqual([])
    }
  })
})

describe('nenhum modelo escorrega na publicidade da OAB', () => {
  it.each(MODELOS.map((m) => [m.nome, m] as const))('%s', (_nome, modelo) => {
    for (const q of modelo.questions) {
      expect(checkCompliance(q.label)).toEqual([])
      for (const o of q.options ?? []) expect(checkCompliance(o)).toEqual([])
    }
  })
})

describe('todo modelo cabe no que o servidor aceita', () => {
  it.each(MODELOS.map((m) => [m.nome, m] as const))('%s', (_nome, modelo) => {
    const { questions } = normalizarTriagem({ enabled: true, questions: modelo.questions })
    // Nada é descartado nem cortado no caminho: o que a tela mostra é o que grava.
    expect(questions).toEqual(modelo.questions)
    expect(questions.length).toBeLessThanOrEqual(TRIAGEM_MAX_PERGUNTAS)
    expect(perguntasUtilizaveis(questions)).toHaveLength(questions.length)
    for (const q of questions) {
      expect(q.label.length).toBeLessThanOrEqual(TRIAGEM_LABEL_MAX)
      expect((q.options ?? []).length).toBeLessThanOrEqual(TRIAGEM_MAX_OPCOES)
      for (const o of q.options ?? []) expect(o.length).toBeLessThanOrEqual(TRIAGEM_OPCAO_MAX)
    }
  })

  it('cada modelo tem ids próprios, e aplicar duas vezes não os repete', () => {
    const a = modelosDeTriagem()
    const b = modelosDeTriagem()
    const ids = [...a, ...b].flatMap((m) => m.questions.map((q) => q.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('o modelo geral fala dos assuntos DESTE perfil', () => {
  it('usa as áreas do advogado como opções, com “Outro assunto” no fim', () => {
    const [geral] = modelosDeTriagem(['Direito de Família', 'Direito do Trabalho'])
    expect(geral.questions[0].options).toEqual([
      'Direito de Família',
      'Direito do Trabalho',
      'Outro assunto',
    ])
  })

  it('perfil ainda sem áreas ganha uma lista de partida, não uma lista vazia', () => {
    const [geral] = modelosDeTriagem([])
    expect(geral.questions[0].options!.length).toBeGreaterThan(1)
  })

  it('não estoura o teto de opções nem repete área', () => {
    const areas = Array.from({ length: 20 }, (_, i) => `Área ${i}`)
    const [geral] = modelosDeTriagem([...areas, 'Área 0'])
    expect(geral.questions[0].options!.length).toBeLessThanOrEqual(TRIAGEM_MAX_OPCOES)
    expect(new Set(geral.questions[0].options).size).toBe(geral.questions[0].options!.length)
  })
})

describe('o vocabulário do editor cobre todos os tipos', () => {
  it('cada tipo tem nome, explicação e exemplo', () => {
    for (const kind of TIPOS_DE_PERGUNTA) {
      expect(TIPO_META[kind].label).toBeTruthy()
      expect(TIPO_META[kind].hint).toBeTruthy()
      expect(TIPO_META[kind].exemplo).toBeTruthy()
    }
  })

  it('a lista de escolha do editor tem todos os tipos, sem repetir', () => {
    expect([...TIPOS_NA_ORDEM].sort()).toEqual([...TIPOS_DE_PERGUNTA].sort())
  })

  it('pergunta nova de escolha já nasce com linhas de opção para preencher', () => {
    expect(novaPergunta('escolha').options).toEqual(['', ''])
    expect(novaPergunta('multipla').options).toEqual(['', ''])
    expect(novaPergunta('texto').options).toBeUndefined()
  })

  it('nome e formato já nascem com o enunciado escrito — não há o que inventar ali', () => {
    expect(novaPergunta('contato').label).toBeTruthy()
    expect(novaPergunta('atendimento').label).toBeTruthy()
    expect(novaPergunta('escolha').label).toBe('')
  })

  it('ids de perguntas novas nunca se repetem', () => {
    const ids = Array.from({ length: 50 }, () => novaPergunta('texto').id)
    expect(new Set(ids).size).toBe(50)
  })
})

describe('o que a tela promete sobre um modelo', () => {
  it('é ponto de partida, nunca aprovação', () => {
    expect(AVISO_DOS_MODELOS).toMatch(/revise/i)
    expect(AVISO_DOS_MODELOS).not.toMatch(/adequad|aprovad|conform|garant/i)
    for (const m of MODELOS) {
      expect(m.resumo).not.toMatch(/adequad|aprovad|garant|ideal|melhor/i)
    }
  })
})
