import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Plan } from '@/lib/types'
import { api } from '@/lib/api'
import { PLAN_LABEL } from '@/lib/upsell'
import { getTheme, isThemeUnlocked, type ThemeId } from '@/lib/themes'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { PlanFeaturePeek } from '@/components/editor/PlanChecklist'
import { CheckIcon, ScaleIcon } from '@/components/ui/icons'

// Assinatura (checkout SIMULADO) — /assinar/:plano.
//
// Era um modal por cima de outro modal (o de upsell): duas camadas de sobreposição
// numa decisão de compra, no celular, com o teclado do sistema por perto. Agora é
// uma página: dá para voltar, dá para recarregar sem perder, e o "processando →
// confirmado" acontece sem a tela por baixo brigando pela atenção.
//
// Continua SEM cobrança (plataforma em teste). Quem grava o plano é o servidor
// (POST /profiles/me/plan) — ver lib/api.ts.

const PRICE: Record<Exclude<Plan, 'free'>, string> = { pro: 'R$ 19', premium: 'R$ 39' }
const PROMISE: Record<Exclude<Plan, 'free'>, string> = {
  pro: 'Assistente de agendamento, selo OAB conferida, perguntas frequentes e endereço sem número.',
  premium:
    'Tudo do Pro + vídeo no perfil, mais perguntas frequentes, domínio próprio e a sua marca no lugar da nossa.',
}

type Phase = 'checkout' | 'processing' | 'done'

export default function CheckoutPage() {
  const { plano } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const voltar = useVoltar('/painel')
  const [phase, setPhase] = useState<Phase>('checkout')
  const [error, setError] = useState<string | null>(null)

  const plan = (plano === 'pro' || plano === 'premium' ? plano : null) as Exclude<Plan, 'free'> | null
  // Tema que o advogado estava PROVANDO quando decidiu assinar. Quem assina
  // provando um tema fica com ele: pedir para escolher de novo depois de pagar
  // seria perder justamente o que motivou a compra.
  const tema = params.get('tema') as ThemeId | null

  useEffect(() => {
    if (phase !== 'processing' || !plan) return
    let alive = true
    // A "espera do pagamento" acontece junto com a ativação de verdade no
    // servidor — o tempo da tela é o tempo do trabalho, não teatro puro.
    const started = Date.now()
    api
      .setPlan(plan)
      .then(async (saved) => {
        if (tema && isThemeUnlocked(getTheme(tema), plan) && saved.theme !== tema) {
          await api.saveDraft({ ...saved, theme: tema }).catch(() => {})
        }
        const restante = Math.max(0, 1200 - (Date.now() - started))
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
  // A volta leva a notícia junto: quem recebe (o painel) comemora o que abriu.
  // É o estado da compra viajando pela URL — o que o modal fazia com useState e
  // perdia a cada recarregamento.
  const voltarComemorando = `${voltar}${voltar.includes('?') ? '&' : '?'}assinou=${plan}`

  if (phase === 'processing') {
    return (
      <SubPage title="Confirmando…" backTo={voltar} backLabel="Voltar" documentTitle={`Assinar ${label}`}>
        <div className="flex flex-col items-center gap-4 rounded-xl2 border border-ink/10 bg-paper px-6 py-16 text-center shadow-card">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
          <p className="text-[14px] font-medium text-ink">Processando pagamento…</p>
          <p className="text-[12px] text-ink-faint">Confirmando sua assinatura {label} com segurança.</p>
        </div>
      </SubPage>
    )
  }

  if (phase === 'done') {
    return (
      <SubPage
        title="Assinatura confirmada!"
        backTo={voltar}
        backLabel="Voltar"
        documentTitle={`${label} ativo`}
      >
        <div className="flex flex-col items-center gap-2 rounded-xl2 border border-ink/10 bg-paper px-6 py-10 text-center shadow-card">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 16, stiffness: 260 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brass/20 text-brass-deep"
          >
            <CheckIcon width={34} height={34} strokeWidth={2.4} />
          </motion.span>
          <p className="mt-3 max-w-[19rem] text-[13.5px] leading-relaxed text-ink-soft">
            Seu plano <span className="font-semibold text-brass-deep">{label}</span> está ativo. Isto é
            o que abriu agora:
          </p>
          {/* Mesma lista do checklist pós-compra — a promessa da venda e o que
              aparece depois nunca divergem (ver lib/planFeatures.ts). */}
          <div className="mt-3 w-full rounded-lg border border-ink/10 bg-paper-soft/60 p-3.5 text-left">
            <PlanFeaturePeek plan={plan} max={5} />
          </div>
          <button
            type="button"
            onClick={() => navigate(voltarComemorando, { replace: true })}
            className="btn-primary mt-4 w-full !py-3"
          >
            Ver o que fazer agora
          </button>
        </div>
      </SubPage>
    )
  }

  return (
    <SubPage
      title={`Assinar ${label}`}
      subtitle={PROMISE[plan]}
      icon={<ScaleIcon width={18} height={18} />}
      backTo={voltar}
      backLabel="Voltar"
      documentTitle={`Assinar ${label}`}
    >
      <div className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
        <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-3">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
            Resumo do pedido
          </span>
          <span className="font-display text-[22px] font-semibold text-ink">{PRICE[plan]}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-3 text-[13.5px]">
          <span className="text-ink-soft">Plano {label} · mensal</span>
          <span className="tabular-nums text-ink">{PRICE[plan]}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-ink/10 py-3 text-[14px] font-semibold">
          <span className="text-ink">Total hoje</span>
          <span className="tabular-nums text-brass-deep">R$ 0,00</span>
        </div>

        <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-faint">
          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass-deep/70" />
          Plataforma em teste — nenhuma cobrança real é feita. Você ativa o plano na hora e pode
          voltar ao Free quando quiser.
        </p>

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
          className="btn-primary mt-4 w-full !py-3"
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
      </div>
    </SubPage>
  )
}
