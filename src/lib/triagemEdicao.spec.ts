import { describe, expect, it } from 'vitest'
import { FIM_DA_TRIAGEM, normalizarTriagem, triagemEmEdicao, type PerguntaDeTriagem } from './triagem'
import { novaPergunta } from './triagemModelos'

// O EDITOR TRABALHA COM O TEXTO CRU.
//
// Até 13/09/2026 cada tecla passava pelo normalizador do servidor, e ele faz
// duas coisas certas na hora de GRAVAR e erradas na hora de DIGITAR: `trim()`
// (o espaço do fim sumia antes da letra seguinte — "Em qual cidade" saía
// "Emqualcidade") e descartar opção vazia (a opção recém-criada morria antes de
// aparecer). Estes testes simulam a digitação tecla a tecla, que é exatamente o
// caminho que os testes do normalizador não percorrem.

/** Aplica o texto uma letra por vez, como o onChange do campo faz. */
function digitar(texto: string, aplicar: (parcial: string) => string): string {
  let atual = ''
  for (const letra of texto) atual = aplicar(atual + letra)
  return atual
}

const comEnunciado = (label: string) =>
  ({ enabled: true, questions: [{ id: 'a', kind: 'texto', label }] }) as const

describe('digitar um enunciado', () => {
  it('o espaço do fim sobrevive, e a frase sai com os espaços do meio', () => {
    const frase = digitar('Em qual cidade', (parcial) => triagemEmEdicao(comEnunciado(parcial)).questions[0].label)
    expect(frase).toBe('Em qual cidade')
  })

  // O contraste que explica o defeito: o normalizador do servidor, aplicado a
  // cada tecla, produz exatamente o que aparecia no print.
  it('(o normalizador do servidor, tecla a tecla, comia os espaços)', () => {
    const frase = digitar('Em qual cidade', (parcial) => normalizarTriagem(comEnunciado(parcial)).questions[0]?.label ?? '')
    expect(frase).toBe('Emqualcidade')
  })

  it('espaço no começo e no fim é mantido enquanto se edita', () => {
    expect(triagemEmEdicao(comEnunciado('  Já ')).questions[0].label).toBe('  Já ')
  })

  it('o teto de tamanho continua valendo', () => {
    expect(triagemEmEdicao(comEnunciado('x'.repeat(500))).questions[0].label.length).toBe(120)
  })
})

describe('as opções de uma pergunta nova', () => {
  it('a pergunta de escolha recém-criada mantém os dois campos vazios', () => {
    const nova = novaPergunta('escolha')
    const [q] = triagemEmEdicao({ enabled: true, questions: [nova] }).questions
    expect(q.options).toHaveLength(2)
    expect(q.options!.map((o) => o.texto)).toEqual(['', ''])
  })

  it('digitar numa opção também mantém os espaços', () => {
    const nova = novaPergunta('escolha')
    const texto = digitar('Belo Horizonte', (parcial) => {
      const editada = { ...nova, options: [{ ...nova.options![0], texto: parcial }, nova.options![1]] }
      return triagemEmEdicao({ enabled: true, questions: [editada] }).questions[0].options![0].texto
    })
    expect(texto).toBe('Belo Horizonte')
  })

  it('trocar o tipo para "sim ou não" já traz as duas opções, com o caminho que tinham', () => {
    const [q] = triagemEmEdicao({
      enabled: true,
      questions: [
        { id: 'a', kind: 'sim-nao', label: 'Já tem processo?', options: [{ id: 'sim', texto: 'x', proxima: 'b' }] },
        { id: 'b', kind: 'texto', label: 'Conte' },
      ],
    }).questions
    expect(q.options).toEqual([
      { id: 'sim', texto: 'Sim', proxima: 'b' },
      { id: 'nao', texto: 'Não' },
    ])
  })
})

describe('os caminhos continuam só para frente, mesmo no editor', () => {
  it('um caminho para trás some — nenhum loop fica desenhado na tela', () => {
    const questions: PerguntaDeTriagem[] = [
      { id: 'a', kind: 'texto', label: 'Primeira' },
      { id: 'b', kind: 'texto', label: 'Segunda', proxima: 'a' },
    ]
    expect(triagemEmEdicao({ enabled: true, questions }).questions[1].proxima).toBeUndefined()
  })

  it('para frente e para o fim ficam', () => {
    const questions: PerguntaDeTriagem[] = [
      { id: 'a', kind: 'texto', label: 'Primeira', proxima: 'c' },
      { id: 'b', kind: 'texto', label: 'Segunda', proxima: FIM_DA_TRIAGEM },
      { id: 'c', kind: 'texto', label: 'Terceira' },
    ]
    const [a, b] = triagemEmEdicao({ enabled: true, questions }).questions
    expect(a.proxima).toBe('c')
    expect(b.proxima).toBe(FIM_DA_TRIAGEM)
  })
})

describe('forma segura para aplicar a cada alteração', () => {
  it('aplicar duas vezes dá o mesmo resultado', () => {
    const entrada = {
      enabled: true,
      questions: [novaPergunta('escolha'), novaPergunta('sim-nao'), { id: 'x', kind: 'texto', label: 'Oi ' }],
    }
    const uma = triagemEmEdicao(entrada)
    expect(triagemEmEdicao(uma)).toEqual(uma)
  })

  it('lixo não quebra', () => {
    for (const lixo of [null, undefined, 'x', 7, [], { questions: 'nada' }, { questions: [null, 3] }]) {
      expect(triagemEmEdicao(lixo)).toEqual({ enabled: false, questions: [] })
    }
  })

  it('o servidor continua recebendo o texto LIMPO ao gravar', () => {
    const emEdicao = triagemEmEdicao(comEnunciado('  Em qual cidade  '))
    expect(normalizarTriagem(emEdicao).questions[0].label).toBe('Em qual cidade')
  })
})
