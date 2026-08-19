import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Plan, Profile } from '@/lib/types'
import { featureProgress, featuresIncluded, featuresPending } from '@/lib/planFeatures'
import { PLAN_LABEL } from '@/lib/upsell'
import { ArrowRight, CheckIcon, SparkIcon } from '@/components/ui/icons'

// "O que abriu no seu plano" — o painel do delta.
//
// O problema que isto resolve: assinar um plano não mudava nada visível, e o
// caminho para usar o que foi comprado era voltar ao editor e caçar. Aqui o
// advogado vê exatamente o que ainda não aproveitou do que já pagou, com um
// clique direto para a seção certa. Item configurado some da lista — depois da
// primeira vez, só sobra o que é novo.

export function PlanChecklist({
  profile,
  /** logo depois do checkout: tom de celebração + destaque visual */
  celebrate = false,
}: {
  profile: Profile
  celebrate?: boolean
}) {
  if (profile.plan === 'free') return null

  const pending = featuresPending(profile)
  const { done, total } = featureProgress(profile)
  const label = PLAN_LABEL[profile.plan]
  const pct = total ? Math.round((done / total) * 100) : 100

  return (
    <motion.section
      initial={celebrate ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`mt-8 overflow-hidden rounded-xl2 border shadow-card ${
        celebrate
          ? 'border-brass/50 bg-gradient-to-b from-brass/[0.12] to-transparent'
          : 'border-ink/10 bg-paper'
      }`}
    >
      <div className="border-b border-ink/[0.07] px-5 py-4 sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brass-deep">
          <SparkIcon width={12} height={12} />
          {label} ativo
        </span>
        <h2 className="mt-2 font-display text-[20px] font-semibold leading-tight text-ink">
          {celebrate
            ? `Pronto — seu ${label} está valendo.`
            : pending.length
              ? `Você ainda não usou tudo do seu ${label}.`
              : `Você está aproveitando todo o ${label}.`}
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
          {pending.length
            ? 'Nada de refazer o perfil: cada item abaixo leva direto ao ponto que mudou.'
            : 'Todos os recursos do seu plano já estão configurados no perfil.'}
        </p>

        {/* Aproveitamento do plano — mostra que sobra valor na mesa */}
        <div className="mt-3.5 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
            <motion.span
              className="block h-full rounded-full bg-brass-deep"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: pct / 100 }}
              style={{ transformOrigin: 'left' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-faint">
            {done}/{total} em uso
          </span>
        </div>
      </div>

      {pending.length > 0 ? (
        <ul className="divide-y divide-ink/[0.07]">
          {pending.map((f) => (
            <li key={f.key}>
              <Link
                to={f.to}
                className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-brass/[0.05] sm:px-6"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[14.5px] font-semibold leading-tight text-ink">
                      {f.title}
                    </span>
                    {f.plan === 'premium' && profile.plan === 'premium' && (
                      <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brass-deep">
                        Max
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-soft">
                    {f.body}
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-1 rounded-full border border-burgundy/25 px-3 py-1.5 text-[12.5px] font-semibold text-burgundy sm:inline-flex">
                  {f.cta}
                  <ArrowRight width={13} height={13} />
                </span>
                <ArrowRight width={16} height={16} className="shrink-0 text-ink-faint sm:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 px-5 py-4 text-[13px] text-brass-deep sm:px-6">
          <CheckIcon width={15} height={15} strokeWidth={2.4} />
          Tudo configurado. Seu perfil está usando cada recurso do plano.
        </p>
      )}
    </motion.section>
  )
}

/**
 * Prévia do que UM plano adiciona — usada antes de assinar, no checkout e nos
 * upsells. É a mesma lista de PlanChecklist, então a promessa da venda e o
 * checklist pós-compra nunca divergem.
 */
export function PlanFeaturePeek({ plan, max = 4 }: { plan: Exclude<Plan, 'free'>; max?: number }) {
  const list = featuresIncluded(plan).filter((f) => f.plan === plan)
  const shown = list.slice(0, max)
  const rest = list.length - shown.length
  return (
    <ul className="space-y-1.5">
      {shown.map((f) => (
        <li key={f.key} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-soft">
          <CheckIcon width={13} height={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-brass-deep" />
          {f.title}
        </li>
      ))}
      {rest > 0 && <li className="pl-[21px] text-[12px] text-ink-faint">e mais {rest} recursos</li>}
    </ul>
  )
}
