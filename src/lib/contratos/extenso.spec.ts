import { describe, expect, it } from 'vitest'
import { formatarReais, lerReais, numeroPorExtenso, reaisComExtenso, reaisPorExtenso } from './extenso'

// O extenso é o que desempata um número digitado errado — então ele não pode
// errar sozinho. Os casos abaixo são os que costumam sair tortos: "cem" x
// "cento", o "e" entre os grupos, "um milhão DE reais", concordância feminina.

describe('numeroPorExtenso', () => {
  it.each([
    [0, 'zero'],
    [1, 'um'],
    [10, 'dez'],
    [14, 'catorze'],
    [21, 'vinte e um'],
    [100, 'cem'],
    [101, 'cento e um'],
    [250, 'duzentos e cinquenta'],
    [1000, 'mil'],
    [1001, 'mil e um'],
    [1100, 'mil e cem'],
    [1250, 'mil duzentos e cinquenta'],
    [2005, 'dois mil e cinco'],
    [15000, 'quinze mil'],
    [1_000_000, 'um milhão'],
    [1_500_000, 'um milhão e quinhentos mil'],
    [2_300_040, 'dois milhões, trezentos mil e quarenta'],
  ])('%i → %s', (n, esperado) => {
    expect(numeroPorExtenso(n)).toBe(esperado)
  })

  it('concorda com substantivo feminino', () => {
    expect(numeroPorExtenso(2, { feminino: true })).toBe('duas')
    expect(numeroPorExtenso(12, { feminino: true })).toBe('doze')
    expect(numeroPorExtenso(21, { feminino: true })).toBe('vinte e uma')
    expect(numeroPorExtenso(200, { feminino: true })).toBe('duzentas')
  })
})

describe('reaisPorExtenso', () => {
  it.each([
    [100, 'um real'],
    [500000, 'cinco mil reais'],
    [150050, 'mil e quinhentos reais e cinquenta centavos'],
    [1, 'um centavo'],
    [50, 'cinquenta centavos'],
    [100000000, 'um milhão de reais'],
    [150000000, 'um milhão e quinhentos mil reais'],
  ])('%i centavos → %s', (c, esperado) => {
    expect(reaisPorExtenso(c)).toBe(esperado)
  })

  it('o número e o extenso saem do mesmo valor', () => {
    expect(reaisComExtenso(500000).replace(/ /g, ' ')).toBe('R$ 5.000,00 (cinco mil reais)')
    expect(formatarReais(150050).replace(/ /g, ' ')).toBe('R$ 1.500,50')
  })
})

describe('lerReais', () => {
  it.each([
    ['5000', 500000],
    ['5.000', 500000],
    ['5.000,00', 500000],
    ['R$ 5.000,50', 500050],
    ['5000.5', 500050],
    ['1.234.567,89', 123456789],
    ['350,00', 35000],
  ])('"%s" → %i centavos', (t, c) => {
    expect(lerReais(t)).toBe(c)
  })

  it('sem número é nulo', () => {
    expect(lerReais('')).toBeNull()
    expect(lerReais('R$')).toBeNull()
  })
})
