// O botão no canto do perfil: qual aparece, e o que ele deliberadamente não é.
//
// ---------------------------------------------------------------------------
// O PEDIDO, E O QUE FOI CONSTRUÍDO NO LUGAR
//
// O recurso nasceu de uma referência: um widget de canto que abre com
// "Olá! Vamos conversar? Me informe seu nome e telefone para iniciarmos uma
// conversa sem compromisso :)", com campo de nome, campo de telefone e caixa de
// consentimento.
//
// O que existe aqui é o atalho SEM a captura — para o assistente ou, desde
// 13/09/2026, para o WhatsApp. Duas razões independentes, e cada uma sozinha já
// bastaria:
//
//   1. REGRAS.md, sobre a Cartilha do CFOAB: "'caixas de perguntas' e chats não
//      podem ser usados para capturar clientes disfarçadamente". Quem responde
//      pela captação é o advogado, na esfera disciplinar.
//   2. A plataforma não guarda dado de visitante — foi por isso que a agenda
//      nativa saiu do produto em 21/08/2026, e ela guardava exatamente nome,
//      WhatsApp e assunto de quem procurava um advogado.
//
// Estes testes são o que impede alguém de reintroduzir a captura mais tarde sem
// perceber o que está reintroduzindo.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest'
import { BALAO_ROTULO, BALAO_ROTULO_WHATSAPP, pinturaDoBalao } from './BalaoDeConversa'
import { TINTA_SOBRE_O_VERDE, VERDE_WHATSAPP } from '@/lib/whatsapp'
import { botaoFlutuante, botaoFlutuanteEscolhido } from '@/lib/botaoFlutuante'
import { checkCompliance } from '@/lib/oab'
import type { Profile } from '@/lib/types'

type P = Pick<Profile, 'floating' | 'assistant' | 'plan'>
const perfil = (over: Record<string, unknown> = {}) => ({ plan: 'pro', ...over }) as unknown as P

/** Tudo o que os dois botões precisam: assistente ligado e número que serve. */
const tudo = { schedulingMode: 'assistant', temWhatsapp: true }

describe('qual botão aparece', () => {
  it('NÃO aparece nenhum por padrão — ligar é ato deliberado', () => {
    // Um elemento que persegue o visitante é o oposto da sobriedade que o
    // Prov. 205/2021 pede. Ele não pode nascer ligado em perfil nenhum.
    expect(botaoFlutuante(perfil(), tudo)).toBeNull()
    expect(botaoFlutuante(perfil({ floating: 'off' }), tudo)).toBeNull()
  })

  it('o WhatsApp aparece com número que serve — e não depende do agendamento', () => {
    expect(botaoFlutuante(perfil({ floating: 'whatsapp' }), tudo)).toBe('whatsapp')
    expect(
      botaoFlutuante(perfil({ floating: 'whatsapp' }), { schedulingMode: 'off', temWhatsapp: true }),
    ).toBe('whatsapp')
  })

  it('o WhatsApp sem número não aparece — seria um atalho para lugar nenhum', () => {
    expect(
      botaoFlutuante(perfil({ floating: 'whatsapp' }), { ...tudo, temWhatsapp: false }),
    ).toBeNull()
  })

  it('o assistente só aparece com o assistente como modo de agendamento', () => {
    expect(botaoFlutuante(perfil({ floating: 'assistant' }), tudo)).toBe('assistant')
    for (const modo of ['off', 'whatsapp', 'external']) {
      expect(
        botaoFlutuante(perfil({ floating: 'assistant' }), { ...tudo, schedulingMode: modo }),
      ).toBeNull()
    }
  })

  it('nunca os dois: a escolha é uma só', () => {
    expect(botaoFlutuante(perfil({ floating: 'assistant' }), tudo)).not.toBe('whatsapp')
    expect(botaoFlutuante(perfil({ floating: 'whatsapp' }), tudo)).not.toBe('assistant')
  })

  it('fora do Pro e do Max, nenhum — a segunda camada da trava do servidor', () => {
    expect(botaoFlutuante(perfil({ plan: 'free', floating: 'whatsapp' }), tudo)).toBeNull()
    expect(botaoFlutuante(perfil({ plan: 'free', floating: 'assistant' }), tudo)).toBeNull()
  })
})

describe('perfil de antes da escolha', () => {
  it('quem tinha o balão do assistente ligado continua com ele', () => {
    expect(botaoFlutuanteEscolhido(perfil({ assistant: { floating: true } }))).toBe('assistant')
    expect(botaoFlutuante(perfil({ assistant: { floating: true } }), tudo)).toBe('assistant')
  })

  it('a escolha nova vence o balão antigo', () => {
    expect(botaoFlutuanteEscolhido(perfil({ floating: 'off', assistant: { floating: true } }))).toBe('off')
  })

  it('valor caído do corpo da requisição não liga nada', () => {
    for (const lixo of ['sim', true, 1, {}, 'WHATSAPP']) {
      expect(botaoFlutuante(perfil({ floating: lixo }), tudo)).toBeNull()
    }
    expect(botaoFlutuante(perfil({ assistant: { floating: 'true' } }), tudo)).toBeNull()
  })
})

describe('o texto dos botões é publicidade de advogado', () => {
  for (const rotulo of [BALAO_ROTULO, BALAO_ROTULO_WHATSAPP]) {
    it(`"${rotulo}" passa na mesma checagem de conformidade do resto do perfil`, () => {
      expect(checkCompliance(rotulo)).toEqual([])
    })

    it(`"${rotulo}" não usa o vocabulário que a norma veda`, () => {
      const texto = rotulo.toLowerCase()
      // "sem compromisso" e "grátis" são apelo comercial pelos mesmos critérios
      // (Prov. 205/2021 Art. 3º, I); "agora"/"já" são chamada imperativa
      // (CED art. 42, V). A frase da referência tinha a primeira.
      for (const proibido of [
        'sem compromisso',
        'grátis',
        'gratuita',
        'agora',
        'já',
        'garanta',
        'contrate',
        'não perca',
      ]) {
        expect(texto, `o botão diz "${proibido}"`).not.toContain(proibido)
      }
    })
  }

  it('descrevem o que acontece ao tocar, e não o que se quer que a pessoa faça', () => {
    expect(BALAO_ROTULO).toBe('Agendar uma conversa')
    // O mesmo texto do botão de WhatsApp do corpo da página.
    expect(BALAO_ROTULO_WHATSAPP).toBe('Conversar no WhatsApp')
  })
})

describe('o balão não coleta nada', () => {
  it('o componente não tem campo de entrada nenhum', async () => {
    // Lê o próprio fonte. É grosseiro de propósito: o que precisa ser garantido
    // aqui não é o comportamento de um render, é a AUSÊNCIA de um formulário —
    // e um teste de render passaria alegremente no dia em que alguém
    // acrescentasse um campo atrás de um estado.
    const { readFileSync } = await import('node:fs')
    const fonte = readFileSync(new URL('./BalaoDeConversa.tsx', import.meta.url), 'utf8')
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    for (const tag of ['<input', '<textarea', '<form', '<select']) {
      expect(codigo, `o balão passou a conter ${tag} — isso é captura de dado de visitante`).not.toContain(tag)
    }
  })
})

describe('a cor do balão', () => {
  // A cena que originou esta trava (13/09/2026): um perfil no tema Marinho com
  // cor de marca roxa — a página roxa, e o balão de WhatsApp BEGE, a cor de
  // acento do tema. Ninguém reconhecia aquilo como WhatsApp.
  it('o WhatsApp é verde em todo tema, e não a cor de acento do perfil', () => {
    const p = pinturaDoBalao('whatsapp')
    expect(p.background).toBe(VERDE_WHATSAPP)
    expect(p.color).toBe(TINTA_SOBRE_O_VERDE)
    expect(String(p.background)).not.toContain('var(')
  })

  it('o assistente é parte da página: acento do perfil com a tinta do tema', () => {
    // `--c-accent-ink` e não um branco fixo — sobre o acento claro do Marinho
    // (pedra) o rótulo branco sumia. Todo tema garante ≥ 4,5:1 nesse par
    // (themes.spec.ts).
    const p = pinturaDoBalao('assistant')
    expect(p.background).toBe('var(--c-accent)')
    expect(p.color).toBe('var(--c-accent-ink)')
  })
})
