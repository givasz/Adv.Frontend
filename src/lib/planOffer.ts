// A OFERTA COMERCIAL — o que cada plano promete a quem ainda não comprou.
//
// Fonte ÚNICA. Antes, a lista de benefícios estava escrita à mão em dois lugares
// (a home e a vitrine do editor) e os recursos de verdade em um terceiro
// (planFeatures.ts). O resultado foi previsível: as três listas discordavam, e a
// que o comprador via era a que prometia o que o produto não fazia.
//
// ---------------------------------------------------------------------------
// A REGRA DESTE ARQUIVO: aqui só entra o que o produto FAZ HOJE.
//
// Não é escrúpulo, é conversão. Quem assina por causa de uma frase e não encontra
// o recurso não vira reembolso — vira alguém que conta a outros advogados que a
// plataforma promete o que não cumpre. Num mercado onde todo mundo se conhece
// pela seccional, essa conta é cara. Recurso que ainda não existe entra com
// `emPreparo: true` e NÃO ganha o ✓ dos demais.
// ---------------------------------------------------------------------------
//
// Sobre o tom: vendemos "seu perfil fica melhor e dentro das regras", nunca
// "você consegue mais clientes". Prometer captação a um advogado é oferecer
// exatamente o que o Prov. 205/2021 proíbe A ELE — e seria a primeira frase que
// uma fiscalização citaria, contra ele e contra a plataforma. Ver REGRAS.md.

import type { Plan } from './types'
import { AI_MIN_PLAN } from './aiFeatures'
import { AREA_LIMIT, CHAR_LIMITS, FAQ_LIMIT, FIRM_PRICING, PLAN_PRICE, precoDoPlano } from './plans'
import { THEMES, isThemeUnlocked } from './themes'

/**
 * O pagamento on-line já está ligado?
 *
 * Hoje NÃO: o provedor de pagamento ainda está sendo integrado. Enquanto isso, o
 * checkout ativa o plano e diz isso com todas as letras — é a ÚNICA tela que fala
 * nesse assunto. A home, a vitrine do editor e o painel mostram os planos como
 * eles são (preço de tabela, cobrança mensal), sem "grátis nos testes": a oferta
 * que a pessoa lê hoje é a mesma que ela vai pagar amanhã.
 *
 * Quando o provedor entrar, troque para `true` e o checkout deixa de avisar.
 */
export const PAGAMENTO_ONLINE_DISPONIVEL = false

const temaCount = (p: Plan) => THEMES.filter((t) => isThemeUnlocked(t, p)).length

export interface OfferItem {
  text: string
  /**
   * Recurso ANUNCIADO mas ainda não disponível. Aparece com marca própria e sem
   * o ✓ — um item "em breve" com o mesmo check dos outros é uma promessa de algo
   * que o comprador não vai encontrar.
   */
  emPreparo?: boolean
}

export interface PlanOffer {
  id: Plan | 'firm'
  name: string
  /** preço de tabela — o que é cobrado por mês */
  price: string
  period: string
  /** o que este plano acrescenta ao perfil, em uma linha */
  pitch: string
  items: OfferItem[]
  /**
   * O que este plano NÃO inclui. Dito na cara, e não pela ausência.
   *
   * É o item que mais converte da página inteira, e o mais honesto: quem escolhe
   * o Free precisa saber, ANTES, que não vai encontrar agendamento — senão passa
   * meia hora procurando e a conclusão dele não é "preciso do Pro", é "esse
   * produto é confuso".
   */
  falta?: string[]
  featured?: boolean
  ctaTo: string
  ctaLabel: string
  secondaryTo?: string
  secondaryLabel?: string
}

// ---- Textos que já foram promessas erradas ---------------------------------
//
// Cada constante abaixo substitui uma frase que estava no ar e não se sustentava.
// Ficam nomeadas para que a correção não seja desfeita por descuido numa próxima
// rodada de copy.

/**
 * O assistente NÃO marca horário nenhum.
 *
 * Era "Assistente virtual que marca horários por você". Ele é um roteiro fechado
 * (dia → horário → assunto → nome) que termina numa mensagem de WhatsApp para o
 * advogado — quem marca é ele, respondendo. Ver lib/assistant.ts. A frase antiga
 * vendia uma agenda automática que não existe, e a agenda nativa foi REMOVIDA em
 * 21/08 justamente para não guardar dado de visitante.
 */
const ASSISTENTE =
  'Assistente de agendamento: quem visita escolhe dia e horário, e o pedido chega pronto no seu WhatsApp'

// O balão é do MESMO assistente, e por isso entra como linha própria em vez de
// virar um plano à parte: o que o Pro compra é a conversa; onde ela fica à mão é
// preferência de quem publica. Descrito pelo que ele faz — "atalho", "se quiser"
// —, sem o vocabulário de conversão que a norma de publicidade não admite.
const BALAO =
  'Atalho de conversa fixo no canto do perfil, se você quiser — dá para deixar desligado'

/**
 * `advoc.me` é o nome do produto, NÃO um domínio no ar — os perfis hoje ficam em
 * advocme.netlify.app (ver lib/publicUrl.ts, que existe por causa de um QR Code
 * que apontava para o endereço inexistente). Prometer "advoc.me/seu-nome" é
 * vender um endereço que o comprador não recebe. O ganho real do Pro é outro, e
 * é verdadeiro: o Free carimba um número no fim do endereço, o Pro não.
 */
const ENDERECO = 'Endereço com o seu nome, sem o número que o Free carimba no fim'

export const PLAN_OFFERS: PlanOffer[] = [
  {
    id: 'free',
    name: 'Free',
    price: precoDoPlano('free'),
    period: 'para sempre',
    pitch: 'Um perfil profissional, no ar em minutos.',
    items: [
      { text: 'Perfil público conferido antes de publicar' },
      { text: `Até ${AREA_LIMIT.free} áreas de atuação` },
      { text: `Bio de até ${CHAR_LIMITS.free.bio} caracteres` },
      { text: 'WhatsApp, e-mail e redes sociais' },
      { text: `${temaCount('free')} temas visuais` },
      { text: 'A IA escreve a bio e a descrição das áreas' },
    ],
    falta: [
      'Sem agendamento pelo perfil',
      'Sem perguntas frequentes',
      'Endereço com número no fim e rodapé “criado com advoc.me”',
    ],
    ctaTo: '/comecar',
    ctaLabel: 'Começar no Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: precoDoPlano('pro'),
    period: '/mês',
    pitch: 'Agendamento e respostas às dúvidas de sempre.',
    featured: true,
    items: [
      { text: ASSISTENTE },
      { text: BALAO },
      { text: `${FAQ_LIMIT.pro} perguntas frequentes respondidas no perfil` },
      { text: ENDERECO },
      { text: 'Cartão digital: QR Code em alta e seu contato em vCard' },
      // Entrou quando o recurso passou a existir. Antes, esta promessa morava só
      // no cartão de venda DENTRO do editor — e ali ela prometia três coisas, das
      // quais nenhuma era entregue: a tela lia um contador que ninguém
      // incrementava e mostrava 0 visitas para todo mundo. "Origem das visitas"
      // ficou de fora de propósito: saber de onde a pessoa veio exige guardar de
      // onde ela veio, e não guardamos dado de visitante.
      { text: 'Relatório do perfil: visitas, botões usados e horários de maior procura' },
      { text: `Até ${AREA_LIMIT.pro} áreas e bio de ${CHAR_LIMITS.pro.bio} caracteres` },
      { text: `${temaCount('pro')} dos ${THEMES.length} temas visuais` },
      { text: 'A IA também escreve sua frase de apresentação e revisa seus textos' },
    ],
    falta: [
      'Sem vídeo, cartão para a gráfica e cor própria',
      'Rodapé “criado com advoc.me” continua',
    ],
    ctaTo: '/comecar?plan=pro',
    ctaLabel: 'Assinar Pro',
  },
  {
    id: 'premium',
    name: 'Max',
    price: precoDoPlano('premium'),
    period: '/mês',
    pitch: 'O perfil com a sua identidade, não a nossa.',
    items: [
      { text: 'Tudo do Pro, e mais:' },
      { text: 'Vídeo de apresentação no fim do perfil' },
      // Estava faltando na home — e é o recurso mais palpável do Max: sai um PDF
      // pronto para a gráfica, com frente, verso, sangria e marcas de corte.
      { text: 'Cartão de visita pronto para a gráfica, em PDF' },
      { text: `Até ${FAQ_LIMIT.premium} perguntas frequentes (eram ${FAQ_LIMIT.pro})` },
      { text: 'Sua cor e sua marca — o rodapé advoc.me some' },
      { text: 'Comprovante de conformidade em PDF, quando precisar mostrar' },
      { text: `Até ${AREA_LIMIT.premium} áreas e bio de ${CHAR_LIMITS.premium.bio} caracteres` },
      { text: `Os ${THEMES.length} temas visuais` },
    ],
    ctaTo: '/comecar?plan=premium',
    ctaLabel: 'Assinar Max',
  },
  {
    id: 'firm',
    name: 'Escritório',
    price: `R$ ${FIRM_PRICING.basePrice}`,
    period: '/mês',
    pitch: 'Toda a equipe reunida numa página.',
    items: [
      { text: 'Página institucional da sociedade' },
      { text: `${FIRM_PRICING.includedSeats} advogados inclusos` },
      { text: `+ R$ ${FIRM_PRICING.extraSeatPrice}/mês por advogado adicional` },
      { text: 'Perfil Pro completo para cada advogado da equipe' },
      { text: 'Assistente do escritório encaminha por área ao advogado certo' },
      { text: 'Marca do escritório no lugar da nossa' },
    ],
    ctaTo: '/escritorio/editar',
    ctaLabel: 'Criar escritório',
    secondaryTo: '/escritorio/andrade-vieira',
    secondaryLabel: 'Ver um exemplo',
  },
]

/** A oferta de um plano, para telas que mostram um só. */
export function offerOf(id: PlanOffer['id']): PlanOffer {
  const o = PLAN_OFFERS.find((p) => p.id === id)
  if (!o) throw new Error(`Plano sem oferta: ${id}`)
  return o
}

// ---- A tabela comparativa ---------------------------------------------------
//
// Os cartões vendem; a tabela responde. Quem está decidindo entre Pro e Max quer
// saber "e vídeo, tem no Pro?" sem ler nove linhas de cada cartão — e a resposta
// tem de ser a mesma que o editor vai dar depois. Por isso cada célula é
// calculada a partir de plans.ts, themes.ts e aiFeatures.ts, e nunca digitada.
//
// `true` = incluído (✓), `false` = não incluído (—), texto = o valor daquele
// plano ("6 áreas", "com número no fim").

export type CompareValue = string | boolean

export interface CompareRow {
  label: string
  /** uma linha a mais, quando o rótulo sozinho não explica */
  hint?: string
  values: Record<Plan, CompareValue>
  /** recurso ainda não disponível em nenhum plano */
  emPreparo?: boolean
}

export interface CompareGroup {
  title: string
  rows: CompareRow[]
}

const PLANS: Plan[] = ['free', 'pro', 'premium']
const RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

/** Uma linha de "incluído a partir do plano X". */
function aPartirDe(minimo: Plan): Record<Plan, boolean> {
  return Object.fromEntries(PLANS.map((p) => [p, RANK[p] >= RANK[minimo]])) as Record<Plan, boolean>
}

/** Uma linha com um valor por plano, calculada. */
function porPlano(f: (p: Plan) => CompareValue): Record<Plan, CompareValue> {
  return Object.fromEntries(PLANS.map((p) => [p, f(p)])) as Record<Plan, CompareValue>
}

const ia = (recurso: keyof typeof AI_MIN_PLAN) => aPartirDe(AI_MIN_PLAN[recurso])

export const PLAN_COMPARE: CompareGroup[] = [
  {
    title: 'Conteúdo do perfil',
    rows: [
      { label: 'Áreas de atuação', values: porPlano((p) => `${AREA_LIMIT[p]}`) },
      {
        label: 'Apresentação (bio)',
        hint: 'tamanho máximo, em caracteres',
        values: porPlano((p) => `${CHAR_LIMITS[p].bio}`),
      },
      {
        label: 'Frase de apresentação',
        hint: 'caracteres',
        values: porPlano((p) => `${CHAR_LIMITS[p].headline}`),
      },
      {
        label: 'Descrição de cada área',
        hint: 'caracteres',
        values: porPlano((p) => `${CHAR_LIMITS[p].areaDesc}`),
      },
      {
        label: 'Perguntas frequentes respondidas',
        values: porPlano((p) => (FAQ_LIMIT[p] > 0 ? `${FAQ_LIMIT[p]}` : false)),
      },
      { label: 'Vídeo de apresentação', values: aPartirDe('premium') },
    ],
  },
  {
    title: 'Contato e atendimento',
    rows: [
      { label: 'WhatsApp, e-mail e redes sociais', values: aPartirDe('free') },
      {
        label: 'Assistente de agendamento',
        hint: 'o pedido chega pronto no seu WhatsApp',
        values: aPartirDe('pro'),
      },
      { label: 'Atalho de conversa no canto do perfil', values: aPartirDe('pro') },
      { label: 'Cartão digital (QR Code e vCard)', values: aPartirDe('pro') },
      { label: 'Cartão de visita para a gráfica (PDF)', values: aPartirDe('premium') },
    ],
  },
  {
    title: 'Endereço e identidade visual',
    rows: [
      {
        label: 'Endereço do perfil',
        values: { free: 'com número no fim', pro: 'só o seu nome', premium: 'só o seu nome' },
      },
      { label: 'Temas visuais', values: porPlano((p) => `${temaCount(p)} de ${THEMES.length}`) },
      { label: 'Cor de destaque e nome do escritório', values: aPartirDe('premium') },
      {
        label: 'Rodapé “criado com advoc.me”',
        values: { free: 'aparece', pro: 'aparece', premium: 'você tira' },
      },
    ],
  },
  {
    title: 'Conformidade e apoio',
    rows: [
      { label: 'Checagem de conformidade antes de publicar', values: aPartirDe('free') },
      { label: 'Link para a consulta pública do CNA', values: aPartirDe('free') },
      { label: 'IA escreve a bio e a descrição das áreas', values: ia('bio') },
      { label: 'IA escreve a frase de apresentação e revisa textos', values: ia('headline') },
      {
        label: 'IA com cidade e áreas no texto',
        hint: 'apresentação mais completa',
        values: aPartirDe('premium'),
      },
      {
        label: 'Relatório do perfil',
        hint: 'visitas, botões usados e horários',
        values: aPartirDe('pro'),
      },
      { label: 'Comprovante de conformidade em PDF', values: aPartirDe('premium') },
    ],
  },
  {
    title: 'Sua conta',
    rows: [
      { label: 'Trocar de plano quando quiser', values: aPartirDe('free') },
      { label: 'Baixar e excluir seus dados', values: aPartirDe('free') },
      { label: 'Cartão de crédito para começar', values: { free: 'não pede', pro: true, premium: true } },
    ],
  },
]

// ---- Como a cobrança funciona ----------------------------------------------
//
// Uma lista só, lida pela home e pelo checkout — os dois lugares onde alguém
// decide gastar dinheiro. São compromissos, não copy: cada linha tem um
// mecanismo por trás (lib/assinatura.ts, lib/rebaixamento.ts, docs/cobranca.md)
// e reaparece nos Termos de Uso com o mesmo sentido.

export const REGRAS_DE_COBRANCA: string[] = [
  'Cobrança mensal, sem fidelidade. Cancele quando quiser — o mês já pago vale até o fim.',
  'Descer de plano ou voltar ao Free não apaga nada: o que exceder o novo plano fica guardado e volta se você voltar.',
  // Esta linha já disse "o endereço nunca muda", e deixou de ser verdade quando o
  // endereço limpo passou a ser um perk que volta ao padrão do Free. Uma promessa
  // dessas quebrada é pior que a própria mudança — o QR impresso não abre e a
  // pessoa lembra de ter lido o contrário aqui.
  'Entre planos pagos o endereço do perfil não muda. Voltando ao Free, ele ganha um número no fim depois de 7 dias — avisados no painel, com a data.',
  'Arrependeu-se? Em até 7 dias da primeira contratação, devolvemos o valor integral.',
  'Se a cobrança falhar, você é avisado no painel com a data — o perfil segue no ar e nada é apagado.',
  'Os dados do cartão ficam com o provedor de pagamento, nunca conosco.',
]

/** Uma linha só, para o lugar onde não cabe a lista. */
export const RESUMO_DA_COBRANCA = 'Cobrado por mês · cancele quando quiser'

/** O preço do plano em uma frase completa, para leitores de tela e resumos. */
export function precoMensal(plan: Exclude<Plan, 'free'>): string {
  return `R$ ${PLAN_PRICE[plan]} por mês`
}
