import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { Plan, Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { PLAN_LABEL } from '@/lib/upsell'
import { mudancasAoDescer } from '@/lib/rebaixamento'
import { dataCurta } from '@/lib/assinatura'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { CheckIcon, ClockIcon } from '@/components/ui/icons'

// Descer de plano — /plano/mudar/:plano.
//
// Existe porque descer era um clique só, sem confirmação e sem uma palavra sobre o
// efeito: o botão "Voltar ao Free" chamava a troca direto. Quem clicasse descobria
// o que tinha acontecido abrindo a própria página.
//
// Três coisas esta tela faz, e nenhuma delas é dificultar a saída:
//
//  1. DIZ O QUE MUDA, a partir do perfil real — não uma lista genérica de
//     marketing ao contrário (ver lib/rebaixamento.ts).
//  2. DIZ O QUE NÃO MUDA. É a parte que mais importa e a que ninguém escreve: o
//     endereço público continua o mesmo, a página segue no ar, e nada é apagado.
//  3. DIZ QUANDO. Com mês pago em aberto, a mudança é AGENDADA para o fim dele —
//     ninguém paga o Max e recebe o Pro no dia seguinte.
//
// O que ela NÃO faz: pedir motivo, oferecer desconto de última hora, esconder o
// botão. Fricção para reter é o tipo de coisa que o público desta plataforma —
// advogados — reconhece e cobra.

const RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

export default function MudarPlanoPage() {
  const { plano } = useParams()
  const navigate = useNavigate()
  const voltar = useVoltar('/painel')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const alvo = (plano === 'free' || plano === 'pro' || plano === 'premium' ? plano : null) as Plan | null

  useEffect(() => {
    let vivo = true
    api
      .getDraft()
      .then((p) => vivo && setProfile(p))
      .catch(() => vivo && setErro('Não foi possível carregar seu perfil.'))
    return () => {
      vivo = false
    }
  }, [])

  if (!alvo) return <Navigate to="/painel" replace />

  if (!profile) {
    return (
      <SubPage title="Mudar de plano" backTo={voltar} documentTitle="Mudar de plano">
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
        </div>
      </SubPage>
    )
  }

  // Subir não passa por aqui — para isso existe o checkout.
  if (RANK[alvo] >= RANK[profile.plan]) {
    return <Navigate to={alvo === 'free' ? '/painel' : `/assinar/${alvo}`} replace />
  }

  const { perde, mantem } = mudancasAoDescer(profile, alvo)
  // Mês pago em aberto: a mudança tem data, e a data é a do fim do que já foi pago.
  const fimDoPeriodo = profile.subscription?.currentPeriodEnd ?? null
  const agendada = !!fimDoPeriodo && new Date(fimDoPeriodo).getTime() > Date.now()

  const confirmar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      await api.setPlan(alvo)
      navigate(voltar, { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível mudar o plano.')
      setSalvando(false)
    }
  }

  return (
    <SubPage
      title={alvo === 'free' ? 'Voltar ao Free' : `Mudar para o ${PLAN_LABEL[alvo]}`}
      subtitle={
        agendada
          ? `Você já pagou até ${dataCurta(fimDoPeriodo)} — nada muda antes disso.`
          : 'Veja o que muda na sua página antes de confirmar.'
      }
      backTo={voltar}
      backLabel="Cancelar"
      documentTitle="Mudar de plano"
    >
      <div className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
        {agendada && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-brass/40 bg-brass/[0.08] px-3.5 py-3">
            <ClockIcon width={16} height={16} className="mt-[2px] shrink-0 text-brass-deep" />
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              A mudança acontece em{' '}
              <span className="font-semibold text-ink">{dataCurta(fimDoPeriodo)}</span>, quando o mês
              que você já pagou termina. Até lá você continua com o{' '}
              {PLAN_LABEL[profile.plan]} inteiro — e pode desfazer quando quiser.
            </p>
          </div>
        )}

        {perde.length > 0 && (
          <>
            <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              O que sai da sua página
            </h2>
            <ul className="mt-2.5 space-y-1.5">
              {perde.map((t) => (
                <li key={t} className="flex items-start gap-2 text-[13px] leading-snug text-ink-soft">
                  <span aria-hidden className="mt-[7px] h-px w-2.5 shrink-0 bg-ink/30" />
                  {t}
                </li>
              ))}
            </ul>
          </>
        )}

        <h2
          className={`text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep ${
            perde.length > 0 ? 'mt-5 border-t border-ink/10 pt-4' : ''
          }`}
        >
          O que continua igual
        </h2>
        <ul className="mt-2.5 space-y-1.5">
          {mantem.map((t) => (
            <li key={t} className="flex items-start gap-2 text-[13px] leading-snug text-ink-soft">
              <CheckIcon width={13} height={13} strokeWidth={2.6} className="mt-[3px] shrink-0 text-brass-deep" />
              {t}
            </li>
          ))}
        </ul>

        {erro && (
          <p role="alert" className="mt-4 text-[12.5px] text-burgundy">
            {erro}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
          {/* O botão de continuar no plano vem PRIMEIRO na ordem visual (row-reverse)
              sem virar armadilha: o de confirmar tem o mesmo tamanho e o mesmo peso
              de leitura, só não é o destacado. */}
          <button
            type="button"
            onClick={() => navigate(voltar)}
            className="btn-primary flex-1 !py-3"
            disabled={salvando}
          >
            Continuar no {PLAN_LABEL[profile.plan]}
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando}
            className="flex-1 rounded-full border border-ink/15 py-3 text-[13.5px] font-semibold text-ink transition-colors hover:border-burgundy/40 hover:text-burgundy disabled:opacity-60"
          >
            {salvando
              ? 'Mudando…'
              : agendada
                ? `Agendar mudança para o ${PLAN_LABEL[alvo]}`
                : `Confirmar mudança para o ${PLAN_LABEL[alvo]}`}
          </button>
        </div>
      </div>
    </SubPage>
  )
}
