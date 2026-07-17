import { Link } from 'react-router-dom'
import { CheckIcon } from '@/components/ui/icons'

// Upsell NATURAL (RFC-002): nunca esconder um recurso pago — mostrar o valor dele
// primeiro, e só então convidar ao upgrade. Elegante, sem pressão.
export function UpsellCard({
  plan,
  title,
  body,
  bullets,
}: {
  plan: 'pro' | 'premium'
  title: string
  body: string
  bullets?: string[]
}) {
  const tier = plan === 'premium' ? 'Max' : 'Pro'
  return (
    <div className="overflow-hidden rounded-xl2 border border-brass/30 bg-gradient-to-br from-brass/[0.10] to-brass/[0.02] p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brass/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brass-deep">
          {tier}
        </span>
        <h3 className="font-display text-[17px] font-semibold text-ink">{title}</h3>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{body}</p>
      {bullets && bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-[13.5px] text-ink-soft">
              <CheckIcon width={15} height={15} strokeWidth={2.4} className="mt-0.5 shrink-0 text-brass-deep" />
              {b}
            </li>
          ))}
        </ul>
      )}
      <Link to="/editor?section=plano" className="btn-primary mt-4 !py-2.5 text-[14px]">
        Conhecer o {tier}
      </Link>
    </div>
  )
}
