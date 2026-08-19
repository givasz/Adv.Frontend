import { describe, expect, it } from 'vitest'
import {
  assistantTitle,
  buildAssistantDays,
  buildAssistantMessage,
  normalizeTimes,
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
