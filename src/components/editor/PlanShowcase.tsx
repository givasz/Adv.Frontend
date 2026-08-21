import { Link, useLocation } from 'react-router-dom'
import type { Plan } from '@/lib/types'
import { AREA_LIMIT, CHAR_LIMITS, FAQ_LIMIT } from '@/lib/plans'
import { PLAN_LABEL } from '@/lib/upsell'
import { CheckIcon } from '@/components/ui/icons'

// Vitrine de planos. O CTA leva à PÁGINA de assinatura (/assinar/:plano), um
// checkout de mentira que parece de verdade — sem cobrança, e sem modal.
// Durante os testes todos os planos ficam liberados. Números (áreas, bio) vêm
// de plans.ts para não mentir; o resto é copy curada de valor.

const ORDER: Plan[] = ['pro', 'premium', 'free']

// O pitch DESCREVE o que o plano acrescenta ao perfil. Nada de "receba clientes"
// ou "ganhe autoridade": vender captação para advogado é oferecer justamente o que
// o Prov. 205/2021 veda a ele — e é a frase que uma fiscalização citaria primeiro.
const PITCH: Record<Plan, string> = {
  free: 'Seu perfil profissional no ar.',
  pro: 'Agendamento e perguntas frequentes no perfil.',
  premium: 'O perfil com a sua identidade visual.',
}
const PRICE: Record<Plan, string> = { free: 'R$ 0', pro: 'R$ 19', premium: 'R$ 39' }

const PERKS: Record<Plan, string[]> = {
  free: [
    `${AREA_LIMIT.free} áreas de atuação`,
    `Bio até ${CHAR_LIMITS.free.bio} caracteres`,
    'WhatsApp e redes sociais',
    '2 temas visuais',
  ],
  pro: [
    'Assistente virtual de agendamento',
    `${FAQ_LIMIT.pro} perguntas frequentes no perfil`,
    'Endereço advoc.me/seu-nome',
    'Cartão digital com QR e vCard',
    `${AREA_LIMIT.pro} áreas · bio até ${CHAR_LIMITS.pro.bio}`,
    '5 temas visuais',
  ],
  premium: [
    'Tudo do Pro, e mais:',
    `${FAQ_LIMIT.premium} perguntas frequentes (eram ${FAQ_LIMIT.pro})`,
    'Vídeo de apresentação',
    'Domínio próprio (.adv.br) — em breve',
    'Sua marca no lugar da nossa',
    'Comprovante de conformidade em PDF',
    `${AREA_LIMIT.premium} áreas · bio até ${CHAR_LIMITS.premium.bio}`,
    '8 temas visuais',
  ],
}

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
                  <span className="font-display text-[19px] font-semibold text-ink">{PRICE[p]}</span>
                  {p !== 'free' && <span className="text-[11px] text-ink-faint">/mês</span>}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] font-semibold leading-snug text-brass-deep">{PITCH[p]}</p>

              <ul className="mt-3 flex-1 space-y-1.5">
                {PERKS[p].map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-soft">
                    <CheckIcon
                      width={13}
                      height={13}
                      strokeWidth={2.4}
                      className="mt-0.5 shrink-0 text-brass-deep"
                    />
                    {perk}
                  </li>
                ))}
              </ul>

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
                      <p className="mt-1.5 text-center text-[11px] text-ink-faint">em teste · sem cobrança</p>
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
