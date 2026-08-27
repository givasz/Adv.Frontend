import { describe, expect, it } from 'vitest'
import { diaCurto, horarioDePico, rotuloDoEvento } from './metricas'

describe('rótulos dos eventos', () => {
  it('traduz os botões do perfil', () => {
    expect(rotuloDoEvento('whatsapp')).toBe('Conversar no WhatsApp')
    expect(rotuloDoEvento('agendamento')).toBe('Agendar uma consulta')
    expect(rotuloDoEvento('cartao')).toBe('Salvou o contato')
  })

  it('traduz as redes sociais', () => {
    expect(rotuloDoEvento('rede:instagram')).toBe('Instagram')
    expect(rotuloDoEvento('rede:linkedin')).toBe('LinkedIn')
    expect(rotuloDoEvento('rede:website')).toBe('Site')
  })

  // A tela nunca pode mostrar uma chave técnica crua, mas também não pode
  // quebrar: uma rede nova no backend chega aqui antes de alguém traduzir.
  it('não quebra com um evento desconhecido', () => {
    expect(rotuloDoEvento('rede:mastodon')).toBe('mastodon')
    expect(rotuloDoEvento('coisa-nova')).toBe('coisa-nova')
  })
})

describe('horário de pico', () => {
  const horas = (pares: Record<number, number>) =>
    Array.from({ length: 24 }, (_, h) => pares[h] ?? 0)

  it('aponta a hora com mais visitas', () => {
    expect(horarioDePico(horas({ 9: 3, 14: 8, 20: 2 }))).toBe('14h–15h')
  })

  it('vira meia-noite corretamente', () => {
    expect(horarioDePico(horas({ 23: 9 }))).toBe('23h–00h')
  })

  // Com duas visitas no mês, dizer "seu horário de pico é 14h" é inventar padrão
  // a partir de ruído — e o advogado leria isso como informação para decidir algo.
  it('cala quando não há movimento que sustente a afirmação', () => {
    expect(horarioDePico(horas({ 14: 2 }))).toBeNull()
    expect(horarioDePico(horas({ 9: 2, 14: 2 }))).toBeNull()
    expect(horarioDePico(horas({}))).toBeNull()
  })

  it('fala a partir de cinco visitas', () => {
    expect(horarioDePico(horas({ 9: 2, 14: 3 }))).toBe('14h–15h')
  })
})

describe('rótulo do dia', () => {
  it('formata a data no padrão brasileiro', () => {
    expect(diaCurto('2026-08-27')).toBe('27/08')
    // Sem fuso no meio: a chave é montada no servidor como AAAA-MM-DD e lida
    // aqui como data local. Um `new Date('2026-08-01')` cru viraria 31/07 a
    // oeste de Greenwich — e o gráfico inteiro andaria um dia para trás.
    expect(diaCurto('2026-08-01')).toBe('01/08')
  })
})
