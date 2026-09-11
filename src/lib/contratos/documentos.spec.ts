import { describe, expect, it } from 'vitest'
import { cnpjConfere, cpfConfere, mascararCnpj, mascararCpf } from './documentos'

describe('CPF', () => {
  it('confere o dígito verificador', () => {
    expect(cpfConfere('529.982.247-25')).toBe(true)
    expect(cpfConfere('52998224725')).toBe(true)
    expect(cpfConfere('529.982.247-26')).toBe(false)
    // Sequência repetida passa na conta e não existe.
    expect(cpfConfere('111.111.111-11')).toBe(false)
    expect(cpfConfere('5299822472')).toBe(false)
  })

  it('mascara enquanto se digita', () => {
    expect(mascararCpf('529')).toBe('529')
    expect(mascararCpf('5299822')).toBe('529.982.2')
    expect(mascararCpf('52998224725999')).toBe('529.982.247-25')
  })
})

describe('CNPJ', () => {
  it('confere o dígito verificador', () => {
    expect(cnpjConfere('11.222.333/0001-81')).toBe(true)
    expect(cnpjConfere('11.222.333/0001-80')).toBe(false)
    expect(cnpjConfere('00.000.000/0000-00')).toBe(false)
  })

  it('mascara enquanto se digita', () => {
    expect(mascararCnpj('112223330001')).toBe('11.222.333/0001')
    expect(mascararCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })
})
