// MODELOS DE TRIAGEM E VOCABULÁRIO DO EDITOR.
//
// Fica FORA de lib/triagem.ts de propósito: aquele arquivo entra no pacote do
// minisite (a conversa do visitante o importa), e nada daqui é preciso para
// conversar — modelo e rótulo de tipo só existem na tela de quem monta.
//
// Sobre os modelos: são SUGESTÕES, e a tela diz isso com todas as letras. Nenhum
// deles é "o certo" para um escritório, nem está aprovado por ninguém — são o
// ponto de partida que evita a folha em branco. Todos são editáveis, e a primeira
// coisa que a tela pede é que sejam revistos.
//
// O que NENHUM modelo faz, e é o motivo de eles existirem prontos: pedir CPF,
// documento, dado de saúde, renda ou endereço. Quem começa de um modelo começa
// de uma triagem que já respeita a minimização de dados (LGPD, art. 6º, III) —
// e é por isso que o modelo é o caminho recomendado na tela. Há teste travando
// isso (triagemModelos.spec.ts): modelo novo que peça dado sensível não passa.

import {
  TRIAGEM_MAX_OPCOES,
  type OpcaoDeTriagem,
  type PerguntaDeTriagem,
  type TipoDePergunta,
} from './triagem'

// ---- Vocabulário dos tipos, para o editor ----------------------------------

export interface TipoMeta {
  /** nome do tipo na lista de escolha */
  label: string
  /** o que ele vira na conversa, em uma linha */
  hint: string
  /** como a resposta aparece, para a prévia da ficha */
  exemplo: string
}

export const TIPO_META: Record<TipoDePergunta, TipoMeta> = {
  texto: {
    label: 'Resposta curta',
    hint: 'Uma linha escrita por quem visita.',
    exemplo: 'campo de uma linha',
  },
  'texto-longo': {
    label: 'Resposta longa',
    hint: 'Algumas frases — para “conte brevemente o que aconteceu”.',
    exemplo: 'campo de algumas frases',
  },
  escolha: {
    label: 'Escolher uma',
    hint: 'Você escreve as opções; quem visita toca em uma.',
    exemplo: 'uma opção',
  },
  multipla: {
    label: 'Escolher quantas quiser',
    hint: 'Mesma coisa, mas dá para marcar mais de uma.',
    exemplo: 'uma ou mais opções',
  },
  'sim-nao': {
    label: 'Sim ou não',
    hint: 'Duas opções, sem você escrever nada.',
    exemplo: 'Sim · Não',
  },
  data: {
    label: 'Data',
    hint: 'Um dia do calendário — “quando isso aconteceu?”.',
    exemplo: 'uma data',
  },
  atendimento: {
    label: 'Presencial ou online',
    hint: 'Usa as formas de atendimento do seu perfil e vai como “Formato” na mensagem.',
    exemplo: 'Presencial · Online',
  },
  contato: {
    label: 'Como posso te chamar',
    hint: 'O nome de quem escreve — vai como “Nome” na mensagem.',
    exemplo: 'o primeiro nome',
  },
}

/** A ordem em que os tipos aparecem para escolher — do mais usado ao mais raro. */
export const TIPOS_NA_ORDEM: TipoDePergunta[] = [
  'escolha',
  'sim-nao',
  'texto-longo',
  'texto',
  'multipla',
  'atendimento',
  'data',
  'contato',
]

let uid = 0
const novoId = () => `tr-${Date.now().toString(36)}-${uid++}`

/** Uma opção em branco, com id próprio — é o id que segura o caminho que sai dela. */
export function novaOpcao(texto = ''): OpcaoDeTriagem {
  return { id: novoId(), texto }
}

/** Uma lista de opções a partir de textos soltos (modelos e prévias). */
const opcoes = (...textos: string[]): OpcaoDeTriagem[] => textos.map((t) => novaOpcao(t))

/** Uma pergunta em branco do tipo pedido, pronta para o advogado escrever. */
export function novaPergunta(kind: TipoDePergunta = 'escolha'): PerguntaDeTriagem {
  const base: PerguntaDeTriagem = { id: novoId(), kind, label: '' }
  // Escolha nasce com duas linhas de opção: uma lista com um item não é lista, e
  // começar do zero esconde que existem opções a escrever.
  if (kind === 'escolha' || kind === 'multipla') base.options = [novaOpcao(), novaOpcao()]
  if (kind === 'atendimento') base.label = 'Como prefere o atendimento?'
  if (kind === 'contato') base.label = 'Como posso te chamar?'
  return base
}

/** Reidentifica as perguntas de um modelo — ids novos a cada vez que se aplica. */
function comIds(questions: Omit<PerguntaDeTriagem, 'id'>[]): PerguntaDeTriagem[] {
  return questions.map((q) => ({ ...q, id: novoId() }))
}

// ---- Modelos ---------------------------------------------------------------

export interface ModeloDeTriagem {
  id: string
  nome: string
  /** a quem serve, em uma linha */
  resumo: string
  questions: PerguntaDeTriagem[]
}

const OUTRO = 'Outro assunto'
const CONTE: Omit<PerguntaDeTriagem, 'id'> = {
  kind: 'texto-longo',
  label: 'Conte brevemente o que aconteceu.',
}
const NOME: Omit<PerguntaDeTriagem, 'id'> = { kind: 'contato', label: 'Como posso te chamar?' }
const FORMATO: Omit<PerguntaDeTriagem, 'id'> = {
  kind: 'atendimento',
  label: 'Como prefere o atendimento?',
}

/**
 * Os modelos disponíveis. O primeiro usa as ÁREAS DO PRÓPRIO PERFIL como opções
 * de assunto: uma lista genérica de matérias num perfil de advogado de família
 * seria a triagem contradizendo a página em que ela está.
 */
export function modelosDeTriagem(areas: string[] = []): ModeloDeTriagem[] {
  const minhasAreas = [...new Set(areas.map((a) => a.trim()).filter(Boolean))].slice(
    0,
    TRIAGEM_MAX_OPCOES - 1,
  )
  const assuntoGeral: Omit<PerguntaDeTriagem, 'id'> = {
    kind: 'escolha',
    label: 'Qual assunto você deseja tratar?',
    options: opcoes(...(minhasAreas.length ? [...minhasAreas, OUTRO] : ['Família', 'Trabalhista', 'Cível', OUTRO])),
  }

  return [
    {
      id: 'geral',
      nome: 'Triagem geral',
      resumo: 'Serve a qualquer área — começa pelos assuntos do seu perfil.',
      questions: comIds([
        assuntoGeral,
        { kind: 'sim-nao', label: 'Você já possui processo sobre esse assunto?' },
        FORMATO,
        CONTE,
        NOME,
      ]),
    },
    {
      id: 'familia',
      nome: 'Direito de Família',
      resumo: 'Divórcio, guarda, pensão e inventário.',
      questions: comIds([
        {
          kind: 'escolha',
          label: 'Sobre qual situação você quer falar?',
          options: opcoes('Divórcio ou separação', 'Guarda ou convivência', 'Pensão alimentícia', 'Inventário ou herança', 'União estável', OUTRO),
        },
        { kind: 'sim-nao', label: 'Já existe processo em andamento?' },
        FORMATO,
        { kind: 'texto-longo', label: 'Conte brevemente a situação, em linhas gerais.' },
        NOME,
      ]),
    },
    {
      id: 'trabalhista',
      nome: 'Direito do Trabalho',
      resumo: 'Rescisão, verbas, jornada e acidente.',
      questions: comIds([
        {
          kind: 'escolha',
          label: 'Sobre qual situação você quer falar?',
          options: opcoes('Demissão ou rescisão', 'Verbas não pagas', 'Horas extras ou jornada', 'Assédio no trabalho', 'Acidente de trabalho', OUTRO),
        },
        {
          kind: 'escolha',
          label: 'Você fala como empregado ou como empregador?',
          options: opcoes('Empregado', 'Empregador'),
        },
        { kind: 'sim-nao', label: 'Você ainda está nesse emprego?' },
        CONTE,
        NOME,
      ]),
    },
    {
      id: 'previdenciario',
      nome: 'Direito Previdenciário',
      resumo: 'Benefícios do INSS e revisões.',
      questions: comIds([
        {
          kind: 'escolha',
          label: 'Sobre qual benefício você quer falar?',
          options: opcoes('Aposentadoria', 'Auxílio por incapacidade', 'BPC/LOAS', 'Pensão por morte', 'Revisão de benefício', OUTRO),
        },
        { kind: 'sim-nao', label: 'Você já fez esse pedido no INSS?' },
        {
          kind: 'escolha',
          label: 'Se já pediu, qual foi a resposta?',
          options: opcoes('Ainda sem resposta', 'Negado', 'Concedido', 'Ainda não pedi'),
          optional: true,
        },
        { kind: 'texto-longo', label: 'Conte brevemente a sua situação, em linhas gerais.' },
        NOME,
      ]),
    },
    {
      id: 'empresarial',
      nome: 'Direito Empresarial',
      resumo: 'Contratos, sociedade e cobrança.',
      questions: comIds([
        {
          kind: 'escolha',
          label: 'Sobre qual assunto você quer falar?',
          options: opcoes('Abertura ou alteração de empresa', 'Contratos', 'Cobrança ou inadimplência', 'Sociedade e sócios', OUTRO),
        },
        {
          kind: 'escolha',
          label: 'Você fala pela empresa ou como pessoa física?',
          options: opcoes('Pela empresa', 'Como pessoa física'),
        },
        FORMATO,
        { kind: 'texto-longo', label: 'Conte brevemente o que você precisa.' },
        NOME,
      ]),
    },
    {
      id: 'civel',
      nome: 'Direito Civil e do Consumidor',
      resumo: 'Contratos, cobrança, imóveis e consumo.',
      questions: comIds([
        {
          kind: 'escolha',
          label: 'Sobre qual situação você quer falar?',
          options: opcoes('Contrato não cumprido', 'Cobrança indevida', 'Problema com produto ou serviço', 'Imóvel ou aluguel', 'Vizinhança', OUTRO),
        },
        { kind: 'sim-nao', label: 'Você já tentou resolver diretamente com a empresa ou pessoa?' },
        FORMATO,
        CONTE,
        NOME,
      ]),
    },
  ]
}

/** A ressalva que acompanha todo modelo. Nunca “adequado”, nunca “aprovado”. */
export const AVISO_DOS_MODELOS = 'Modelo inicial — revise antes de publicar.'
