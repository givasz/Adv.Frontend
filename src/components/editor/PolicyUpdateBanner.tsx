import { POLICY_VERSION } from '@/lib/oab'
import { InfoIcon } from '@/components/ui/icons'

// Monitor de mudanças normativas — aparece quando o conjunto de regras foi revisado
// depois da última conferência do perfil. O perfil é reavaliado automaticamente
// (reviewCount vem de fora, já recalculado sob as regras atuais) e o advogado é
// avisado. "Marcar como revisado" carimba a revisão vigente no perfil.
export function PolicyUpdateBanner({
  reviewCount,
  onReviewed,
}: {
  /** nº de pontos de conformidade encontrados na reavaliação sob as regras atuais */
  reviewCount: number
  onReviewed: () => void
}) {
  return (
    <div className="rounded-xl2 border border-brass/30 bg-brass/[0.08] px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <InfoIcon width={18} height={18} className="mt-0.5 shrink-0 text-brass-deep" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-brass-deep">
            As regras de publicidade foram atualizadas
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
            {reviewCount > 0 ? (
              <>
                Reavaliamos seu perfil sob a versão vigente ({POLICY_VERSION}) e encontramos{' '}
                <span className="font-semibold">
                  {reviewCount} ponto{reviewCount > 1 ? 's' : ''}
                </span>{' '}
                para revisar. Confira a bio e as áreas de atuação.
              </>
            ) : (
              <>
                Reavaliamos seu perfil sob a versão vigente ({POLICY_VERSION}) e ele continua em
                conformidade. Nada a corrigir.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onReviewed}
            className="mt-2.5 rounded-lg border border-brass/40 bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-brass-deep transition-colors hover:bg-brass/10"
          >
            Marcar como revisado
          </button>
        </div>
      </div>
    </div>
  )
}
