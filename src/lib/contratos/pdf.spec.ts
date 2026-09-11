import { describe, expect, it } from 'vitest'
import { gerarPdf, nomeDoArquivo } from './pdf'
import { MODELOS, type Contexto } from './modelos'
import { finsDePdf, impressoesParaConferir, sha256Hex } from './impressao'
import { CODIGO_DE_REGISTRO, sortearCodigo } from './codigo'
import { caracteresSemImpressao } from './imprimivel'

// O registro guarda a impressão digital de UM arquivo. Três coisas sustentam
// a promessa de "baixar de novo o arquivo idêntico" e de reconhecer o original
// dentro da versão assinada — e nenhuma delas aparece em tsc ou no build:
//   • mesmo documento + mesmas opções = mesmos bytes;
//   • o PDF sai mesmo com caractere que a fonte não tem;
//   • um acréscimo no fim (o que o assinador faz) deixa o original reconhecível.

const CTX: Contexto = {
  advogado: {
    nome: 'Marina Sales',
    oab: 'OAB/MG 123.456',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    endereco: 'Av. Afonso Pena, 1500, Belo Horizonte/MG',
    email: '',
  },
  hoje: new Date(2026, 8, 10, 12),
}

const DADOS = {
  ...MODELOS.honorarios.iniciais(CTX),
  'cliente.nome': 'João da Silva',
  'cliente.nacionalidade': 'brasileiro',
  'cliente.estadoCivil': 'solteiro',
  'cliente.profissao': 'engenheiro',
  'cliente.cpf': '529.982.247-25',
  'cliente.endereco': 'Rua das Flores, 120, Belo Horizonte/MG',
  'advogado.tratamento': 'advogada',
  objeto: 'ajuizamento de ação de divórcio consensual, com partilha de bens — “tudo” incluído, § 1º',
  valor: '5.000,00',
  testemunhas: 'sim',
}

const OPCOES = {
  codigo: 'AVM-7K2P-9QXD',
  emitidoEm: '2026-09-10T15:00:00.000Z',
  autor: 'Marina Sales',
  enderecoDeConferencia: 'advocme.netlify.app/contratos/conferir',
}

const decodificar = (b: Uint8Array) => new TextDecoder('latin1').decode(b)

describe('gerarPdf', () => {
  it('é reproduzível: o mesmo documento dá os mesmos bytes', async () => {
    const doc = MODELOS.honorarios.montar(DADOS, CTX)
    const a = await gerarPdf(doc, OPCOES)
    const b = await gerarPdf(doc, OPCOES)
    expect(decodificar(a.subarray(0, 5))).toBe('%PDF-')
    expect(await sha256Hex(a)).toBe(await sha256Hex(b))
  })

  it('o código e a data entram no arquivo — e mudar o código muda a impressão digital', async () => {
    const doc = MODELOS.honorarios.montar(DADOS, CTX)
    const a = await gerarPdf(doc, OPCOES)
    const b = await gerarPdf(doc, { ...OPCOES, codigo: 'AVM-7K2P-9QXE' })
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(b))
    const { PDFDocument } = await import('pdf-lib')
    const lido = await PDFDocument.load(a, { updateMetadata: false })
    expect(lido.getKeywords()).toBe('AVM-7K2P-9QXD')
    expect(lido.getAuthor()).toBe('Marina Sales')
    expect(lido.getCreationDate()?.toISOString()).toBe('2026-09-10T15:00:00.000Z')
  })

  it('texto longo quebra em várias páginas sem perder nada', async () => {
    const doc = MODELOS.honorarios.montar({ ...DADOS, objeto: 'serviço '.repeat(900) }, CTX)
    const bytes = await gerarPdf(doc, OPCOES)
    const paginas = decodificar(bytes).match(/\/Type \/Page\b/g) ?? []
    expect(paginas.length).toBeGreaterThan(2)
  })

  it('emoji e símbolos fora da fonte não derrubam a geração', async () => {
    const doc = MODELOS.procuracao.montar({ ...DADOS, finalidade: 'ação ✅ → urgente 🚀' }, CTX)
    await expect(gerarPdf(doc, { ...OPCOES, codigo: null })).resolves.toBeInstanceOf(Uint8Array)
    // …e a revisão sabe avisar ANTES.
    expect(caracteresSemImpressao('ação ✅ → urgente 🚀 “ok” — § º')).toEqual(['✅', '→', '🚀'])
  })

  it('a medida da linha não conta kerning, porque o desenho não aplica', async () => {
    // Foi o que colou "PARTECONTRATANTEinformada" nas linhas justificadas: o
    // pdf-lib mede COM o kerning dos pares e desenha SEM. Se um dia a medida
    // parar de descontar o par, este teste avisa que a soma por caractere de
    // pdf.ts deixou de ser necessária — e não o contrário, em silêncio.
    const { PDFDocument, StandardFonts } = await import('pdf-lib')
    const pdf = await PDFDocument.create()
    const f = await pdf.embedFont(StandardFonts.TimesRoman)
    const porPar = f.widthOfTextAtSize('TA', 100)
    const porLetra = f.widthOfTextAtSize('T', 100) + f.widthOfTextAtSize('A', 100)
    expect(porPar).toBeLessThan(porLetra)
  })

  it('palavra maior que a linha é partida, não vaza da margem', async () => {
    const doc = MODELOS.procuracao.montar({ ...DADOS, finalidade: 'x'.repeat(400) }, CTX)
    await expect(gerarPdf(doc, OPCOES)).resolves.toBeInstanceOf(Uint8Array)
  })
})

describe('reconhecer o original dentro da versão assinada', () => {
  it('o hash do começo do arquivo assinado é o hash registrado', async () => {
    const original = await gerarPdf(MODELOS.procuracao.montar(DADOS, CTX), OPCOES)
    // O assinador acrescenta uma atualização incremental depois do %%EOF.
    const acrescimo = new TextEncoder().encode('\n10 0 obj\n<< /Type /Sig >>\nendobj\ntrailer\n<<>>\n%%EOF\n')
    const assinado = new Uint8Array(original.length + acrescimo.length)
    assinado.set(original)
    assinado.set(acrescimo, original.length)

    const registrado = await sha256Hex(original)
    const { inteiro, trechos } = await impressoesParaConferir(assinado)
    expect(inteiro.hash).not.toBe(registrado)
    expect(trechos.map((t) => t.hash)).toContain(registrado)
    expect(trechos.find((t) => t.hash === registrado)!.tamanho).toBe(original.length)
  })

  it('o próprio arquivo, sem acréscimo, não gera trecho repetido', async () => {
    const original = await gerarPdf(MODELOS.procuracao.montar(DADOS, CTX), OPCOES)
    expect(finsDePdf(original).includes(original.length)).toBe(false)
  })
})

describe('nome do arquivo e código', () => {
  it('nome sem acento nem espaço, com o código', () => {
    const doc = MODELOS.procuracao.montar(DADOS, CTX)
    expect(nomeDoArquivo(doc, 'AVM-7K2P-9QXD')).toBe('procuracao-ad-judicia-et-extra-AVM-7K2P-9QXD.pdf')
    expect(nomeDoArquivo(doc, null)).toBe('procuracao-ad-judicia-et-extra-minuta.pdf')
  })

  it('o código sorteado sempre passa no formato que o servidor aceita', () => {
    for (let i = 0; i < 200; i++) expect(CODIGO_DE_REGISTRO.test(sortearCodigo())).toBe(true)
  })
})
