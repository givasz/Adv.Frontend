// Índice de Confiança — mede a CREDIBILIDADE PERCEBIDA de um perfil, não beleza.
// Motor desacoplado e puro (função de Profile → 0..100). Sem estado, sem banco:
// o índice é sempre derivado do conteúdo existente. Ver RFC-002.
import type { Plan, Profile } from './types'
import { resolveSchedulingMode } from './booking'

export interface TrustFactor {
  key: string
  /** rótulo em forma de AÇÃO, para o painel de evolução ("Adicionar foto") */
  action: string
  /** rótulo curto do fator ("Foto") */
  label: string
  /** peso no índice (a soma de todos = 100) */
  points: number
  /** plano mínimo para concluir — trava o card. Ausente = disponível no Free. */
  plan?: Exclude<Plan, 'free'>
  /** já conquistado neste perfil? */
  done: (p: Profile) => boolean
}

const rank: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }
const filledAreas = (p: Profile) => p.areas.filter((a) => a.label.trim()).length

// Fatores do índice. A soma dos pontos é exatamente 100; os itens Free somam 82
// (um perfil Free completo satura em 82) e os 18 restantes vêm de PRO/MAX —
// um upsell honesto: o teto só sobe assinando.
//
// Os 10 pontos que eram da conferência de OAB voltaram para os itens de conteúdo
// do Free (+2 em cada um da faixa "Evolução"). A conferência saiu do produto: uma
// distinção pública que se comprava não cabia no Prov. 205/2021, e a marca virou
// um link para a consulta pública do CNA, igual para todo mundo — logo, não é
// mais algo a "conquistar". Ver components/ui/CnaLink.
export const TRUST_FACTORS: TrustFactor[] = [
  // ---- Essenciais (feitos já no onboarding) ----
  { key: 'nome', action: 'Informe seu nome', label: 'Nome', points: 5, done: (p) => !!p.name.trim() },
  { key: 'cidade', action: 'Informe sua cidade', label: 'Cidade', points: 5, done: (p) => !!(p.city && p.state) },
  { key: 'oab', action: 'Informe seu número da OAB', label: 'OAB', points: 7, done: (p) => !!p.oabNumber.trim() },
  { key: 'bio', action: 'Escreva sua apresentação', label: 'Bio', points: 8, done: (p) => !!p.bio.trim() },
  { key: 'whatsapp', action: 'Adicione seu WhatsApp', label: 'WhatsApp', points: 7, done: (p) => !!p.contact.whatsapp },
  { key: 'area1', action: 'Defina sua área principal', label: 'Área principal', points: 6, done: (p) => filledAreas(p) >= 1 },
  // ---- Evolução (Free) ----
  { key: 'foto', action: 'Adicionar foto', label: 'Foto', points: 13, done: (p) => !!p.avatarUrl },
  { key: 'frase', action: 'Escrever uma frase de apresentação', label: 'Frase', points: 7, done: (p) => !!p.headline.trim() },
  { key: 'redes', action: 'Conectar suas redes', label: 'Redes', points: 10, done: (p) => p.socials.length > 0 },
  { key: 'email', action: 'Adicionar um e-mail de contato', label: 'E-mail', points: 5, done: (p) => !!p.contact.email },
  { key: 'area2', action: 'Adicionar uma segunda área de atuação', label: '2ª área', points: 9, done: (p) => filledAreas(p) >= 2 },
  // ---- Planos pagos ----
  { key: 'agenda', action: 'Ativar sua agenda de atendimento', label: 'Agenda', points: 8, plan: 'pro', done: (p) => resolveSchedulingMode(p) !== 'off' },
  // Domínio próprio saiu do índice enquanto o recurso não existe: dava 5 pontos de
  // credibilidade por DIGITAR um endereço que não ia para lugar nenhum. Os pontos
  // foram para a marca própria, que é o que o Max entrega de fato hoje.
  { key: 'marca', action: 'Personalizar sua marca', label: 'Marca própria', points: 10, plan: 'premium', done: (p) => !!(p.branding?.brandName || p.branding?.hideWatermark) },
]

export interface TrustResult {
  /** índice conquistado, 0..100 */
  score: number
  /** teto (100) */
  max: number
  /** fatores já conquistados */
  earned: TrustFactor[]
  /** próximos passos (não conquistados), do maior ganho para o menor */
  next: TrustFactor[]
  /** rótulo qualitativo do nível */
  level: string
  /** um fator é acessível no plano atual? (não travado) */
  locked: (f: TrustFactor) => boolean
}

export function computeTrust(p: Profile): TrustResult {
  const earned = TRUST_FACTORS.filter((f) => f.done(p))
  const score = Math.min(100, earned.reduce((s, f) => s + f.points, 0))
  const next = TRUST_FACTORS.filter((f) => !f.done(p)).sort((a, b) => b.points - a.points)
  const locked = (f: TrustFactor) => !!f.plan && rank[p.plan] < rank[f.plan]
  return { score, max: 100, earned, next, level: trustLevel(score), locked }
}

// Nível qualitativo — tom profissional, sem gamificação infantil.
export function trustLevel(score: number): string {
  if (score >= 90) return 'Perfil excelente'
  if (score >= 75) return 'Perfil forte'
  if (score >= 60) return 'Perfil sólido'
  if (score >= 40) return 'Bom começo'
  return 'Em construção'
}
