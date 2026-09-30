import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { SubPage } from '@/components/ui/SubPage'
import { PlanFeaturePeek } from '@/components/editor/PlanChecklist'
import { CheckIcon } from '@/components/ui/icons'

// A tela de "plano ativado" — a mesma para quem ativou pelo checkout antigo e para
// quem pagou pelo Asaas. Duas telas de sucesso para a mesma notícia divergiriam na
// primeira mudança de texto.
export function PlanoAtivado({
  plan,
  label,
  voltar,
}: {
  plan: 'pro' | 'premium'
  label: string
  voltar: string
}) {
  const navigate = useNavigate()
  // A volta leva a notícia junto: quem recebe (o painel) comemora o que abriu.
  const voltarComemorando = `${voltar}${voltar.includes('?') ? '&' : '?'}assinou=${plan}`
  return (
    <SubPage title="Plano ativado" backTo={voltar} backLabel="Voltar" documentTitle={`${label} ativo`}>
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
          Seu plano <span className="font-semibold text-brass-deep">{label}</span> está ativo. Isto é o
          que abriu agora:
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
