import { Link, useLocation } from 'react-router-dom'
import type { Plan } from '@/lib/types'
import { PLAN_LABEL } from '@/lib/upsell'
import { offerOf, seloDeCobranca } from '@/lib/planOffer'
import { CheckIcon, ClockIcon } from '@/components/ui/icons'

// Vitrine de planos. O CTA leva à PÁGINA de assinatura (/assinar/:plano), um
// checkout de mentira que parece de verdade — sem cobrança, e sem modal.
// Durante os testes todos os planos ficam liberados.
//
// Preço, pitch e benefícios vêm de lib/planOffer.ts — a MESMA fonte da home.
// Enquanto esta tela mantinha a própria lista, ela e a home discordavam sobre o
// que o Pro entrega, e o comprador via uma coisa antes de assinar e outra depois.
const ORDER: Plan[] = ['pro', 'premium', 'free']

export function PlanShowcase({
  plan,
  onPick,
  voltar,
  tema,
}: {
  plan: Plan
  /** só para o downgrade ("Voltar ao Free"), que não passa por checkout */
  onPick?: (p: Plan) => void
  /** para onde a assinatura devolve a pessoa (padrão: a rota atual) */
  voltar?: string
  /** tema em prova, preservado através do checkout */
  tema?: string | null
}) {
  const loc = useLocation()
  const volta = voltar ?? `${loc.pathname}${loc.search}`
  const checkoutUrl = (p: Exclude<Plan, 'free'>) =>
    `/assinar/${p}${tema ? `?tema=${tema}&` : '?'}voltar=${encodeURIComponent(volta)}`

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3 sm:items-stretch">
        {ORDER.map((p) => {
          const current = p === plan
          const recommended = p === 'pro'
          const oferta = offerOf(p)
          return (
            <div
              key={p}
              className={`relative flex flex-col rounded-xl2 border p-4 transition-shadow ${
                recommended
                  ? 'border-brass/60 bg-gradient-to-br from-brass/[0.14] to-brass/[0.02] shadow-lift sm:-my-1'
                  : 'border-ink/12 bg-paper shadow-card'
              }`}
            >
              {recommended && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brass px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink shadow-card">
                  Mais popular
                </span>
              )}
              <div className={`flex items-baseline justify-between gap-2 ${recommended ? 'mt-1.5' : ''}`}>
                <h3 className="font-display text-[20px] font-semibold text-ink">{PLAN_LABEL[p]}</h3>
                <span className="text-right">
                  <span className="font-display text-[19px] font-semibold text-ink">{oferta.price}</span>
                  {p !== 'free' && <span className="text-[11px] text-ink-faint">/mês</span>}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] font-semibold leading-snug text-brass-deep">{oferta.pitch}</p>

              <ul className="mt-3 flex-1 space-y-1.5">
                {oferta.items.map((item) => (
                  <li
                    key={item.text}
                    className={`flex items-start gap-2 text-[12.5px] leading-snug ${
                      item.emPreparo ? 'text-ink-faint' : 'text-ink-soft'
                    }`}
                  >
                    {item.emPreparo ? (
                      <ClockIcon width={13} height={13} className="mt-0.5 shrink-0 text-ink-faint" />
                    ) : (
                      <CheckIcon
                        width={13}
                        height={13}
                        strokeWidth={2.4}
                        className="mt-0.5 shrink-0 text-brass-deep"
                      />
                    )}
                    <span>
                      {item.text}
                      {item.emPreparo && (
                        <span className="ml-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                          · em preparo
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {/* O que este plano NÃO tem — a mesma franqueza da home. */}
              {oferta.falta && oferta.falta.length > 0 && (
                <ul className="mt-2.5 space-y-1 border-t border-ink/10 pt-2.5">
                  {oferta.falta.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[11.5px] leading-snug text-ink-faint">
                      <span aria-hidden className="mt-[6px] h-px w-2.5 shrink-0 bg-ink/25" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4">
                {current ? (
                  <div className="flex items-center justify-center gap-1.5 rounded-full border border-ink/12 py-2.5 text-[13px] font-semibold text-ink-faint">
                    <CheckIcon width={14} height={14} strokeWidth={2.4} />
                    Seu plano atual
                  </div>
                ) : (
                  <>
                    {p === 'free' ? (
                      // Downgrade não passa por checkout — é só desligar a assinatura.
                      <button
                        type="button"
                        onClick={() => onPick?.('free')}
                        className="w-full rounded-full border border-ink/15 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-burgundy/40 hover:text-burgundy"
                      >
                        Voltar ao Free
                      </button>
                    ) : (
                      <Link
                        to={checkoutUrl(p)}
                        className="block w-full rounded-full bg-burgundy py-2.5 text-center text-[13.5px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep"
                      >
                        Assinar {PLAN_LABEL[p]}
                      </Link>
                    )}
                    {p !== 'free' && (
                      <p className="mt-1.5 text-center text-[11px] text-ink-faint">{seloDeCobranca() ?? 'cobrança mensal'}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

    </>
  )
}
