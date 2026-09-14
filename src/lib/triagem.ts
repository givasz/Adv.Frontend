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
// ⚠️ A PARTE DE CIMA deste arquivo (tipos, tetos, `normalizarTriagem` e o
// caminho da conversa) é ESPELHO de backend/src/triagem.ts, e os dois lados
// passam pelos mesmos casos (triagem.casos.json e triagemCaminhos.spec.ts). A
// parte de baixo é da tela e da conversa e só existe aqui.

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
 * para que ligar uma resposta a uma pergunta seja um mecanismo só. "Sim" pode
 * abrir uma pergunta e "Não" outra, exatamente como numa escolha escrita à mão.
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

export interface OpcaoDeTriagem {
  id: string
  /** o texto que o visitante lê e toca */
  texto: string
  /**
   * Quem dá esta resposta encerra a triagem ali: a conversa pula para o
   * agendamento (ou para o envio, quando não há grade). É o "não preciso saber
   * mais nada" do advogado. Múltipla escolha não encerra — ver o normalizador.
   */
  encerra?: true
}

/**
 * "Esta pergunta só é feita a quem respondeu ASSIM numa pergunta anterior."
 *
 * É a forma de ramificar, e a única: o advogado liga uma resposta a uma
 * pergunta, e quem não deu aquela resposta nunca a vê. Sem condição, a pergunta
 * é feita a todo mundo que chegar até ela — que é como toda triagem começa.
 */
export interface CondicaoDaPergunta {
  /** o id de uma pergunta ANTERIOR, que tenha opções */
  pergunta: string
  /** as respostas dela que abrem esta pergunta — basta uma */
  opcoes: string[]
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
  /** só é feita a quem deu uma destas respostas — ausente = feita a todos */
  condicao?: CondicaoDaPergunta
}

/**
 * As perguntas que o assistente faz SOZINHO depois da triagem — e que o advogado
 * pode tirar da conversa: o dia e o horário, a preferência presencial/online e o
 * "como posso te chamar?". A abertura (com o aviso para não mandar documentos) e
 * o envio não saem: sem a primeira a pessoa escreve sem saber o que não mandar,
 * e sem o segundo nada chega a ninguém.
 */
export type EtapaFixa = 'horario' | 'formato' | 'nome'

export const ETAPAS_FIXAS: EtapaFixa[] = ['horario', 'formato', 'nome']

export interface TriagemConfig {
  enabled: boolean
  questions: PerguntaDeTriagem[]
  /** etapas embutidas que o advogado tirou da conversa — ausente = nenhuma */
  semEtapas?: EtapaFixa[]
}

/** As etapas tiradas, limpas e na ordem da conversa. */
function etapasTiradas(raw: unknown): EtapaFixa[] {
  const lista: unknown[] = Array.isArray(raw) ? raw : []
  return ETAPAS_FIXAS.filter((e) => lista.includes(e))
}

// ---- Tetos ------------------------------------------------------------------
//
// Curtos de propósito. Uma triagem de vinte perguntas não é triagem, é
// formulário — e formulário longo no celular é abandonado no meio. O limite
// também é a proteção mais barata contra coleta excessiva: quem tem oito
// perguntas escolhe as oito que importam.
//
// Com perguntas condicionais o teto conta ainda mais a favor: oito perguntas que
// só abrem para quem precisa cobrem muito mais casos do que oito em fila.

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
    // tempo todo, e com chave de texto a pergunta ligada a ela se soltaria
    // silenciosamente a cada correção de digitação.
    const id = ID_OK.test(idBruto) && !idsUsados.has(idBruto) ? idBruto : `o${out.length + 1}`
    idsUsados.add(id)
    const opcao: OpcaoDeTriagem = { id, texto: valor }
    if (bruta.encerra === true) opcao.encerra = true
    out.push(opcao)
  }
  return out
}

/** As opções fixas de um tipo, preservando as que já encerravam a triagem. */
function opcoesFixas(kind: TipoDePergunta, raw: unknown): OpcaoDeTriagem[] {
  const encerravam = new Set(
    (Array.isArray(raw) ? raw : [])
      .filter((o): o is OpcaoDeTriagem => !!o && typeof o === 'object' && o.encerra === true)
      .map((o) => String(o.id ?? '')),
  )
  return (OPCOES_FIXAS[kind] ?? []).map((o) =>
    encerravam.has(o.id) ? { ...o, encerra: true as const } : { ...o },
  )
}

/** A condição como veio, só com a FORMA conferida — o sentido é da 2ª passagem. */
function condicaoBruta(raw: unknown): CondicaoDaPergunta | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const c = raw as Partial<CondicaoDaPergunta>
  const pergunta = String(c.pergunta ?? '')
  if (!ID_OK.test(pergunta)) return undefined
  const opcoes = [
    ...new Set((Array.isArray(c.opcoes) ? c.opcoes : []).map(String).filter((id) => ID_OK.test(id))),
  ].slice(0, TRIAGEM_MAX_OPCOES)
  return { pergunta, opcoes }
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
 *   • condição que depende de pergunta POSTERIOR, da própria pergunta, do nada,
 *     de pergunta sem opções ou de resposta que não existe — ver a segunda
 *     passagem, que é o que garante que a conversa termina.
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
    const condicao = condicaoBruta(bruta.condicao)
    if (condicao) pergunta.condicao = condicao
    questions.push(pergunta)
  }

  // ---- Segunda passagem: as ligações -----------------------------------------
  //
  // Uma condição só vale se depende de uma pergunta que vem ANTES. É essa regra
  // — e não um detector de ciclos — que garante que a conversa termina: a
  // conversa só anda para frente, e uma pergunta nunca espera por uma resposta
  // que ainda não foi dada.
  //
  // Ligação inválida some em silêncio, e é de propósito: ela aparece quando o
  // advogado apaga a pergunta de que outra dependia, ou troca o tipo dela, e o
  // fluxograma do editor mostra na hora o desenho novo. Segurar uma condição
  // impossível deixaria uma pergunta no ar que nunca é feita a ninguém.
  limparLigacoes(questions, false)

  // Só aparece quando há alguma: a triagem que nunca tirou nada continua com
  // exatamente a forma de antes.
  const semEtapas = etapasTiradas(bruto.semEtapas)
  return { enabled: bruto.enabled === true, questions, ...(semEtapas.length ? { semEtapas } : {}) }
}

/**
 * As ligações que fazem sentido, aplicadas NO LUGAR. É a mesma regra no
 * servidor e no editor; a única diferença é o que acontece com a condição que
 * ficou sem nenhuma resposta escolhida — o editor a segura (é o advogado no meio
 * do gesto de escolher), a conversa não.
 */
function limparLigacoes(questions: PerguntaDeTriagem[], manterVazia: boolean) {
  const indicePorId = new Map(questions.map((q, i) => [q.id, i]))
  questions.forEach((q, i) => {
    for (const o of q.options ?? []) {
      // Múltipla escolha não encerra: quem marca "encerra" junto com outra
      // resposta que abre uma pergunta não tem desempate honesto.
      if (q.kind === 'multipla' || o.encerra !== true) delete o.encerra
    }
    if (!q.condicao) return
    const fonte = indicePorId.get(q.condicao.pergunta)
    const origem = fonte !== undefined && fonte < i ? questions[fonte] : undefined
    const ids = new Set((origem?.options ?? []).map((o) => o.id))
    const opcoes = q.condicao.opcoes.filter((id) => ids.has(id))
    if (!origem || !ids.size || (!opcoes.length && !manterVazia)) delete q.condicao
    else q.condicao = { pergunta: origem.id, opcoes }
  })
}

/**
 * As perguntas que a CONVERSA pode de fato fazer.
 *
 * Uma pergunta de escolha sem nenhuma opção não tem como ser respondida: mostrá-la
 * deixaria o visitante parado numa tela sem saída. E uma pergunta que depende de
 * outra que ficou de fora nunca teria a resposta de que precisa. As duas ficam
 * guardadas no editor, onde o advogado termina de escrevê-las, e simplesmente
 * não entram em cena.
 */
export function perguntasUtilizaveis(questions: PerguntaDeTriagem[]): PerguntaDeTriagem[] {
  const ficaram = new Set<string>()
  return questions.filter((q) => {
    const pronta =
      !!q.label.trim() &&
      (!TIPOS_COM_OPCOES.includes(q.kind) || !!q.options?.length) &&
      (!q.condicao || ficaram.has(q.condicao.pergunta))
    if (pronta) ficaram.add(q.id)
    return pronta
  })
}

/**
 * O que o visitante já respondeu, do jeito que o CAMINHO precisa: o id da
 * pergunta e os ids das respostas tocadas (lista vazia quando a resposta foi
 * escrita). Pergunta pulada não entra — e por isso não abre nada.
 */
export type RespostasDoCaminho = Record<string, string[]>

/** Esta pergunta deve ser feita, dado o que já foi respondido? */
export function condicaoAtendida(
  pergunta: PerguntaDeTriagem,
  respostas: RespostasDoCaminho,
): boolean {
  const c = pergunta.condicao
  if (!c) return true
  return (respostas[c.pergunta] ?? []).some((id) => c.opcoes.includes(id))
}

/**
 * O índice da próxima pergunta, depois de `indice` ter sido respondido.
 *
 * Primeiro, se a resposta dada ENCERRA a triagem, acabou. Senão, é a primeira
 * pergunta seguinte cuja condição foi atendida — as que dependem de uma
 * resposta que não foi dada são puladas. Devolver `perguntas.length` significa
 * "acabou a triagem": daí em diante é o agendamento de sempre.
 *
 * O índice só cresce, então a conversa termina em no máximo N passos, para
 * qualquer configuração. `indice` -1 dá a primeira pergunta.
 *
 * `perguntas` aqui é a lista que a conversa percorre (`perguntasUtilizaveis`),
 * porque é nela que os índices fazem sentido.
 */
export function proximaPergunta(
  perguntas: PerguntaDeTriagem[],
  indice: number,
  respostas: RespostasDoCaminho = {},
): number {
  const atual = perguntas[indice]
  if (atual && atual.kind !== 'multipla') {
    const tocadas = respostas[atual.id] ?? []
    if (atual.options?.some((o) => o.encerra && tocadas.includes(o.id))) return perguntas.length
  }
  let j = Math.max(indice + 1, 0)
  while (j < perguntas.length && !condicaoAtendida(perguntas[j], respostas)) j++
  return Math.min(j, perguntas.length)
}

/**
 * Os ids das perguntas que a conversa CONSEGUE alcançar, por algum caminho.
 *
 * Existe por causa do defeito clássico de todo formulário com caminhos: uma
 * pergunta que ninguém consegue receber — porque depende de uma resposta que
 * encerra a triagem, ou vem depois de uma pergunta em que toda resposta encerra.
 * Ela fica na tela do advogado, parece que está no ar, e nunca é feita a
 * ninguém. O editor avisa — não bloqueia: o desenho pode estar pela metade.
 *
 * Anda por todos os caminhos, tocando uma resposta de cada vez (numa múltipla
 * escolha, marcar uma só já abre tudo o que aquela resposta abre). Guarda os
 * estados já vistos, e tem um teto: numa configuração absurda o bastante para
 * estourá-lo, devolve todas — não avisar é melhor do que avisar errado.
 */
export function perguntasAlcancaveis(questions: PerguntaDeTriagem[]): Set<string> {
  const uteis = perguntasUtilizaveis(questions)
  const vistos = new Set<string>()
  const fontes = [...new Set(uteis.flatMap((q) => (q.condicao ? [q.condicao.pergunta] : [])))]
  const estados = new Set<string>()
  let orcamento = 20000

  const andar = (i: number, respostas: RespostasDoCaminho): void => {
    if (i >= uteis.length) return
    const estado = `${i}|${fontes.map((f) => respostas[f]?.join(',') ?? '-').join(';')}`
    if (estados.has(estado)) return
    estados.add(estado)
    if (--orcamento < 0) throw new Error('teto')
    const q = uteis[i]
    vistos.add(q.id)
    const saidas: RespostasDoCaminho[] = q.options?.length
      ? q.options.map((o) => ({ ...respostas, [q.id]: [o.id] }))
      : [{ ...respostas, [q.id]: [] }]
    if (q.optional) saidas.push(respostas)
    for (const r of saidas) andar(proximaPergunta(uteis, i, r), r)
  }

  try {
    andar(proximaPergunta(uteis, -1), {})
  } catch {
    return new Set(uteis.map((q) => q.id))
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
 * A triagem na forma que o EDITOR usa: estrutura garantida, texto intocado.
 *
 * Existe por causa de um defeito que o normalizador do servidor causava quando
 * era aplicado a cada tecla: ele faz `trim()`, então o espaço digitado no fim
 * sumia antes da letra seguinte ("Em " virava "Em", e a frase saía
 * "Emqualcidade"); e ele descarta opção vazia, então a opção recém-criada morria
 * antes de aparecer — "+ Adicionar opção" não adicionava nada.
 *
 * O servidor continua limpando tudo ao gravar, e a conversa continua lendo a
 * forma limpa. Aqui só se garante o que a TELA precisa para não quebrar: tipo
 * válido, opções como objetos, as listas fixas de "sim/não" e de atendimento, e
 * as ligações só com pergunta anterior — essas, sim, com a mesma regra do
 * servidor, para que mover uma pergunta nunca deixe na tela uma ligação que a
 * conversa não vai seguir.
 *
 * Aplicar duas vezes dá o mesmo resultado, e é isso que permite usá-la em toda
 * alteração sem acumular efeito.
 */
export function triagemEmEdicao(raw: unknown): TriagemConfig {
  const bruto = (raw ?? {}) as Partial<TriagemConfig>
  const lista: unknown[] = Array.isArray(bruto.questions) ? bruto.questions : []
  const questions: PerguntaDeTriagem[] = []

  for (const item of lista) {
    if (questions.length === TRIAGEM_MAX_PERGUNTAS) break
    if (!item || typeof item !== 'object') continue
    const q = item as Partial<PerguntaDeTriagem>
    const kind: TipoDePergunta =
      q.kind && TIPOS_DE_PERGUNTA.includes(q.kind) ? q.kind : 'texto'
    const pergunta: PerguntaDeTriagem = {
      id: String(q.id ?? `t${questions.length + 1}`),
      kind,
      // Sem trim e sem juntar espaços: é o texto sendo digitado.
      label: typeof q.label === 'string' ? q.label.slice(0, TRIAGEM_LABEL_MAX) : '',
    }
    const opcoesBrutas: unknown[] = Array.isArray(q.options) ? q.options : []
    if (TIPOS_COM_OPCOES.includes(kind)) {
      // Opção VAZIA fica: é a que acabou de ser criada e ainda vai ser escrita.
      pergunta.options = opcoesBrutas.slice(0, TRIAGEM_MAX_OPCOES).map((o, j) => {
        const bruta = (typeof o === 'string' ? { texto: o } : (o ?? {})) as Partial<OpcaoDeTriagem>
        const opcao: OpcaoDeTriagem = {
          id: String(bruta.id ?? `o${j + 1}`),
          texto: typeof bruta.texto === 'string' ? bruta.texto.slice(0, TRIAGEM_OPCAO_MAX) : '',
        }
        if (bruta.encerra === true) opcao.encerra = true
        return opcao
      })
    } else if (OPCOES_FIXAS[kind]) {
      // Trocar o tipo para "sim/não" já traz as duas opções — sem elas não
      // haveria resposta a que ligar uma pergunta.
      pergunta.options = opcoesFixas(kind, opcoesBrutas)
    }
    if (q.optional === true) pergunta.optional = true
    const condicao = condicaoBruta(q.condicao)
    if (condicao) pergunta.condicao = condicao
    questions.push(pergunta)
  }

  limparLigacoes(questions, true)
  const semEtapas = etapasTiradas(bruto.semEtapas)
  return { enabled: bruto.enabled === true, questions, ...(semEtapas.length ? { semEtapas } : {}) }
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

/**
 * A conversa ainda faz esta pergunta embutida (dia e horário, formato, nome)?
 *
 * Só a triagem ATIVA tira alguma: sem ela o assistente é um agendador, e um
 * agendador sem dia e horário não teria o que agendar.
 */
export function etapaNaConversa(
  profile: Pick<Profile, 'triage' | 'plan'>,
  etapa: EtapaFixa,
): boolean {
  if (!triagemAtiva(profile)) return true
  return !(resolveTriagem(profile).semEtapas ?? []).includes(etapa)
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
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
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

// ---- O fluxograma, para o advogado conferir ---------------------------------
//
// A lista de perguntas do editor não responde à pergunta que ele realmente faz
// ("por onde a conversa passa?"): quem vê qual pergunta depende das respostas, e
// o roteiro inteiro tem a abertura, o aviso de segurança e o que vem DEPOIS da
// triagem — dia, horário, formato e nome.
//
// Cada passo estrutural aqui é decidido pela MESMA condição que a conversa usa
// (ver AssistantChat): é por isso que as condições chegam de fora, em vez de
// serem recalculadas aqui com outro critério.

/** Uma resposta dentro de um bloco do fluxograma. */
export interface RespostaNoMapa {
  id: string
  texto: string
  encerra: boolean
  /** os números (na lista do editor) das perguntas que esta resposta abre */
  abre: number[]
}

/** Uma pergunta do advogado, como caixa do fluxograma. */
export interface PerguntaNoMapa {
  tipo: 'pergunta'
  id: string
  /** a posição na lista do editor (1, 2, 3…) */
  numero: number
  texto: string
  kind: TipoDePergunta
  opcional: boolean
  respostas: RespostaNoMapa[]
  /** ninguém chega até aqui — ver `perguntasAlcancaveis` */
  inalcancavel: boolean
}

/**
 * Um desvio: as perguntas de dentro só são feitas a quem deu uma das respostas.
 *
 * Os ramos se ANINHAM quando a pergunta de dentro depende de outra que já está
 * no ramo — ela só pode ser feita se a de fora foi, então desenhá-la dentro é
 * dizer a verdade sobre o caminho, não uma escolha de layout.
 */
export interface RamoNoMapa {
  tipo: 'ramo'
  /** número da pergunta de que o ramo depende */
  numero: number
  /** o id dela e das respostas que abrem o ramo — é o que dá a cor da ligação */
  pergunta: string
  opcoes: { id: string; texto: string }[]
  itens: ItemDoMapa[]
}

export type ItemDoMapa = PerguntaNoMapa | RamoNoMapa

/** Um passo que o assistente faz sozinho, antes ou depois das perguntas. */
export interface PassoFixo {
  texto: string
  /** a pergunta embutida que este passo é — só as que o advogado pode tirar */
  etapa?: EtapaFixa
  /** o advogado tirou este passo da conversa */
  removida?: boolean
}

export interface MapaDaTriagem {
  inicio: PassoFixo
  itens: ItemDoMapa[]
  depois: PassoFixo[]
}

/**
 * O fluxograma inteiro, do jeito que o visitante vai percorrer.
 *
 * `perguntas` é a lista do EDITOR (a numeração sai dela, para bater com
 * "Editar a pergunta 3"); as contas de caminho usam a forma normalizada, que é a
 * que a conversa lê.
 */
export function mapaDaTriagem(
  perguntas: PerguntaDeTriagem[],
  contexto: {
    /** a grade tem horário para oferecer daqui para a frente */
    comHorarios: boolean
    /** o perfil atende presencial E online */
    dosDoisJeitos: boolean
    /** as perguntas embutidas que o advogado tirou da conversa */
    semEtapas?: EtapaFixa[]
  },
): MapaDaTriagem {
  const numeroPorId = new Map(perguntas.map((q, i) => [q.id, i + 1]))
  const normalizadas = normalizarTriagem({ enabled: true, questions: perguntas }).questions
  const uteis = perguntasUtilizaveis(normalizadas)
  const alcancaveis = perguntasAlcancaveis(normalizadas)
  const numero = (id: string) => numeroPorId.get(id) ?? 0

  const itens: ItemDoMapa[] = []
  /** os ramos abertos, de fora para dentro, com quem já está em cada um */
  const pilha: { ramo: RamoNoMapa; membros: Set<string> }[] = []
  const mesmaCondicao = (ramo: RamoNoMapa, c: CondicaoDaPergunta) =>
    ramo.pergunta === c.pergunta &&
    ramo.opcoes.length === c.opcoes.length &&
    ramo.opcoes.every((o) => c.opcoes.includes(o.id))

  for (const q of uteis) {
    const caixa: PerguntaNoMapa = {
      tipo: 'pergunta',
      id: q.id,
      numero: numero(q.id),
      texto: q.label,
      kind: q.kind,
      opcional: !!q.optional,
      respostas: (q.options ?? []).map((o) => ({
        id: o.id,
        texto: o.texto,
        encerra: !!o.encerra,
        abre: uteis
          .filter((x) => x.condicao?.pergunta === q.id && x.condicao.opcoes.includes(o.id))
          .map((x) => numero(x.id)),
      })),
      inalcancavel: !alcancaveis.has(q.id),
    }

    const c = q.condicao
    // Fecha os ramos a que esta pergunta não pertence: sem condição ela é feita
    // a todos; com condição, pertence ao ramo se depende de alguém de dentro
    // dele, ou se depende exatamente das mesmas respostas.
    while (pilha.length) {
      const topo = pilha[pilha.length - 1]
      if (c && (topo.membros.has(c.pergunta) || mesmaCondicao(topo.ramo, c))) break
      pilha.pop()
    }
    const destino = () => (pilha.length ? pilha[pilha.length - 1].ramo.itens : itens)

    if (c && !(pilha.length && mesmaCondicao(pilha[pilha.length - 1].ramo, c))) {
      const origem = uteis.find((x) => x.id === c.pergunta)
      const ramo: RamoNoMapa = {
        tipo: 'ramo',
        numero: numero(c.pergunta),
        pergunta: c.pergunta,
        opcoes: (origem?.options ?? [])
          .filter((o) => c.opcoes.includes(o.id))
          .map((o) => ({ id: o.id, texto: o.texto })),
        itens: [],
      }
      destino().push(ramo)
      pilha.push({ ramo, membros: new Set() })
    }
    destino().push(caixa)
    for (const p of pilha) p.membros.add(q.id)
  }

  // Os passos que o assistente faz sozinho. Os que o advogado TIROU continuam na
  // lista, marcados — é de onde a tela tira o "Devolver". Cada um só entra quando
  // de fato seria feito (mesmas condições da conversa).
  const tiradas = new Set(contexto.semEtapas ?? [])
  const etapa = (e: EtapaFixa, texto: string): PassoFixo =>
    tiradas.has(e) ? { texto, etapa: e, removida: true } : { texto, etapa: e }
  const depois: PassoFixo[] = []
  if (contexto.comHorarios) depois.push(etapa('horario', 'Escolher o dia e o horário na sua grade'))
  if (contexto.dosDoisJeitos && !uteis.some((q) => q.kind === 'atendimento')) {
    depois.push(etapa('formato', 'Presencial ou online'))
  }
  if (!uteis.some((q) => q.kind === 'contato')) depois.push(etapa('nome', 'Como posso te chamar?'))
  // Sem a etapa de horário, o fecho é o de pedido de contato — como na conversa.
  const pedeHorario = contexto.comHorarios && !tiradas.has('horario')
  depois.push({
    texto: pedeHorario
      ? 'Enviar tudo no seu WhatsApp — o horário só vale depois de você confirmar'
      : 'Enviar tudo no seu WhatsApp — você analisa e responde',
  })

  return {
    inicio: { texto: 'Abertura, com o aviso para não enviar documentos nem senhas' },
    itens,
    depois,
  }
}

// ---- Ligar uma resposta a uma pergunta --------------------------------------
//
// Os dois gestos do editor — "esta pergunta só abre se…" na pergunta, e "esta
// resposta abre…" no fluxograma — mexem no MESMO dado: a condição da pergunta de
// destino. Uma função só para os dois, para que não haja dois jeitos de
// discordar.

/** As perguntas anteriores de que a pergunta na posição `indice` pode depender. */
export interface FontePossivel {
  id: string
  numero: number
  rotulo: string
  opcoes: { id: string; texto: string }[]
}

export function fontesPossiveis(perguntas: PerguntaDeTriagem[], indice: number): FontePossivel[] {
  // Só para TRÁS, e só quem tem resposta para escolher: é a regra que torna a
  // espera por uma resposta futura impossível, e a tela não deve sequer
  // oferecer o que o servidor vai derrubar.
  return perguntas
    .slice(0, Math.max(indice, 0))
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => (q.options ?? []).some((o) => o.texto.trim()))
    .map(({ q, i }) => ({
      id: q.id,
      numero: i + 1,
      rotulo: `${i + 1}. ${q.label.trim() || 'Pergunta sem enunciado'}`,
      opcoes: (q.options ?? [])
        .filter((o) => o.texto.trim())
        .map((o) => ({ id: o.id, texto: o.texto.trim() })),
    }))
}

/**
 * Liga (ou desliga) "quem responder `opcaoId` na pergunta `fonteId` vê a
 * pergunta `alvoId`".
 *
 * Uma pergunta depende de UMA pergunta só. Ligar a ela uma resposta de outra
 * pergunta TROCA a dependência — a tela diz isso antes do toque. Desligar a
 * última resposta devolve a pergunta a todo mundo.
 */
export function ligarResposta(
  perguntas: PerguntaDeTriagem[],
  fonteId: string,
  opcaoId: string,
  alvoId: string,
  ligar: boolean,
): PerguntaDeTriagem[] {
  const fonte = perguntas.findIndex((q) => q.id === fonteId)
  const alvo = perguntas.findIndex((q) => q.id === alvoId)
  if (fonte < 0 || alvo <= fonte) return perguntas
  return perguntas.map((q) => {
    if (q.id !== alvoId) return q
    const c = q.condicao
    if (ligar) {
      const opcoes = c?.pergunta === fonteId ? [...new Set([...c.opcoes, opcaoId])] : [opcaoId]
      return { ...q, condicao: { pergunta: fonteId, opcoes } }
    }
    if (c?.pergunta !== fonteId) return q
    const opcoes = c.opcoes.filter((id) => id !== opcaoId)
    const { condicao: _fora, ...resto } = q
    return opcoes.length ? { ...q, condicao: { pergunta: fonteId, opcoes } } : resto
  })
}

/**
 * Dá para trocar a pergunta `i` de lugar com a de baixo sem soltar uma ligação?
 * Não, quando a de baixo depende dela: subir a dependente acima da pergunta de
 * que ela precisa desfaria o desenho em silêncio.
 */
export function podeTrocarComAProxima(perguntas: PerguntaDeTriagem[], i: number): boolean {
  const de = perguntas[i]
  const para = perguntas[i + 1]
  return !!de && !!para && para.condicao?.pergunta !== de.id
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

// Fronteira à esquerda com `(?:^|[^\p{L}])`, e não lookbehind: o Safari/iOS só
// entende lookbehind a partir do 16.4, e nos iPhones anteriores esta lista
// derrubava a conversa inteira. Aqui só importa SE casou (`.test`), então o
// separador que o prefixo consome não faz diferença.
const PEDIDOS_DE_ANALISE: RegExp[] = [
  /(?:^|[^\p{L}])(tenho|teria|tenh|temos)\s+(algum\s+)?direito(?![\p{L}])/iu,
  /(?:^|[^\p{L}])(posso|poderia|d[áa]\s+p(?:a|ra)ra?|cabe|caberia)\s+(eu\s+)?(process\w+|entrar\s+com|acionar|exigir|cobrar|pedir\s+indeniza\w+|recorrer|denunciar)(?![\p{L}])/iu,
  /(?:^|[^\p{L}])(cabe|caberia)\s+(alguma\s+)?(a[çc][ãa]o|processo|recurso|medida)(?![\p{L}])/iu,
  /(?:^|[^\p{L}])qual\s+(a[çc][ãa]o|processo|medida|recurso)\s+(eu\s+)?(devo|posso|teria)(?![\p{L}])/iu,
  /(?:^|[^\p{L}])o\s+que\s+(eu\s+)?(devo|posso|fa[çc]o|faria)\s*(fazer)?(?![\p{L}])/iu,
  /(?:^|[^\p{L}])(qual|quais|quanta?)\s+(a\s+|as\s+)?(minhas?\s+|nossas?\s+)?chances?(?![\p{L}])/iu,
  /(?:^|[^\p{L}])(tenho|temos|teria)\s+chances?(?![\p{L}])/iu,
  /(?:^|[^\p{L}])(vou|vamos|consigo|d[áa]\s+p(?:a|ra)ra?)\s+ganhar(?![\p{L}])/iu,
  /(?:^|[^\p{L}])isso\s+([ée]|seria)\s+(crime|ilegal|legal|abusiv\w+|justo|correto|permitido)(?![\p{L}])/iu,
  /(?:^|[^\p{L}])quanto\s+(eu\s+)?(vou|posso|d[áa]\s+p(?:a|ra)ra?|consigo)\s+(receber|ganhar)(?![\p{L}])/iu,
  /(?:^|[^\p{L}])vale\s+a\s+pena\s+(process\w+|entrar|recorrer|brigar)(?![\p{L}])/iu,
  /(?:^|[^\p{L}])(voc[êe]|tu)\s+acha\s+que(?![\p{L}])/iu,
  /(?:^|[^\p{L}])me\s+(diga|diz|fala|explica)\s+se(?![\p{L}])/iu,
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
