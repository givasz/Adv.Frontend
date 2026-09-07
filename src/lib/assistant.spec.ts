import { describe, expect, it } from 'vitest'
import {
  assistantDayAt,
  assistantTitle,
  buildAssistantDays,
  buildAssistantMessage,
  busyKey,
  falaDoEnderecoPresencial,
  formatBusyLong,
  formatBusyShort,
  normalizeBusy,
  normalizeTimes,
  parseBrDate,
  resolveAssistantConfig,
  weeklySlotCount,
} from './assistant'
import type { AssistantConfig } from './types'

// 2026-08-19 é uma quarta-feira (weekday 3), 10:00 no fuso local.
const QUARTA_10H = new Date(2026, 7, 19, 10, 0, 0, 0)

const config = (over: Partial<AssistantConfig> = {}): AssistantConfig => ({
  days: [{ weekday: 3, times: ['09:00', '14:00'] }],
  durationMin: 45,
  leadHours: 2,
  horizonDays: 0,
  greeting: '',
  ...over,
})

describe('normalizeTimes', () => {
  it('ordena, deduplica e descarta entradas inválidas', () => {
    expect(normalizeTimes(['14:00', '9:30', '14:00', 'x', '25:00', '08:75'])).toEqual([
      '09:30',
      '14:00',
    ])
  })
})

describe('resolveAssistantConfig', () => {
  it('descarta dias sem horário válido e fora do intervalo 0–6', () => {
    const cfg = resolveAssistantConfig({
      ...config(),
      days: [
        { weekday: 9, times: ['10:00'] },
        { weekday: 2, times: ['nada'] },
        { weekday: 1, times: ['10:00'] },
      ],
    })
    expect(cfg.days).toEqual([{ weekday: 1, times: ['10:00'] }])
  })

  it('limita valores absurdos aos padrões seguros', () => {
    const cfg = resolveAssistantConfig(config({ durationMin: 9999, horizonDays: -3 }))
    expect(cfg.durationMin).toBe(180)
    expect(cfg.horizonDays).toBe(1)
  })
})

describe('buildAssistantDays', () => {
  it('respeita a antecedência mínima — horário que já passou não é oferecido', () => {
    const days = buildAssistantDays(config(), QUARTA_10H)
    expect(days).toHaveLength(1)
    expect(days[0].times).toEqual(['14:00'])
    expect(days[0].relative).toBe('hoje')
    expect(days[0].longLabel).toBe('quarta-feira, 19 de agosto')
  })

  it('some com o dia quando nenhum horário sobra', () => {
    expect(buildAssistantDays(config({ leadHours: 12 }), QUARTA_10H)).toHaveLength(0)
  })

  it('só oferece os dias da semana configurados, dentro do horizonte', () => {
    const days = buildAssistantDays(
      config({ days: [{ weekday: 1, times: ['09:00'] }], horizonDays: 14 }),
      QUARTA_10H,
    )
    expect(days.map((d) => d.weekday)).toEqual([1, 1])
    expect(days[0].label).toBe('seg, 24 ago')
  })
})

describe('weeklySlotCount', () => {
  it('soma os horários de todos os dias', () => {
    expect(
      weeklySlotCount(
        resolveAssistantConfig(
          config({
            days: [
              { weekday: 1, times: ['09:00', '10:00'] },
              { weekday: 3, times: ['14:00'] },
            ],
          }),
        ),
      ),
    ).toBe(3)
  })
})

describe('buildAssistantMessage', () => {
  const profile = { name: 'Marina Sales' }
  const day = buildAssistantDays(config(), QUARTA_10H)[0]

  it('monta a mensagem com o que foi escolhido, sem linhas vazias de campos ausentes', () => {
    const msg = buildAssistantMessage(
      profile,
      { day, time: '14:00', format: 'online', subject: 'Direito de Família', name: 'Ana' },
      45,
    )
    expect(msg).toContain('Olá, Marina!')
    expect(msg).toContain('Dia e horário: quarta-feira, 19 de agosto às 14:00')
    expect(msg).toContain('Formato: Online')
    expect(msg).toContain('Assunto: Direito de Família')
    expect(msg).not.toContain('Detalhe:')
  })

  it('não promete nem confirma nada — só pede confirmação', () => {
    const msg = buildAssistantMessage(profile, { day, time: '14:00' })
    expect(msg).toContain('Fico no aguardo da sua confirmação.')
    expect(msg).not.toMatch(/garant|urgente|desconto|grátis/i)
  })
})

describe('assistantTitle', () => {
  it('sempre deixa claro que é um assistente virtual', () => {
    expect(assistantTitle({ name: 'Pedro Almeida' })).toBe('Assistente virtual de Pedro')
    expect(assistantTitle({ name: '' })).toBe('Assistente virtual')
  })
})

describe('falaDoEnderecoPresencial', () => {
  const local = {
    city: 'São Paulo',
    state: 'SP',
    address: {
      cep: '01310100',
      rua: 'Av. Paulista',
      numero: '1000',
      complemento: 'Conj. 121',
      bairro: 'Bela Vista',
    },
  }

  it('diz o endereço inteiro, com a cidade', () => {
    // Com cidade, ao contrário da linha do perfil: o histórico da conversa é
    // lido (e fotografado) longe do cabeçalho da página.
    expect(falaDoEnderecoPresencial(local)).toBe(
      'O atendimento presencial é em Av. Paulista, 1000 — Conj. 121, Bela Vista, São Paulo/SP · 01310-100.',
    )
  })

  it('cala quando o advogado escondeu o endereço', () => {
    // O interruptor de privacidade vale na conversa também — seria o caminho
    // mais silencioso de publicar o endereço de quem atende em casa.
    expect(falaDoEnderecoPresencial({ ...local, address: { ...local.address, publico: false } })).toBe('')
  })

  it('cala quando não há endereço, e a conversa segue como antes', () => {
    expect(falaDoEnderecoPresencial({ city: 'Curitiba', state: 'PR' })).toBe('')
    expect(falaDoEnderecoPresencial({ city: 'Curitiba', state: 'PR', address: { bairro: 'Centro' } })).toBe('')
  })

  it('não tem nada de captação — é fala operacional', () => {
    expect(falaDoEnderecoPresencial(local)).not.toMatch(/venha|garant|melhor|atendimento exclusivo/i)
  })
})

// ---- Horários ocupados ------------------------------------------------------
//
// O advogado marcou por fora um horário que a grade continua oferecendo. Estes
// testes cobrem as duas pontas: o que entra na lista e o que some da conversa.

describe('normalizeBusy', () => {
  it('descarta formato inválido, data que não existe e horário impossível', () => {
    expect(
      normalizeBusy(
        ['2026-08-20T14:00', '2026-02-31T10:00', '20/08/2026', '2026-08-20T25:00', 42, null],
        QUARTA_10H,
      ),
    ).toEqual(['2026-08-20T14:00'])
  })

  it('joga o passado fora — a lista encolhe sozinha, sem faxina agendada', () => {
    const lista = ['2026-08-18T09:00', '2026-08-19T09:00', '2026-08-20T09:00']
    // 19/08 é HOJE na conversa: o dia de hoje fica, o de ontem sai.
    expect(normalizeBusy(lista, QUARTA_10H)).toEqual(['2026-08-19T09:00', '2026-08-20T09:00'])
  })

  it('ordena e deduplica', () => {
    expect(
      normalizeBusy(['2026-08-26T14:00', '2026-08-19T09:00', '2026-08-26T14:00'], QUARTA_10H),
    ).toEqual(['2026-08-19T09:00', '2026-08-26T14:00'])
  })
})

describe('buildAssistantDays com horários ocupados', () => {
  it('esconde só o horário marcado, e só naquela data', () => {
    const cfg = config({ horizonDays: 14, busy: [busyKey('2026-08-26', '09:00')] })
    const dias = buildAssistantDays(cfg, QUARTA_10H)
    expect(dias.map((d) => [d.key, d.times])).toEqual([
      // hoje: 09:00 já não respeita a antecedência mínima
      ['2026-08-19', ['14:00']],
      // a quarta marcada perde só o horário marcado
      ['2026-08-26', ['14:00']],
      // e a quarta seguinte volta inteira: o que se marca é uma DATA, não um
      // dia da semana — a grade nunca é alterada.
      ['2026-09-02', ['09:00', '14:00']],
    ])
  })

  it('some com o dia inteiro quando não sobra horário livre', () => {
    const cfg = config({
      horizonDays: 7,
      busy: [busyKey('2026-08-26', '09:00'), busyKey('2026-08-26', '14:00')],
    })
    const dias = buildAssistantDays(cfg, QUARTA_10H)
    expect(dias.map((d) => d.key)).toEqual(['2026-08-19'])
  })
})

describe('assistantDayAt', () => {
  it('devolve os horários livres de uma data além do horizonte oferecido', () => {
    // horizonDays 0: a conversa pública só oferece hoje. O advogado ainda assim
    // marca um compromisso da quarta seguinte.
    const dia = assistantDayAt(config(), '2026-08-26', QUARTA_10H)
    expect(dia?.times).toEqual(['09:00', '14:00'])
  })

  it('não devolve dia que ele não atende, data passada nem data inexistente', () => {
    expect(assistantDayAt(config(), '2026-08-20', QUARTA_10H)).toBeNull() // quinta
    expect(assistantDayAt(config(), '2026-08-12', QUARTA_10H)).toBeNull() // quarta passada
    expect(assistantDayAt(config(), '2026-02-31', QUARTA_10H)).toBeNull()
  })

  it('não devolve dia cujos horários já foram todos marcados', () => {
    const cfg = config({ busy: [busyKey('2026-08-26', '09:00'), busyKey('2026-08-26', '14:00')] })
    expect(assistantDayAt(cfg, '2026-08-26', QUARTA_10H)).toBeNull()
  })
})

describe('parseBrDate', () => {
  it('lê o que o advogado digita', () => {
    expect(parseBrDate('25/11', QUARTA_10H)).toBe('2026-11-25')
    expect(parseBrDate('5.9.2027', QUARTA_10H)).toBe('2027-09-05')
    expect(parseBrDate('25-11-27', QUARTA_10H)).toBe('2027-11-25')
  })

  it('sem ano, nunca marca para trás — pula para o ano seguinte', () => {
    // 10/08 já passou em 19/08/2026: quem escreve isso quer 2027.
    expect(parseBrDate('10/08', QUARTA_10H)).toBe('2027-08-10')
  })

  it('recusa o que não é data', () => {
    expect(parseBrDate('31/02', QUARTA_10H)).toBeNull()
    expect(parseBrDate('amanhã', QUARTA_10H)).toBeNull()
    expect(parseBrDate('25/13', QUARTA_10H)).toBeNull()
  })
})

describe('rótulos de um horário ocupado', () => {
  it('escreve por extenso e curto', () => {
    expect(formatBusyLong('2026-11-25T14:00')).toBe('quarta-feira, 25 de novembro às 14:00')
    expect(formatBusyShort('2026-11-25T14:00')).toBe('25 nov · 14:00')
  })
})
