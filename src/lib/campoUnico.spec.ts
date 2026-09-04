// A trava de "um assunto por campo".
//
// Ela existe porque um limite de CONTAGEM sozinho não segura nada: o Free entrega
// uma área e uma pergunta, e quem quiser três escreve as três dentro do campo
// único. A cota fica intacta no banco e furada na tela.
//
// Os testes aqui guardam os dois lados da régua, e o segundo importa mais que o
// primeiro: pegar enumeração é fácil, o difícil é NÃO pegar nome legítimo. Uma
// trava que reprova "Direito de Família e Sucessões" faz o advogado brigar com o
// editor — e ele tem razão.

import { describe, expect, it } from 'vitest'
import { areaComMaisDeUma, perguntaComMaisDeUma } from './campoUnico'

describe('área: enumeração explícita é barrada', () => {
  const casos = [
    'Direito de Família, Sucessões',
    'Família; Sucessões',
    'Cível / Criminal',
    'Cível | Trabalhista',
    'Cível + Criminal',
    'Cível & Criminal',
    'Direito Civil - Consumidor',
    'Direito Civil – Consumidor',
    'Família • Sucessões',
  ]

  for (const caso of casos) {
    it(`barra "${caso}"`, () => {
      expect(areaComMaisDeUma(caso)).not.toBeNull()
    })
  }

  it('sugere ficar só com a primeira área, sem pontuação sobrando', () => {
    expect(areaComMaisDeUma('Direito de Família, Sucessões e Inventários')!.sugestao).toBe(
      'Direito de Família',
    )
    expect(areaComMaisDeUma('Cível / Criminal')!.sugestao).toBe('Cível')
  })
})

describe('área: nome legítimo passa — este é o lado que não pode falhar', () => {
  const legitimos = [
    'Direito de Família e Sucessões',
    'Direito Civil e Empresarial',
    'Direito do Trabalho',
    'Direito Previdenciário',
    'Direito Médico-Hospitalar',
    'Direito do Consumidor',
    'Direito Penal Econômico',
  ]

  for (const nome of legitimos) {
    it(`deixa passar "${nome}"`, () => {
      expect(areaComMaisDeUma(nome)).toBeNull()
    })
  }

  it('campo vazio e digitação pela metade não são erro', () => {
    // Barrar enquanto a pessoa AINDA está digitando é o jeito mais rápido de
    // fazer um aviso ser ignorado — quando o de verdade chegar, ninguém lê.
    expect(areaComMaisDeUma('')).toBeNull()
    expect(areaComMaisDeUma('   ')).toBeNull()
    expect(areaComMaisDeUma('Direito Civil,')).toBeNull()
  })
})

describe('pergunta: duas interrogações são duas perguntas', () => {
  it('barra e corta na primeira', () => {
    const p = perguntaComMaisDeUma('Quanto custa? Quanto tempo demora?')!
    expect(p).not.toBeNull()
    expect(p.sugestao).toBe('Quanto custa?')
  })

  it('uma pergunta só passa, com vírgula e tudo', () => {
    expect(perguntaComMaisDeUma('Quanto tempo demora um inventário, em média?')).toBeNull()
    expect(perguntaComMaisDeUma('Preciso de advogado para isso')).toBeNull()
    expect(perguntaComMaisDeUma('')).toBeNull()
  })

  it('o caso que ela NÃO pega, e que fica com o teto de caracteres', () => {
    // "Quanto custa e quanto demora?" tem uma interrogação só. Pegar isso exigiria
    // adivinhar semântica, e adivinhar erra contra quem escreveu certo. Está aqui
    // escrito para ninguém "consertar" a trava tentando cobrir este caso.
    expect(perguntaComMaisDeUma('Quanto custa e quanto tempo demora?')).toBeNull()
  })
})
