import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Plan } from '@/lib/types'
import { useDialog } from '@/lib/a11y'
import { PLAN_LABEL } from '@/lib/upsell'
import { CheckIcon, XIcon, ScaleIcon } from '@/components/ui/icons'

// Checkout SIMULADO — dá a sensação de assinar um plano de verdade (resumo do
// pedido → processando → confirmado), mas deixa CLARO que é teste e não há
// cobrança. Ao confirmar, chama onConfirmed() para o app ativar o plano.

const PRICE: Record<Exclude<Plan, 'free'>, string> = { pro: 'R$ 19', premium: 'R$ 39' }
const PROMISE: Record<Exclude<Plan, 'free'>, string> = {
  pro: 'Agenda, QR Code, selo OAB conferida, mais áreas e temas.',
  premium: 'Tudo do Pro + domínio próprio, artigos e sua marca sem advoc.me.',
}

type Phase = 'checkout' | 'processing' | 'done'

export function PurchaseSimulator({
  plan,
  onClose,
  onConfirmed,
}: {
  plan: Exclude<Plan, 'free'>
  onClose: () => void
  onConfirmed: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onClose)
  const [phase, setPhase] = useState<Phase>('checkout')
  const label = PLAN_LABEL[plan]

  // "processando" avança sozinho para "confirmado".
  useEffect(() => {
    if (phase !== 'processing') return
    const t = setTimeout(() => setPhase('done'), 1600)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={phase === 'processing' ? undefined : onClose}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Assinar ${label}`}
        className="w-full max-w-sm overflow-hidden rounded-t-xl2 bg-paper shadow-lift sm:rounded-xl2"
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 26, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'checkout' && (
          <div>
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <span className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
                <ScaleIcon width={18} height={18} className="text-burgundy" />
                Assinatura advoc.me
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="-mr-1 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                <XIcon width={18} height={18} />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-display text-[20px] font-semibold text-ink">Plano {label}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{PROMISE[plan]}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="font-display text-[22px] font-semibold text-ink">{PRICE[plan]}</span>
                  <span className="block text-[11px] text-ink-faint">/mês</span>
                </p>
              </div>

              <div className="mt-4 space-y-2 rounded-lg border border-ink/10 bg-paper-soft p-3.5 text-[12.5px]">
                <div className="flex justify-between text-ink-soft">
                  <span>Assinatura mensal</span>
                  <span className="tabular-nums">{PRICE[plan]}</span>
                </div>
                <div className="flex justify-between font-medium text-ink">
                  <span>Cobrado hoje (em teste)</span>
                  <span className="tabular-nums text-brass-deep">R$ 0,00</span>
                </div>
              </div>

              <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-faint">
                <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass-deep/70" />
                Plataforma em teste — nenhuma cobrança real é feita. Você ativa o plano na hora e pode
                voltar ao Free quando quiser.
              </p>

              <button
                type="button"
                onClick={() => setPhase('processing')}
                className="btn-primary mt-4 w-full !py-3"
              >
                Confirmar assinatura {label}
              </button>
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
            <p className="text-[14px] font-medium text-ink">Processando pagamento…</p>
            <p className="text-[12px] text-ink-faint">Confirmando sua assinatura {label} com segurança.</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, stiffness: 260 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-brass/20 text-brass-deep"
            >
              <CheckIcon width={34} height={34} strokeWidth={2.4} />
            </motion.span>
            <h3 className="mt-3 font-display text-[22px] font-semibold text-ink">Assinatura confirmada!</h3>
            <p className="max-w-[16rem] text-[13.5px] leading-relaxed text-ink-soft">
              Seu plano <span className="font-semibold text-brass-deep">{label}</span> está ativo. Os novos
              recursos já apareceram no seu perfil.
            </p>
            <button
              type="button"
              onClick={() => {
                onConfirmed()
                onClose()
              }}
              className="btn-primary mt-4 w-full !py-3"
            >
              Começar a usar
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
