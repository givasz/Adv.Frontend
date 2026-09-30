import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Plan } from '@/lib/types'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { ConfirmarEmailCartao } from '@/components/auth/EmailDaConta'
import { PLAN_LABEL } from '@/lib/upsell'
import { precoDoPlano } from '@/lib/plans'
import { PAGAMENTO_ONLINE_DISPONIVEL, REGRAS_DE_COBRANCA, offerOf } from '@/lib/planOffer'
import { getTheme, isThemeUnlocked, type ThemeId } from '@/lib/themes'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { CheckIcon, ClockIcon, ScaleIcon } from '@/components/ui/icons'
import { CheckoutPago } from '@/components/checkout/CheckoutPago'
import { PlanoAtivado } from '@/components/checkout/PlanoAtivado'

// Assinatura — /assinar/:plano.
//
// Era um modal por cima de outro modal (o de upsell): duas camadas de sobreposição
// numa decisão de compra, no celular, com o teclado do sistema por perto. Agora é
// uma página: dá para voltar, dá para recarregar sem perder, e o "ativando →
// ativado" acontece sem a tela por baixo brigando pela atenção.
//
// Quem grava o plano é o servidor (POST /profiles/me/plan) — ver lib/api.ts.
//
// Com o pagamento on-line ligado (VITE_PAGAMENTO_ONLINE, ver planOffer.ts), esta
// página entrega a vez ao CheckoutPago: cartão, Pix ou boleto pelo Asaas, e o plano
// abre quando o pagamento é confirmado. O resto deste arquivo é o checkout antigo,
// que segue valendo enquanto a variável não estiver ligada.
//
// Sobre o pagamento: enquanto o provedor não está ligado
// (PAGAMENTO_ONLINE_DISPONIVEL = false), ESTA é a única tela que diz isso. A home
// e a vitrine mostram o preço de tabela e ponto; a pessoa só precisa saber que a
// cobrança ainda não começou no momento em que está prestes a confirmar — e
// precisa saber aqui, com todas as letras, porque é aqui que ela decide.

// De plans.ts, a fonte única. O checkout é o ÚLTIMO lugar onde um preço pode
// divergir da vitrine: quem descobre a diferença aqui descobre no pior momento.
const PRICE: Record<Exclude<Plan, 'free'>, string> = {
  pro: precoDoPlano('pro'),
  premium: precoDoPlano('premium'),
}

type Phase = 'checkout' | 'processing' | 'done'

export default function CheckoutPage() {
  const { plano } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const voltar = useVoltar('/painel')
  const [phase, setPhase] = useState<Phase>('checkout')
  const [error, setError] = useState<string | null>(null)
  // Assinar pede o e-mail confirmado (o servidor recusa sem ele — ver
  // ProfilesService.setPlan): é por ele que chegam a cobrança e os avisos do plano.
  const { emailPending } = useAuth()

  const plan = (plano === 'pro' || plano === 'premium' ? plano : null) as Exclude<Plan, 'free'> | null
  // Tema que o advogado estava PROVANDO quando decidiu assinar. Quem assina
  // provando um tema fica com ele: pedir para escolher de novo depois de pagar
  // seria perder justamente o que motivou a compra.
  const tema = params.get('tema') as ThemeId | null

  useEffect(() => {
    if (phase !== 'processing' || !plan) return
    let alive = true
    // A espera acontece junto com a ativação de verdade no servidor — o tempo da
    // tela é o tempo do trabalho, não teatro.
    const started = Date.now()
    api
      .setPlan(plan)
      .then(async (saved) => {
        if (tema && isThemeUnlocked(getTheme(tema), plan) && saved.theme !== tema) {
          await api.saveDraft({ ...saved, theme: tema }).catch(() => {})
        }
        const restante = Math.max(0, 900 - (Date.now() - started))
        setTimeout(() => alive && setPhase('done'), restante)
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Não foi possível ativar o plano.')
        setPhase('checkout')
      })
    return () => {
      alive = false
    }
  }, [phase, plan, tema])

  if (!plan) return <Navigate to="/painel" replace />

  const label = PLAN_LABEL[plan]
  const oferta = offerOf(plan)

  if (PAGAMENTO_ONLINE_DISPONIVEL) {
    return <CheckoutPago plan={plan} label={label} tema={tema} voltar={voltar} />
  }

  if (phase === 'processing') {
    return (
      <SubPage title="Ativando…" backTo={voltar} backLabel="Voltar" documentTitle={`Assinar ${label}`}>
        <div className="flex flex-col items-center gap-4 rounded-xl2 border border-ink/10 bg-paper px-6 py-16 text-center shadow-card">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
          <p className="text-[14px] font-medium text-ink">Ativando seu plano {label}…</p>
          <p className="text-[12px] text-ink-faint">Abrindo os recursos no seu perfil.</p>
        </div>
      </SubPage>
    )
  }

  if (phase === 'done') return <PlanoAtivado plan={plan} label={label} voltar={voltar} />

  return (
    <SubPage
      title={`Assinar ${label}`}
      subtitle={oferta.pitch}
      icon={<ScaleIcon width={18} height={18} />}
      backTo={voltar}
      backLabel="Voltar"
      documentTitle={`Assinar ${label}`}
    >
      <div className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
        <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-3">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
            Resumo da assinatura
          </span>
          <span className="font-display text-[22px] font-semibold text-ink">
            {PRICE[plan]}
            <span className="ml-0.5 font-sans text-[13px] font-medium text-ink-faint">/mês</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 py-3 text-[13.5px]">
          <span className="text-ink-soft">Plano {label} · renovação mensal</span>
          <span className="tabular-nums text-ink">{PRICE[plan]},00</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-ink/10 py-3 text-[14px] font-semibold">
          <span className="text-ink">Total por mês</span>
          <span className="tabular-nums text-ink">{PRICE[plan]},00</span>
        </div>

        {!PAGAMENTO_ONLINE_DISPONIVEL && (
          // A única frase do produto sobre o pagamento ainda não estar ligado.
          // Diz o que acontece (ativa agora), quando a cobrança começa (quando o
          // meio de pagamento existir) e como a pessoa fica sabendo (no painel,
          // antes). Nada de "grátis": é uma assinatura cuja primeira cobrança
          // tem data a definir, e a pessoa merece saber exatamente isso.
          <p className="flex items-start gap-2 rounded-lg border border-brass/40 bg-brass/[0.08] px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
            <ClockIcon width={15} height={15} className="mt-[2px] shrink-0 text-brass-deep" />
            <span>
              <span className="font-semibold text-ink">O pagamento on-line ainda está sendo integrado.</span>{' '}
              Ao confirmar, o plano é ativado agora. A primeira cobrança só acontece quando o meio
              de pagamento estiver disponível — e você é avisado no painel antes dela, com a data.
            </span>
          </p>
        )}

        {/* As regras da assinatura, as mesmas da home e dos Termos de Uso. Quem
            está prestes a assinar lê aqui o que acontece se cancelar, se descer
            de plano, se se arrepender — sem precisar procurar. */}
        <ul className="mt-4 space-y-1.5 border-t border-ink/10 pt-3.5">
          {REGRAS_DE_COBRANCA.map((r) => (
            <li key={r} className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
              <CheckIcon width={13} height={13} strokeWidth={2.4} className="mt-[3px] shrink-0 text-brass-deep" />
              {r}
            </li>
          ))}
        </ul>

        {/* Entre a pessoa e o botão, no lugar em que ela decide. Some sozinho quando
            o servidor diz que o e-mail foi confirmado (inclusive ao voltar do
            aplicativo de e-mail para esta aba). */}
        <ConfirmarEmailCartao contexto="assinar" className="mt-4" />

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => setPhase('processing')}
          disabled={emailPending}
          className="btn-primary mt-4 w-full !py-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirmar assinatura {label}
        </button>
        <button
          type="button"
          onClick={() => navigate(voltar)}
          className="mt-2 w-full py-2 text-[13px] font-medium text-ink-faint hover:text-ink"
        >
          Agora não
        </button>
        <p className="mt-3 text-center text-[11.5px] leading-relaxed text-ink-faint">
          Ao confirmar você aceita os{' '}
          <a href="/legal/termos" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
            Termos de Uso
          </a>
          , inclusive as condições de cobrança e cancelamento.
        </p>
      </div>
    </SubPage>
  )
}
