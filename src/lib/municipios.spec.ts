import { describe, expect, it } from 'vitest'
import { MUNICIPIOS_POR_UF, TOTAL_MUNICIPIOS } from './municipios.data'
import {
  buscarMunicipios,
  cidadeExiste,
  cidadeOficial,
  municipiosDaUf,
  normalizarNome,
  ufsComCidade,
} from './municipios'

const base = MUNICIPIOS_POR_UF

describe('a base do IBGE chegou inteira', () => {
  // Sanidade do arquivo gerado. Ele é regravado por um script que fala com a
  // rede (scripts/gen-municipios.mjs); uma resposta pela metade produziria um
  // arquivo válido em TypeScript e mudo em produção — cidades simplesmente
  // sumiriam do autocompletar sem nenhum erro.
  it('tem as 27 unidades da federação', () => {
    expect(Object.keys(base)).toHaveLength(27)
  })

  it('soma o total declarado pelo gerador', () => {
    const soma = Object.values(base).reduce((n, linha) => n + linha.split('|').length, 0)
    expect(soma).toBe(TOTAL_MUNICIPIOS)
    // O Brasil tem 5.570 municípios mais o Distrito Federal, que a base do IBGE
    // devolve como município de si mesmo.
    expect(soma).toBeGreaterThanOrEqual(5570)
  })

  it('São Paulo tem 645 municípios e o DF tem só Brasília', () => {
    expect(municipiosDaUf(base, 'SP')).toHaveLength(645)
    expect(municipiosDaUf(base, 'DF')).toEqual(['Brasília'])
  })

  it('UF desconhecida devolve lista vazia em vez de estourar', () => {
    expect(municipiosDaUf(base, 'XX')).toEqual([])
  })
})

describe('normalizarNome', () => {
  it('tira acento, caixa e pontuação', () => {
    expect(normalizarNome('São José do Rio Preto')).toBe('sao jose do rio preto')
    expect(normalizarNome("Santa Bárbara d'Oeste")).toBe('santa barbara d oeste')
    expect(normalizarNome('  MOGI-MIRIM  ')).toBe('mogi mirim')
  })
})

describe('buscarMunicipios', () => {
  it('encontra sem acento e sem caixa', () => {
    const r = buscarMunicipios(base, 'sao paulo', 'SP')
    expect(r[0]).toEqual({ nome: 'São Paulo', uf: 'SP' })
  })

  it('quem COMEÇA com o termo vem antes de quem só o contém', () => {
    const r = buscarMunicipios(base, 'santos', 'SP')
    expect(r[0].nome).toBe('Santos')
  })

  it('sem UF, procura no Brasil inteiro e diz de qual estado é cada um', () => {
    const r = buscarMunicipios(base, 'campinas')
    expect(r.some((m) => m.nome === 'Campinas' && m.uf === 'SP')).toBe(true)
  })

  it('com UF, não devolve cidade de outro estado', () => {
    // "Bom Jesus" existe em várias UFs — é o caso que prova o filtro.
    const r = buscarMunicipios(base, 'bom jesus', 'PI')
    expect(r.every((m) => m.uf === 'PI')).toBe(true)
  })

  it('campo vazio COM UF abre a lista da UF; vazio SEM UF não sugere nada', () => {
    expect(buscarMunicipios(base, '', 'AC').length).toBeGreaterThan(0)
    expect(buscarMunicipios(base, '')).toEqual([])
  })

  it('respeita o limite pedido', () => {
    expect(buscarMunicipios(base, 'a', undefined, 5)).toHaveLength(5)
  })

  it('termo sem correspondência devolve lista vazia', () => {
    expect(buscarMunicipios(base, 'zzzznaoexiste')).toEqual([])
  })
})

describe('cidadeOficial devolve a grafia da base', () => {
  // É o que transforma o que a pessoa digitou no que vai para o banco: sem
  // isto, "sao paulo" seria gravado assim e sairia assim no título de SEO.
  it('corrige acento e caixa', () => {
    expect(cidadeOficial(base, 'SP', 'sao paulo')).toBe('São Paulo')
    expect(cidadeOficial(base, 'RJ', 'RIO DE JANEIRO')).toBe('Rio de Janeiro')
  })

  it('devolve null para cidade que não existe na UF', () => {
    expect(cidadeOficial(base, 'SP', 'Rio de Janeiro')).toBeNull()
    expect(cidadeOficial(base, 'SP', '')).toBeNull()
    expect(cidadeExiste(base, 'SP', 'São Paolo')).toBe(false)
  })
})

describe('ufsComCidade', () => {
  it('diz onde a cidade existe quando a UF marcada está errada', () => {
    expect(ufsComCidade(base, 'Rio de Janeiro')).toContain('RJ')
  })

  it('nome que não existe em lugar nenhum devolve lista vazia', () => {
    expect(ufsComCidade(base, 'Atlântida')).toEqual([])
  })
})
