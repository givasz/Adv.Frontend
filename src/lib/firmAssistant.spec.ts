import { describe, expect, it } from 'vitest'
import {
  buildFirmAssistantMessage,
  FIRM_PERIODS,
  firmAssistantDestination,
  firmAssistantWhatsapp,
  firmAssistantWhatsappHref,
} from './assistant'

const escritorio = {
  name: 'Andrade & Vieira',
  contact: { whatsapp: '5511990000000' },
  lawyers: [
    { name: 'Ana Beatriz', whatsapp: '5511911111111' },
    { name: 'Carlos Andrade', whatsapp: undefined },
  ],
}

describe('mensagem do assistente do escritório', () => {
  it('leva os dados do pedido e nada além deles', () => {
    const msg = buildFirmAssistantMessage('Andrade & Vieira', {
      area: 'Direito de Família',
      lawyer: 'Ana Beatriz',
      format: 'online',
      period: 'Esta semana, de manhã',
      name: 'Marina',
    })
    expect(msg).toContain('Nome: Marina')
    expect(msg).toContain('Assunto: Direito de Família')
    expect(msg).toContain('Advogado(a): Ana Beatriz')
    expect(msg).toContain('Formato: Online')
    expect(msg).toContain('Preferência de horário: Esta semana, de manhã')
    expect(msg).toContain('Andrade & Vieira')
  })

  it('não promete resultado, prazo, preço nem urgência', () => {
    const msg = buildFirmAssistantMessage('Andrade & Vieira', {
      area: 'Trabalhista',
      period: 'Tanto faz',
      name: 'João',
    })
    expect(msg).not.toMatch(/garant|urgente|desconto|honorári|R\$|melhor advogad/i)
  })

  it('sem escolha de advogado, diz "sem preferência" — nunca indica alguém', () => {
    const msg = buildFirmAssistantMessage('Andrade & Vieira', { area: 'Empresarial', name: 'Rita' })
    expect(msg).toContain('Advogado(a): sem preferência')
  })
})

describe('destino do pedido', () => {
  it('padrão é o WhatsApp institucional', () => {
    expect(firmAssistantWhatsapp(escritorio, { lawyer: 'Ana Beatriz' })).toBe('5511990000000')
  })

  it('com rota por advogado, vai para quem foi escolhido', () => {
    const f = { ...escritorio, assistantRoute: 'lawyer' }
    expect(firmAssistantWhatsapp(f, { lawyer: 'Ana Beatriz' })).toBe('5511911111111')
  })

  it('advogado sem WhatsApp cai no institucional em vez de sumir com o pedido', () => {
    const f = { ...escritorio, assistantRoute: 'lawyer' }
    expect(firmAssistantWhatsapp(f, { lawyer: 'Carlos Andrade' })).toBe('5511990000000')
  })

  it('sem preferência de advogado, também vai para o institucional', () => {
    const f = { ...escritorio, assistantRoute: 'lawyer' }
    expect(firmAssistantWhatsapp(f, {})).toBe('5511990000000')
  })

  it('escritório sem WhatsApp nenhum não gera link', () => {
    const f = { ...escritorio, contact: {} }
    expect(firmAssistantWhatsappHref(f, { name: 'Rita' })).toBeUndefined()
  })

  it('o link já leva a mensagem montada', () => {
    const href = firmAssistantWhatsappHref(escritorio, { area: 'Família', name: 'Rita' })!
    expect(href.startsWith('https://wa.me/5511990000000?text=')).toBe(true)
    expect(decodeURIComponent(href)).toContain('Assunto: Família')
  })
})

describe('preferências de horário', () => {
  it('são períodos, não horários — a sociedade não tem agenda por advogado', () => {
    expect(FIRM_PERIODS.length).toBeGreaterThan(1)
    for (const p of FIRM_PERIODS) expect(p.label).not.toMatch(/\d{1,2}:\d{2}/)
  })
})

// O visitante precisa saber, ANTES de enviar, se vai cair no WhatsApp de uma pessoa
// ou no do escritório: a conversa mostra esse nome no resumo e no botão.
describe('nome do destino', () => {
  it('encaminhamento direto nomeia o advogado', () => {
    const d = firmAssistantDestination(
      { ...escritorio, assistantRoute: 'lawyer' },
      { lawyer: 'Ana Beatriz' },
    )
    expect(d).toEqual({ whatsapp: '5511911111111', label: 'Ana Beatriz', direct: true })
  })

  it('sem encaminhamento direto, o destino é o escritório', () => {
    const d = firmAssistantDestination(escritorio, { lawyer: 'Ana Beatriz' })
    expect(d.direct).toBe(false)
    expect(d.label).toBe('o escritório')
  })

  it('advogado sem número não é anunciado como destino', () => {
    const d = firmAssistantDestination(
      { ...escritorio, assistantRoute: 'lawyer' },
      { lawyer: 'Carlos Andrade' },
    )
    expect(d.direct).toBe(false)
    expect(d.whatsapp).toBe('5511990000000')
  })
})
