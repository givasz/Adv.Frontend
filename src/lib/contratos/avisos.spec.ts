import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// "Documento que promete o que o sistema não faz é pior do que documento nenhum"
// (REGRAS.md, nota de 04/09/2026) — aplicado às telas de contratos.
//
// O que esta funcionalidade FAZ: monta minuta por modelo, gera um PDF comum,
// registra a impressão digital dele e confere se um arquivo é o mesmo.
// O que ela NÃO faz, e nenhuma tela pode sugerir: PDF/A, carimbo do tempo,
// assinatura, validação de assinatura, garantia de validade jurídica, verificação
// de quem é o advogado. Cada uma dessas palavras já apareceu num material de
// referência sobre o tema — é exatamente por isso que elas são barradas aqui.

const SRC = join(__dirname, '..', '..')

function arquivos(): { nome: string; texto: string }[] {
  const lista = [
    join(SRC, 'pages', 'ContratosPage.tsx'),
    join(SRC, 'pages', 'ContratoPage.tsx'),
    join(SRC, 'pages', 'ConferirDocumentoPage.tsx'),
    ...readdirSync(join(SRC, 'components', 'contratos'))
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => join(SRC, 'components', 'contratos', f)),
  ]
  return lista.map((nome) => ({
    nome,
    // Comentários saem: é neles que as palavras proibidas são EXPLICADAS.
    texto: readFileSync(nome, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1'),
  }))
}

const PROMESSAS_PROIBIDAS: [RegExp, string][] = [
  [/PDF\/A/i, 'o PDF gerado não é PDF/A'],
  [/carimbo do tempo|timestamp/i, 'não há carimbo do tempo'],
  [/blockchain|imutável/i, 'não há registro imutável'],
  [/validade (jurídica )?garantida|juridicamente válid|documento válido|garantia de validade/i, 'a plataforma não garante validade'],
  [/\bverificad[oa]s?\b|\bcertificad[oa] pela plataforma|\batestad[oa]\b/i, 'a plataforma não verifica nem atesta'],
  [/assinado (digitalmente )?pela plataforma|assinatura automática/i, 'a plataforma não assina'],
  [/gerad[oa] por (IA|intelig)/i, 'a minuta não usa IA'],
]

describe('as telas de contratos não prometem o que o sistema não faz', () => {
  for (const { nome, texto } of arquivos()) {
    it(nome.split(/[\\/]/).slice(-2).join('/'), () => {
      for (const [re, porque] of PROMESSAS_PROIBIDAS) {
        expect(re.test(texto), `${porque} — achado ${re} em ${nome}`).toBe(false)
      }
    })
  }
})

describe('as ressalvas que precisam estar na tela', () => {
  const porNome = (fim: string) => arquivos().find((a) => a.nome.endsWith(fim))!.texto.replace(/\s+/g, ' ')

  it('a conferência pública diz o que NÃO confere, em texto visível', () => {
    const t = porNome('ConferirDocumentoPage.tsx')
    expect(t).toContain('Não confere o conteúdo, as assinaturas nem a validade jurídica')
    expect(t).toContain('como o próprio advogado informou')
  })

  it('a revisão diz que a minuta é de modelo, sem IA, e ponto de partida', () => {
    const t = porNome('ContratoPage.tsx')
    expect(t).toContain('sem inteligência artificial')
    expect(t).toContain('ponto de partida')
  })

  it('o registro diz o que guarda e o que não guarda', () => {
    const t = porNome('ContratoPage.tsx')
    expect(t).toContain('Não guardamos')
    expect(t).toContain('o texto do documento')
    expect(t).toContain('não substitui a assinatura')
  })

  it('a lista de documentos diz onde o texto fica', () => {
    expect(porNome('ContratosPage.tsx')).toContain('ficam só neste navegador')
  })
})
