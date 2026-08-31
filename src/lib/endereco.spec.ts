import { describe, expect, it } from 'vitest'
import {
  adrDoVCard,
  cepCompleto,
  digitosDeCep,
  enderecoEmLinha,
  enderecoVisivel,
  formatarCep,
  linhaLocalidade,
  linhaLogradouro,
  linkDoMapa,
  temEndereco,
  type Endereco,
} from './endereco'

const completo: Endereco = {
  cep: '01310100',
  rua: 'Av. Paulista',
  numero: '1000',
  complemento: 'Conj. 121',
  bairro: 'Bela Vista',
}

describe('CEP', () => {
  it('guarda só dígitos e formata na exibição', () => {
    expect(digitosDeCep('01310-100')).toBe('01310100')
    expect(digitosDeCep('abc01310100999')).toBe('01310100')
    expect(formatarCep('01310100')).toBe('01310-100')
  })

  it('formata o que ainda está sendo digitado', () => {
    expect(formatarCep('013')).toBe('013')
    expect(formatarCep('013101')).toBe('01310-1')
  })

  it('só 8 dígitos contam como completo', () => {
    expect(cepCompleto('01310100')).toBe(true)
    expect(cepCompleto('0131010')).toBe(false)
  })
})

describe('temEndereco / enderecoVisivel', () => {
  it('endereço vazio não ocupa espaço', () => {
    expect(temEndereco(undefined)).toBe(false)
    expect(temEndereco({})).toBe(false)
    expect(temEndereco({ bairro: 'Centro' })).toBe(true)
  })

  it('sem rua não aparece: um CEP solto não leva ninguém a lugar nenhum', () => {
    expect(enderecoVisivel({ cep: '01310100', bairro: 'Bela Vista' })).toBe(false)
    expect(enderecoVisivel(completo)).toBe(true)
  })

  it('o interruptor de privacidade some com o endereço da página', () => {
    expect(enderecoVisivel({ ...completo, publico: false })).toBe(false)
    // Ausente conta como público — perfis antigos não têm o campo, e quem
    // preenche endereço no editor está preenchendo para aparecer.
    expect(enderecoVisivel({ ...completo, publico: undefined })).toBe(true)
  })
})

describe('as linhas lidas por humano', () => {
  it('monta logradouro e localidade', () => {
    expect(linhaLogradouro(completo)).toBe('Av. Paulista, 1000 — Conj. 121')
    expect(linhaLocalidade(completo, 'São Paulo', 'SP')).toBe('Bela Vista, São Paulo/SP · 01310-100')
  })

  it('some com o que falta em vez de deixar pontuação órfã', () => {
    expect(linhaLogradouro({ rua: 'Rua das Flores' })).toBe('Rua das Flores')
    expect(linhaLocalidade({}, 'Curitiba', 'PR')).toBe('Curitiba/PR')
    expect(linhaLocalidade(undefined, '', '')).toBe('')
  })

  it('a linha única junta as duas', () => {
    expect(enderecoEmLinha(completo, 'São Paulo', 'SP')).toBe(
      'Av. Paulista, 1000 — Conj. 121, Bela Vista, São Paulo/SP · 01310-100',
    )
  })
})

describe('link do mapa', () => {
  it('aponta para o endereço completo, com o país', () => {
    const href = linkDoMapa(completo, 'São Paulo', 'SP')!
    expect(href.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true)
    expect(decodeURIComponent(href.split('query=')[1])).toContain('Av. Paulista, 1000')
    expect(decodeURIComponent(href.split('query=')[1])).toContain('Brasil')
  })

  it('sem rua não existe link', () => {
    // Um mapa apontando só para a cidade abre no centro dela fingindo que é o
    // escritório — pior do que não ter botão nenhum.
    expect(linkDoMapa({ bairro: 'Centro' }, 'São Paulo', 'SP')).toBeUndefined()
    expect(linkDoMapa(undefined, 'São Paulo', 'SP')).toBeUndefined()
  })

  it('escapa o que vai na busca', () => {
    const href = linkDoMapa({ rua: 'Rua A & B' }, 'Cidade/Teste', 'SP')!
    expect(href).not.toContain(' ')
    expect(href).toContain('%26')
  })
})

describe('ADR do vCard', () => {
  it('segue a ordem dos sete campos da RFC 2426', () => {
    // caixa postal ; complemento ; logradouro ; cidade ; estado ; CEP ; país
    // A vírgula entre rua e número sai escapada porque, dentro de um componente
    // do ADR, ela é separador de lista — é assim que o contato salvo no telefone
    // mostra "Av. Paulista, 1000" em vez de duas linhas.
    expect(adrDoVCard(completo, 'São Paulo', 'SP')).toBe(
      'ADR;TYPE=WORK:;Conj. 121;Av. Paulista\\, 1000;São Paulo;SP;01310-100;Brasil',
    )
  })

  it('sem complemento usa o bairro na segunda posição', () => {
    expect(adrDoVCard({ rua: 'Av. Paulista', bairro: 'Bela Vista' }, 'São Paulo', 'SP')).toBe(
      'ADR;TYPE=WORK:;Bela Vista;Av. Paulista;São Paulo;SP;;Brasil',
    )
  })

  it('sem endereço nenhum ainda diz cidade e estado', () => {
    expect(adrDoVCard(undefined, 'Curitiba', 'PR')).toBe('ADR;TYPE=WORK:;;;Curitiba;PR;;Brasil')
  })

  it('sem nada, não há bloco', () => {
    expect(adrDoVCard(undefined, '', '')).toBeUndefined()
  })

  it('escapa ponto-e-vírgula e vírgula — senão o cartão inteiro se desloca', () => {
    const adr = adrDoVCard({ rua: 'Rua A; B', complemento: 'Sala 1, fundos' }, 'X', 'SP')!
    expect(adr).toContain('Sala 1\\, fundos')
    expect(adr).toContain('Rua A\\; B')
  })
})
