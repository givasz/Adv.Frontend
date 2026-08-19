import { motion } from 'framer-motion'
import type { Plan } from '@/lib/types'
import { getTheme, type ThemeId } from '@/lib/themes'
import { PLAN_LABEL, PLAN_PRICE } from '@/lib/upsell'
import { SparkIcon } from '@/components/ui/icons'

// Barra da prova de tema: aparece enquanto um tema travado está só na prévia.
//
// Ela existe para o experimento ser HONESTO. O perfil público continua com o tema
// salvo, e isso precisa estar dito com todas as letras — senão o advogado sai
// achando que trocou de visual e descobre o contrário quando alguém abrir o link.
// Daí também o "Voltar ao meu tema" ao lado do CTA: sair da prova tem de ser tão
// fácil quanto entrar.

export function ThemeTrialBar({
  trying,
  saved,
  onSubscribe,
  onCancel,
  onShowPreview,
}: {
  trying: ThemeId
  saved: ThemeId
  onSubscribe: (p: Exclude<Plan, 'free'>) => void
  onCancel: () => void
  /** só no celular: leva para a aba de prévia, onde o tema provado aparece */
  onShowPreview: () => void
}) {
  const theme = getTheme(trying)
  const tier = theme.tier as Exclude<Plan, 'free'>

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl2 border border-brass/40 bg-gradient-to-b from-brass/[0.12] to-transparent p-4"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
          <SparkIcon width={15} height={15} className="text-brass-deep" />
          Provando o tema {theme.name}
        </span>
        <span className="rounded-full bg-brass/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brass-deep">
          {PLAN_LABEL[tier]}
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
        Só aqui na prévia. Seu perfil continua com o tema{' '}
        <span className="font-medium text-ink">{getTheme(saved).name}</span> para quem abre o link —
        o {PLAN_LABEL[tier]} é que salva este.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {/* No desktop a prévia está ao lado e o tema já mudou sozinho. No celular
            ela vive noutra aba — sem este atalho, "provar" não mostraria nada. */}
        <button
          type="button"
          onClick={onShowPreview}
          className="btn-primary !py-2 !px-4 text-[13px] lg:hidden"
        >
          Ver no meu perfil
        </button>
        <button
          type="button"
          onClick={() => onSubscribe(tier)}
          className="btn-primary !py-2 !px-4 text-[13px] max-lg:!bg-transparent max-lg:!text-burgundy max-lg:!ring-1 max-lg:!ring-burgundy/40"
        >
          Ficar com o {theme.name} · {PLAN_PRICE[tier]}/mês
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[12.5px] font-semibold text-ink-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Voltar ao meu tema
        </button>
      </div>
    </motion.div>
  )
}
