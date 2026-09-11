// O PDF do documento — gerado no aparelho, byte a byte reproduzível.
//
// POR QUE GERAR O ARQUIVO AQUI, E NÃO PELO "IMPRIMIR → SALVAR COMO PDF"
// ----------------------------------------------------------------------
// O cartão de visita usa o diálogo de impressão, e ali está certo. Aqui não
// serve: o arquivo que sai da impressão é feito pelo navegador, muda de um
// aparelho para outro e nunca passa por nós — não há como saber a impressão
// digital dele. O registro precisa do hash do arquivo EXATO que o advogado vai
// assinar, então o arquivo precisa nascer do nosso código.
//
// REPRODUZÍVEL: mesmo texto + mesmo código + mesma data de emissão = mesmos bytes.
// É isso que permite baixar de novo, meses depois, o arquivo idêntico ao
// registrado (e conferir antes de entregar: ver `ContratoPage`). Por isso nada
// aqui lê o relógio — a data vem de fora, gravada no rascunho.
//
// O QUE ESTE PDF NÃO É: não é PDF/A, não tem carimbo do tempo nem assinatura
// digital. É um PDF comum, com metadados, pronto para ser assinado por quem
// tem certificado. A tela não promete nada além disso.
//
// `pdf-lib` entra por import dinâmico: ~200 KB que só baixam quando alguém gera
// um documento, nunca no painel nem no perfil público.

import type { PDFFont, PDFPage } from 'pdf-lib'
import { tituloDaClausula, type DocumentoMontado } from './modelos'
import { normalizarTexto } from './imprimivel'

export interface OpcoesDoPdf {
  /** código de registro; `null` = minuta para conferência, com marca d'água */
  codigo: string | null
  /** data de emissão (ISO) — fixa, para o arquivo ser reproduzível */
  emitidoEm: string
  autor: string
  /** onde conferir, sem "https://" — impresso no rodapé */
  enderecoDeConferencia: string
}

const A4: [number, number] = [595.28, 841.89]
const MARGEM_X = 70
const TOPO = A4[1] - 68
const PISO = 82
const LARGURA = A4[0] - MARGEM_X * 2
const CORPO = 11.5
const ENTRELINHA = 16.4
const RECUO = 28

interface Fontes {
  regular: PDFFont
  negrito: PDFFont
  italico: PDFFont
}

/** Nome do arquivo: "procuracao-ad-judicia-et-extra-AVM-7K2P-9QXD.pdf". */
export function nomeDoArquivo(doc: DocumentoMontado, codigo: string | null): string {
  const base = doc.titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${base}-${codigo ?? 'minuta'}.pdf`
}

export async function gerarPdf(doc: DocumentoMontado, o: OpcoesDoPdf): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib')

  const pdf = await PDFDocument.create({ updateMetadata: false })
  const fontes: Fontes = {
    regular: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
    italico: await pdf.embedFont(StandardFonts.TimesRomanItalic),
  }
  const suportados = new Set(fontes.regular.getCharacterSet())

  // O que a fonte não tem vira "?". A revisão já avisou antes (imprimivel.ts);
  // isto é só a rede de segurança para o PDF nunca deixar de sair.
  const limpar = (t: string) =>
    Array.from(normalizarTexto(t), (ch) => {
      if (ch === ' ') return suportados.has(0xa0) ? ch : ' '
      return suportados.has(ch.codePointAt(0)!) ? ch : '?'
    }).join('')

  const tinta = rgb(0.13, 0.11, 0.09)
  const cinza = rgb(0.42, 0.38, 0.33)

  const paginas: PDFPage[] = []
  let pagina!: PDFPage
  let y = 0

  const novaPagina = () => {
    pagina = pdf.addPage(A4)
    paginas.push(pagina)
    y = TOPO
  }
  const garantir = (altura: number) => {
    if (y - altura < PISO) novaPagina()
  }

  // Largura SEM kerning, somando caractere a caractere.
  //
  // `widthOfTextAtSize` desconta o kerning dos pares (T-A, A-T, V-A…), mas
  // `drawText` desenha as letras sem ele. Medindo com e desenhando sem, a
  // palavra real saía mais larga que a medida, e na linha justificada a palavra
  // seguinte encostava: "PARTECONTRATANTEinformada" — justamente nas palavras em
  // caixa alta, que são as que o contrato repete. Caractere sozinho não tem par,
  // então a soma dá exatamente o que é desenhado.
  const cache = new Map<PDFFont, Map<string, number>>()
  const largura = (t: string, f: PDFFont, tam: number) => {
    let porFonte = cache.get(f)
    if (!porFonte) cache.set(f, (porFonte = new Map()))
    let soma = 0
    for (const ch of limpar(t)) {
      let w = porFonte.get(ch)
      if (w === undefined) porFonte.set(ch, (w = f.widthOfTextAtSize(ch, 1000)))
      soma += w
    }
    return (soma * tam) / 1000
  }

  /** Quebra em linhas; palavra maior que a linha é partida por caractere. */
  const quebrar = (texto: string, f: PDFFont, tam: number, primeira: number, demais: number) => {
    const linhas: string[][] = []
    let atual: string[] = []
    let ocupado = 0
    const espaco = largura(' ', f, tam)
    const limite = () => (linhas.length === 0 ? primeira : demais)
    const palavras = texto.split(' ').filter(Boolean)
    for (let palavra of palavras) {
      let w = largura(palavra, f, tam)
      while (w > limite() && !atual.length) {
        let corte = palavra.length - 1
        while (corte > 1 && largura(palavra.slice(0, corte), f, tam) > limite()) corte--
        linhas.push([palavra.slice(0, corte)])
        palavra = palavra.slice(corte)
        w = largura(palavra, f, tam)
      }
      const necessario = atual.length ? ocupado + espaco + w : w
      if (necessario > limite() && atual.length) {
        linhas.push(atual)
        atual = [palavra]
        ocupado = w
      } else {
        atual.push(palavra)
        ocupado = necessario
      }
    }
    if (atual.length) linhas.push(atual)
    return linhas
  }

  const escreverParagrafo = (
    texto: string,
    opts: { fonte?: PDFFont; tamanho?: number; recuo?: number; alinhar?: 'justificar' | 'centro' | 'esquerda'; entrelinha?: number },
  ) => {
    const f = opts.fonte ?? fontes.regular
    const tam = opts.tamanho ?? CORPO
    const recuo = opts.recuo ?? 0
    const passo = opts.entrelinha ?? ENTRELINHA
    const alinhar = opts.alinhar ?? 'justificar'
    const linhas = quebrar(texto, f, tam, LARGURA - recuo, LARGURA)
    linhas.forEach((palavras, i) => {
      garantir(passo)
      y -= passo
      const inicio = MARGEM_X + (i === 0 ? recuo : 0)
      const disponivel = LARGURA - (i === 0 ? recuo : 0)
      const ultima = i === linhas.length - 1
      if (alinhar === 'justificar' && !ultima && palavras.length > 1) {
        const soma = palavras.reduce((s, p) => s + largura(p, f, tam), 0)
        const vao = (disponivel - soma) / (palavras.length - 1)
        let x = inicio
        for (const p of palavras) {
          pagina.drawText(limpar(p), { x, y, size: tam, font: f, color: tinta })
          x += largura(p, f, tam) + vao
        }
        return
      }
      const linha = palavras.join(' ')
      const w = largura(linha, f, tam)
      const x = alinhar === 'centro' ? MARGEM_X + (LARGURA - w) / 2 : inicio
      pagina.drawText(limpar(linha), { x, y, size: tam, font: f, color: tinta })
    })
  }

  novaPagina()

  // ---- Título
  escreverParagrafo(doc.titulo.toLocaleUpperCase('pt-BR'), {
    fonte: fontes.negrito,
    tamanho: 13.5,
    alinhar: 'centro',
    entrelinha: 19,
  })
  y -= 18

  // ---- Cláusulas
  doc.clausulas.forEach((c, i) => {
    const titulo = tituloDaClausula(doc, i).trim()
    const paragrafos = c.texto.split('\n').map((p) => p.trim()).filter(Boolean)
    if (!titulo && !paragrafos.length) return
    // Título órfão no pé da página é o erro clássico de diagramação: garante que
    // ele desça junto com pelo menos duas linhas do texto.
    garantir((titulo ? ENTRELINHA : 0) + ENTRELINHA * 2)
    if (titulo) {
      escreverParagrafo(titulo.toLocaleUpperCase('pt-BR'), { fonte: fontes.negrito, alinhar: 'esquerda' })
      y -= 3
    }
    paragrafos.forEach((p, k) => {
      escreverParagrafo(p, { recuo: RECUO })
      if (k < paragrafos.length - 1) y -= 4
    })
    y -= 11
  })

  // ---- Fecho
  // "Local e data" e a primeira linha de assinaturas descem JUNTOS: assinatura
  // sozinha numa página, sem o texto que ela assina acima, é o tipo de folha
  // que se destaca de um contrato e se grampeia em outro.
  const fecho = doc.fecho.filter((l) => l.trim())
  garantir(fecho.length * (ENTRELINHA + 4) + 24 + (doc.assinaturas.length ? 78 : 0))
  y -= 4
  for (const linha of fecho) {
    escreverParagrafo(linha, { recuo: RECUO })
    y -= 4
  }

  // ---- Assinaturas, em pares lado a lado
  const COLUNA = (LARGURA - 36) / 2
  const pares: typeof doc.assinaturas[] = []
  for (let i = 0; i < doc.assinaturas.length; i += 2) pares.push(doc.assinaturas.slice(i, i + 2))
  y -= 20
  for (const par of pares) {
    const ALTURA = 78
    garantir(ALTURA)
    y -= 44
    const sozinha = par.length === 1
    par.forEach((a, k) => {
      const x0 = sozinha ? MARGEM_X + (LARGURA - COLUNA) / 2 : MARGEM_X + k * (COLUNA + 36)
      pagina.drawLine({ start: { x: x0, y }, end: { x: x0 + COLUNA, y }, thickness: 0.6, color: tinta })
      let yy = y - 13
      const escreverCentro = (t: string, f: PDFFont, tam: number, cor = tinta) => {
        for (const palavras of quebrar(t, f, tam, COLUNA, COLUNA).slice(0, 2)) {
          const linha = palavras.join(' ')
          const w = largura(linha, f, tam)
          pagina.drawText(limpar(linha), { x: x0 + (COLUNA - w) / 2, y: yy, size: tam, font: f, color: cor })
          yy -= tam + 2.5
        }
      }
      if (a.nome.trim()) escreverCentro(a.nome, fontes.negrito, 10.5)
      escreverCentro(a.papel, fontes.regular, 9, cinza)
    })
    y -= ALTURA - 44
  }

  // ---- Rodapé e marca d'água, com o total de páginas já conhecido
  const total = paginas.length
  paginas.forEach((p, i) => {
    if (!o.codigo) {
      p.drawText('MINUTA SEM REGISTRO', {
        x: 140,
        y: 250,
        size: 50,
        font: fontes.negrito,
        color: rgb(0.42, 0.13, 0.19),
        opacity: 0.07,
        rotate: degrees(45),
      })
    }
    const esquerda = o.codigo
      ? `Registro ${o.codigo} · confira a integridade deste arquivo em ${o.enderecoDeConferencia}`
      : 'Minuta para conferência, sem registro. Não use esta versão para assinatura.'
    p.drawLine({ start: { x: MARGEM_X, y: 54 }, end: { x: A4[0] - MARGEM_X, y: 54 }, thickness: 0.4, color: cinza })
    p.drawText(limpar(esquerda), { x: MARGEM_X, y: 40, size: 7.5, font: fontes.italico, color: cinza })
    const pag = `${i + 1}/${total}`
    p.drawText(pag, {
      x: A4[0] - MARGEM_X - largura(pag, fontes.regular, 8),
      y: 40,
      size: 8,
      font: fontes.regular,
      color: cinza,
    })
  })

  // ---- Metadados. Data fixa (a de emissão), nunca o relógio.
  const emitido = new Date(o.emitidoEm)
  pdf.setTitle(limpar(doc.titulo))
  pdf.setAuthor(limpar(o.autor))
  pdf.setSubject(o.codigo ? `Documento registrado ${o.codigo}` : 'Minuta para conferência, sem registro')
  pdf.setKeywords(o.codigo ? [o.codigo] : ['minuta'])
  pdf.setCreator('advoc.me')
  pdf.setProducer('advoc.me')
  pdf.setLanguage('pt-BR')
  pdf.setCreationDate(emitido)
  pdf.setModificationDate(emitido)

  // Sem object streams: assinadores e validadores mais antigos leem melhor a
  // tabela de referência clássica — e é justamente para ser assinado que o
  // arquivo existe.
  return pdf.save({ useObjectStreams: false })
}
