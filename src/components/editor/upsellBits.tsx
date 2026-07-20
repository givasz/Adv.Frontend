import { type ReactNode } from 'react'
import type { Plan } from '@/lib/types'
import { PLAN_LABEL, quotaLabel, type Quota } from '@/lib/upsell'
import { LockIcon } from '@/components/ui/icons'

// Peças visuais do upsell contextual do editor. Nenhuma delas contém regra de
// negócio — todas recebem os dados já calculados por lib/upsell.ts.

/** Contador de uso em tempo real: "2/2 — Free". Fica âmbar ao bater o limite. */
export function QuotaCounter({ quota }: { quota: Quota }) {
  return (
    <span
      className={`text-[11px] font-medium tabular-nums ${
        quota.atLimit ? 'text-brass-deep' : 'text-ink-faint'
      }`}
    >
      {quotaLabel(quota)}
    </span>
  )
}

/** Chip "+8 no Índice de Confiança" — some sozinho quando o recurso rende 0. */
export function TrustPointsChip({ points }: { points: number }) {
  if (points <= 0) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brass/15 px-2 py-0.5 text-[11px] font-semibold text-brass-deep">
      +{points} no Índice de Confiança
    </span>
  )
}

/**
 * Slot "fantasma" — o próximo item além do limite, desenhado desabilitado
 * (borrado + cadeado) para o usuário ver o espaço que teria. Clicar abre o modal.
 */
export function GhostSlot({
  unlockPlan,
  points = 0,
  onOpen,
}: {
  unlockPlan: Exclude<Plan, 'free'>
  points?: number
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-lg border border-dashed border-brass/40 bg-brass/[0.04] p-3 text-left transition-colors hover:border-brass/60"
      aria-label={`Adicionar mais — recurso do ${PLAN_LABEL[unlockPlan]}`}
    >
      {/* espectro do próximo campo (inerte) */}
      <div className="pointer-events-none select-none opacity-40 blur-[1.5px]" aria-hidden>
        <div className="h-9 rounded-lg border border-ink/15 bg-paper" />
        <div className="mt-2 h-12 rounded-lg border border-ink/15 bg-paper" />
      </div>
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-burgundy shadow-card">
          <LockIcon width={12} height={12} strokeWidth={2} />
          Disponível no {PLAN_LABEL[unlockPlan]}
        </span>
        {points > 0 && <TrustPointsChip points={points} />}
      </span>
    </button>
  )
}

/**
 * Envelope de recurso bloqueado — mostra o conteúdo real (ex.: o próprio card de
 * agendamento) borrado e inerte, com um overlay de cadeado, pontos e CTA. O
 * usuário vê exatamente a seção que teria, em vez de a seção sumir.
 */
export function LockedFeature({
  unlockPlan,
  points = 0,
  children,
  onOpen,
}: {
  unlockPlan: Exclude<Plan, 'free'>
  points?: number
  children: ReactNode
  onOpen: () => void
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-brass/25 bg-brass/[0.03]">
      <div className="pointer-events-none max-h-[280px] select-none overflow-hidden opacity-50 blur-[2px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-paper/40 p-4 text-center backdrop-blur-[1px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-burgundy shadow-card">
          <LockIcon width={13} height={13} strokeWidth={2} />
          Recurso do {PLAN_LABEL[unlockPlan]}
        </span>
        {points > 0 && <TrustPointsChip points={points} />}
        <button type="button" onClick={onOpen} className="btn-primary !py-2 !px-4 text-[13px]">
          Ver o que muda
        </button>
      </div>
    </div>
  )
}
