import type { Plan } from './types'

// Limites de caracteres por campo, escalando com o plano ("Proposto").
// ⚠️ MANTER EM SINCRONIA com backend/src/plans.ts (o backend é a fonte da verdade).
//
// O Free é APERTADO de propósito (revisão de 04/09/2026). Ele entrega UMA área e
// UMA pergunta, e com campos curtos — porque um campo largo com cota de um vira
// convite a empilhar: "Família, Sucessões e Inventários" num rótulo só, duas
// perguntas dentro da mesma pergunta. Isso não é o advogado sendo esperto, é a
// tela pedindo por isso. Cota pequena com campo grande é uma regra que se anula
// sozinha; quem quer listar mais assunto assina o plano que vende mais assunto.
//
// Os planos pagos ficam folgados: lá a cota já dá o espaço, e apertar o texto
// seria mesquinhez sem função.
export type LimitedField = 'headline' | 'bio' | 'areaDesc'

export const CHAR_LIMITS: Record<Plan, Record<LimitedField, number>> = {
  free: { headline: 50, bio: 240, areaDesc: 110 },
  pro: { headline: 90, bio: 600, areaDesc: 280 },
  premium: { headline: 120, bio: 1000, areaDesc: 400 },
}

export function charLimit(plan: Plan, field: LimitedField): number {
  return CHAR_LIMITS[plan][field]
}

// Número máximo de áreas de atuação por plano (usado no editor).
// Free = UMA: a área principal, aquela pela qual o advogado quer ser encontrado.
//
// Pro 6 → 4 e Max 20 → 12 em 04/09/2026. Vinte áreas nunca foi generosidade: um
// perfil que lista vinte assuntos não diz a quem chega o que aquele advogado faz,
// diz que ele faz tudo — e "faz tudo" é o que se lê como "não é de nada". A
// escada continua clara (1 → 4 → 12) e cada degrau ainda vale o que cobra.
export const AREA_LIMIT: Record<Plan, number> = { free: 1, pro: 4, premium: 12 }

// Perguntas frequentes respondidas no perfil: 1 no Free, 2 no Pro, 5 no Max.
// O Free tinha ZERO até 04/09/2026 — uma pergunta é o suficiente para o recurso
// existir e ser entendido, e é o que dá sentido ao teto dos planos pagos.
export const FAQ_LIMIT: Record<Plan, number> = { free: 1, pro: 2, premium: 5 }

// ---- Tetos de TEXTO dos campos de cota ------------------------------------
//
// Estes três eram números fixos, iguais em todos os planos. Viraram tabela pelo
// mesmo motivo do bloco lá em cima: no Free a cota é um, e um campo generoso
// transforma o campo único numa lista disfarçada.
//
// O rótulo da área cabe em 32 no Free porque é o tamanho de um nome de área de
// verdade — "Direito de Família e Sucessões" tem 30. O que não cabe em 32 quase
// sempre é enumeração, e enumeração tem trava própria (ver lib/campoUnico.ts).
export const AREA_LABEL_MAX: Record<Plan, number> = { free: 32, pro: 40, premium: 40 }

// FAQ é orientação geral, não parecer. Resposta longa no celular vira parede de
// texto — e quanto mais texto, mais chance de escorregar para fora do que o
// Prov. 205/2021 permite.
export const FAQ_QUESTION_MAX: Record<Plan, number> = { free: 80, pro: 100, premium: 100 }

// 300 → 220 em 27/08/2026. A 300, a IA escrevia até encostar no teto e a resposta
// saía com cinco linhas no celular — exatamente a parede de texto que o comentário
// acima queria evitar. 220 cabe em duas ou três frases, que é o formato de uma
// orientação geral. O número é passado à IA no pedido (ver Editor.aiLimit).
export const FAQ_ANSWER_MAX: Record<Plan, number> = { free: 160, pro: 220, premium: 220 }

/**
 * Responder perguntas frequentes no perfil.
 *
 * Deixou de ser "recurso dos planos pagos" em 04/09/2026 e passou a ser a
 * pergunta que a tabela responde: este plano tem cota maior que zero? Assim o
 * portão nunca discorda do número anunciado — foi lendo a tabela que o Free
 * ganhou a primeira pergunta, sem precisar caçar `plan === 'pro'` por sete
 * arquivos.
 */
export function canUseFaq(plan: Plan): boolean {
  return FAQ_LIMIT[plan] > 0
}

/**
 * Cartão digital do advogado: QR em resolução de impressão + contato em vCard.
 * Recurso dos planos pagos — é material de MARKETING (cartão de visita, vitrine,
 * assinatura de e-mail), diferente do botão de compartilhar que o visitante usa
 * no perfil público, que segue livre para qualquer um.
 */
export function canUseDigitalCard(plan: Plan): boolean {
  return plan === 'pro' || plan === 'premium'
}

/**
 * Cartão de visita para IMPRIMIR (arte pronta para a gráfica) — exclusivo do Max.
 * É outra coisa do cartão digital acima: aqui sai arquivo de impressão, com
 * sangria e marcas de corte. Ver lib/cardArt.ts.
 */
export function canUsePrintCard(plan: Plan): boolean {
  return plan === 'premium'
}

/** Vídeo de apresentação no perfil — também exclusivo do Max. */
export function canUseVideo(plan: Plan): boolean {
  return plan === 'premium'
}

// Tetos FIXOS (iguais em todos os planos) — sanidade/anti-abuso, não são recurso de plano.
export const NAME_MAX = 70 // cabe qualquer nome real; evita layout/slug quebrados
export const OAB_MAX = 20 // ex.: "OAB/SP 123.456"

// Agendamento (qualquer forma: link externo OU agenda nativa) — recurso dos planos
// pagos. No Free não há botão "Agendar". MANTER EM SINCRONIA com backend/src/plans.ts.
export function canUseScheduling(plan: Plan): boolean {
  return plan === 'pro' || plan === 'premium'
}

// Agenda nativa (cliente marca dia/hora, advogado aceita/recusa) — também só nos pagos.
export function canUseNativeAgenda(plan: Plan): boolean {
  return plan === 'pro' || plan === 'premium'
}

// ---- Preço dos planos individuais — FONTE ÚNICA ----
//
// Estava escrito em QUATRO lugares: planOffer.ts (a home e o editor), upsell.ts
// (o convite que aparece ao esbarrar num recurso pago), UnlockMore.tsx (o cartão
// do editor) e CheckoutPage.tsx (a tela que confirma a assinatura).
//
// Quatro cópias de um preço é uma promessa que se contradiz sozinha: a home
// anuncia um valor, o checkout cobra outro, e quem descobre a diferença é o
// cliente no momento em que ele mais repara. Um preço é a última coisa que pode
// divergir entre a vitrine e a caixa registradora.
//
// Em REAIS (número), não em texto: quem formata é `precoDoPlano()`. Guardar
// "R$ 29" como string espalha a decisão de formato junto com o valor, e foi
// assim que as quatro cópias nasceram.
export const PLAN_PRICE: Record<Exclude<Plan, 'free'>, number> = {
  pro: 29,
  premium: 49,
}

/** O preço como ele aparece na tela. `free` é o único que não é um número. */
export function precoDoPlano(plan: Plan): string {
  return plan === 'free' ? 'R$ 0' : `R$ ${PLAN_PRICE[plan]}`
}

// ---- Plano Escritório (espelha backend/src/plans.ts) ----
// R$ 99/mês incluindo 5 advogados; +R$ 20/mês por advogado adicional.
export const FIRM_PRICING = { basePrice: 99, includedSeats: 5, extraSeatPrice: 20 } as const

export function firmMonthlyPrice(seats: number): number {
  const extra = Math.max(0, seats - FIRM_PRICING.includedSeats)
  return FIRM_PRICING.basePrice + extra * FIRM_PRICING.extraSeatPrice
}
