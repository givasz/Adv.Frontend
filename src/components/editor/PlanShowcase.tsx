import type { Plan } from '@/lib/types'
import { AREA_LIMIT, CHAR_LIMITS } from '@/lib/plans'
import { PLAN_LABEL } from '@/lib/upsell'
import { CheckIcon } from '@/components/ui/icons'

// Vitrine de planos com ATIVAÇÃO grátis — durante os testes todos os planos ficam
// liberados (sem cobrança), então o CTA ativa o plano na hora. Os números (áreas,
// bio) vêm de plans.ts para não mentir; o resto é copy curada de valor.

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
    '2 temas visuais',
  ],
  pro: [
    `${AREA_LIMIT.pro} áreas de atuação`,
    `Bio até ${CHAR_LIMITS.pro.bio} caracteres`,
    'Agenda de consultas no perfil',
    'QR Code e cartão de contato',
    'Selo “OAB conferida”',
    'Endereço advoc.me/seu-nome',
    '5 temas visuais',
  ],
  premium: [
    'Tudo do Pro, e mais:',
    `${AREA_LIMIT.premium} áreas · bio até ${CHAR_LIMITS.premium.bio}`,
    'Publique artigos no seu perfil',
    'Domínio próprio (.adv.br)',
    'Sem a marca advoc.me',
    '8 temas visuais',
  ],
}

export function PlanShowcase({ plan, onPick }: { plan: Plan; onPick: (p: Plan) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ORDER.map((p) => {
        const current = p === plan
        const recommended = p === 'pro'
        return (
          <div
            key={p}
            className={`relative flex flex-col rounded-xl2 border p-4 shadow-card ${
              recommended
                ? 'border-brass/50 bg-gradient-to-br from-brass/[0.10] to-brass/[0.01]'
                : 'border-ink/12 bg-paper'
            }`}
          >
            {recommended && (
              <span className="absolute -top-2.5 left-4 rounded-full bg-brass px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">
                Mais popular
              </span>
            )}
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-[19px] font-semibold text-ink">{PLAN_LABEL[p]}</h3>
              <span className="text-[13px] font-semibold text-ink">
                {PRICE[p]}
                {p !== 'free' && <span className="text-[11px] font-normal text-ink-faint">/mês</span>}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] font-medium leading-snug text-brass-deep">{PITCH[p]}</p>

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
                    onClick={() => onPick(p)}
                    className={`w-full rounded-full py-2.5 text-[13.5px] font-semibold transition-colors ${
                      recommended || p !== 'free'
                        ? 'bg-burgundy text-paper-soft hover:bg-burgundy-deep'
                        : 'border border-ink/15 text-ink hover:border-burgundy/40 hover:text-burgundy'
                    }`}
                  >
                    {p === 'free' ? 'Voltar ao Free' : `Ativar ${PLAN_LABEL[p]} grátis`}
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
  )
}
