// O balão de conversa: quando aparece, e o que ele deliberadamente não é.
//
// ---------------------------------------------------------------------------
// O PEDIDO, E O QUE FOI CONSTRUÍDO NO LUGAR
//
// O recurso nasceu de uma referência: um widget de canto que abre com
// "Olá! Vamos conversar? Me informe seu nome e telefone para iniciarmos uma
// conversa sem compromisso :)", com campo de nome, campo de telefone e caixa de
// consentimento.
//
// O que existe aqui é o atalho SEM a captura. Duas razões independentes, e cada
// uma sozinha já bastaria:
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
import { balaoVisivel, BALAO_ROTULO } from './BalaoDeConversa'
import { checkCompliance } from '@/lib/oab'
import type { Profile } from '@/lib/types'

const perfil = (floating?: boolean) =>
  ({ assistant: { floating } }) as unknown as Pick<Profile, 'assistant'>

const ligado = { schedulingMode: 'assistant', podeAgendar: true }

describe('quando o balão aparece', () => {
  it('aparece quando o advogado ligou e o assistente é o modo escolhido', () => {
    expect(balaoVisivel(perfil(true), ligado)).toBe(true)
  })

  it('NÃO aparece por padrão — ligar é ato deliberado', () => {
    // Um elemento que persegue o visitante é o oposto da sobriedade que o
    // Prov. 205/2021 pede. Ele não pode nascer ligado em perfil nenhum.
    expect(balaoVisivel(perfil(undefined), ligado)).toBe(false)
    expect(balaoVisivel(perfil(false), ligado)).toBe(false)
    expect(balaoVisivel({} as Pick<Profile, 'assistant'>, ligado)).toBe(false)
  })

  it('só `true` liga — valor caído do corpo da requisição não vale', () => {
    for (const lixo of ['true', 1, 'sim', {}]) {
      expect(balaoVisivel(perfil(lixo as never), ligado)).toBe(false)
    }
  })

  it('não aparece quando o agendamento não é o assistente', () => {
    // Seria um atalho para uma conversa que não existe.
    for (const modo of ['off', 'whatsapp', 'external']) {
      expect(balaoVisivel(perfil(true), { ...ligado, schedulingMode: modo })).toBe(false)
    }
  })

  it('fica inerte na prévia do editor, como o resto do perfil', () => {
    expect(balaoVisivel(perfil(true), { ...ligado, podeAgendar: false })).toBe(false)
  })

  it('a trava de plano é do SERVIDOR, e o modo já a carrega', () => {
    // `schedulingMode` chega 'off' em perfil Free (resolveSchedulingMode chama
    // canUseScheduling), e o campo `floating` só vem `true` do backend em
    // Pro/Max. São duas camadas independentes, e a de fora é o servidor.
    expect(balaoVisivel(perfil(true), { schedulingMode: 'off', podeAgendar: true })).toBe(false)
  })
})

describe('o texto do balão é publicidade de advogado', () => {
  it('passa na mesma checagem de conformidade do resto do perfil', () => {
    expect(checkCompliance(BALAO_ROTULO)).toEqual([])
  })

  it('não usa o vocabulário que a norma veda', () => {
    const texto = BALAO_ROTULO.toLowerCase()
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
      expect(texto, `o balão diz "${proibido}"`).not.toContain(proibido)
    }
  })

  it('descreve o que acontece ao tocar, e não o que se quer que a pessoa faça', () => {
    expect(BALAO_ROTULO).toBe('Agendar uma conversa')
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
