// Lógica de upsell contextual do editor — ÚNICA fonte de "o que está travado e
// por quê". Deriva tudo dos limites já definidos em plans.ts, dos fatores do
// Índice de Confiança (trustScore.ts) e dos temas (themes.ts). Os componentes
// visuais NÃO repetem regra de negócio — só consomem estas funções puras.

import type { Plan } from './types'
import { AREA_LIMIT, CHAR_LIMITS, canUseScheduling, type LimitedField } from './plans'
import { TRUST_FACTORS } from './trustScore'
import { THEMES, isThemeUnlocked } from './themes'

// Rótulo de plano exibido ao usuário (premium é comercializado como "Max").
export const PLAN_LABEL: Record<Plan, string> = { free: 'Free', pro: 'Pro', premium: 'Max' }
export const PLAN_PRICE: Record<Exclude<Plan, 'free'>, string> = { pro: 'R$ 19', premium: 'R$ 39' }

const RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }
const PAID: Exclude<Plan, 'free'>[] = ['pro', 'premium']

/** Menor plano estritamente acima do atual (para CTAs "Disponível no Pro"). */
export function nextPlan(plan: Plan): Exclude<Plan, 'free'> | null {
  if (plan === 'free') return 'pro'
  if (plan === 'pro') return 'premium'
  return null
}

// ---- Cotas de uso (contadores + slot fantasma) ------------------------------

export interface Quota {
  used: number
  limit: number
  remaining: number
  atLimit: boolean
  plan: Plan
  /** menor plano que aumenta o teto (para o slot fantasma) — null se já no topo */
  unlockPlan: Exclude<Plan, 'free'> | null
  /** novo teto nesse plano — null se já no topo */
  unlockLimit: number | null
}

function makeQuota(plan: Plan, used: number, limitOf: (p: Plan) => number): Quota {
  const limit = limitOf(plan)
  const up = PAID.find((p) => RANK[p] > RANK[plan] && limitOf(p) > limit) ?? null
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    atLimit: used >= limit,
    plan,
    unlockPlan: up,
    unlockLimit: up ? limitOf(up) : null,
  }
}

/** Cota de áreas de atuação (limite de CONTAGEM por plano). */
export function areaQuota(plan: Plan, used: number): Quota {
  return makeQuota(plan, used, (p) => AREA_LIMIT[p])
}

/** Cota de um campo com limite de CARACTERES por plano (bio, destaque, etc.). */
export function charQuota(plan: Plan, field: LimitedField, used: number): Quota {
  return makeQuota(plan, used, (p) => CHAR_LIMITS[p][field])
}

/** Rótulo do contador em tempo real: "2/2 — Free". */
export function quotaLabel(q: Quota): string {
  return `${q.used}/${q.limit} — ${PLAN_LABEL[q.plan]}`
}

// ---- Pontos do Índice de Confiança por recurso ------------------------------

const FACTOR_POINTS: Record<string, number> = Object.fromEntries(
  TRUST_FACTORS.map((f) => [f.key, f.points]),
)

/** Soma dos pontos do Índice de Confiança das chaves de fator dadas. */
export function factorPoints(...keys: string[]): number {
  return keys.reduce((s, k) => s + (FACTOR_POINTS[k] ?? 0), 0)
}

export type UpsellFeature =
  | 'areas'
  | 'bio'
  | 'highlights'
  | 'agenda'
  | 'themes'
  | 'oab'
  | 'branding'

// Recurso do editor → fatores do Índice que um upgrade destravaria. Só os
// fatores gated por plano em trustScore.ts pontuam; recursos sem fator gated
// (áreas, bio, temas) rendem 0 — e o chip de pontos simplesmente não aparece.
const FEATURE_FACTORS: Record<UpsellFeature, string[]> = {
  areas: [],
  bio: [],
  highlights: [],
  themes: [],
  agenda: ['agenda'],
  oab: ['oab_conferida'],
  branding: ['dominio', 'marca'],
}

/** Pontos do Índice de Confiança que o upgrade daquele recurso destravaria. */
export function featurePoints(feature: UpsellFeature): number {
  return factorPoints(...FEATURE_FACTORS[feature])
}

// ---- Comparação focada em um recurso (para o modal) -------------------------

export interface FeatureRow {
  plan: Plan
  value: string
}
export interface FeatureCompare {
  key: UpsellFeature
  title: string
  subtitle: string
  points: number
  rows: FeatureRow[] // sempre na ordem free, pro, premium
}

const themeCount = (p: Plan) => THEMES.filter((t) => isThemeUnlocked(t, p)).length

const FEATURE_META: Record<
  UpsellFeature,
  { title: string; subtitle: string; value: (p: Plan) => string }
> = {
  areas: {
    title: 'Áreas de atuação',
    subtitle: 'Quantas áreas você pode listar no perfil.',
    value: (p) => `${AREA_LIMIT[p]} áreas`,
  },
  bio: {
    title: 'Tamanho da bio',
    subtitle: 'Quantos caracteres sua apresentação pode ter.',
    value: (p) => `${CHAR_LIMITS[p].bio} caracteres`,
  },
  highlights: {
    title: 'Destaques de experiência',
    subtitle: 'Espaço para detalhar cada destaque.',
    value: (p) => `${CHAR_LIMITS[p].highlightDetail} caracteres cada`,
  },
  agenda: {
    title: 'Agendamento de consultas',
    subtitle: 'Receba pedidos de horário direto pelo perfil.',
    value: (p) => (canUseScheduling(p) ? 'Incluído' : '—'),
  },
  themes: {
    title: 'Temas visuais',
    subtitle: 'Identidades visuais para o seu perfil.',
    value: (p) => `${themeCount(p)} de ${THEMES.length} temas`,
  },
  oab: {
    title: 'Selo “OAB conferida”',
    subtitle: 'A plataforma confere seu registro e exibe a marca.',
    value: (p) => (p === 'free' ? '—' : 'Incluído'),
  },
  branding: {
    title: 'Marca e domínio próprios',
    subtitle: 'Domínio .adv.br e perfil sem a marca advoc.me.',
    value: (p) => (p === 'premium' ? 'Incluído' : '—'),
  },
}

/** Descreve um recurso comparando o valor em cada plano — foco do modal. */
export function featureCompare(feature: UpsellFeature): FeatureCompare {
  const meta = FEATURE_META[feature]
  const plans: Plan[] = ['free', 'pro', 'premium']
  return {
    key: feature,
    title: meta.title,
    subtitle: meta.subtitle,
    points: featurePoints(feature),
    rows: plans.map((p) => ({ plan: p, value: meta.value(p) })),
  }
}
