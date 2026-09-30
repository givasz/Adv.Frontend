import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bandeiraDoNumero,
  dataCurta,
  documentoValido,
  mascaraCartao,
  mascaraCep,
  mascaraDocumento,
  mascaraTelefone,
  mascaraValidade,
  reais,
} from './pagamento'

describe('CPF e CNPJ — a mesma conta do servidor', () => {
  it('aceita os válidos com e sem pontuação', () => {
    expect(documentoValido('529.982.247-25')).toBe(true)
    expect(documentoValido('52998224725')).toBe(true)
    expect(documentoValido('69.366.280/0001-52')).toBe(true)
  })

  it('recusa dígito errado, sequência repetida e tamanho errado', () => {
    expect(documentoValido('529.982.247-24')).toBe(false)
    expect(documentoValido('111.111.111-11')).toBe(false)
    expect(documentoValido('69.366.280/0001-53')).toBe(false)
    expect(documentoValido('1234')).toBe(false)
  })
})

describe('máscaras enquanto digita', () => {
  it('o mesmo campo vira CPF ou CNPJ conforme a quantidade de dígitos', () => {
    expect(mascaraDocumento('52998224725')).toBe('529.982.247-25')
    expect(mascaraDocumento('529982')).toBe('529.982')
    expect(mascaraDocumento('69366280000152')).toBe('69.366.280/0001-52')
  })

  it('aceita colagem com qualquer pontuação', () => {
    expect(mascaraCartao('4444-4444 4444.4444')).toBe('4444 4444 4444 4444')
    expect(mascaraCep('80420 210')).toBe('80420-210')
  })

  it('validade, telefone fixo e celular', () => {
    expect(mascaraValidade('1230')).toBe('12/30')
    expect(mascaraValidade('1')).toBe('1')
    expect(mascaraTelefone('4133334444')).toBe('(41) 3333-4444')
    expect(mascaraTelefone('41999998888')).toBe('(41) 99999-8888')
  })

  it('data e valor para exibir', () => {
    expect(dataCurta('2026-10-29')).toBe('29/10/2026')
    expect(dataCurta(undefined)).toBe('')
    expect(reais(49)).toBe('R$ 49,00')
  })
})

describe('bandeira reconhecida enquanto digita', () => {
  it('reconhece as bandeiras pelos primeiros dígitos, com ou sem espaço', () => {
    expect(bandeiraDoNumero('4444 4444')).toBe('visa')
    expect(bandeiraDoNumero('5184 0197')).toBe('mastercard')
    expect(bandeiraDoNumero('2221 00')).toBe('mastercard')
    expect(bandeiraDoNumero('3782 822463')).toBe('amex')
    expect(bandeiraDoNumero('6062 8255')).toBe('hipercard')
  })
  it('Elo antes de Visa e Mastercard, que dividem faixas com ela', () => {
    expect(bandeiraDoNumero('4389 35')).toBe('elo')
    expect(bandeiraDoNumero('5067 00')).toBe('elo')
    expect(bandeiraDoNumero('6363 68')).toBe('elo')
  })
  it('sem dígitos ou faixa desconhecida: nenhuma bandeira', () => {
    expect(bandeiraDoNumero('')).toBeNull()
    expect(bandeiraDoNumero('9999')).toBeNull()
  })
})

describe('o checkout não guarda o que se digita', () => {
  // A tela recebe número de cartão e CPF. Nenhum dos arquivos do pagamento pode
  // escrever em armazenamento do navegador — a regra "salvar antes de sair" dos
  // editores não vale aqui.
  const arquivos = [
    'lib/pagamento.ts',
    'components/checkout/CheckoutPago.tsx',
    'components/checkout/CamposDoCartao.tsx',
    'pages/MinhaAssinaturaPage.tsx',
  ]
  for (const a of arquivos) {
    it(`${a} não usa localStorage, sessionStorage nem console`, () => {
      const fonte = readFileSync(join(__dirname, '..', a), 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .join('\n')
      expect(fonte).not.toMatch(/localStorage|sessionStorage|console\.|useSalvarAntesDeSair/)
    })
  }
})
