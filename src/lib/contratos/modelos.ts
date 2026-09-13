// OS MODELOS DE DOCUMENTO — contrato de honorários, procuração, substabelecimento
// e declaração de hipossuficiência.
//
// ---------------------------------------------------------------------------
// TRÊS DECISÕES QUE VALEM PARA O ARQUIVO INTEIRO
//
// 1. MODELO FIXO, SEM INTELIGÊNCIA ARTIFICIAL. A minuta é montada por regra, a
//    partir dos campos. Por dois motivos que se somam: (a) um modelo de linguagem
//    inventa — cláusula, artigo, prazo — e o erro sai com a mesma cara do acerto;
//    (b) mandar CPF, endereço e o assunto do caso de um cliente para um provedor
//    de IA é entregar dado sob sigilo profissional a um terceiro. Um texto-base
//    conhecido, revisado e versionado (ver versoes.ts) não tem nenhum dos dois
//    problemas. A tela diz isso ao advogado com todas as letras.
//
// 2. NADA SAI SEM REVISÃO. O modelo é ponto de partida: o advogado edita cada
//    cláusula e declara que revisou antes de registrar. Campo obrigatório vazio
//    vira "[preencher: …]" no texto, e o registro não anda enquanto houver um.
//
// 3. NENHUM DADO É INVENTADO. O que não foi informado não aparece — nem um
//    "brasileiro" presumido, nem um estado civil padrão. Onde o gênero de quem é
//    descrito não é conhecido, a redação é neutra ("PARTE CONTRATANTE", "com
//    endereço em"); onde é, o advogado escolhe o tratamento.
//
// Obrigação de meio: nenhum modelo promete resultado. A cláusula que o diz é
// parte do texto-base do contrato de honorários, e não deve sair dele.
// ---------------------------------------------------------------------------

import { VERSOES_DOS_MODELOS, type ModeloId } from './versoes'
import { cnpjConfere, cpfConfere } from './documentos'
import { lerReais, numeroPorExtenso, reaisComExtenso } from './extenso'

export type { ModeloId }

export type Dados = Record<string, string>

export type TipoDeCampo =
  | 'texto'
  | 'paragrafo'
  | 'cpf'
  | 'cnpj'
  | 'email'
  | 'moeda'
  | 'numero'
  | 'data'
  | 'escolha'
  | 'marcar'
  | 'confirmar'

export interface OpcaoDeCampo {
  valor: string
  rotulo: string
  dica?: string
}

export interface Campo {
  id: string
  rotulo: string
  tipo: TipoDeCampo
  obrigatorio?: boolean
  dica?: string
  /** texto de exemplo dentro do campo — termina em "…" */
  exemplo?: string
  opcoes?: OpcaoDeCampo[]
  /** o campo só existe quando a condição vale (ex.: CNPJ só para pessoa jurídica) */
  quando?: (d: Dados) => boolean
  autocomplete?: string
  /** limites de `numero` */
  min?: number
  max?: number
}

export interface Grupo {
  id: string
  titulo: string
  descricao?: string
  campos: Campo[]
}

export interface Clausula {
  id: string
  /** "Do objeto". Vazio = parágrafo sem título (o preâmbulo). */
  titulo: string
  texto: string
  /** conta na numeração "Cláusula 1ª, 2ª…" (a numeração é feita na hora de desenhar) */
  numerada: boolean
}

export interface Assinatura {
  /** vazio = linha em branco para preencher à mão (testemunhas) */
  nome: string
  papel: string
}

export interface DocumentoMontado {
  titulo: string
  clausulas: Clausula[]
  /** "E, por estarem de acordo…" e a linha de local e data */
  fecho: string[]
  assinaturas: Assinatura[]
}

export interface DadosDoAdvogado {
  nome: string
  /** como está no perfil: "OAB/MG 123.456" */
  oab: string
  cidade: string
  uf: string
  /** endereço profissional em uma linha, se o perfil tem */
  endereco: string
  email: string
}

export interface Contexto {
  advogado: DadosDoAdvogado
  hoje: Date
}

export interface Modelo {
  /** 'proprio' = modelo escrito pelo advogado (ver proprio.ts) */
  id: ModeloId | 'proprio'
  versao: string
  nome: string
  resumo: string
  quemAssina: string
  grupos: Grupo[]
  iniciais: (ctx: Contexto) => Dados
  montar: (d: Dados, ctx: Contexto) => DocumentoMontado
}

// ---- Utilidades de redação ---------------------------------------------------

/** Marca que o registro procura: enquanto houver uma no texto, não se registra. */
export const MARCA_PENDENTE = '[preencher'

export const pendente = (rotulo: string) => `${MARCA_PENDENTE}: ${rotulo.toLowerCase()}]`

export function valor(d: Dados, id: string, rotulo: string): string {
  const v = (d[id] ?? '').trim()
  return v || pendente(rotulo)
}

const opcional = (d: Dados, id: string) => (d[id] ?? '').trim()

/** Tira o ponto final que a pessoa digitou, para a frase montada pôr o dela. */
export const semPontoFinal = (t: string) => t.replace(/[\s.;]+$/, '')

/** "a, b e c" */
export function listaNatural(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

/** Hoje, em "AAAA-MM-DD" no fuso de quem usa — o valor de um <input type="date">. */
export function dataIsoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dataDoIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return null
  const data = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(data.getTime()) ? null : data
}

const LONGA = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const CURTA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "10 de setembro de 2026"; o dia 1 sai "1º", como se escreve em documento. */
export function dataPorExtenso(iso: string): string {
  const d = dataDoIso(iso)
  if (!d) return pendente('data')
  return LONGA.format(d).replace(/^1 de/, '1º de')
}

function dataCurta(iso: string, rotulo: string): string {
  const d = dataDoIso(iso)
  return d ? CURTA.format(d) : pendente(rotulo)
}

/** "OAB/MG 123.456" → { uf: "MG", numero: "123.456" }. */
export function lerInscricao(oab: string): { uf: string; numero: string } | null {
  const m = /OAB\s*\/?\s*([A-Za-z]{2})\s*(?:n[º°o.]*\s*)?([\d.\-/A-Za-z]*\d[\d.\-/A-Za-z]*)/i.exec(oab ?? '')
  if (!m) return null
  return { uf: m[1]!.toUpperCase(), numero: m[2]! }
}

function inscricaoPorExtenso(oab: string, tratamento: string): string {
  const inscrit = genero(tratamento, 'inscrito', 'inscrita', 'inscrito(a)')
  const i = lerInscricao(oab)
  if (i) return `${inscrit} na OAB/${i.uf} sob o nº ${i.numero}`
  return oab.trim() ? `${inscrit} na ${oab.trim()}` : pendente('inscrição na OAB')
}

export function genero(tratamento: string, masc: string, fem: string, neutro: string): string {
  return tratamento === 'advogado' ? masc : tratamento === 'advogada' ? fem : neutro
}

function tituloComGenero(tratamento: string, masc: string, fem: string): string {
  return genero(tratamento, masc, fem, `${masc}(a)`)
}

/** "Parágrafo único." quando há um; "§ 1º", "§ 2º"… quando há mais. */
function comParagrafos(caput: string, paragrafos: string[]): string {
  const ps = paragrafos.filter(Boolean)
  if (!ps.length) return caput
  if (ps.length === 1) return `${caput}\nParágrafo único. ${ps[0]}`
  return [caput, ...ps.map((p, i) => `§ ${i + 1}º ${p}`)].join('\n')
}

let sequencia = 0
export function clausula(titulo: string, texto: string, numerada = true): Clausula {
  sequencia += 1
  return { id: `c${sequencia}-${Math.random().toString(36).slice(2, 8)}`, titulo, texto, numerada }
}

/** Uma cláusula nova e vazia, inserida pelo advogado na revisão. */
export function clausulaEmBranco(): Clausula {
  return clausula('', '', true)
}

export function localEData(d: Dados): string {
  return `${valor(d, 'local', 'Local')}, ${dataPorExtenso(d.data ?? '')}.`
}

// ---- Os blocos que se repetem entre modelos --------------------------------

const TRATAMENTO: Campo = {
  id: 'advogado.tratamento',
  rotulo: 'Como você aparece no documento',
  tipo: 'escolha',
  obrigatorio: true,
  opcoes: [
    { valor: 'advogada', rotulo: 'Advogada' },
    { valor: 'advogado', rotulo: 'Advogado' },
  ],
}

export function grupoDoAdvogado(): Grupo {
  return {
    id: 'advogado',
    titulo: 'Seus dados',
    descricao: 'Nome e inscrição vêm do seu perfil. O endereço profissional é exigido na procuração.',
    campos: [
      TRATAMENTO,
      {
        id: 'advogado.endereco',
        rotulo: 'Endereço profissional',
        tipo: 'texto',
        obrigatorio: true,
        exemplo: 'Av. Afonso Pena, 1500, sala 804, Centro, Belo Horizonte/MG, CEP 30130-005…',
        autocomplete: 'off',
      },
      {
        id: 'advogado.email',
        rotulo: 'E-mail profissional',
        tipo: 'email',
        dica: 'opcional',
        exemplo: 'contato@seuescritorio.adv.br…',
        autocomplete: 'off',
      },
    ],
  }
}

export const ehPJ = (d: Dados) => d['cliente.tipo'] === 'pj'
const ehPF = (d: Dados) => !ehPJ(d)

export function grupoDoCliente(opts: { titulo: string; permitePJ: boolean; descricao?: string }): Grupo {
  const campos: Campo[] = []
  if (opts.permitePJ) {
    campos.push({
      id: 'cliente.tipo',
      rotulo: 'É pessoa física ou jurídica?',
      tipo: 'escolha',
      obrigatorio: true,
      opcoes: [
        { valor: 'pf', rotulo: 'Pessoa física' },
        { valor: 'pj', rotulo: 'Pessoa jurídica' },
      ],
    })
  }
  const pf = opts.permitePJ ? ehPF : () => true
  const pj = opts.permitePJ ? ehPJ : () => false
  campos.push(
    { id: 'cliente.nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, quando: pf, autocomplete: 'off', exemplo: 'Como está no documento de identidade…' },
    { id: 'cliente.nacionalidade', rotulo: 'Nacionalidade', tipo: 'texto', obrigatorio: true, quando: pf, exemplo: 'brasileira…' },
    { id: 'cliente.estadoCivil', rotulo: 'Estado civil', tipo: 'texto', obrigatorio: true, quando: pf, exemplo: 'casada…' },
    { id: 'cliente.profissao', rotulo: 'Profissão', tipo: 'texto', obrigatorio: true, quando: pf, exemplo: 'professora…' },
    { id: 'cliente.cpf', rotulo: 'CPF', tipo: 'cpf', obrigatorio: true, quando: pf },
    { id: 'cliente.rg', rotulo: 'RG e órgão emissor', tipo: 'texto', dica: 'opcional', quando: pf, exemplo: 'MG-12.345.678 SSP/MG…' },
    { id: 'cliente.razao', rotulo: 'Razão social', tipo: 'texto', obrigatorio: true, quando: pj, autocomplete: 'off' },
    { id: 'cliente.cnpj', rotulo: 'CNPJ', tipo: 'cnpj', obrigatorio: true, quando: pj },
    {
      id: 'cliente.endereco',
      rotulo: 'Endereço completo',
      tipo: 'texto',
      obrigatorio: true,
      exemplo: 'Rua das Flores, 120, ap. 32, Savassi, Belo Horizonte/MG, CEP 30140-000…',
      autocomplete: 'off',
    },
    { id: 'cliente.email', rotulo: 'E-mail', tipo: 'email', dica: 'opcional', quando: pf, autocomplete: 'off' },
    { id: 'cliente.representante', rotulo: 'Quem assina pela empresa', tipo: 'texto', obrigatorio: true, quando: pj, exemplo: 'Nome completo…' },
    { id: 'cliente.representanteCargo', rotulo: 'Cargo de quem assina', tipo: 'texto', obrigatorio: true, quando: pj, exemplo: 'sócia-administradora…' },
    { id: 'cliente.representanteCpf', rotulo: 'CPF de quem assina', tipo: 'cpf', obrigatorio: true, quando: pj },
  )
  return { id: 'cliente', titulo: opts.titulo, descricao: opts.descricao, campos }
}

export const GRUPO_LOCAL: Grupo = {
  id: 'local',
  titulo: 'Local e data',
  campos: [
    { id: 'local', rotulo: 'Cidade', tipo: 'texto', obrigatorio: true, exemplo: 'Belo Horizonte/MG…' },
    { id: 'data', rotulo: 'Data do documento', tipo: 'data', obrigatorio: true },
  ],
}

export function qualificacaoDoCliente(d: Dados, permitePJ: boolean): string {
  if (permitePJ && ehPJ(d)) {
    return (
      `${valor(d, 'cliente.razao', 'Razão social')}, pessoa jurídica de direito privado, ` +
      `inscrita no CNPJ sob o nº ${valor(d, 'cliente.cnpj', 'CNPJ')}, com sede em ` +
      `${semPontoFinal(valor(d, 'cliente.endereco', 'Endereço'))}, neste ato representada por ` +
      `${valor(d, 'cliente.representante', 'Quem assina pela empresa')}, ` +
      `${valor(d, 'cliente.representanteCargo', 'Cargo de quem assina')}, CPF nº ` +
      `${valor(d, 'cliente.representanteCpf', 'CPF de quem assina')}`
    )
  }
  const rg = opcional(d, 'cliente.rg')
  const email = opcional(d, 'cliente.email')
  return (
    `${valor(d, 'cliente.nome', 'Nome completo')}, ${valor(d, 'cliente.nacionalidade', 'Nacionalidade')}, ` +
    `${valor(d, 'cliente.estadoCivil', 'Estado civil')}, ${valor(d, 'cliente.profissao', 'Profissão')}, ` +
    `CPF nº ${valor(d, 'cliente.cpf', 'CPF')}${rg ? `, RG nº ${rg}` : ''}, com endereço em ` +
    `${semPontoFinal(valor(d, 'cliente.endereco', 'Endereço'))}${email ? ` e endereço eletrônico ${email}` : ''}`
  )
}

export function nomeDoCliente(d: Dados, permitePJ: boolean): string {
  return permitePJ && ehPJ(d)
    ? valor(d, 'cliente.razao', 'Razão social')
    : valor(d, 'cliente.nome', 'Nome completo')
}

export function papelDoCliente(d: Dados, papel: string, permitePJ: boolean): string {
  return permitePJ && ehPJ(d)
    ? `${papel} · representada por ${valor(d, 'cliente.representante', 'Quem assina pela empresa')}`
    : papel
}

export function qualificacaoDoAdvogado(d: Dados, ctx: Contexto): string {
  const t = d['advogado.tratamento'] ?? ''
  const email = opcional(d, 'advogado.email')
  return (
    `${ctx.advogado.nome.trim() || pendente('seu nome')}, ${genero(t, 'advogado', 'advogada', 'advogado(a)')} ` +
    `${inscricaoPorExtenso(ctx.advogado.oab, t)}, com endereço profissional em ` +
    `${semPontoFinal(valor(d, 'advogado.endereco', 'Endereço profissional'))}` +
    `${email ? ` e endereço eletrônico ${email}` : ''}`
  )
}

export function iniciaisComuns(ctx: Contexto): Dados {
  const cidade = [ctx.advogado.cidade.trim(), ctx.advogado.uf.trim()].filter(Boolean).join('/')
  return {
    'cliente.tipo': 'pf',
    'advogado.endereco': ctx.advogado.endereco,
    'advogado.email': ctx.advogado.email,
    local: cidade,
    data: dataIsoLocal(ctx.hoje),
  }
}

// ---- Contrato de honorários ----------------------------------------------------

const comFixo = (d: Dados) => d.tipoHonorarios === 'fixo' || d.tipoHonorarios === 'misto'
const comExito = (d: Dados) => d.tipoHonorarios === 'exito' || d.tipoHonorarios === 'misto'

const ABRANGENCIA: Record<string, string> = {
  extrajudicial:
    'Os serviços são de natureza extrajudicial. Eventual medida judicial dependerá de ajuste próprio.',
  primeira:
    'O patrocínio abrange a atuação até a sentença de primeiro grau, inclusive embargos de declaração. Recursos e cumprimento de sentença, se necessários, dependerão de ajuste próprio.',
  recursos:
    'O patrocínio abrange a atuação em primeiro grau e nos recursos ao tribunal de segundo grau. Recursos aos tribunais superiores e cumprimento de sentença, se necessários, dependerão de ajuste próprio.',
  todas:
    'O patrocínio abrange a atuação em todas as instâncias, até o trânsito em julgado, e o cumprimento de sentença.',
}

function formaDePagamento(d: Dados): string {
  const total = lerReais(d.valor ?? '')
  const n = Math.max(1, Math.floor(Number(d.parcelas) || 1))
  const venc = dataCurta(d.vencimento ?? '', 'Vencimento')
  const meio = opcional(d, 'meioPagamento')
  const final = meio ? `, mediante ${semPontoFinal(meio)}` : ''
  if (total === null) return `${pendente('forma de pagamento')}${final}`
  if (n === 1) return `em parcela única, com vencimento em ${venc}${final}`
  const base = Math.floor(total / n)
  const resto = total - base * n
  const qtd = `${n} (${numeroPorExtenso(n, { feminino: true })}) parcelas mensais e sucessivas`
  if (resto === 0) {
    return `em ${qtd} de ${reaisComExtenso(base)}, a primeira com vencimento em ${venc} e as demais no mesmo dia dos meses seguintes${final}`
  }
  return `em ${qtd}, a primeira de ${reaisComExtenso(base + resto)}, com vencimento em ${venc}, e as demais de ${reaisComExtenso(base)}, no mesmo dia dos meses seguintes${final}`
}

function valorComExtenso(d: Dados): string {
  const c = lerReais(d.valor ?? '')
  return c === null ? pendente('valor dos honorários') : reaisComExtenso(c)
}

function percentualComExtenso(d: Dados): string {
  const p = Math.floor(Number(d.percentual))
  if (!Number.isFinite(p) || p <= 0) return pendente('percentual')
  return `${p}% (${numeroPorExtenso(p)} por cento)`
}

const honorarios: Modelo = {
  id: 'honorarios',
  versao: VERSOES_DOS_MODELOS.honorarios,
  nome: 'Contrato de honorários',
  resumo: 'Objeto, abrangência, honorários fixos ou sobre o proveito, revogação e foro.',
  quemAssina: 'Você e o cliente',
  grupos: [
    grupoDoCliente({ titulo: 'Quem contrata', permitePJ: true }),
    {
      id: 'servico',
      titulo: 'O serviço',
      campos: [
        {
          id: 'objeto',
          rotulo: 'O que será feito',
          tipo: 'paragrafo',
          obrigatorio: true,
          dica: 'é o que delimita o contrato',
          exemplo: 'ajuizamento de ação de divórcio consensual, com partilha de bens, perante a Vara de Família de Belo Horizonte/MG…',
        },
        {
          id: 'abrangencia',
          rotulo: 'Até onde vai o patrocínio',
          tipo: 'escolha',
          obrigatorio: true,
          opcoes: [
            { valor: 'extrajudicial', rotulo: 'Só extrajudicial' },
            { valor: 'primeira', rotulo: 'Até a sentença' },
            { valor: 'recursos', rotulo: 'Até o 2º grau' },
            { valor: 'todas', rotulo: 'Todas as instâncias' },
          ],
        },
      ],
    },
    {
      id: 'honorarios',
      titulo: 'Honorários',
      campos: [
        {
          id: 'tipoHonorarios',
          rotulo: 'Como são calculados',
          tipo: 'escolha',
          obrigatorio: true,
          opcoes: [
            { valor: 'fixo', rotulo: 'Valor fixo' },
            { valor: 'exito', rotulo: 'Sobre o proveito' },
            { valor: 'misto', rotulo: 'Fixo + proveito' },
          ],
        },
        { id: 'valor', rotulo: 'Valor total', tipo: 'moeda', obrigatorio: true, quando: comFixo, exemplo: '5.000,00…' },
        { id: 'parcelas', rotulo: 'Em quantas parcelas', tipo: 'numero', obrigatorio: true, quando: comFixo, min: 1, max: 60 },
        { id: 'vencimento', rotulo: 'Vencimento da primeira', tipo: 'data', obrigatorio: true, quando: comFixo },
        {
          id: 'meioPagamento',
          rotulo: 'Meio de pagamento',
          tipo: 'texto',
          dica: 'opcional',
          quando: comFixo,
          exemplo: 'Pix ou transferência para a conta indicada pela parte contratada…',
        },
        {
          id: 'percentual',
          rotulo: 'Percentual sobre o proveito econômico',
          tipo: 'numero',
          obrigatorio: true,
          quando: comExito,
          min: 1,
          max: 100,
          dica: 'em %',
        },
      ],
    },
    grupoDoAdvogado(),
    {
      id: 'fechamento',
      titulo: 'Foro e testemunhas',
      campos: [
        { id: 'foro', rotulo: 'Comarca do foro', tipo: 'texto', obrigatorio: true, exemplo: 'Belo Horizonte/MG…' },
        {
          id: 'testemunhas',
          rotulo: 'Linhas para testemunhas',
          tipo: 'escolha',
          obrigatorio: true,
          opcoes: [
            { valor: 'nao', rotulo: 'Sem testemunhas' },
            { valor: 'sim', rotulo: 'Duas testemunhas' },
          ],
        },
      ],
    },
    GRUPO_LOCAL,
  ],
  iniciais: (ctx) => {
    const base = iniciaisComuns(ctx)
    return {
      ...base,
      abrangencia: 'primeira',
      tipoHonorarios: 'fixo',
      parcelas: '1',
      vencimento: base.data!,
      foro: base.local!,
      testemunhas: 'nao',
    }
  },
  montar: (d, ctx) => {
    const exito = comExito(d)
    const fixo = comFixo(d)
    const caputHonorarios =
      d.tipoHonorarios === 'misto'
        ? `Pelos serviços descritos neste contrato, a PARTE CONTRATANTE pagará à PARTE CONTRATADA: (a) honorários de ${valorComExtenso(d)}, ${formaDePagamento(d)}; e (b) honorários de ${percentualComExtenso(d)} sobre o proveito econômico que vier a obter com a demanda, a serem pagos em até 10 (dez) dias do efetivo recebimento.`
        : exito
          ? `Pelos serviços descritos neste contrato, a PARTE CONTRATANTE pagará à PARTE CONTRATADA honorários de ${percentualComExtenso(d)} sobre o proveito econômico que vier a obter com a demanda, a serem pagos em até 10 (dez) dias do efetivo recebimento.`
          : `Pelos serviços descritos neste contrato, a PARTE CONTRATANTE pagará à PARTE CONTRATADA honorários de ${valorComExtenso(d)}, ${formaDePagamento(d)}.`

    const assinaturas: Assinatura[] = [
      { nome: nomeDoCliente(d, true), papel: papelDoCliente(d, 'Parte contratante', true) },
      { nome: ctx.advogado.nome.trim() || pendente('seu nome'), papel: `Parte contratada · ${ctx.advogado.oab.trim()}` },
    ]
    if (d.testemunhas === 'sim') {
      assinaturas.push({ nome: '', papel: 'Testemunha · nome e CPF' }, { nome: '', papel: 'Testemunha · nome e CPF' })
    }

    return {
      titulo: 'Contrato de prestação de serviços advocatícios e honorários',
      clausulas: [
        clausula(
          '',
          `Pelo presente instrumento particular, de um lado, ${qualificacaoDoCliente(d, true)}, doravante PARTE CONTRATANTE, e, de outro, ${qualificacaoDoAdvogado(d, ctx)}, doravante PARTE CONTRATADA, ajustam a prestação de serviços advocatícios nos termos das cláusulas seguintes.`,
          false,
        ),
        clausula(
          'Do objeto',
          comParagrafos(
            `A PARTE CONTRATADA prestará à PARTE CONTRATANTE os seguintes serviços de advocacia: ${semPontoFinal(valor(d, 'objeto', 'O que será feito'))}.`,
            [ABRANGENCIA[d.abrangencia ?? ''] ?? pendente('até onde vai o patrocínio')],
          ),
        ),
        clausula(
          'Das obrigações da parte contratada',
          comParagrafos(
            'A PARTE CONTRATADA conduzirá os serviços com zelo e diligência, guardará sigilo sobre as informações e os documentos recebidos e manterá a PARTE CONTRATANTE informada sobre o andamento, sempre que solicitada.',
            [
              'A obrigação assumida é de meio, e não de resultado: a PARTE CONTRATADA não garante o êxito da demanda, que depende de fatores alheios à sua atuação.',
            ],
          ),
        ),
        clausula(
          'Das obrigações da parte contratante',
          comParagrafos(
            'A PARTE CONTRATANTE fornecerá, com veracidade e nos prazos solicitados, as informações e os documentos necessários à execução dos serviços, e comunicará qualquer mudança em seus dados de contato.',
            [
              'Custas, emolumentos, honorários periciais, cópias, deslocamentos e demais despesas necessárias correm por conta da PARTE CONTRATANTE e não integram os honorários deste contrato.',
            ],
          ),
        ),
        clausula(
          'Dos honorários',
          comParagrafos(caputHonorarios, [
            exito ? 'Não havendo proveito econômico, não serão devidos os honorários calculados sobre ele.' : '',
            exito
              ? 'Os honorários calculados sobre o proveito econômico, somados aos de sucumbência, não ultrapassarão o proveito obtido pela PARTE CONTRATANTE.'
              : '',
            'Os honorários de sucumbência, quando houver, pertencem à PARTE CONTRATADA e não se compensam com os previstos neste contrato.',
            fixo
              ? 'O atraso no pagamento sujeitará o valor devido a correção monetária pelo IPCA, juros de mora de 1% (um por cento) ao mês e multa de 2% (dois por cento).'
              : '',
          ]),
        ),
        clausula(
          'Da revogação e da renúncia',
          comParagrafos(
            'A PARTE CONTRATANTE pode revogar o mandato, e a PARTE CONTRATADA pode renunciar a ele, a qualquer tempo, mediante comunicação escrita.',
            [
              'Na renúncia, a PARTE CONTRATADA continuará a representar a PARTE CONTRATANTE durante os 10 (dez) dias seguintes à comunicação, se necessário para evitar prejuízo.',
              exito
                ? 'Em qualquer caso, serão devidos os honorários proporcionais aos serviços já prestados, e os honorários sobre o proveito econômico serão devidos na proporção do trabalho realizado, se o proveito vier a ser obtido.'
                : 'Em qualquer caso, serão devidos os honorários proporcionais aos serviços já prestados.',
            ],
          ),
        ),
        clausula(
          'Dos dados pessoais',
          'As partes tratarão os dados pessoais recebidos em razão deste contrato apenas para executá-lo e para o exercício regular de direitos, com o sigilo próprio da advocacia.',
        ),
        clausula(
          'Da assinatura eletrônica',
          'As partes admitem a assinatura deste instrumento por meio eletrônico — com certificado digital ou outro meio que comprove a autoria e a integridade do documento — e reconhecem sua validade.',
        ),
        clausula(
          'Do foro',
          comParagrafos(
            `Fica eleito o foro da comarca de ${semPontoFinal(valor(d, 'foro', 'Comarca do foro'))} para resolver as questões decorrentes deste contrato.`,
            ['Este contrato constitui título executivo extrajudicial quanto aos honorários ajustados.'],
          ),
        ),
      ],
      fecho: ['E, por estarem de acordo, as partes assinam este instrumento.', localEData(d)],
      assinaturas,
    }
  },
}

// ---- Procuração ----------------------------------------------------------------

export const PODERES_ESPECIAIS: OpcaoDeCampo[] = [
  { valor: 'citacao', rotulo: 'receber citação' },
  { valor: 'confessar', rotulo: 'confessar' },
  { valor: 'reconhecer', rotulo: 'reconhecer a procedência do pedido' },
  { valor: 'transigir', rotulo: 'transigir' },
  { valor: 'desistir', rotulo: 'desistir' },
  { valor: 'renunciar', rotulo: 'renunciar ao direito sobre o qual se funda a ação' },
  { valor: 'quitacao', rotulo: 'receber valores e dar quitação' },
  { valor: 'compromisso', rotulo: 'firmar compromisso' },
  { valor: 'hipossuficiencia', rotulo: 'assinar declaração de hipossuficiência econômica' },
]

/** Valores de um campo "marcar" (guardados separados por "|"). */
export function marcados(d: Dados, id: string): string[] {
  return (d[id] ?? '').split('|').filter(Boolean)
}

const procuracao: Modelo = {
  id: 'procuracao',
  versao: VERSOES_DOS_MODELOS.procuracao,
  nome: 'Procuração ad judicia',
  resumo: 'Poderes gerais para o foro e, só se precisar, os poderes especiais um a um.',
  quemAssina: 'O cliente',
  grupos: [
    grupoDoCliente({ titulo: 'Quem outorga', permitePJ: true }),
    grupoDoAdvogado(),
    {
      id: 'poderes',
      titulo: 'Poderes',
      campos: [
        {
          id: 'finalidade',
          rotulo: 'Para quê',
          tipo: 'paragrafo',
          dica: 'opcional — sem ela, a procuração é geral',
          exemplo: 'propor ação de alimentos em face de…',
        },
        {
          id: 'especiais',
          rotulo: 'Poderes especiais',
          tipo: 'marcar',
          dica: 'marque só os necessários',
          opcoes: PODERES_ESPECIAIS,
        },
        {
          id: 'substabelecer',
          rotulo: 'Substabelecimento',
          tipo: 'escolha',
          obrigatorio: true,
          opcoes: [
            { valor: 'com', rotulo: 'Pode substabelecer' },
            { valor: 'nao', rotulo: 'Não pode' },
          ],
        },
      ],
    },
    GRUPO_LOCAL,
  ],
  iniciais: (ctx) => ({ ...iniciaisComuns(ctx), substabelecer: 'com' }),
  montar: (d, ctx) => {
    const t = d['advogado.tratamento'] ?? ''
    const finalidade = opcional(d, 'finalidade')
    const especiais = marcados(d, 'especiais')
      .map((v) => PODERES_ESPECIAIS.find((p) => p.valor === v)?.rotulo)
      .filter((r): r is string => !!r)
    const oOutorgado = genero(t, 'o outorgado', 'a outorgada', 'o(a) outorgado(a)')
    const seuProcurador = genero(t, 'seu procurador', 'sua procuradora', 'seu(sua) procurador(a)')

    const clausulas: Clausula[] = [
      clausula('Outorgante', `${qualificacaoDoCliente(d, true)}.`, false),
      clausula(tituloComGenero(t, 'Outorgado', 'Outorgada'), `${qualificacaoDoAdvogado(d, ctx)}.`, false),
      clausula(
        'Poderes',
        `Pelo presente instrumento, a parte outorgante nomeia e constitui ${oOutorgado} ${seuProcurador}, a quem confere amplos poderes para o foro em geral, com a cláusula ad judicia et extra, para representá-la em qualquer juízo, instância ou tribunal e perante órgãos públicos e entidades privadas, podendo propor as ações competentes e defendê-la nas contrárias, interpor recursos e praticar todos os atos necessários ao fiel cumprimento deste mandato${finalidade ? `, especialmente para ${semPontoFinal(finalidade)}` : ''}.`,
        false,
      ),
    ]
    if (especiais.length) {
      clausulas.push(
        clausula('Poderes especiais', `Confere, ainda, poderes especiais para ${listaNatural(especiais)}.`, false),
      )
    }
    clausulas.push(
      clausula(
        'Substabelecimento',
        d.substabelecer === 'nao'
          ? 'É vedado o substabelecimento dos poderes aqui conferidos.'
          : 'Os poderes aqui conferidos podem ser substabelecidos, com ou sem reserva.',
        false,
      ),
    )

    return {
      titulo: 'Procuração ad judicia et extra',
      clausulas,
      fecho: [localEData(d)],
      assinaturas: [{ nome: nomeDoCliente(d, true), papel: papelDoCliente(d, 'Outorgante', true) }],
    }
  },
}

// ---- Substabelecimento ---------------------------------------------------------

const substabelecimento: Modelo = {
  id: 'substabelecimento',
  versao: VERSOES_DOS_MODELOS.substabelecimento,
  nome: 'Substabelecimento',
  resumo: 'Com ou sem reserva de poderes, em favor de outro advogado.',
  quemAssina: 'Você',
  grupos: [
    grupoDoAdvogado(),
    {
      id: 'substabelecido',
      titulo: 'Quem recebe os poderes',
      campos: [
        { id: 'sub.nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, autocomplete: 'off' },
        {
          id: 'sub.tratamento',
          rotulo: 'Tratamento',
          tipo: 'escolha',
          obrigatorio: true,
          opcoes: [
            { valor: 'advogada', rotulo: 'Advogada' },
            { valor: 'advogado', rotulo: 'Advogado' },
          ],
        },
        { id: 'sub.oab', rotulo: 'Inscrição na OAB', tipo: 'texto', obrigatorio: true, exemplo: 'OAB/MG 234.567…' },
        { id: 'sub.endereco', rotulo: 'Endereço profissional', tipo: 'texto', dica: 'opcional', autocomplete: 'off' },
      ],
    },
    {
      id: 'mandato',
      titulo: 'O mandato',
      campos: [
        { id: 'outorgante', rotulo: 'Quem outorgou a procuração', tipo: 'texto', obrigatorio: true, exemplo: 'Nome completo do cliente…', autocomplete: 'off' },
        { id: 'processo', rotulo: 'Número do processo', tipo: 'texto', dica: 'opcional', exemplo: '0001234-56.2026.8.13.0024…' },
        { id: 'finalidade', rotulo: 'Para quê', tipo: 'texto', dica: 'opcional', exemplo: 'acompanhar a audiência de conciliação…' },
        {
          id: 'reserva',
          rotulo: 'Reserva de poderes',
          tipo: 'escolha',
          obrigatorio: true,
          opcoes: [
            { valor: 'com', rotulo: 'Com reserva', dica: 'você continua no caso' },
            { valor: 'sem', rotulo: 'Sem reserva', dica: 'você deixa o caso' },
          ],
        },
        {
          id: 'ciencia',
          rotulo: 'O cliente já sabe, de forma prévia e inequívoca, deste substabelecimento',
          tipo: 'confirmar',
          obrigatorio: true,
          quando: (d) => d.reserva === 'sem',
          dica: 'sem reserva, é exigência ética',
        },
      ],
    },
    GRUPO_LOCAL,
  ],
  iniciais: (ctx) => ({ ...iniciaisComuns(ctx), reserva: 'com' }),
  montar: (d, ctx) => {
    const t = d['advogado.tratamento'] ?? ''
    const ts = d['sub.tratamento'] ?? ''
    const sem = d.reserva === 'sem'
    const oSubstabelecente = genero(t, 'o substabelecente', 'a substabelecente', 'o(a) substabelecente')
    const oSubstabelecido = genero(ts, 'o substabelecido', 'a substabelecida', 'o(a) substabelecido(a)')
    const subEndereco = opcional(d, 'sub.endereco')
    const processo = opcional(d, 'processo')
    const finalidade = opcional(d, 'finalidade')

    const reservaTexto = sem
      ? `Sem a reserva, ${oSubstabelecente} deixa de representar a parte outorgante, e ${oSubstabelecido} assume integralmente o patrocínio. ${cap(oSubstabelecente)} declara que a parte outorgante tem prévio e inequívoco conhecimento deste substabelecimento.`
      : `Com a reserva, ${oSubstabelecente} continua ${genero(t, 'habilitado', 'habilitada', 'habilitado(a)')} a atuar, em conjunto ou separadamente.`

    return {
      titulo: sem ? 'Substabelecimento sem reserva de poderes' : 'Substabelecimento com reserva de poderes',
      clausulas: [
        clausula('Substabelecente', `${qualificacaoDoAdvogado(d, ctx)}.`, false),
        clausula(
          tituloComGenero(ts, 'Substabelecido', 'Substabelecida'),
          `${valor(d, 'sub.nome', 'Nome de quem recebe os poderes')}, ${genero(ts, 'advogado', 'advogada', 'advogado(a)')} ${inscricaoPorExtenso(valor(d, 'sub.oab', 'Inscrição na OAB de quem recebe'), ts)}${subEndereco ? `, com endereço profissional em ${semPontoFinal(subEndereco)}` : ''}.`,
          false,
        ),
        clausula(
          'Poderes',
          `Pelo presente instrumento, ${oSubstabelecente} substabelece em favor ${genero(ts, 'do substabelecido', 'da substabelecida', 'do(a) substabelecido(a)')}, ${sem ? 'sem reserva' : 'com reserva'} de poderes, os poderes que lhe foram conferidos por ${valor(d, 'outorgante', 'Quem outorgou a procuração')}${processo ? ` nos autos do processo nº ${processo}` : ''}${finalidade ? `, para ${semPontoFinal(finalidade)}` : ''}.`,
          false,
        ),
        clausula('Reserva de poderes', reservaTexto, false),
      ],
      fecho: [localEData(d)],
      assinaturas: [
        { nome: ctx.advogado.nome.trim() || pendente('seu nome'), papel: `Substabelecente · ${ctx.advogado.oab.trim()}` },
      ],
    }
  },
}

function cap(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// ---- Declaração de hipossuficiência -------------------------------------------

const hipossuficiencia: Modelo = {
  id: 'hipossuficiencia',
  versao: VERSOES_DOS_MODELOS.hipossuficiencia,
  nome: 'Declaração de hipossuficiência',
  resumo: 'Para o pedido de gratuidade da justiça de pessoa física.',
  quemAssina: 'O cliente',
  grupos: [
    grupoDoCliente({
      titulo: 'Quem declara',
      permitePJ: false,
      descricao: 'Só pessoa física: para pessoa jurídica, a gratuidade depende de prova da insuficiência.',
    }),
    {
      id: 'pedido',
      titulo: 'O pedido',
      campos: [
        {
          id: 'finalidade',
          rotulo: 'Em qual processo ou ação',
          tipo: 'texto',
          dica: 'opcional — comece com “na” ou “nos autos”',
          exemplo: 'na ação de alimentos a ser proposta perante a Vara de Família de Belo Horizonte/MG…',
        },
      ],
    },
    GRUPO_LOCAL,
  ],
  iniciais: (ctx) => {
    const { local, data } = iniciaisComuns(ctx)
    return { local: local!, data: data! }
  },
  montar: (d) => {
    const finalidade = opcional(d, 'finalidade')
    return {
      titulo: 'Declaração de hipossuficiência econômica',
      clausulas: [
        clausula(
          '',
          `${qualificacaoDoCliente(d, false)}, declara, sob as penas da lei, que não tem condições de arcar com as custas, as despesas processuais e os honorários advocatícios sem prejuízo do próprio sustento ou do sustento de sua família, e por isso requer os benefícios da gratuidade da justiça${finalidade ? ` ${semPontoFinal(finalidade)}` : ''}.`,
          false,
        ),
        clausula(
          '',
          'Declara, ainda, estar ciente de que, revogado o benefício, arcará com as despesas que deixou de adiantar e, em caso de má-fé, poderá pagar multa de até dez vezes o seu valor, além de responder civil e criminalmente pela falsidade desta declaração.',
          false,
        ),
      ],
      fecho: [localEData(d)],
      assinaturas: [{ nome: valor(d, 'cliente.nome', 'Nome completo'), papel: 'Declarante' }],
    }
  },
}

// ---- Catálogo ------------------------------------------------------------------

export const MODELOS: Record<ModeloId, Modelo> = {
  honorarios,
  procuracao,
  substabelecimento,
  hipossuficiencia,
}

export const ORDEM_DOS_MODELOS: ModeloId[] = ['honorarios', 'procuracao', 'substabelecimento', 'hipossuficiencia']

export function ehModelo(v: unknown): v is ModeloId {
  return typeof v === 'string' && v in MODELOS
}

/** Os campos que existem com estes dados (as condições `quando` aplicadas). */
export function camposVisiveis(grupo: Grupo, d: Dados): Campo[] {
  return grupo.campos.filter((c) => !c.quando || c.quando(d))
}

export interface Pendencia {
  campo: Campo
  grupo: Grupo
  motivo: 'vazio' | 'invalido'
}

/**
 * O que ainda impede montar a minuta: obrigatórios vazios e números fora do
 * intervalo. CPF e CNPJ com dígito errado NÃO travam — são aviso (ver `avisoDoCampo`):
 * quem decide se o número está certo é o advogado, com o documento na mão.
 */
export function pendencias(modelo: Modelo, d: Dados): Pendencia[] {
  const lista: Pendencia[] = []
  for (const grupo of modelo.grupos) {
    for (const campo of camposVisiveis(grupo, d)) {
      const v = (d[campo.id] ?? '').trim()
      if (!v) {
        if (campo.obrigatorio && campo.tipo !== 'marcar') lista.push({ campo, grupo, motivo: 'vazio' })
        continue
      }
      if (campo.tipo === 'numero') {
        const n = Number(v)
        if (!Number.isInteger(n) || (campo.min !== undefined && n < campo.min) || (campo.max !== undefined && n > campo.max)) {
          lista.push({ campo, grupo, motivo: 'invalido' })
        }
      }
      if (campo.tipo === 'moeda' && (lerReais(v) ?? 0) <= 0) lista.push({ campo, grupo, motivo: 'invalido' })
      if (campo.tipo === 'data' && !dataDoIso(v)) lista.push({ campo, grupo, motivo: 'invalido' })
    }
  }
  return lista
}

/** Aviso que não trava: dígito verificador que não confere, e-mail sem arroba. */
export function avisoDoCampo(campo: Campo, v: string): string | null {
  const t = (v ?? '').trim()
  if (!t) return null
  if (campo.tipo === 'cpf' && !cpfConfere(t)) return 'Os dígitos deste CPF não conferem. Confira os números.'
  if (campo.tipo === 'cnpj' && !cnpjConfere(t)) return 'Os dígitos deste CNPJ não conferem. Confira os números.'
  if (campo.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'Confira este e-mail.'
  return null
}

/** Quantos trechos "[preencher: …]" restam no documento. */
export function trechosPendentes(doc: DocumentoMontado): number {
  const textos = [doc.titulo, ...doc.clausulas.flatMap((c) => [c.titulo, c.texto]), ...doc.fecho, ...doc.assinaturas.flatMap((a) => [a.nome, a.papel])]
  return textos.reduce((n, t) => n + (t.split(MARCA_PENDENTE).length - 1), 0)
}

/** Número ordinal da cláusula, só entre as numeradas: "1ª", "2ª"… */
export function tituloDaClausula(doc: DocumentoMontado, indice: number): string {
  const c = doc.clausulas[indice]!
  if (!c.numerada) return c.titulo
  const n = doc.clausulas.slice(0, indice + 1).filter((x) => x.numerada).length
  return c.titulo.trim() ? `Cláusula ${n}ª — ${c.titulo.trim()}` : `Cláusula ${n}ª`
}
