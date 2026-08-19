import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Plan, Profile } from '@/lib/types'
import { slugify } from '@/lib/brFormat'
import { PLAN_LABEL } from '@/lib/upsell'
import { CheckIcon } from '@/components/ui/icons'
import { PurchaseSimulator } from './PurchaseSimulator'

// Tópicos concretos de "como melhorar o perfil" travados por plano. Cada um
// mostra o ganho real (ex.: seu endereço sem número, seu domínio) e, se ainda
// travado, o botão abre o checkout SIMULADO (Pro e Max). Já incluídos no plano
// atual aparecem com selo, dando senso de evolução.

type Topic = {
  key: string
  title: string
  value: (p: Profile) => string
  plan: Exclude<Plan, 'free'>
}

const TOPICS: Topic[] = [
  {
    key: 'slug',
    title: 'Seu nome no endereço, sem número',
    plan: 'pro',
    value: (p) => `advoc.me/${slugify(p.name) || 'seu-nome'} · disponível`,
  },
  {
    key: 'oab',
    title: 'Selo “OAB conferida”',
    plan: 'pro',
    value: () => 'A plataforma confere seu registro e exibe a marca',
  },
  {
    key: 'agenda',
    title: 'Agenda de consultas no perfil',
    plan: 'pro',
    value: () => 'O cliente escolhe um horário e você confirma',
  },
  {
    key: 'domain',
    title: 'Seu próprio domínio (.adv.br)',
    plan: 'premium',
    value: (p) => `${slugify(p.name) || 'seu-nome'}.adv.br · disponível`,
  },
  {
    key: 'brand',
    title: 'Sem a marca advoc.me',
    plan: 'premium',
    value: () => 'Perfil com a sua identidade, do topo ao rodapé',
  },
]

const RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

export function UpgradeTopics({
  profile,
  onPick,
  initial = null,
  showIncluded = true,
}: {
  profile: Profile
  onPick: (p: Plan) => void
  /** abre o checkout já neste plano (ex.: quem clicou "Assinar Pro" na home) */
  initial?: Exclude<Plan, 'free'> | null
  /**
   * Mostra também os tópicos já inclusos no plano atual (com selo "Incluído").
   * Desligue onde o senso de progresso já vem de outro lugar — no painel, o
   * checklist do plano cumpre esse papel e repetir aqui vira ruído.
   */
  showIncluded?: boolean
}) {
  const [pending, setPending] = useState<Exclude<Plan, 'free'> | null>(initial)

  return (
    <>
      <div className="space-y-2.5">
        {TOPICS.filter((t) => showIncluded || RANK[profile.plan] < RANK[t.plan]).map((t) => {
          const unlocked = RANK[profile.plan] >= RANK[t.plan]
          return (
            <div
              key={t.key}
              className="flex items-center gap-3 rounded-xl2 border border-ink/10 bg-paper p-3.5 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[14.5px] font-semibold leading-tight text-ink">
                    {t.title}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      unlocked ? 'bg-brass/15 text-brass-deep' : 'bg-ink/[0.06] text-ink-faint'
                    }`}
                  >
                    {PLAN_LABEL[t.plan]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12.5px] leading-relaxed text-ink-soft">
                  {t.value(profile)}
                </p>
              </div>
              {unlocked ? (
                <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-brass-deep">
                  <CheckIcon width={14} height={14} strokeWidth={2.4} />
                  Incluído
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPending(t.plan)}
                  className="shrink-0 rounded-full bg-burgundy px-3.5 py-1.5 text-[12.5px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep"
                >
                  Ativar {PLAN_LABEL[t.plan]}
                </button>
              )}
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
