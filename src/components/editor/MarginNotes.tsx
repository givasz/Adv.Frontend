import type { checkCompliance } from '@/lib/oab'
import { CheckIcon, ScaleIcon } from '@/components/ui/icons'

type Issues = ReturnType<typeof checkCompliance>

// "Comentários à margem" (estilo Google Docs) — apresenta a checagem de conformidade
// como uma REVISÃO colegiada, não como fiscalização: cada apontamento é um comentário
// do "Revisor de conformidade" ancorado no trecho citado. Reforça a sensação de
// segunda opinião amigável. Sem issues → estado positivo de "nada a apontar".
export function MarginNotes({ issues }: { issues: Issues }) {
  if (!issues.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-brass/20 bg-brass/[0.05] px-3 py-2.5 text-[12.5px] text-ink-soft">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass-deep">
          <CheckIcon width={13} height={13} strokeWidth={2.4} />
        </span>
        <span>
          <span className="font-semibold text-brass-deep">Revisor de conformidade:</span> nada a
          apontar. O texto está sóbrio e dentro das regras.
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {issues.map((issue, idx) => {
        const blocking = issue.severity === 'block'
        return (
          <div
            key={idx}
            className="relative rounded-lg border border-ink/12 bg-paper-soft px-3 py-2.5 shadow-sm"
          >
            {/* "linha" que liga o comentário ao texto, como no Google Docs */}
            <span
              className={`absolute -left-px top-3 h-[calc(100%-1.5rem)] w-[3px] rounded-full ${
                blocking ? 'bg-brass-deep/70' : 'bg-brass/40'
              }`}
              aria-hidden
            />
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-ink-faint">
                <ScaleIcon width={13} height={13} />
              </span>
              <span className="text-[12px] font-semibold text-ink">Revisor de conformidade</span>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                  blocking ? 'bg-brass/15 text-brass-deep' : 'bg-ink/[0.06] text-ink-faint'
                }`}
              >
                {blocking ? 'ajustar' : 'sugestão'}
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
              <span className="rounded bg-brass/15 px-1 font-medium text-ink">“{issue.term}”</span>{' '}
              — {issue.reason}
            </p>
          </div>
        )
      })}
    </div>
  )
}
