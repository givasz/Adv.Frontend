import type { Plan } from './types'

// Limites de caracteres por campo, escalando com o plano ("Proposto").
// ⚠️ MANTER EM SINCRONIA com backend/src/plans.ts (o backend é a fonte da verdade).
export type LimitedField = 'headline' | 'bio' | 'areaDesc' | 'highlightTitle' | 'highlightDetail'

export const CHAR_LIMITS: Record<Plan, Record<LimitedField, number>> = {
  free: { headline: 60, bio: 300, areaDesc: 160, highlightTitle: 40, highlightDetail: 80 },
  pro: { headline: 90, bio: 600, areaDesc: 280, highlightTitle: 60, highlightDetail: 140 },
  premium: { headline: 120, bio: 1000, areaDesc: 400, highlightTitle: 80, highlightDetail: 200 },
}

export function charLimit(plan: Plan, field: LimitedField): number {
  return CHAR_LIMITS[plan][field]
}

// Número máximo de áreas de atuação por plano (usado no editor).
export const AREA_LIMIT: Record<Plan, number> = { free: 2, pro: 6, premium: 20 }

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

// ---- Plano Escritório (espelha backend/src/plans.ts) ----
// R$ 99/mês incluindo 5 advogados; +R$ 20/mês por advogado adicional.
export const FIRM_PRICING = { basePrice: 99, includedSeats: 5, extraSeatPrice: 20 } as const

export function firmMonthlyPrice(seats: number): number {
  const extra = Math.max(0, seats - FIRM_PRICING.includedSeats)
  return FIRM_PRICING.basePrice + extra * FIRM_PRICING.extraSeatPrice
}
