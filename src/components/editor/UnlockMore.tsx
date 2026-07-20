import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Plan } from '@/lib/types'
import { useDialog } from '@/lib/a11y'
import {
  featureCompare,
  PLAN_LABEL,
  PLAN_PRICE,
  type UpsellFeature,
} from '@/lib/upsell'
import { TrustPointsChip } from './upsellBits'
import { ArrowRight, CheckIcon, SparkIcon, XIcon } from '@/components/ui/icons'

// Upsell "positivo": os planos pagos não desbloqueiam recursos abstratos — eles
// dão MAIS ITENS para o advogado colocar no perfil. Cada bullet é uma coisa a
// mais que aparece no perfil, não um jargão de assinatura. Usado enquanto o
// perfil é montado (onboarding) e no painel de evolução.

type PaidPlan = Exclude<Plan, 'free'>
type Tier = { id: PaidPlan; tier: string; price: string; pitch: string; items: string[] }

const TIER_UNLOCKS: Record<PaidPlan, Tier> = {
  pro: {
    id: 'pro',
    tier: 'Pro',
    price: 'R$ 19',
    pitch: 'Mais espaço e recursos no seu perfil.',
    items: [
      'Botão de agendamento no perfil',
      'QR Code e cartão de contato',
      'Até 6 áreas de atuação',
      'Endereço advoc.me/seu-nome',
      'Selo “OAB conferida”',
      'Bio e textos mais longos',
      'Mais temas visuais',
    ],
  },
  premium: {
    id: 'premium',
    tier: 'Max',
    price: 'R$ 39',
    pitch: 'Sua marca e sua autoridade, sem limites.',
    items: [
      'Publique artigos no seu perfil',
      'Galeria e vídeo de apresentação',
      'Seu próprio domínio (.adv.br)',
      'Sem a marca advoc.me',
      'Bio ainda mais longa',
    ],
  },
}

// Quais planos ainda estão "acima" do atual (o que dá pra desbloquear).
function tiersAbove(plan: Plan): Tier[] {
  if (plan === 'premium') return []
  if (plan === 'pro') return [TIER_UNLOCKS.premium]
  return [TIER_UNLOCKS.pro, TIER_UNLOCKS.premium]
}

/**
 * `compact` (onboarding) — um cartão enxuto do próximo plano, com alguns itens
 * como chips. Se `onPick` for passado, tocar aplica o plano ao rascunho SEM sair
 * do fluxo (o advogado publica já com os itens a mais). Sem `onPick`, vira um
 * link para a seção de plano. `full` (painel) — cartões completos por plano.
 */
export function UnlockMore({
  plan,
  compact = false,
  onPick,
}: {
  plan: Plan
  compact?: boolean
  onPick?: (tier: PaidPlan) => void
}) {
  const tiers = tiersAbove(plan)
  if (tiers.length === 0) return null

  if (compact) {
    const t = tiers[0]
    const shown = t.items.slice(0, 3)
    const rest = t.items.length - shown.length
    const inner = (
      <>
        <div className="flex items-center gap-2">
          <SparkIcon width={16} height={16} className="text-brass-deep" />
          <p className="text-[13.5px] font-semibold text-ink">Adicione mais ao seu perfil</p>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-ink-soft">
              {t.price}
              <span className="text-[10.5px] font-normal text-ink-faint">/mês</span>
            </span>
            <span className="rounded-full bg-brass/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brass-deep">
              {t.tier}
            </span>
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {shown.map((i) => (
            <span
              key={i}
              className="rounded-full border border-brass/25 bg-paper/60 px-2.5 py-1 text-[11.5px] font-medium text-ink-soft"
            >
              + {i}
            </span>
          ))}
          {rest > 0 && (
            <span className="rounded-full px-2 py-1 text-[11.5px] font-medium text-brass-deep">
              +{rest} itens
            </span>
          )}
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brass-deep">
          {onPick ? `Ativar o ${t.tier} no meu perfil` : 'Ver o que dá pra adicionar'}
          <ArrowRight width={13} height={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </>
    )
    const cls =
      'group block w-full overflow-hidden rounded-xl2 border border-brass/30 bg-gradient-to-br from-brass/[0.12] to-brass/[0.02] p-4 text-left shadow-card transition-colors hover:border-brass/50'
    return onPick ? (
      <button type="button" onClick={() => onPick(t.id)} className={cls}>
        {inner}
      </button>
    ) : (
      <Link to="/editor?section=plano" className={cls}>
        {inner}
      </Link>
    )
  }

  return (
    <div className={`grid gap-3 ${tiers.length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {tiers.map((t) => (
        <div
          key={t.tier}
          className="flex flex-col overflow-hidden rounded-xl2 border border-brass/30 bg-gradient-to-br from-brass/[0.10] to-brass/[0.01] p-5 shadow-card"
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brass/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brass-deep">
              {t.tier}
            </span>
            <span className="ml-auto text-[13px] font-semibold text-ink">
              {t.price}
              <span className="text-[11.5px] font-normal text-ink-faint">/mês</span>
            </span>
          </div>
          <p className="mt-2.5 text-[13.5px] leading-snug text-ink-soft">{t.pitch}</p>
          <ul className="mt-3 flex-1 space-y-1.5">
            {t.items.map((i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-ink-soft">
                <CheckIcon width={14} height={14} strokeWidth={2.4} className="mt-0.5 shrink-0 text-brass-deep" />
                {i}
              </li>
            ))}
          </ul>
          <Link to="/editor?section=plano" className="btn-primary mt-4 !py-2.5 text-[13.5px]">
            Conhecer o {t.tier}
          </Link>
        </div>
      ))}
    </div>
  )
}

/**
 * Modal de comparação FOCADO em um recurso — abre quando o advogado bate um
 * limite no editor. Mostra só o recurso que motivou o bloqueio, comparado entre
 * Free/Pro/Max (valores derivados de lib/upsell.ts → plans.ts). Fecha por Esc,
 * clique fora, X ou "Continuar editando" — nunca força a decisão. O CTA leva à
 * página de planos existente (upgrade real virá com o billing).
 */
export function FeatureUpsellModal({
  feature,
  plan,
  onClose,
}: {
  feature: UpsellFeature
  plan: Plan
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onClose)
  const cmp = featureCompare(feature)
  const titleId = 'feature-upsell-title'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-t-xl2 bg-paper shadow-lift sm:rounded-xl2"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div>
            <h2 id={titleId} className="font-display text-[19px] font-semibold text-ink">
              {cmp.title}
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{cmp.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <XIcon width={18} height={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {cmp.points > 0 && (
            <div className="mb-3">
              <TrustPointsChip points={cmp.points} />
            </div>
          )}
          <ul className="space-y-2">
            {cmp.rows.map((r) => {
              const current = r.plan === plan
              const emphasis = !current && r.plan !== 'free'
              return (
                <li
                  key={r.plan}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 ${
                    emphasis ? 'border-brass/40 bg-brass/[0.06]' : 'border-ink/10 bg-paper-soft'
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`text-[13.5px] font-semibold ${emphasis ? 'text-brass-deep' : 'text-ink'}`}
                    >
                      {PLAN_LABEL[r.plan]}
                    </span>
                    {current && (
                      <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                        Seu plano
                      </span>
                    )}
                    {r.plan !== 'free' && (
                      <span className="text-[11.5px] text-ink-faint">
                        {PLAN_PRICE[r.plan as Exclude<Plan, 'free'>]}/mês
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-right text-[13px] font-medium ${
                      emphasis ? 'text-ink' : 'text-ink-soft'
                    }`}
                  >
                    {r.value}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex items-center gap-2.5">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 !py-2.5">
              Continuar editando
            </button>
            <Link
              to="/editor?section=plano"
              onClick={onClose}
              className="btn-primary flex-1 !py-2.5 text-[14px]"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
