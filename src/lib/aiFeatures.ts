import type { GenerateKind, Plan } from './types'

// Disponibilidade dos recursos de IA por plano — fonte ÚNICA. O backend usa o
// mesmo `plan` só para ajustar profundidade/tamanho; quem libera o botão é aqui.
//   free    → bio, área (a isca)
//   pro     → + frase de apresentação, revisar/melhorar texto
//   premium → + rascunho de artigo, e bio/área "enriquecidas" (cidade + áreas)
export type AiFeature = GenerateKind

export const AI_MIN_PLAN: Record<AiFeature, Plan> = {
  bio: 'free',
  area: 'free',
  headline: 'pro',
  improve: 'pro',
  article: 'premium',
}

const RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

/** O plano atual pode usar esse recurso de IA? */
export function canUseAi(feature: AiFeature, plan: Plan): boolean {
  return RANK[plan] >= RANK[AI_MIN_PLAN[feature]]
}

/** Plano mínimo para o recurso (para rótulos "Pro"/"Max"). */
export function aiMinPlan(feature: AiFeature): Plan {
  return AI_MIN_PLAN[feature]
}
