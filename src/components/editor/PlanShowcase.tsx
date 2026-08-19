import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Plan } from '@/lib/types'
import { AREA_LIMIT, ARTICLE_LIMIT, CHAR_LIMITS, HIGHLIGHT_LIMIT } from '@/lib/plans'
import { PLAN_LABEL } from '@/lib/upsell'
import { CheckIcon } from '@/components/ui/icons'
import { PurchaseSimulator } from './PurchaseSimulator'

// Vitrine de planos com ATIVAÇÃO simulada — o CTA abre um checkout de mentira
// (parece assinatura de verdade, mas sem cobrança) e só então ativa o plano.
// Durante os testes todos os planos ficam liberados. Números (áreas, bio) vêm
// de plans.ts para não mentir; o resto é copy curada de valor.

const ORDER: Plan[] = ['pro', 'premium', 'free']

const PITCH: Record<Plan, string> = {
  free: 'Seu perfil profissional no ar.',
  pro: 'Receba clientes e ganhe alcance.',
  premium: 'Sua marca e autoridade, sem limites.',
}
const PRICE: Record<Plan, string> = { free: 'R$ 0', pro: 'R$ 19', premium: 'R$ 39' }

const PERKS: Record<Plan, string[]> = {
  free: [
    `${AREA_LIMIT.free} áreas de atuação`,
    `Bio até ${CHAR_LIMITS.free.bio} caracteres`,
    'WhatsApp e redes sociais',
    `${HIGHLIGHT_LIMIT.free} destaque de experiência`,
    '2 temas visuais',
  ],
  pro: [
    'Assistente virtual de agendamento',
    'Selo “OAB conferida”',
    'Endereço advoc.me/seu-nome',
    `${HIGHLIGHT_LIMIT.pro} destaques de experiência`,
    'Cartão digital com QR e vCard',
    `${AREA_LIMIT.pro} áreas · bio até ${CHAR_LIMITS.pro.bio}`,
    '5 temas visuais',
  ],
  premium: [
    'Tudo do Pro, e mais:',
    `Até ${ARTICLE_LIMIT.premium} artigos no seu perfil`,
    'Vídeo de apresentação',
    'Domínio próprio (.adv.br)',
    'Sua marca no lugar da nossa',
    'Comprovante de conformidade em PDF',
    `${AREA_LIMIT.premium} áreas · bio até ${CHAR_LIMITS.premium.bio}`,
    '8 temas visuais',
  ],
}

export function PlanShowcase({ plan, onPick }: { plan: Plan; onPick: (p: Plan) => void }) {
  // Plano aguardando confirmação no checkout simulado (null = fechado).
  const [pending, setPending] = useState<Exclude<Plan, 'free'> | null>(null)

  const activate = (p: Plan) => {
    if (p === 'free') return onPick('free') // downgrade não precisa de checkout
    setPending(p) // abre o checkout simulado
  }

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
                    <button
                      type="button"
                      onClick={() => activate(p)}
                      className={`w-full rounded-full py-2.5 text-[13.5px] font-semibold transition-colors ${
                        p !== 'free'
                          ? 'bg-burgundy text-paper-soft hover:bg-burgundy-deep'
                          : 'border border-ink/15 text-ink hover:border-burgundy/40 hover:text-burgundy'
                      }`}
                    >
                      {p === 'free' ? 'Voltar ao Free' : `Assinar ${PLAN_LABEL[p]}`}
                    </button>
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

      <AnimatePresence>
        {pending && (
          <PurchaseSimulator
            plan={pending}
            onClose={() => setPending(null)}
            onConfirmed={() => onPick(pending)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
