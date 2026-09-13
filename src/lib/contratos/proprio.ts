// MODELOS PRÓPRIOS — o texto-base escrito pelo advogado (Max, até 3).
//
// ---------------------------------------------------------------------------
// A REGRA QUE SUSTENTA TUDO: O MODELO É SÓ TEXTO.
//
// Os modelos da plataforma nunca saem do aparelho; este sai — fica guardado na
// conta, para estar em qualquer aparelho. Isso só é aceitável porque ele é um
// formulário em branco: onde entraria um dado, o advogado escreve um CAMPO entre
// chaves, e o valor é pedido a cada documento, no aparelho, como sempre foi.
//
//   {Qualificação do cliente}  → os dados do cliente, pedidos no formulário
//   {Sua qualificação}         → nome, OAB e endereço do perfil
//   {Valor mensal}             → qualquer outro nome vira um campo do documento
//
// O que tem forma de dado pessoal (CPF, e-mail, telefone, processo…) é apontado
// aqui enquanto a pessoa escreve e RECUSADO no servidor (dado-pessoal.ts). Nome
// de pessoa não tem forma — a tela pede, com todas as letras, para não escrever.
// ---------------------------------------------------------------------------

import {
  GRUPO_LOCAL,
  MODELOS,
  clausula,
  dataPorExtenso,
  ehPJ,
  genero,
  grupoDoAdvogado,
  grupoDoCliente,
  iniciaisComuns,
  localEData,
  nomeDoCliente,
  papelDoCliente,
  pendente,
  qualificacaoDoAdvogado,
  qualificacaoDoCliente,
  semPontoFinal,
  valor,
  type Dados,
  type Grupo,
  type Modelo,
} from './modelos'
import { ROTULO_DO_DADO, acharDadosPessoais } from './dadoPessoal'
import { sha256Hex } from './impressao'
import type { Rascunho } from './rascunhos'

export type QuemAssina = 'cliente' | 'advogado' | 'ambos'

export const QUEM_ASSINA_OPCOES: { valor: QuemAssina; rotulo: string }[] = [
  { valor: 'ambos', rotulo: 'Você e o cliente' },
  { valor: 'cliente', rotulo: 'Só o cliente' },
  { valor: 'advogado', rotulo: 'Só você' },
]

export interface ClausulaDoModeloProprio {
  titulo: string
  texto: string
}

export interface ConteudoDoModeloProprio {
  nome: string
  quemAssina: QuemAssina
  titulo: string
  clausulas: ClausulaDoModeloProprio[]
}

export interface ModeloProprioSalvo extends ConteudoDoModeloProprio {
  id: string
  revisao: number
  criadoEm: string
  atualizadoEm: string
}

/** O que o rascunho guarda: o modelo como estava ao começar, e a versão dele. */
export interface CopiaDeModeloProprio extends ConteudoDoModeloProprio {
  id: string
  /** "p:" + 16 hex do SHA-256 do texto — é o que vai para o registro */
  versao: string
}

/**
 * ⚠️ PARIDADE com LIMITES_DO_MODELO_PROPRIO de backend/src/contratos/modelo-proprio.ts
 * (o teste de lá lê este bloco).
 */
export const LIMITES_DO_MODELO_PROPRIO = {
  nome: 60,
  titulo: 160,
  tituloDaClausula: 120,
  textoDaClausula: 4000,
  clausulas: 40,
  totalDeTexto: 30000,
  campos: 20,
  rotuloDoCampo: 40,
}

// ---- Campos ------------------------------------------------------------------

export interface CampoPadrao {
  rotulo: string
  dica: string
  exige: 'cliente' | 'advogado' | 'local'
}

/** Os campos que a plataforma sabe preencher. Qualquer outro nome vira campo seu. */
export const CAMPOS_PADRAO: CampoPadrao[] = [
  { rotulo: 'Qualificação do cliente', dica: 'nome, nacionalidade, estado civil, profissão, CPF e endereço — ou os dados da empresa', exige: 'cliente' },
  { rotulo: 'Nome do cliente', dica: 'ou a razão social', exige: 'cliente' },
  { rotulo: 'CPF ou CNPJ do cliente', dica: 'o que couber', exige: 'cliente' },
  { rotulo: 'Endereço do cliente', dica: 'endereço completo', exige: 'cliente' },
  { rotulo: 'Sua qualificação', dica: 'seu nome, inscrição na OAB e endereço profissional', exige: 'advogado' },
  { rotulo: 'Seu nome', dica: 'como está no perfil', exige: 'advogado' },
  { rotulo: 'Sua inscrição na OAB', dica: 'como está no perfil', exige: 'advogado' },
  { rotulo: 'Cidade', dica: 'onde o documento é assinado', exige: 'local' },
  { rotulo: 'Data', dica: 'por extenso', exige: 'local' },
]

const CAMPO = /\{([^{}\n]{1,80})\}/g
const normalizar = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
const PADRAO_POR_NOME = new Map(CAMPOS_PADRAO.map((c) => [normalizar(c.rotulo), c]))

export function camposDoTexto(texto: string): string[] {
  return [...(texto ?? '').matchAll(CAMPO)].map((m) => m[1]!.trim().replace(/\s+/g, ' '))
}

function textosDoModelo(c: ConteudoDoModeloProprio): string[] {
  return [c.titulo, ...c.clausulas.flatMap((x) => [x.titulo, x.texto])]
}

/** Campos usados no modelo: os da plataforma e os criados pelo advogado, sem repetir. */
export function camposDoModelo(c: ConteudoDoModeloProprio): { padrao: CampoPadrao[]; proprios: string[] } {
  const vistos = new Set<string>()
  const padrao: CampoPadrao[] = []
  const proprios: string[] = []
  for (const rotulo of textosDoModelo(c).flatMap(camposDoTexto)) {
    const chave = normalizar(rotulo)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    const p = PADRAO_POR_NOME.get(chave)
    if (p) padrao.push(p)
    else proprios.push(rotulo)
  }
  return { padrao, proprios }
}

/** Id estável de um campo criado pelo advogado: "campo.valor-mensal". */
export function idDoCampoProprio(rotulo: string): string {
  const slug = normalizar(rotulo)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `campo.${slug || 'sem-nome'}`
}

// ---- Validação (espelho do servidor) ----------------------------------------

export interface ProblemaNoModelo {
  /** índice da cláusula, quando o problema é numa cláusula */
  clausula?: number
  mensagem: string
  /** true quando é dado pessoal — a trava principal, mostrada à parte */
  dadoPessoal?: boolean
}

/**
 * Tudo o que impediria o servidor de gravar — calculado enquanto a pessoa escreve.
 * A lista vazia quer dizer "o servidor aceita"; quem decide, ainda assim, é ele.
 */
export function problemasDoModelo(c: ConteudoDoModeloProprio): ProblemaNoModelo[] {
  const L = LIMITES_DO_MODELO_PROPRIO
  const p: ProblemaNoModelo[] = []
  if (c.nome.trim().length < 2) p.push({ mensagem: 'Dê um nome ao modelo.' })
  if (c.nome.trim().length > L.nome) p.push({ mensagem: `O nome passa de ${L.nome} caracteres.` })
  if (c.titulo.trim().length < 2) p.push({ mensagem: 'Escreva o título do documento.' })
  if (c.titulo.trim().length > L.titulo) p.push({ mensagem: `O título passa de ${L.titulo} caracteres.` })
  if (c.clausulas.length > L.clausulas) p.push({ mensagem: `O modelo passa de ${L.clausulas} cláusulas.` })
  c.clausulas.forEach((x, i) => {
    if (x.titulo.length > L.tituloDaClausula) {
      p.push({ clausula: i, mensagem: `O título da cláusula ${i + 1} passa de ${L.tituloDaClausula} caracteres.` })
    }
    if (x.texto.length > L.textoDaClausula) {
      p.push({ clausula: i, mensagem: `A cláusula ${i + 1} passa de ${L.textoDaClausula} caracteres.` })
    }
  })
  if (!c.clausulas.some((x) => x.texto.trim())) p.push({ mensagem: 'Escreva ao menos uma cláusula.' })
  if ([c.nome, ...textosDoModelo(c)].join('').length > L.totalDeTexto) {
    p.push({ mensagem: `O modelo passa de ${L.totalDeTexto} caracteres no total.` })
  }

  const nomes = new Set<string>()
  for (const rotulo of textosDoModelo(c).flatMap(camposDoTexto)) {
    if (rotulo.length < 2 || rotulo.length > L.rotuloDoCampo) {
      p.push({ mensagem: `O campo {${rotulo.slice(0, 50)}} precisa ter entre 2 e ${L.rotuloDoCampo} caracteres.` })
    }
    nomes.add(normalizar(rotulo))
  }
  if (nomes.size > L.campos) p.push({ mensagem: `O modelo passa de ${L.campos} campos diferentes.` })

  const onde: [string, number | undefined][] = [
    [c.nome, undefined],
    [c.titulo, undefined],
    ...c.clausulas.flatMap((x, i) => [[x.titulo, i], [x.texto, i]] as [string, number][]),
  ]
  const lugar = (k: number, i: number | undefined) =>
    k === 0 ? 'No nome do modelo' : k === 1 ? 'No título' : `Na cláusula ${(i ?? 0) + 1}`
  onde.forEach(([t, i], k) => {
    for (const a of acharDadosPessoais(t)) {
      p.push({
        clausula: i,
        dadoPessoal: true,
        mensagem: `${lugar(k, i)}: parece ${ROTULO_DO_DADO[a.tipo]} (${a.trecho}).`,
      })
    }
  })
  return p
}

/** "p:" + 16 hex do SHA-256 do que vai para o papel (o nome do modelo não entra). */
export async function versaoDoModeloProprio(c: ConteudoDoModeloProprio): Promise<string> {
  const canonico = JSON.stringify({
    titulo: c.titulo,
    quemAssina: c.quemAssina,
    clausulas: c.clausulas.map((x) => ({ titulo: x.titulo, texto: x.texto })),
  })
  return `p:${(await sha256Hex(new TextEncoder().encode(canonico))).slice(0, 16)}`
}

// ---- Montagem ------------------------------------------------------------------

/** O modelo próprio no mesmo formato dos modelos da plataforma. */
export function modeloDeProprio(copia: CopiaDeModeloProprio): Modelo {
  const { padrao, proprios } = camposDoModelo(copia)
  const precisaCliente = copia.quemAssina !== 'advogado' || padrao.some((c) => c.exige === 'cliente')
  const precisaAdvogado = copia.quemAssina !== 'cliente' || padrao.some((c) => c.exige === 'advogado')

  const grupos: Grupo[] = []
  if (precisaCliente) grupos.push(grupoDoCliente({ titulo: 'O cliente', permitePJ: true }))
  if (precisaAdvogado) grupos.push(grupoDoAdvogado())
  if (proprios.length) {
    grupos.push({
      id: 'proprios',
      titulo: 'Dados deste documento',
      descricao: 'Os campos que você criou no modelo.',
      campos: proprios.map((rotulo) => ({
        id: idDoCampoProprio(rotulo),
        rotulo,
        tipo: 'texto' as const,
        obrigatorio: true,
        autocomplete: 'off',
      })),
    })
  }
  grupos.push(GRUPO_LOCAL)

  return {
    id: 'proprio',
    versao: copia.versao,
    nome: copia.nome,
    resumo: 'Modelo seu',
    quemAssina: QUEM_ASSINA_OPCOES.find((o) => o.valor === copia.quemAssina)?.rotulo ?? 'Você e o cliente',
    grupos,
    iniciais: (ctx) => iniciaisComuns(ctx),
    montar: (d: Dados, ctx) => {
      const valorDoCampo = (rotulo: string): string => {
        switch (normalizar(rotulo)) {
          case 'qualificação do cliente':
            return qualificacaoDoCliente(d, true)
          case 'nome do cliente':
            return nomeDoCliente(d, true)
          case 'cpf ou cnpj do cliente':
            return ehPJ(d) ? valor(d, 'cliente.cnpj', 'CNPJ') : valor(d, 'cliente.cpf', 'CPF')
          case 'endereço do cliente':
            return semPontoFinal(valor(d, 'cliente.endereco', 'Endereço do cliente'))
          case 'sua qualificação':
            return qualificacaoDoAdvogado(d, ctx)
          case 'seu nome':
            return ctx.advogado.nome.trim() || pendente('seu nome')
          case 'sua inscrição na oab':
            return ctx.advogado.oab.trim() || pendente('inscrição na OAB')
          case 'cidade':
            return valor(d, 'local', 'Cidade')
          case 'data':
            return dataPorExtenso(d.data ?? '')
          default:
            return valor(d, idDoCampoProprio(rotulo), rotulo)
        }
      }
      const trocar = (t: string) => t.replace(CAMPO, (_m, rotulo: string) => valorDoCampo(rotulo))

      const tratamento = d['advogado.tratamento'] ?? ''
      const doAdvogado = {
        nome: ctx.advogado.nome.trim() || pendente('seu nome'),
        papel: `${genero(tratamento, 'Advogado', 'Advogada', 'Advogado(a)')} · ${ctx.advogado.oab.trim()}`,
      }
      const doCliente = { nome: nomeDoCliente(d, true), papel: papelDoCliente(d, 'Cliente', true) }

      return {
        titulo: trocar(copia.titulo),
        // Cláusula com título ganha número ("Cláusula 1ª — …"); sem título é
        // parágrafo solto — o jeito de escrever um preâmbulo.
        clausulas: copia.clausulas.map((c) => clausula(trocar(c.titulo), trocar(c.texto), !!c.titulo.trim())),
        fecho: [localEData(d)],
        assinaturas:
          copia.quemAssina === 'cliente'
            ? [doCliente]
            : copia.quemAssina === 'advogado'
              ? [doAdvogado]
              : [doCliente, doAdvogado],
      }
    },
  }
}

/** O modelo de um rascunho: da plataforma, ou a cópia do modelo próprio. */
export function modeloDoRascunho(r: Rascunho): Modelo | null {
  if (r.modelo === 'proprio') return r.proprio ? modeloDeProprio(r.proprio) : null
  return MODELOS[r.modelo] ?? null
}

/** Um modelo novo, já com o esqueleto que mostra como os campos funcionam. */
export function modeloEmBranco(): ConteudoDoModeloProprio {
  return {
    nome: '',
    quemAssina: 'ambos',
    titulo: '',
    clausulas: [
      {
        titulo: '',
        texto:
          'Pelo presente instrumento, de um lado, {Qualificação do cliente}, e, de outro, {Sua qualificação}, ajustam o seguinte.',
      },
      { titulo: 'Do objeto', texto: '' },
      {
        titulo: 'Do foro',
        texto: 'Fica eleito o foro da comarca de {Cidade} para resolver as questões decorrentes deste instrumento.',
      },
    ],
  }
}
