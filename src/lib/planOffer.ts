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
import { AREA_LIMIT, CHAR_LIMITS, FAQ_LIMIT, FIRM_PRICING } from './plans'
import { THEMES, isThemeUnlocked } from './themes'

/**
 * A cobrança está ligada?
 *
 * Hoje NÃO: o checkout ativa o plano e mostra "Total hoje: R$ 0,00" (ver
 * CheckoutPage). A home mostrava "R$ 19/mês" sem dizer nada disso — quem chegava
 * ao checkout descobria sozinho, e a diferença entre as duas telas é exatamente o
 * tipo de coisa que faz alguém desconfiar do resto.
 *
 * Dizer a verdade aqui também é a oferta mais forte que existe hoje, e a única
 * honesta: o plano está aberto durante os testes. Quando o pagamento entrar,
 * troque para `false` e todas as telas se ajustam sozinhas.
 */
export const COBRANCA_ATIVA = false

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
  /** preço de tabela (o que será cobrado quando a cobrança entrar) */
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
    price: 'R$ 0',
    period: 'para sempre',
    pitch: 'Um perfil profissional, no ar em minutos.',
    items: [
      { text: 'Perfil público conferido antes de publicar' },
      { text: `Até ${AREA_LIMIT.free} áreas de atuação` },
      { text: `Bio de até ${CHAR_LIMITS.free.bio} caracteres` },
      { text: 'WhatsApp, e-mail e redes sociais' },
      { text: `${temaCount('free')} temas visuais` },
    ],
    falta: [
      'Sem agendamento pelo perfil',
      'Sem perguntas frequentes',
      'Endereço com número no fim e rodapé “criado com advoc.me”',
    ],
    ctaTo: '/comecar',
    ctaLabel: 'Criar meu perfil grátis',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 19',
    period: '/mês',
    pitch: 'Agendamento e respostas às dúvidas de sempre.',
    featured: true,
    items: [
      { text: ASSISTENTE },
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
    ctaTo: '/comecar?plan=pro',
    ctaLabel: 'Assinar Pro',
  },
  {
    id: 'premium',
    name: 'Max',
    price: 'R$ 39',
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
      { text: 'Domínio próprio (.adv.br)', emPreparo: true },
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

/**
 * A linha que explica o preço enquanto a cobrança não existe.
 *
 * Não é um truque de urgência: é o que o checkout já diz há semanas ("Total hoje:
 * R$ 0,00"). A home é que estava calada — e uma home que anuncia R$ 19 levando a
 * um checkout de R$ 0 não parece generosa, parece descuidada.
 */
export function avisoDeCobranca(): string | null {
  if (COBRANCA_ATIVA) return null
  return 'Plataforma em teste: os planos estão abertos sem cobrança. Você ativa agora e volta ao Free quando quiser.'
}

/** Selo curto do mesmo aviso, para caber dentro do cartão do plano. */
export function seloDeCobranca(): string | null {
  return COBRANCA_ATIVA ? null : 'sem cobrança nos testes'
}
