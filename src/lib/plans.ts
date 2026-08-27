import type { Plan } from './types'

// Limites de caracteres por campo, escalando com o plano ("Proposto").
// ⚠️ MANTER EM SINCRONIA com backend/src/plans.ts (o backend é a fonte da verdade).
export type LimitedField = 'headline' | 'bio' | 'areaDesc'

export const CHAR_LIMITS: Record<Plan, Record<LimitedField, number>> = {
  free: { headline: 60, bio: 300, areaDesc: 160 },
  pro: { headline: 90, bio: 600, areaDesc: 280 },
  premium: { headline: 120, bio: 1000, areaDesc: 400 },
}

export function charLimit(plan: Plan, field: LimitedField): number {
  return CHAR_LIMITS[plan][field]
}

// Número máximo de áreas de atuação por plano (usado no editor).
export const AREA_LIMIT: Record<Plan, number> = { free: 2, pro: 6, premium: 20 }

// Perguntas frequentes respondidas no perfil: nenhuma no Free, 2 no Pro, 5 no Max.
export const FAQ_LIMIT: Record<Plan, number> = { free: 0, pro: 2, premium: 5 }
// Tetos de texto CURTOS de propósito (iguais em todos os planos): FAQ é orientação
// geral, não parecer. Resposta longa no celular vira parede de texto — e quanto mais
// texto, mais chance de escorregar para fora do que o Prov. 205/2021 permite.
export const FAQ_QUESTION_MAX = 100
// 300 → 220 em 27/08/2026. A 300, a IA escrevia até encostar no teto e a resposta
// saía com cinco linhas no celular — exatamente a parede de texto que o comentário
// acima queria evitar. 220 cabe em duas ou três frases, que é o formato de uma
// orientação geral. O número é passado à IA no pedido (ver Editor.aiLimit).
export const FAQ_ANSWER_MAX = 220

/** Responder perguntas frequentes no perfil — recurso dos planos pagos. */
export function canUseFaq(plan: Plan): boolean {
  return plan === 'pro' || plan === 'premium'
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
export const AREA_LABEL_MAX = 40 // nome da área curto — mantém os tiles alinhados/centrados

// Agendamento (qualquer forma: link externo OU agenda nativa) — recurso dos planos
// pagos. No Free não há botão "Agendar". MANTER EM SINCRONIA com backend/src/plans.ts.
export function canUseScheduling(plan: Plan): boolean {
  return plan === 'pro' || plan === 'premium'
}

// Agenda nativa (cliente marca dia/hora, advogado aceita/recusa) — também só nos pagos.
export function canUseNativeAgenda(plan: Plan): boolean {
  return plan === 'pro' || plan === 'premium'
}

// ---- Plano Escritório (espelha backend/src/plans.ts) ----
// R$ 99/mês incluindo 5 advogados; +R$ 20/mês por advogado adicional.
export const FIRM_PRICING = { basePrice: 99, includedSeats: 5, extraSeatPrice: 20 } as const

export function firmMonthlyPrice(seats: number): number {
  const extra = Math.max(0, seats - FIRM_PRICING.includedSeats)
  return FIRM_PRICING.basePrice + extra * FIRM_PRICING.extraSeatPrice
}
