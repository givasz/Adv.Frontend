import { Link, useSearchParams } from 'react-router-dom'
import type { Plan } from '@/lib/types'
import {
  featureCompare,
  nextPlan,
  PLAN_LABEL,
  PLAN_PRICE,
  type UpsellFeature,
} from '@/lib/upsell'
import { SubPage, comVolta, useVoltar } from '@/components/ui/SubPage'
import { PlanShowcase } from '@/components/editor/PlanShowcase'
import { TrustPointsChip } from '@/components/editor/upsellBits'
import { LockIcon } from '@/components/ui/icons'

// Planos — /planos.
//
// Duas leituras na mesma página:
//   • com `?recurso=`, abre focada no recurso que bateu o limite (era o modal de
//     upsell que aparecia por cima do editor);
//   • sem ele, é a vitrine completa dos planos.
//
// Virou página porque comparar preço dentro de uma janelinha sobreposta, no
// celular, é onde a decisão morre: não dá para rolar direito, não dá para voltar
// e não dá para mandar o link para o sócio.

const RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

export default function PlansPage() {
  const [params] = useSearchParams()
  const voltar = useVoltar('/painel')
  const recurso = params.get('recurso') as UpsellFeature | null
  const planoAtual = (params.get('plano') ?? 'free') as Plan
  const tema = params.get('tema')

  const cmp = recurso ? featureCompare(recurso) : null
  // Menor plano que realmente muda este recurso — é ele que o botão assina.
  const alvo = cmp
    ? ((cmp.rows.find(
        (r) => r.plan !== 'free' && RANK[r.plan] > RANK[planoAtual] && r.value !== '—',
      )?.plan ?? nextPlan(planoAtual)) as Exclude<Plan, 'free'> | null)
    : null

  const checkoutUrl = (p: Exclude<Plan, 'free'>) =>
    comVolta(`/assinar/${p}${tema ? `?tema=${tema}` : ''}`, voltar)

  return (
    <SubPage
      title={cmp ? cmp.title : 'Planos'}
      subtitle={cmp ? cmp.subtitle : 'Troque quando quiser. Mais recursos, mais alcance.'}
      icon={cmp ? <LockIcon width={17} height={17} /> : undefined}
      backTo={voltar}
      backLabel="Continuar editando"
      documentTitle={cmp ? cmp.title : 'Planos'}
      wide
    >
      {cmp && (
        <div className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-5">
          {cmp.points > 0 && (
            <div className="mb-3">
              <TrustPointsChip points={cmp.points} />
            </div>
          )}
          <ul className="space-y-2">
            {cmp.rows.map((r) => {
              const atual = r.plan === planoAtual
              const destaque = !atual && r.plan !== 'free'
              return (
                <li
                  key={r.plan}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 ${
                    destaque ? 'border-brass/40 bg-brass/[0.06]' : 'border-ink/10 bg-paper-soft'
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`text-[13.5px] font-semibold ${
                        destaque ? 'text-brass-deep' : 'text-ink'
                      }`}
                    >
                      {PLAN_LABEL[r.plan]}
                    </span>
                    {atual && (
                      <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                        Seu plano
                      </span>
                    )}
                    {r.plan !== 'free' && (
                      <span className="text-[11.5px] text-ink-faint">
                        {PLAN_PRICE[r.plan as Exclude<Plan, 'free'>]}/mês
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-right text-[13px] font-medium ${
                      destaque ? 'text-ink' : 'text-ink-soft'
                    }`}
                  >
                    {r.value}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Link to={voltar} className="btn-ghost flex-1 !py-2.5">
              Continuar editando
            </Link>
            {alvo && (
              <Link to={checkoutUrl(alvo)} className="btn-primary flex-1 !py-2.5 text-[14px]">
                Ativar {PLAN_LABEL[alvo]} · {PLAN_PRICE[alvo]}/mês
              </Link>
            )}
          </div>
        </div>
      )}

      <div className={cmp ? 'pt-2' : ''}>
        {cmp && (
          <h2 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
            Todos os planos
          </h2>
        )}
        <PlanShowcase plan={planoAtual} voltar={voltar} tema={tema} />
      </div>
    </SubPage>
  )
}
