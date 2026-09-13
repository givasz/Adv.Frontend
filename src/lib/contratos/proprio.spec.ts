import { describe, expect, it } from 'vitest'
import {
  camposDoModelo,
  idDoCampoProprio,
  modeloDeProprio,
  modeloDoRascunho,
  modeloEmBranco,
  problemasDoModelo,
  versaoDoModeloProprio,
  type ConteudoDoModeloProprio,
  type CopiaDeModeloProprio,
} from './proprio'
import { MARCA_PENDENTE, pendencias, trechosPendentes, type Contexto, type DocumentoMontado } from './modelos'
import type { Rascunho } from './rascunhos'

// Modelos próprios. O que não pode regredir:
//   • o modelo guarda só texto — o que tem forma de dado pessoal é apontado;
//   • campo entre chaves vira dado pedido no formulário, nunca texto fixo;
//   • campo sem valor vira "[preencher: …]", e o registro não anda com ele;
//   • a versão muda quando o texto muda (é ela que vai para o registro).

const CTX: Contexto = {
  advogado: {
    nome: 'Marina Sales',
    oab: 'OAB/MG 123.456',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    endereco: 'Av. Afonso Pena, 1500, Belo Horizonte/MG',
    email: '',
  },
  hoje: new Date(2026, 8, 12, 12),
}

const CONTEUDO: ConteudoDoModeloProprio = {
  nome: 'Consultoria mensal',
  quemAssina: 'ambos',
  titulo: 'Contrato de consultoria para {Nome do cliente}',
  clausulas: [
    { titulo: '', texto: 'De um lado, {Qualificação do cliente}, e de outro, {Sua qualificação}.' },
    { titulo: 'Do valor', texto: 'Honorários mensais de {Valor mensal}, pagos até o dia {Dia do pagamento}.' },
    { titulo: 'Do foro', texto: 'Foro de {cidade}. Vale o {valor mensal} acima.' },
  ],
}

const texto = (d: DocumentoMontado) =>
  [d.titulo, ...d.clausulas.flatMap((c) => [c.titulo, c.texto]), ...d.fecho, ...d.assinaturas.flatMap((a) => [a.nome, a.papel])].join('\n')

async function copia(c = CONTEUDO): Promise<CopiaDeModeloProprio> {
  return { ...c, id: 'm1', versao: await versaoDoModeloProprio(c) }
}

describe('campos do modelo', () => {
  it('separa os da plataforma dos criados pelo advogado, sem repetir (maiúscula não conta)', () => {
    const { padrao, proprios } = camposDoModelo(CONTEUDO)
    expect(padrao.map((c) => c.rotulo)).toEqual(['Nome do cliente', 'Qualificação do cliente', 'Sua qualificação', 'Cidade'])
    expect(proprios).toEqual(['Valor mensal', 'Dia do pagamento'])
  })

  it('id estável, sem acento', () => {
    expect(idDoCampoProprio('Dia do Pagamento')).toBe('campo.dia-do-pagamento')
    expect(idDoCampoProprio('Índice de reajuste')).toBe('campo.indice-de-reajuste')
  })
})

describe('montar a partir do modelo próprio', () => {
  it('pede cliente, advogado, os campos próprios e local — e troca tudo no texto', async () => {
    const m = modeloDeProprio(await copia())
    expect(m.grupos.map((g) => g.id)).toEqual(['cliente', 'advogado', 'proprios', 'local'])
    const d = {
      ...m.iniciais(CTX),
      'cliente.nome': 'João da Silva',
      'cliente.nacionalidade': 'brasileiro',
      'cliente.estadoCivil': 'solteiro',
      'cliente.profissao': 'engenheiro',
      'cliente.cpf': '529.982.247-25',
      'cliente.endereco': 'Rua das Flores, 120, Belo Horizonte/MG',
      'advogado.tratamento': 'advogada',
      'campo.valor-mensal': 'R$ 2.000,00',
      'campo.dia-do-pagamento': '10',
    }
    expect(pendencias(m, d)).toEqual([])
    const doc = m.montar(d, CTX)
    const t = texto(doc)
    expect(doc.titulo).toBe('Contrato de consultoria para João da Silva')
    expect(t).toContain('João da Silva, brasileiro, solteiro, engenheiro, CPF nº 529.982.247-25')
    expect(t).toContain('Marina Sales, advogada inscrita na OAB/MG sob o nº 123.456')
    expect(t).toContain('Honorários mensais de R$ 2.000,00, pagos até o dia 10.')
    expect(t).toContain('Foro de Belo Horizonte/MG. Vale o R$ 2.000,00 acima.')
    expect(t).not.toMatch(/\{|\}/)
    expect(trechosPendentes(doc)).toBe(0)
    // Cláusula com título é numerada; sem título, não.
    expect(doc.clausulas.map((c) => c.numerada)).toEqual([false, true, true])
    expect(doc.assinaturas.map((a) => a.papel)).toEqual(['Cliente', 'Advogada · OAB/MG 123.456'])
  })

  it('campo sem valor vira [preencher] e trava', async () => {
    const m = modeloDeProprio(await copia())
    const doc = m.montar(m.iniciais(CTX), CTX)
    expect(texto(doc)).toContain(`${MARCA_PENDENTE}: valor mensal]`)
    expect(pendencias(m, m.iniciais(CTX)).map((p) => p.campo.id)).toContain('campo.valor-mensal')
  })

  it('só o advogado assina e nenhum campo de cliente: o formulário não pede cliente', async () => {
    const m = modeloDeProprio(
      await copia({
        nome: 'Declaração',
        quemAssina: 'advogado',
        titulo: 'Declaração',
        clausulas: [{ titulo: '', texto: '{Sua qualificação} declara que {Fato declarado}.' }],
      }),
    )
    expect(m.grupos.map((g) => g.id)).toEqual(['advogado', 'proprios', 'local'])
  })

  it('o rascunho usa a cópia do modelo — e sem cópia não inventa um', async () => {
    const base = { id: 'r', modeloVersao: 'x', dados: {}, documento: null, etapa: 'dados', criadoEm: '', atualizadoEm: '' } as const
    expect(modeloDoRascunho({ ...base, modelo: 'proprio', proprio: await copia() } as Rascunho)?.nome).toBe('Consultoria mensal')
    expect(modeloDoRascunho({ ...base, modelo: 'proprio' } as Rascunho)).toBeNull()
    expect(modeloDoRascunho({ ...base, modelo: 'procuracao' } as Rascunho)?.id).toBe('procuracao')
  })
})

describe('o que o modelo não pode guardar', () => {
  it('um modelo só com campos passa limpo', () => {
    expect(problemasDoModelo(CONTEUDO)).toEqual([])
  })

  it('o esqueleto em branco só pede nome, título e o texto do objeto', () => {
    const msgs = problemasDoModelo(modeloEmBranco()).map((p) => p.mensagem)
    expect(msgs).toEqual(['Dê um nome ao modelo.', 'Escreva o título do documento.'])
    expect(problemasDoModelo(modeloEmBranco()).some((p) => p.dadoPessoal)).toBe(false)
  })

  it('aponta dado pessoal dizendo onde, sem repetir o dado', () => {
    const p = problemasDoModelo({
      ...CONTEUDO,
      clausulas: [...CONTEUDO.clausulas, { titulo: '', texto: 'Cliente com CPF 529.982.247-25 e e-mail ana@x.com.br' }],
    })
    const dados = p.filter((x) => x.dadoPessoal)
    expect(dados.map((x) => x.clausula)).toEqual([3, 3])
    expect(dados[0]!.mensagem).toContain('Na cláusula 4: parece CPF')
    expect(dados[0]!.mensagem).not.toContain('982.247')
  })
})

describe('versão do modelo', () => {
  it('muda quando o texto muda, e não quando só o nome muda', async () => {
    const a = await versaoDoModeloProprio(CONTEUDO)
    expect(a).toMatch(/^p:[0-9a-f]{16}$/)
    expect(await versaoDoModeloProprio({ ...CONTEUDO, nome: 'Outro nome' })).toBe(a)
    expect(await versaoDoModeloProprio({ ...CONTEUDO, titulo: 'Outro título' })).not.toBe(a)
  })
})
