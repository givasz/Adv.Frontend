// ASSISTENTE DE TRIAGEM — as perguntas que o advogado escolhe fazer antes de
// encaminhar um atendimento.
//
// O QUE É, EM UMA FRASE: uma recepção digital. O advogado define as perguntas, o
// assistente as faz na ordem, organiza as respostas e entrega tudo no WhatsApp
// dele. Quem avalia, decide e confirma é o advogado — sempre.
//
// O QUE NÃO É: um chatbot jurídico. Não há IA neste caminho, não há
// interpretação do caso, não há classificação de mérito, não há resposta a
// consulta. O Prov. 205/2021 e a Cartilha do CFOAB admitem o chatbot para
// facilitar a comunicação, encaminhar primeiras informações e coletar dados — e
// vedam usá-lo para responder consulta jurídica de quem não é cliente. Essa
// fronteira é a arquitetura deste arquivo, não um aviso colado nele: não existe
// função aqui capaz de opinar sobre um caso.
//
// NADA DO VISITANTE É GUARDADO. As respostas moram na memória da aba e viram uma
// mensagem que sai do aparelho de quem respondeu direto para o WhatsApp do
// advogado. Não há tabela, não há rota e não há coluna — ver backend/src/triagem.ts.
//
// ⚠️ A PARTE DE CIMA deste arquivo (tipos, tetos e `normalizarTriagem`) é ESPELHO
// de backend/src/triagem.ts, e os dois lados passam pelos mesmos casos
// (triagem.casos.json). A parte de baixo é da conversa e só existe aqui.

import type { Plan, Profile } from './types'
import { canUseTriagem } from './plans'

// ---- Espelho do servidor ----------------------------------------------------

/** Os tipos de pergunta que a triagem entende. */
export type TipoDePergunta =
  | 'texto' // resposta curta, uma linha
  | 'texto-longo' // "conte brevemente o que aconteceu"
  | 'escolha' // uma opção entre várias
  | 'multipla' // quantas quiser entre várias
  | 'sim-nao'
  | 'data'
  | 'atendimento' // presencial ou online — alimenta o "Formato" da mensagem
  | 'contato' // como posso te chamar — alimenta o "Nome" da mensagem

export const TIPOS_DE_PERGUNTA: TipoDePergunta[] = [
  'texto',
  'texto-longo',
  'escolha',
  'multipla',
  'sim-nao',
  'data',
  'atendimento',
  'contato',
]

/** Tipos cuja lista de opções é ESCRITA pelo advogado. */
export const TIPOS_COM_OPCOES: TipoDePergunta[] = ['escolha', 'multipla']

/**
 * Tipos cuja lista é NOSSA e não se edita — mas que têm opções do mesmo jeito,
 * para que ramificar seja um mecanismo só. "Sim" pode levar a uma pergunta e
 * "Não" a outra, exatamente como numa escolha escrita à mão.
 */
export const OPCOES_FIXAS: Partial<Record<TipoDePergunta, { id: string; texto: string }[]>> = {
  'sim-nao': [
    { id: 'sim', texto: 'Sim' },
    { id: 'nao', texto: 'Não' },
  ],
  atendimento: [
    { id: 'presencial', texto: 'Presencial' },
    { id: 'online', texto: 'Online' },
  ],
}

/**
 * Tipos que só fazem sentido UMA vez, porque cada um alimenta um campo
 * estruturado da mensagem final (o formato do atendimento e o nome de quem
 * escreve). Duas perguntas de nome deixariam a mensagem com dois "Nome:".
 */
export const TIPOS_UNICOS: TipoDePergunta[] = ['atendimento', 'contato']

/**
 * Destino que encerra a triagem: a conversa pula para o agendamento (ou para o
 * envio, quando não há grade). É o "não preciso saber mais nada" do advogado.
 */
export const FIM_DA_TRIAGEM = 'fim'

export interface OpcaoDeTriagem {
  id: string
  /** o texto que o visitante lê e toca */
  texto: string
  /**
   * Para onde ESTA resposta leva: o id de uma pergunta seguinte, ou
   * `FIM_DA_TRIAGEM`. Ausente = a próxima pergunta da lista, que é como toda
   * triagem começa e como a maioria vai continuar.
   *
   * Só aponta para FRENTE — ver a segunda passagem de `normalizarTriagem`.
   */
  proxima?: string
}

export interface PerguntaDeTriagem {
  id: string
  kind: TipoDePergunta
  /** a pergunta como o visitante a lê */
  label: string
  /** respostas possíveis — escritas pelo advogado, ou as fixas de OPCOES_FIXAS */
  options?: OpcaoDeTriagem[]
  /** o visitante pode seguir sem responder */
  optional?: boolean
  /**
   * Para onde a conversa vai DEPOIS desta pergunta, quando a resposta não
   * escolhe o caminho (pergunta escrita à mão, data, nome) ou quando a opção
   * respondida não tem destino próprio.
   */
  proxima?: string
}

export interface TriagemConfig {
  enabled: boolean
  questions: PerguntaDeTriagem[]
}

// ---- Tetos ------------------------------------------------------------------
//
// Curtos de propósito. Uma triagem de vinte perguntas não é triagem, é
// formulário — e formulário longo no celular é abandonado no meio. O limite
// também é a proteção mais barata contra coleta excessiva: quem tem oito
// perguntas escolhe as oito que importam.
//
// Com ramificação o teto conta ainda mais a favor: oito perguntas com caminhos
// diferentes cobrem muito mais casos do que oito perguntas em fila.

/** Perguntas por perfil. */
export const TRIAGEM_MAX_PERGUNTAS = 8
/** Tamanho do enunciado. */
export const TRIAGEM_LABEL_MAX = 120
/** Opções por pergunta de escolha. */
export const TRIAGEM_MAX_OPCOES = 8
/** Tamanho de cada opção. */
export const TRIAGEM_OPCAO_MAX = 40
/** Resposta curta do visitante (também vale para 'contato'). */
export const TRIAGEM_RESPOSTA_MAX = 140
/** Resposta longa do visitante ("conte brevemente"). */
export const TRIAGEM_RESPOSTA_LONGA_MAX = 400

/** Id utilizável: curto, previsível e seguro de pôr numa chave de React. */
const ID_OK = /^[A-Za-z0-9_-]{1,40}$/

const texto = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Opções ESCRITAS pelo advogado, já limpas, sem repetição e com id estável. */
function opcoesEscritas(raw: unknown): OpcaoDeTriagem[] {
  const out: OpcaoDeTriagem[] = []
  const idsUsados = new Set<string>()
  for (const o of Array.isArray(raw) ? raw : []) {
    if (out.length === TRIAGEM_MAX_OPCOES) break
    // Compat com a forma antiga (lista de strings): a triagem nasceu assim, e
    // um perfil gravado naquele formato não pode perder as opções ao ser lido.
    const bruta: Partial<OpcaoDeTriagem> =
      typeof o === 'string' ? { texto: o } : ((o ?? {}) as OpcaoDeTriagem)
    const valor = texto(bruta.texto, TRIAGEM_OPCAO_MAX)
    if (!valor || out.some((x) => x.texto === valor)) continue
    const idBruto = String(bruta.id ?? '')
    // Id próprio, e não o texto como chave: o advogado renomeia uma opção o
    // tempo todo, e com chave de texto o caminho que sai dela se perderia
    // silenciosamente a cada correção de digitação.
    const id = ID_OK.test(idBruto) && !idsUsados.has(idBruto) ? idBruto : `o${out.length + 1}`
    idsUsados.add(id)
    const opcao: OpcaoDeTriagem = { id, texto: valor }
    const destino = String(bruta.proxima ?? '')
    if (destino) opcao.proxima = destino
    out.push(opcao)
  }
  return out
}

/** As opções fixas de um tipo, preservando o caminho que cada uma já levava. */
function opcoesFixas(kind: TipoDePergunta, raw: unknown): OpcaoDeTriagem[] {
  const anteriores = new Map(
    (Array.isArray(raw) ? raw : [])
      .filter((o): o is OpcaoDeTriagem => !!o && typeof o === 'object')
      .map((o) => [String(o.id ?? ''), String(o.proxima ?? '')]),
  )
  return (OPCOES_FIXAS[kind] ?? []).map((o) => {
    const destino = anteriores.get(o.id)
    return destino ? { ...o, proxima: destino } : { ...o }
  })
}

/**
 * A config utilizável a partir de qualquer coisa que tenha chegado.
 *
 * Nunca lança: corpo malformado vira triagem vazia e desligada, e o perfil
 * continua exatamente como estava. É a mesma postura de `resolveAssistantConfig`
 * — a conversa do visitante não pode depender de um JSON bem-formado.
 *
 * O que é DESCARTADO (e por quê):
 *   • o que não é sequer um objeto;
 *   • tipo desconhecido — vira 'texto', que é o tipo que responde qualquer coisa;
 *   • a segunda pergunta de nome ou de formato de atendimento (ver TIPOS_UNICOS);
 *   • opção repetida ou vazia;
 *   • caminho que aponta para trás, para a própria pergunta ou para o nada —
 *     ver a segunda passagem, que é o que garante que a conversa termina.
 *
 * O que é MANTIDO mesmo estando pela metade: pergunta ainda sem enunciado e
 * pergunta de escolha ainda sem opções. Nenhuma das duas vai à conversa (ver
 * `perguntasUtilizaveis`), mas as duas continuam no editor — apagar em silêncio
 * o que alguém está escrevendo é pior do que guardar um rascunho.
 */
export function normalizarTriagem(raw: unknown): TriagemConfig {
  const bruto = (raw ?? {}) as Partial<TriagemConfig>
  const lista = Array.isArray(bruto.questions) ? bruto.questions : []
  const questions: PerguntaDeTriagem[] = []
  const idsUsados = new Set<string>()
  const unicosUsados = new Set<TipoDePergunta>()

  for (const q of lista) {
    if (questions.length === TRIAGEM_MAX_PERGUNTAS) break
    if (!q || typeof q !== 'object') continue
    // Enunciado em branco é MANTIDO: é a pergunta que o advogado acabou de
    // adicionar e ainda não escreveu. Descartá-la aqui fazia o botão "+
    // Adicionar pergunta" não adicionar nada — o item nascia e morria no mesmo
    // salvamento. Ela não chega à conversa (ver perguntasUtilizaveis).
    const bruta = q as PerguntaDeTriagem
    const label = texto(bruta.label, TRIAGEM_LABEL_MAX)

    const kind: TipoDePergunta = TIPOS_DE_PERGUNTA.includes(bruta.kind) ? bruta.kind : 'texto'
    if (TIPOS_UNICOS.includes(kind)) {
      if (unicosUsados.has(kind)) continue
      unicosUsados.add(kind)
    }

    // Id do corpo quando serve; senão um nosso. A posição entra no id gerado só
    // para ele não colidir com o da pergunta seguinte.
    const idBruto = String(bruta.id ?? '')
    const id = ID_OK.test(idBruto) && !idsUsados.has(idBruto) ? idBruto : `t${questions.length + 1}`
    idsUsados.add(id)

    const pergunta: PerguntaDeTriagem = { id, kind, label }
    if (TIPOS_COM_OPCOES.includes(kind)) pergunta.options = opcoesEscritas(bruta.options)
    else if (OPCOES_FIXAS[kind]) pergunta.options = opcoesFixas(kind, bruta.options)
    if (bruta.optional === true) pergunta.optional = true
    const destino = String(bruta.proxima ?? '')
    if (destino) pergunta.proxima = destino
    questions.push(pergunta)
  }

  // ---- Segunda passagem: os caminhos -----------------------------------------
  //
  // Um destino só vale se aponta para uma pergunta que vem DEPOIS, ou para o fim
  // da triagem. É essa regra — e não um detector de ciclos — que garante que a
  // conversa termina: sem ela, "pergunta 2 → pergunta 1" deixaria o visitante
  // rodando em círculo, e quem descobriria seria ele.
  //
  // Caminho inválido some em silêncio, e é de propósito: ele aparece quando o
  // advogado MOVE uma pergunta para cima, e o roteiro desenhado no editor mostra
  // na hora o caminho novo. Segurar um destino quebrado seria pior.
  const indicePorId = new Map(questions.map((q, i) => [q.id, i]))
  const valido = (destino: string | undefined, i: number): string | undefined => {
    if (!destino) return undefined
    if (destino === FIM_DA_TRIAGEM) return FIM_DA_TRIAGEM
    const alvo = indicePorId.get(destino)
    return alvo !== undefined && alvo > i ? destino : undefined
  }
  questions.forEach((q, i) => {
    const daPergunta = valido(q.proxima, i)
    if (daPergunta) q.proxima = daPergunta
    else delete q.proxima
    for (const o of q.options ?? []) {
      // Múltipla escolha não ramifica: o visitante marca várias, e duas respostas
      // apontando para lugares diferentes não têm desempate honesto. O caminho
      // dela é sempre o da pergunta.
      const daOpcao = q.kind === 'multipla' ? undefined : valido(o.proxima, i)
      if (daOpcao) o.proxima = daOpcao
      else delete o.proxima
    }
  })

  return { enabled: bruto.enabled === true, questions }
}

/**
 * As perguntas que a CONVERSA pode de fato fazer.
 *
 * Uma pergunta de escolha sem nenhuma opção não tem como ser respondida: mostrá-la
 * deixaria o visitante parado numa tela sem saída. Ela fica guardada no editor,
 * onde o advogado termina de escrevê-la, e simplesmente não entra em cena.
 */
export function perguntasUtilizaveis(questions: PerguntaDeTriagem[]): PerguntaDeTriagem[] {
  return questions.filter(
    (q) => !!q.label.trim() && (!TIPOS_COM_OPCOES.includes(q.kind) || !!q.options?.length),
  )
}

/**
 * O índice da próxima pergunta, depois de `indice` ser respondido com `opcaoId`.
 *
 * A cascata é: o caminho da RESPOSTA, depois o caminho da PERGUNTA, depois a
 * próxima da lista. Devolver `perguntas.length` significa "acabou a triagem" —
 * daí em diante é o agendamento de sempre.
 *
 * `perguntas` aqui é a lista que a conversa percorre (`perguntasUtilizaveis`),
 * porque é nela que os índices fazem sentido. Um destino que não existe mais
 * nessa lista volta a ser "a próxima": o normalizador já derrubou os inválidos,
 * e esta é a segunda rede.
 */
export function proximaPergunta(
  perguntas: PerguntaDeTriagem[],
  indice: number,
  opcaoId?: string,
): number {
  const atual = perguntas[indice]
  if (!atual) return perguntas.length
  const daOpcao = opcaoId ? atual.options?.find((o) => o.id === opcaoId)?.proxima : undefined
  const destino = daOpcao ?? atual.proxima
  if (!destino) return indice + 1
  if (destino === FIM_DA_TRIAGEM) return perguntas.length
  const alvo = perguntas.findIndex((q) => q.id === destino)
  return alvo > indice ? alvo : indice + 1
}

/**
 * Os ids das perguntas que a conversa CONSEGUE alcançar, partindo da primeira.
 *
 * Existe por causa do defeito clássico de todo formulário com caminhos: uma
 * pergunta para a qual ninguém é mandado. Ela fica na tela do advogado, parece
 * que está no ar, e nunca é feita a ninguém. O editor avisa — não bloqueia: o
 * advogado pode estar no meio de montar o caminho.
 */
export function perguntasAlcancaveis(questions: PerguntaDeTriagem[]): Set<string> {
  const uteis = perguntasUtilizaveis(questions)
  const vistos = new Set<string>()
  const fila: number[] = uteis.length ? [0] : []
  while (fila.length) {
    const i = fila.shift() as number
    const q = uteis[i]
    if (!q || vistos.has(q.id)) continue
    vistos.add(q.id)
    const saidas = q.options?.length
      ? q.options.map((o) => proximaPergunta(uteis, i, o.id))
      : [proximaPergunta(uteis, i)]
    // Pergunta que dá para pular tem uma saída a mais: o caminho de quem não
    // respondeu, que é sempre o da própria pergunta.
    if (q.optional) saidas.push(proximaPergunta(uteis, i))
    for (const j of saidas) if (j < uteis.length) fila.push(j)
  }
  return vistos
}

/**
 * Os enunciados e as opções, em texto corrido — é o que passa pela checagem de
 * conformidade (ver oab/compliance.ts). Tudo aqui é lido pelo visitante, então
 * tudo aqui é publicidade advocatícia como qualquer linha do perfil.
 */
export function textosDaTriagem(config: TriagemConfig | null | undefined): string[] {
  const out: string[] = []
  for (const q of config?.questions ?? []) {
    if (q.label?.trim()) out.push(q.label)
    // Só as opções ESCRITAS pelo advogado. "Sim", "Não", "Presencial" e "Online"
    // são nossas — conferi-las seria a plataforma auditando o próprio vocabulário.
    if (!TIPOS_COM_OPCOES.includes(q.kind)) continue
    for (const o of q.options ?? []) if (o.texto?.trim()) out.push(o.texto)
  }
  return out
}


// ---- Do lado de cá: o que a tela e a conversa precisam ----------------------

export const TRIAGEM_VAZIA: TriagemConfig = { enabled: false, questions: [] }

/** A config gravada, sempre utilizável. Não decide plano — ver `triagemAtiva`. */
export function resolveTriagem(profile: Pick<Profile, 'triage'>): TriagemConfig {
  return normalizarTriagem(profile.triage ?? TRIAGEM_VAZIA)
}

/**
 * A triagem vale para ESTE perfil? Plano, interruptor e ao menos uma pergunta
 * respondível — as três coisas, e nesta ordem.
 *
 * Fonte ÚNICA da resposta: a conversa, o editor, o painel e a prévia perguntam
 * aqui. O servidor tem o portão equivalente (canUseTriagem + normalizarTriagem),
 * e é ele quem decide o que fica gravado — esta função nunca é a única trava.
 */
export function triagemAtiva(profile: Pick<Profile, 'triage' | 'plan'>): boolean {
  if (!canUseTriagem(profile.plan)) return false
  const config = resolveTriagem(profile)
  return config.enabled && perguntasUtilizaveis(config.questions).length > 0
}

/** As perguntas que a conversa vai fazer, na ordem — vazio quando a triagem não vale. */
export function perguntasDaConversa(
  profile: Pick<Profile, 'triage' | 'plan'>,
): PerguntaDeTriagem[] {
  if (!triagemAtiva(profile)) return []
  return perguntasUtilizaveis(resolveTriagem(profile).questions)
}

/** Teto de caracteres da resposta, por tipo de pergunta. */
export function tetoDaResposta(kind: TipoDePergunta): number {
  return kind === 'texto-longo' ? TRIAGEM_RESPOSTA_LONGA_MAX : TRIAGEM_RESPOSTA_MAX
}

/** "2026-09-20" → "20/09/2026". Devolve o que veio quando não é uma data. */
export function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim())
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '')
}

/** A resposta é escrita à mão (e portanto pode trazer um pedido de orientação)? */
export function respostaLivre(kind: TipoDePergunta): boolean {
  return kind === 'texto' || kind === 'texto-longo'
}

/**
 * O que o visitante lê ANTES de a triagem começar.
 *
 * Aparece uma vez, dito pelo próprio assistente, e não como letra miúda: é o
 * único momento em que a pessoa ainda não escreveu nada e pode decidir o que
 * escrever. Sem alarme e sem lista de proibições — uma frase que dá a régua.
 */
export const AVISO_DE_SEGURANCA =
  'Antes de começarmos: não envie documentos, senhas ou dados bancários por aqui. Se precisar de algo assim, o advogado pede depois.'

/**
 * A limpeza de TUDO que o visitante escreve, antes de virar mensagem.
 *
 * Três coisas, e cada uma resolve um problema real:
 *   • quebras de linha viram espaço — a mensagem final usa a quebra para separar
 *     campo de campo, e um texto com quebras dentro embaralharia o que o
 *     advogado lê;
 *   • caracteres de controle e marcas invisíveis de direção de texto somem —
 *     são o que permite escrever uma coisa e exibir outra;
 *   • teto de tamanho, porque a mensagem inteira vira uma URL.
 *
 * Nada disso INTERPRETA o texto: o assistente não lê o que foi escrito, ele
 * apenas o repassa. Uma resposta que diga "ignore suas instruções" é repassada
 * como qualquer outra frase — não existe instrução a ignorar (ver os testes).
 */
export function limparResposta(bruto: string, max = TRIAGEM_RESPOSTA_MAX): string {
  return String(bruto ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[ -​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Uma pergunta respondida, pronta para o resumo e para a mensagem. */
export interface RespostaDeTriagem {
  id: string
  /** o enunciado como o visitante o leu */
  pergunta: string
  /** a resposta, já limpa */
  resposta: string
}

/**
 * O bloco da triagem na mensagem do WhatsApp.
 *
 * Pergunta e resposta em linhas seguidas, com uma linha em branco entre os
 * pares: é o formato que se lê de relance no celular, que é onde o advogado vai
 * ler. A observação final não é enfeite — ela é o que impede a mensagem de ser
 * confundida com uma triagem feita por alguém.
 */
export function linhasDaTriagem(respostas: RespostaDeTriagem[]): string[] {
  if (!respostas.length) return []
  const out: string[] = ['— Triagem —']
  for (const r of respostas) {
    out.push(r.pergunta)
    out.push(r.resposta || '(sem resposta)')
    out.push('')
  }
  out.push(
    'As informações acima foram escritas por quem visitou o perfil, na triagem inicial. Não são análise jurídica.',
  )
  return out
}

// ---- O roteiro inteiro, para o advogado conferir ---------------------------
//
// A lista de perguntas do editor não responde à pergunta que ele realmente faz
// ("como vai ficar a conversa?"), porque o roteiro não é só o que ele escreveu:
// tem a abertura, tem o aviso de segurança e tem o que vem DEPOIS da triagem —
// dia, horário, formato e nome. Sem ver isso junto, ele publica sem saber o
// tamanho do que montou.
//
// Cada passo estrutural aqui é decidido pela MESMA condição que a conversa usa
// (ver AssistantChat): é por isso que as condições chegam de fora, em vez de
// serem recalculadas aqui com outro critério.

export interface RamoDoRoteiro {
  /** o texto da resposta */
  opcao: string
  /** para onde ela leva, em palavras ("Pergunta 3", "Direto para o agendamento") */
  destino: string
  /** `true` quando esta resposta desvia do caminho normal */
  desvia: boolean
}

export interface PassoDoRoteiro {
  /** o que acontece nesse passo, na voz do produto */
  texto: string
  /** `true` quando o passo é uma pergunta ESCRITA pelo advogado */
  minha: boolean
  /** a posição dela na lista do editor (1, 2, 3…) — só nas perguntas do advogado */
  numero?: number
  /**
   * Os caminhos que saem desta pergunta. Só vem preenchido quando ALGUM deles
   * desvia: numa triagem em fila, mostrar "Sim → a próxima / Não → a próxima"
   * seria ruído em cima da informação que importa.
   */
  ramos?: RamoDoRoteiro[]
  /**
   * Ninguém chega até aqui. É o defeito clássico de todo formulário com
   * caminhos, e é invisível na lista de perguntas — a pergunta está lá, parece
   * no ar, e nunca é feita a ninguém.
   */
  inalcancavel?: boolean
}

/**
 * O roteiro inteiro, do jeito que o visitante vai percorrer.
 *
 * Devolve uma LISTA, e não uma árvore, de propósito: a coluna do editor é
 * estreita e um fluxograma ali vira desenho ilegível. Cada pergunta aparece uma
 * vez, na ordem do editor, com os caminhos que saem dela escritos ao lado — que
 * é como se lê um roteiro, e não como se desenha um grafo.
 */
export function roteiroDaConversa(
  perguntas: PerguntaDeTriagem[],
  contexto: {
    /** a grade tem horário para oferecer daqui para a frente */
    comHorarios: boolean
    /** o perfil atende presencial E online */
    dosDoisJeitos: boolean
  },
): PassoDoRoteiro[] {
  const uteis = perguntasUtilizaveis(perguntas)
  const alcancaveis = perguntasAlcancaveis(perguntas)
  const depoisDaTriagem = contexto.comHorarios
    ? 'direto para os horários'
    : 'direto para o envio'

  const passos: PassoDoRoteiro[] = [
    { texto: 'Abertura, com o aviso para não enviar documentos nem senhas', minha: false },
  ]

  uteis.forEach((q, i) => {
    const passo: PassoDoRoteiro = { texto: q.label, minha: true, numero: i + 1 }
    if (!alcancaveis.has(q.id)) passo.inalcancavel = true
    const ramos = (q.options ?? []).map((o) => {
      const alvo = proximaPergunta(uteis, i, o.id)
      const desvia = alvo !== i + 1
      return {
        opcao: o.texto,
        destino:
          alvo >= uteis.length
            ? depoisDaTriagem
            : `pergunta ${alvo + 1}${uteis[alvo].label ? ` · ${uteis[alvo].label}` : ''}`,
        desvia,
      }
    })
    // Pergunta sem opções também pode desviar (o caminho é dela, não da
    // resposta) — e aí o desvio vira uma linha só.
    if (!ramos.length) {
      const alvo = proximaPergunta(uteis, i)
      if (alvo !== i + 1) {
        ramos.push({
          opcao: 'Depois desta',
          destino:
            alvo >= uteis.length
              ? depoisDaTriagem
              : `pergunta ${alvo + 1}${uteis[alvo].label ? ` · ${uteis[alvo].label}` : ''}`,
          desvia: true,
        })
      }
    }
    if (ramos.some((r) => r.desvia)) passo.ramos = ramos
    passos.push(passo)
  })

  if (contexto.comHorarios) {
    passos.push({ texto: 'Escolher o dia e o horário na sua grade', minha: false })
  }
  if (contexto.dosDoisJeitos && !uteis.some((q) => q.kind === 'atendimento')) {
    passos.push({ texto: 'Presencial ou online', minha: false })
  }
  if (!uteis.some((q) => q.kind === 'contato')) {
    passos.push({ texto: 'Como posso te chamar?', minha: false })
  }
  passos.push({
    texto: contexto.comHorarios
      ? 'Enviar tudo no seu WhatsApp — o horário só vale depois de você confirmar'
      : 'Enviar tudo no seu WhatsApp — você analisa e responde',
    minha: false,
  })
  return passos
}

/** Os destinos que o editor pode oferecer para uma pergunta na posição `indice`. */
export interface DestinoPossivel {
  /** valor gravado: o id de uma pergunta, ou FIM_DA_TRIAGEM */
  valor: string
  rotulo: string
}

export function destinosPossiveis(
  perguntas: PerguntaDeTriagem[],
  indice: number,
): DestinoPossivel[] {
  // Só para FRENTE: é a regra que torna o loop impossível, e a tela não deve
  // sequer oferecer o que o servidor vai derrubar.
  const out: DestinoPossivel[] = perguntas
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => i > indice)
    .map(({ q, i }) => ({
      valor: q.id,
      rotulo: `${i + 1}. ${q.label.trim() || 'Pergunta sem enunciado'}`,
    }))
  out.push({ valor: FIM_DA_TRIAGEM, rotulo: 'Encerrar a triagem' })
  return out
}

// ---- Quando o visitante pede orientação jurídica ---------------------------
//
// Ele vai pedir. Alguém que chega ao perfil de um advogado com um problema
// escreve "tenho direito a isso?" na primeira caixa de texto que encontra, e
// seria estranho se não escrevesse.
//
// O assistente não responde — e a diferença entre não responder e IGNORAR é o
// produto inteiro. Ignorar deixa a pessoa achando que perguntou mal e que
// alguém vai responder depois. Dizer, de frente, que a avaliação é do advogado
// e seguir com a próxima pergunta é o que respeita quem escreveu e o que o
// Prov. 205/2021 exige (consulta é do advogado, não de máquina).
//
// A detecção é de PEDIDO DE ANÁLISE, não de assunto jurídico: "fui demitido sem
// justa causa" é fato e passa reto; "fui demitido, posso processar?" dispara.

const PEDIDOS_DE_ANALISE: RegExp[] = [
  /(?<![\p{L}])(tenho|teria|tenh|temos)\s+(algum\s+)?direito(?![\p{L}])/iu,
  /(?<![\p{L}])(posso|poderia|d[áa]\s+p(?:a|ra)ra?|cabe|caberia)\s+(eu\s+)?(process\w+|entrar\s+com|acionar|exigir|cobrar|pedir\s+indeniza\w+|recorrer|denunciar)(?![\p{L}])/iu,
  /(?<![\p{L}])(cabe|caberia)\s+(alguma\s+)?(a[çc][ãa]o|processo|recurso|medida)(?![\p{L}])/iu,
  /(?<![\p{L}])qual\s+(a[çc][ãa]o|processo|medida|recurso)\s+(eu\s+)?(devo|posso|teria)(?![\p{L}])/iu,
  /(?<![\p{L}])o\s+que\s+(eu\s+)?(devo|posso|fa[çc]o|faria)\s*(fazer)?(?![\p{L}])/iu,
  /(?<![\p{L}])(qual|quais|quanta?)\s+(a\s+|as\s+)?(minhas?\s+|nossas?\s+)?chances?(?![\p{L}])/iu,
  /(?<![\p{L}])(tenho|temos|teria)\s+chances?(?![\p{L}])/iu,
  /(?<![\p{L}])(vou|vamos|consigo|d[áa]\s+p(?:a|ra)ra?)\s+ganhar(?![\p{L}])/iu,
  /(?<![\p{L}])isso\s+([ée]|seria)\s+(crime|ilegal|legal|abusiv\w+|justo|correto|permitido)(?![\p{L}])/iu,
  /(?<![\p{L}])quanto\s+(eu\s+)?(vou|posso|d[áa]\s+p(?:a|ra)ra?|consigo)\s+(receber|ganhar)(?![\p{L}])/iu,
  /(?<![\p{L}])vale\s+a\s+pena\s+(process\w+|entrar|recorrer|brigar)(?![\p{L}])/iu,
  /(?<![\p{L}])(voc[êe]|tu)\s+acha\s+que(?![\p{L}])/iu,
  /(?<![\p{L}])me\s+(diga|diz|fala|explica)\s+se(?![\p{L}])/iu,
]

/** O visitante está pedindo uma análise do caso — e não descrevendo um fato? */
export function pedeOrientacaoJuridica(texto: string): boolean {
  const alvo = String(texto ?? '')
  return PEDIDOS_DE_ANALISE.some((re) => re.test(alvo))
}

/**
 * A resposta do assistente a um pedido de análise. A primeira explica; a partir
 * da segunda, encurta — repetir o parágrafo inteiro a cada insistência soa a
 * robô emperrado, e a pessoa já leu a explicação.
 */
export function respostaNeutra(vezes: number): string {
  return vezes <= 1
    ? 'Posso reunir algumas informações para encaminhar ao advogado, mas não faço análise nem orientação jurídica — quem avalia o seu caso é ele.'
    : 'Essa avaliação precisa ser feita pelo advogado. Sigo com as perguntas para que ele receba tudo organizado.'
}

// ---- Texto de responsabilidade (painel) ------------------------------------
//
// Fonte única para não virar copy solta: estas três frases são o limite do que a
// plataforma promete sobre a triagem, e estão na tela do editor onde ninguém
// precisa procurá-las. A regra que elas cumprem está em SEGURANCA.md: a
// plataforma NUNCA atesta a conformidade de um perfil.

export const LIMITES_DA_TRIAGEM: string[] = [
  'O Assistente de Triagem é uma ferramenta de comunicação e coleta inicial de informações. Ele não presta consultoria jurídica e não substitui a sua análise, decisão ou responsabilidade profissional.',
  'A configuração das perguntas é responsabilidade sua.',
  'O advoc.me não garante que uma configuração específica seja adequada a todas as situações profissionais ou disciplinares. Oferecemos orientações de segurança e conformidade; a responsabilidade pelo conteúdo e pelo tratamento dos dados continua sendo do profissional.',
]

/** Plano mínimo do recurso — reexportado para as telas não repetirem a regra. */
export { canUseTriagem }

/** O plano em que a triagem abre, para os textos de upsell. */
export const TRIAGEM_PLANO: Exclude<Plan, 'free'> = 'premium'
