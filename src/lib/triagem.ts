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

/** Tipos que dependem de uma lista escrita pelo advogado. */
export const TIPOS_COM_OPCOES: TipoDePergunta[] = ['escolha', 'multipla']

/**
 * Tipos que só fazem sentido UMA vez, porque cada um alimenta um campo
 * estruturado da mensagem final (o formato do atendimento e o nome de quem
 * escreve). Duas perguntas de nome deixariam a mensagem com dois "Nome:".
 */
export const TIPOS_UNICOS: TipoDePergunta[] = ['atendimento', 'contato']

export interface PerguntaDeTriagem {
  id: string
  kind: TipoDePergunta
  /** a pergunta como o visitante a lê */
  label: string
  /** opções de resposta — só em 'escolha' e 'multipla' */
  options?: string[]
  /** o visitante pode seguir sem responder */
  optional?: boolean
}

export interface TriagemConfig {
  enabled: boolean
  questions: PerguntaDeTriagem[]
}

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

const ID_OK = /^[A-Za-z0-9_-]{1,40}$/

const texto = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''

/**
 * A config utilizável a partir de qualquer coisa que tenha chegado. Nunca lança:
 * corpo malformado vira triagem vazia e desligada. Ver o gêmeo no servidor, que
 * é quem decide o que fica gravado.
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
    const label = texto(q?.label, TRIAGEM_LABEL_MAX)

    const pedido = q?.kind
    const kind: TipoDePergunta = TIPOS_DE_PERGUNTA.includes(pedido) ? pedido : 'texto'
    if (TIPOS_UNICOS.includes(kind)) {
      if (unicosUsados.has(kind)) continue
      unicosUsados.add(kind)
    }

    const idBruto = String(q?.id ?? '')
    const id = ID_OK.test(idBruto) && !idsUsados.has(idBruto) ? idBruto : `t${questions.length + 1}`
    idsUsados.add(id)

    const pergunta: PerguntaDeTriagem = { id, kind, label }
    if (TIPOS_COM_OPCOES.includes(kind)) {
      const opcoes: string[] = []
      for (const o of Array.isArray(q?.options) ? q.options : []) {
        const valor = texto(o, TRIAGEM_OPCAO_MAX)
        if (!valor || opcoes.includes(valor)) continue
        opcoes.push(valor)
        if (opcoes.length === TRIAGEM_MAX_OPCOES) break
      }
      pergunta.options = opcoes
    }
    if (q?.optional === true) pergunta.optional = true
    questions.push(pergunta)
  }

  return { enabled: bruto.enabled === true, questions }
}

/**
 * As perguntas que a CONVERSA pode de fato fazer. Uma pergunta de escolha sem
 * nenhuma opção não tem como ser respondida — ela fica no editor, esperando o
 * advogado terminar, e não entra em cena.
 */
export function perguntasUtilizaveis(questions: PerguntaDeTriagem[]): PerguntaDeTriagem[] {
  return questions.filter(
    (q) => !!q.label.trim() && (!TIPOS_COM_OPCOES.includes(q.kind) || !!q.options?.length),
  )
}

/** Enunciados e opções em texto corrido — é o que passa pela checagem da OAB. */
export function textosDaTriagem(config: TriagemConfig | null | undefined): string[] {
  const out: string[] = []
  for (const q of config?.questions ?? []) {
    if (q.label?.trim()) out.push(q.label)
    for (const o of q.options ?? []) if (o.trim()) out.push(o)
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

/** As duas opções de uma pergunta de sim/não — fixas, nunca escritas pelo advogado. */
export const OPCOES_SIM_NAO = ['Sim', 'Não']

/** Rótulos da pergunta de preferência de atendimento, na ordem em que aparecem. */
export const OPCOES_ATENDIMENTO = ['Presencial', 'Online']

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

export interface PassoDoRoteiro {
  /** o que acontece nesse passo, na voz do produto */
  texto: string
  /** `true` quando o passo é uma pergunta ESCRITA pelo advogado */
  minha: boolean
}

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
  const passos: PassoDoRoteiro[] = [
    { texto: 'Abertura, com o aviso para não enviar documentos nem senhas', minha: false },
    ...uteis.map((q) => ({ texto: q.label, minha: true })),
  ]
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
