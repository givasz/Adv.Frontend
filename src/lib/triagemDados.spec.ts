import { describe, expect, it } from 'vitest'
import { conferirPergunta, conferirPerguntaInteira, perguntaBloqueada } from './triagemDados'
import CASOS from './triagem.casos.json'

// Os MESMOS casos que o servidor usa (backend/src/triagem-dados.spec.ts). Se a
// tela e o servidor discordarem, o advogado escreve a pergunta, vê "tudo certo" e
// o salvar falha — ou, pior, a tela avisa e o servidor grava.

const casos = CASOS as { pergunta: string; achados: string[] }[]

describe('o que a pergunta está pedindo — casos compartilhados com o servidor', () => {
  it('há casos limpos, de aviso e de bloqueio (o teste não passa por não ter o que testar)', () => {
    expect(casos.some((c) => !c.achados.length)).toBe(true)
    expect(casos.some((c) => c.achados.some((a) => a.endsWith(':aviso')))).toBe(true)
    expect(casos.some((c) => c.achados.some((a) => a.endsWith(':bloqueio')))).toBe(true)
  })

  it.each(casos.map((c) => [c.pergunta, c.achados] as const))('%s', (pergunta, achados) => {
    expect(conferirPergunta(pergunta).map((a) => `${a.tipo}:${a.risco}`)).toEqual(achados)
  })
})

describe('as palavras que NÃO podem ser barradas sozinhas', () => {
  // A regra do §5 do pedido: "processo" e "documento" são vocabulário normal de
  // uma triagem. Barrá-los cegamente impediria a pergunta mais comum que existe.
  it('“processo” sozinho passa; “número do processo” avisa', () => {
    expect(conferirPergunta('Você já tem processo sobre isso?')).toEqual([])
    expect(conferirPergunta('Qual o número do processo?')[0]?.tipo).toBe('processo')
  })

  it('“documento” sozinho passa; pedir para enviar um avisa', () => {
    expect(conferirPergunta('Você tem documentos sobre o caso?')).toEqual([])
    expect(conferirPergunta('Mande cópia dos documentos')[0]?.tipo).toBe('documento')
  })

  // A fronteira \b do JavaScript é ASCII: com ela, "rg" casa DENTRO de "órgão".
  // Foi o defeito que já desligou uma vedação em silêncio no motor da OAB.
  it('“órgão” não vira um pedido de RG', () => {
    expect(conferirPergunta('O órgão respondeu?')).toEqual([])
    expect(conferirPergunta('Qual seu RG?')[0]?.tipo).toBe('documento')
  })

  it('“raça” não é achada dentro de “praça” nem de “graça”', () => {
    expect(conferirPergunta('Os fatos ocorreram na praça central?')).toEqual([])
    expect(conferirPergunta('Qual a sua raça?')[0]?.tipo).toBe('sensivel')
  })
})

describe('o que o servidor recusa gravar', () => {
  it('só credencial, cartão e conta bancária bloqueiam', () => {
    expect(perguntaBloqueada({ label: 'Qual a sua senha?' })?.tipo).toBe('credencial')
    expect(perguntaBloqueada({ label: 'Número do cartão de crédito' })?.tipo).toBe('cartao')
    expect(perguntaBloqueada({ label: 'Qual sua chave Pix?' })?.tipo).toBe('bancario')
  })

  it('o resto é aviso, e aviso nunca impede de salvar', () => {
    for (const pergunta of ['Qual o seu CPF?', 'Qual seu salário?', 'Onde você mora?']) {
      expect(conferirPergunta(pergunta).length).toBeGreaterThan(0)
      expect(perguntaBloqueada({ label: pergunta })).toBeNull()
    }
  })

  it('pergunta vazia não gera apontamento', () => {
    expect(conferirPergunta('')).toEqual([])
    expect(conferirPergunta('   ')).toEqual([])
    expect(perguntaBloqueada({ label: '' })).toBeNull()
  })
})

describe('cada apontamento sabe se explicar', () => {
  it('traz o trecho, o motivo e uma reescrita pronta', () => {
    const [achado] = conferirPergunta('Qual o seu CPF?')
    expect(achado.trecho.toLowerCase()).toBe('cpf')
    expect(achado.motivo.length).toBeGreaterThan(20)
    expect(achado.sugestao.trim()).not.toBe('')
  })

  it('o mesmo tipo não aparece duas vezes na mesma pergunta', () => {
    const achados = conferirPergunta('Informe CPF, RG e CNH')
    expect(achados.filter((a) => a.tipo === 'documento')).toHaveLength(1)
  })
})

describe('a brecha da opção de resposta', () => {
  it('o bloqueio vale para a pergunta INTEIRA, não só para o enunciado', () => {
    const pergunta = {
      label: 'Qual informação você quer enviar?',
      options: [{ texto: 'Minha senha do banco' }],
    }
    expect(perguntaBloqueada({ label: pergunta.label })).toBeNull()
    expect(perguntaBloqueada(pergunta)?.tipo).toBe('credencial')
  })

  it('cada tipo aparece uma vez só, mesmo repetido entre enunciado e opções', () => {
    const achados = conferirPerguntaInteira({
      label: 'Qual o seu CPF?',
      options: [{ texto: 'Mando o CPF' }, { texto: 'Mando o RG' }],
    })
    expect(achados.filter((a) => a.tipo === 'documento')).toHaveLength(1)
  })

  it('pergunta limpa com opções limpas não gera apontamento', () => {
    expect(
      conferirPerguntaInteira({
        label: 'Qual assunto?',
        options: [{ texto: 'Família' }, { texto: 'Cível' }],
      }),
    ).toEqual([])
    expect(conferirPerguntaInteira({})).toEqual([])
  })
})
