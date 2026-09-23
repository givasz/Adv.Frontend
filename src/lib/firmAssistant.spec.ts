import { describe, expect, it } from 'vitest'
import {
  buildFirmAssistantMessage,
  FIRM_PERIODS,
  firmAlcancaAdvogado,
  firmAssistantDestination,
  firmAssistantWhatsapp,
  firmAssistantWhatsappHref,
  firmRecebeSemPreferencia,
  firmTemDestino,
  type AssistantDayOption,
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

// Quem escolhe um advogado que usa a agenda do assistente marca dia e HORÁRIO —
// e a mensagem tem de levar isso, não a pergunta de período que ficou para trás.
describe('horário da agenda do advogado', () => {
  const dia: AssistantDayOption = {
    key: '2026-11-25',
    date: new Date(2026, 10, 25),
    weekday: 3,
    label: 'qua, 25 nov',
    longLabel: 'quarta-feira, 25 de novembro',
    relative: '',
    times: ['14:00'],
  }

  it('com horário escolhido, a mensagem leva dia, hora e duração — e não o período', () => {
    const msg = buildFirmAssistantMessage(
      'Andrade & Vieira',
      { lawyer: 'Ana Beatriz', day: dia, time: '14:00', period: 'Tanto faz', name: 'Rita' },
      60,
    )
    expect(msg).toContain('Dia e horário: quarta-feira, 25 de novembro às 14:00')
    expect(msg).toContain('Duração prevista: 60 min')
    expect(msg).not.toContain('Preferência de horário')
  })

  it('sem horário, segue com a preferência de período e sem duração', () => {
    const msg = buildFirmAssistantMessage('Andrade & Vieira', { period: 'Tanto faz' }, 60)
    expect(msg).toContain('Preferência de horário: Tanto faz')
    expect(msg).not.toContain('Duração prevista')
  })
})

describe('advogados com o mesmo nome', () => {
  it('o pedido segue o id escolhido, não o primeiro nome igual', () => {
    const f = {
      ...escritorio,
      assistantRoute: 'lawyer',
      lawyers: [
        { id: 'a', name: 'Ana Souza', whatsapp: '5511911111111' },
        { id: 'b', name: 'Ana Souza', whatsapp: '5511922222222' },
      ],
    }
    expect(firmAssistantWhatsapp(f, { lawyer: 'Ana Souza', lawyerId: 'b' })).toBe('5511922222222')
  })
})

describe('para onde o pedido pode ir', () => {
  it('sem WhatsApp do escritório e sem rota por advogado, não há destino', () => {
    expect(firmTemDestino({ ...escritorio, contact: {} })).toBe(false)
  })

  it('com rota por advogado, basta um advogado com número — mas "tanto faz" não chega', () => {
    const f = { ...escritorio, contact: {}, assistantRoute: 'lawyer' }
    expect(firmTemDestino(f)).toBe(true)
    expect(firmRecebeSemPreferencia(f)).toBe(false)
    expect(firmAlcancaAdvogado(f, escritorio.lawyers[0])).toBe(true)
    expect(firmAlcancaAdvogado(f, escritorio.lawyers[1])).toBe(false)
  })

  it('número que não serve para o WhatsApp não é anunciado como destino direto', () => {
    const f = {
      ...escritorio,
      assistantRoute: 'lawyer',
      lawyers: [{ name: 'Ana Beatriz', whatsapp: '12' }],
    }
    expect(firmAssistantDestination(f, { lawyer: 'Ana Beatriz' }).direct).toBe(false)
  })
})

// A caixa de solicitações vale nas DUAS pontas, e a ordem entre elas é o que
// mantém cada um dono da própria decisão: `assistantRoute` é a escolha do
// escritório sobre a própria página; dentro do que ele delega, a caixa do
// advogado é a escolha dele sobre onde receber.
describe('caixa de solicitações', () => {
  const comCaixa = {
    ...escritorio,
    lawyers: [
      { id: 'a', name: 'Ana Beatriz', whatsapp: '5511911111111', meetingInbox: true },
      { id: 'c', name: 'Carlos Andrade' },
    ],
  }

  it('delegando ao advogado, a caixa DELE vence o WhatsApp dele', () => {
    const d = firmAssistantDestination(
      { ...comCaixa, assistantRoute: 'lawyer' },
      { lawyerId: 'a', lawyer: 'Ana Beatriz' },
    )
    expect(d.inbox).toBe('lawyer')
    expect(d.label).toBe('Ana Beatriz')
    expect(d.whatsapp).toBeUndefined()
  })

  it('sem delegar, a caixa do advogado não tira o pedido do escritório', () => {
    // `assistantRoute` institucional é o escritório dizendo que os pedidos são
    // dele. A caixa do advogado não passa por cima disso.
    const d = firmAssistantDestination(comCaixa, { lawyerId: 'a', lawyer: 'Ana Beatriz' })
    expect(d.inbox).toBe(null)
    expect(d.whatsapp).toBe('5511990000000')
  })

  it('com a caixa da sociedade ligada, o pedido vai para ela e não para o WhatsApp', () => {
    const d = firmAssistantDestination({ ...comCaixa, meetingInboxEnabled: true }, {})
    expect(d.inbox).toBe('firm')
    expect(d.whatsapp).toBeUndefined()
  })

  it('caixa da sociedade é destino: escritório sem WhatsApp nenhum deixa de ser beco sem saída', () => {
    const f = { ...escritorio, contact: {}, meetingInboxEnabled: true }
    expect(firmTemDestino(f)).toBe(true)
    expect(firmRecebeSemPreferencia(f)).toBe(true)
  })

  it('advogado sem número mas com caixa é alcançável quando o escritório delega', () => {
    const f = {
      ...escritorio,
      contact: {},
      assistantRoute: 'lawyer',
      lawyers: [{ id: 'x', name: 'Rita Alves', meetingInbox: true }],
    }
    expect(firmAlcancaAdvogado(f, f.lawyers[0])).toBe(true)
    // Sem preferência continua não chegando: a sociedade não tem canal nenhum.
    expect(firmRecebeSemPreferencia(f)).toBe(false)
  })

  it('destino por caixa não gera link de WhatsApp', () => {
    const f = { ...escritorio, contact: {}, meetingInboxEnabled: true }
    expect(firmAssistantWhatsappHref(f, { name: 'Rita' })).toBeUndefined()
  })
})

// A triagem do advogado escolhido entra na mensagem exatamente como entra na do
// perfil dele: é a mesma triagem, e só a porta de entrada mudou.
describe('triagem na mensagem do escritório', () => {
  it('as respostas viajam com o pedido, com a ressalva de que não são análise', () => {
    const msg = buildFirmAssistantMessage('Andrade & Vieira', {
      lawyer: 'Ana Beatriz',
      name: 'Rita',
      triagem: [{ id: 't1', pergunta: 'A empresa já foi formalizada?', resposta: 'Ainda não' }],
    })
    expect(msg).toContain('A empresa já foi formalizada?')
    expect(msg).toContain('Ainda não')
    expect(msg).toContain('Não são análise jurídica.')
  })

  it('sem triagem, a mensagem não ganha bloco nenhum', () => {
    const msg = buildFirmAssistantMessage('Andrade & Vieira', { name: 'Rita' })
    expect(msg).not.toContain('Triagem')
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
    expect(d).toEqual({
      whatsapp: '5511911111111',
      label: 'Ana Beatriz',
      direct: true,
      inbox: null,
    })
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
