import { describe, expect, it } from 'vitest'
import {
  MARCA_PENDENTE,
  MODELOS,
  ORDEM_DOS_MODELOS,
  avisoDoCampo,
  camposVisiveis,
  dataPorExtenso,
  lerInscricao,
  pendencias,
  tituloDaClausula,
  trechosPendentes,
  type Contexto,
  type Dados,
  type DocumentoMontado,
} from './modelos'
import { VERSOES_DOS_MODELOS } from './versoes'

// Os modelos são o texto que vai para um contrato assinado. O que não pode
// regredir aqui:
//   • campo vazio vira "[preencher: …]" — nunca "undefined" nem um dado inventado;
//   • o contrato de honorários diz que a obrigação é de MEIO (nenhum modelo promete resultado);
//   • os valores saem por extenso a partir do mesmo número;
//   • o gênero só aparece quando o advogado o escolheu.

const CTX: Contexto = {
  advogado: {
    nome: 'Marina Sales',
    oab: 'OAB/MG 123.456',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    endereco: 'Av. Afonso Pena, 1500, sala 804, Centro, Belo Horizonte/MG',
    email: 'marina@sales.adv.br',
  },
  hoje: new Date(2026, 8, 10, 12),
}

const PESSOA: Dados = {
  'cliente.tipo': 'pf',
  'cliente.nome': 'João da Silva',
  'cliente.nacionalidade': 'brasileiro',
  'cliente.estadoCivil': 'solteiro',
  'cliente.profissao': 'engenheiro',
  'cliente.cpf': '529.982.247-25',
  'cliente.endereco': 'Rua das Flores, 120, Savassi, Belo Horizonte/MG',
  'advogado.tratamento': 'advogada',
}

function texto(doc: DocumentoMontado): string {
  return [doc.titulo, ...doc.clausulas.flatMap((c) => [c.titulo, c.texto]), ...doc.fecho, ...doc.assinaturas.flatMap((a) => [a.nome, a.papel])].join('\n')
}

function completo(id: keyof typeof MODELOS, extra: Dados = {}): Dados {
  return { ...MODELOS[id].iniciais(CTX), ...PESSOA, ...extra }
}

describe('catálogo de modelos', () => {
  it('cada modelo carimba a revisão de versoes.ts', () => {
    for (const id of ORDEM_DOS_MODELOS) {
      expect(MODELOS[id].versao).toBe(VERSOES_DOS_MODELOS[id])
      expect(MODELOS[id].id).toBe(id)
    }
  })

  it('ids de campo são únicos dentro de cada modelo', () => {
    for (const id of ORDEM_DOS_MODELOS) {
      const ids = MODELOS[id].grupos.flatMap((g) => g.campos.map((c) => c.id))
      expect(new Set(ids).size, id).toBe(ids.length)
    }
  })

  it('exemplos de campo terminam em reticências', () => {
    for (const id of ORDEM_DOS_MODELOS) {
      for (const c of MODELOS[id].grupos.flatMap((g) => g.campos)) {
        if (c.exemplo) expect(c.exemplo.endsWith('…'), `${id}.${c.id}`).toBe(true)
      }
    }
  })
})

describe('montar sem dados', () => {
  it.each(ORDEM_DOS_MODELOS)('%s: nada de undefined/null/NaN, e o que falta vira [preencher]', (id) => {
    const doc = MODELOS[id].montar({}, CTX)
    const t = texto(doc)
    expect(t).not.toMatch(/undefined|null|NaN/)
    expect(trechosPendentes(doc)).toBeGreaterThan(0)
    expect(t).toContain(MARCA_PENDENTE)
  })
})

describe('montar com os dados completos', () => {
  it('contrato de honorários fixo: valor e parcelas por extenso, obrigação de meio, nada pendente', () => {
    const d = completo('honorarios', {
      objeto: 'ajuizamento de ação de divórcio consensual.',
      valor: '5.000,00',
      parcelas: '2',
      vencimento: '2026-10-05',
    })
    expect(pendencias(MODELOS.honorarios, d)).toEqual([])
    const doc = MODELOS.honorarios.montar(d, CTX)
    const t = texto(doc).replace(/ /g, ' ')
    expect(trechosPendentes(doc)).toBe(0)
    expect(t).toContain('R$ 5.000,00 (cinco mil reais)')
    expect(t).toContain('2 (duas) parcelas mensais e sucessivas de R$ 2.500,00 (dois mil e quinhentos reais)')
    expect(t).toContain('05/10/2026')
    expect(t).toMatch(/obrigação assumida é de meio, e não de resultado/)
    // O ponto final digitado no objeto não vira ponto duplo.
    expect(t).not.toContain('consensual..')
    expect(t).toContain('advogada inscrita na OAB/MG sob o nº 123.456')
  })

  it('parcelas que não dividem exato: a primeira leva a diferença', () => {
    const d = completo('honorarios', { objeto: 'x', valor: '1.000,00', parcelas: '3', vencimento: '2026-10-05' })
    const t = texto(MODELOS.honorarios.montar(d, CTX)).replace(/ /g, ' ')
    expect(t).toContain('a primeira de R$ 333,34')
    expect(t).toContain('as demais de R$ 333,33')
  })

  it('honorários sobre o proveito: percentual por extenso e o teto somado à sucumbência', () => {
    const d = completo('honorarios', { objeto: 'x', tipoHonorarios: 'exito', percentual: '20' })
    expect(pendencias(MODELOS.honorarios, d)).toEqual([])
    const t = texto(MODELOS.honorarios.montar(d, CTX))
    expect(t).toContain('20% (vinte por cento)')
    expect(t).toContain('não ultrapassarão o proveito obtido')
    // Sem valor fixo, nada de multa por atraso nem forma de pagamento.
    expect(t).not.toContain('multa de 2%')
  })

  it('pessoa jurídica: CNPJ e representante no lugar de CPF e estado civil', () => {
    const d = completo('procuracao', {
      'cliente.tipo': 'pj',
      'cliente.razao': 'Padaria Estrela Ltda.',
      'cliente.cnpj': '11.222.333/0001-81',
      'cliente.endereco': 'Rua A, 1, Centro, Contagem/MG',
      'cliente.representante': 'Ana Souza',
      'cliente.representanteCargo': 'sócia-administradora',
      'cliente.representanteCpf': '529.982.247-25',
    })
    expect(pendencias(MODELOS.procuracao, d)).toEqual([])
    const doc = MODELOS.procuracao.montar(d, CTX)
    const t = texto(doc)
    expect(t).toContain('inscrita no CNPJ sob o nº 11.222.333/0001-81')
    expect(t).not.toContain('estado civil')
    expect(doc.assinaturas[0]!.papel).toContain('representada por Ana Souza')
  })

  it('procuração: poderes especiais só os marcados, em lista natural', () => {
    const d = completo('procuracao', { especiais: 'transigir|quitacao' })
    const t = texto(MODELOS.procuracao.montar(d, CTX))
    expect(t).toContain('poderes especiais para transigir e receber valores e dar quitação')
    expect(t).not.toContain('confessar')
    expect(t).toContain('a outorgada sua procuradora')
  })

  it('sem tratamento escolhido, a redação fica neutra — nenhum gênero presumido', () => {
    const d = completo('procuracao', { 'advogado.tratamento': '' })
    const t = texto(MODELOS.procuracao.montar(d, CTX))
    expect(t).toContain('o(a) outorgado(a)')
    // …e o campo continua pedindo a escolha.
    expect(pendencias(MODELOS.procuracao, d).map((p) => p.campo.id)).toContain('advogado.tratamento')
  })

  it('substabelecimento sem reserva exige a ciência do cliente', () => {
    const base = completo('substabelecimento', {
      'sub.nome': 'Paulo Lima',
      'sub.tratamento': 'advogado',
      'sub.oab': 'OAB/MG 234.567',
      outorgante: 'João da Silva',
      reserva: 'sem',
    })
    expect(pendencias(MODELOS.substabelecimento, base).map((p) => p.campo.id)).toEqual(['ciencia'])
    const d = { ...base, ciencia: 'sim' }
    expect(pendencias(MODELOS.substabelecimento, d)).toEqual([])
    const doc = MODELOS.substabelecimento.montar(d, CTX)
    expect(doc.titulo).toBe('Substabelecimento sem reserva de poderes')
    expect(texto(doc)).toContain('prévio e inequívoco conhecimento')
    // Gênero de quem recebe, com a contração certa ("em favor DO", nunca "de o").
    expect(texto(doc)).toContain('em favor do substabelecido')
    expect(texto(doc)).toContain('Paulo Lima, advogado inscrito na OAB/MG sob o nº 234.567')
    expect(texto(doc)).not.toMatch(/\bde o\b|\bde a\b/)
  })

  it('hipossuficiência: só pessoa física, sem campo de pessoa jurídica', () => {
    const grupos = MODELOS.hipossuficiencia.grupos
    const ids = grupos.flatMap((g) => camposVisiveis(g, { 'cliente.tipo': 'pj' }).map((c) => c.id))
    expect(ids).not.toContain('cliente.cnpj')
    expect(ids).toContain('cliente.cpf')
    const d = completo('hipossuficiencia')
    expect(pendencias(MODELOS.hipossuficiencia, d)).toEqual([])
    expect(texto(MODELOS.hipossuficiencia.montar(d, CTX))).toContain('gratuidade da justiça')
  })
})

describe('validações que não travam', () => {
  it('CPF com dígito errado é aviso, não pendência', () => {
    const d = completo('procuracao', { 'cliente.cpf': '529.982.247-26' })
    expect(pendencias(MODELOS.procuracao, d)).toEqual([])
    const campo = MODELOS.procuracao.grupos[0]!.campos.find((c) => c.id === 'cliente.cpf')!
    expect(avisoDoCampo(campo, '529.982.247-26')).toMatch(/Confira/)
    expect(avisoDoCampo(campo, '529.982.247-25')).toBeNull()
  })

  it('número fora do intervalo é pendência', () => {
    const d = completo('honorarios', { objeto: 'x', valor: '100', parcelas: '0', vencimento: '2026-10-05' })
    expect(pendencias(MODELOS.honorarios, d).map((p) => p.campo.id)).toEqual(['parcelas'])
  })
})

describe('redação', () => {
  it('data por extenso, com 1º no primeiro dia', () => {
    expect(dataPorExtenso('2026-09-10')).toBe('10 de setembro de 2026')
    expect(dataPorExtenso('2026-10-01')).toBe('1º de outubro de 2026')
  })

  it('lê a inscrição como o perfil a guarda', () => {
    expect(lerInscricao('OAB/MG 123.456')).toEqual({ uf: 'MG', numero: '123.456' })
    expect(lerInscricao('OAB SP nº 98765')).toEqual({ uf: 'SP', numero: '98765' })
    expect(lerInscricao('123')).toBeNull()
  })

  it('a numeração conta só as cláusulas numeradas', () => {
    const doc = MODELOS.honorarios.montar(completo('honorarios'), CTX)
    expect(tituloDaClausula(doc, 0)).toBe('')
    expect(tituloDaClausula(doc, 1)).toBe('Cláusula 1ª — Do objeto')
  })
})
