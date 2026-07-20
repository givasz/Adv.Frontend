import { Link } from 'react-router-dom'
import type { Plan } from '@/lib/types'
import { ArrowRight, CheckIcon, SparkIcon } from '@/components/ui/icons'

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
