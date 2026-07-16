import { useState } from 'react'
import type { checkCompliance } from '@/lib/oab'
import { InfoIcon, XIcon } from '@/components/ui/icons'

type Issues = ReturnType<typeof checkCompliance>

// Motor de conformidade INVISÍVEL (RFC-001): o advogado escreve normalmente e só
// é avisado quando precisa. Nada aparece quando o texto está ok. Cada aviso surge
// uma única vez (deduplicado por regra), em uma linha; "Corrigir" revela como ajustar.
export function MarginNotes({ issues }: { issues: Issues }) {
  // Deduplica por regra — o mesmo alerta nunca se repete.
  const seen = new Set<string>()
  const unique = issues.filter((i) => (seen.has(i.ruleId) ? false : seen.add(i.ruleId)))

  if (!unique.length) return null

  return (
    <div className="space-y-1.5">
      {unique.map((issue) => (
        <Note key={issue.ruleId} issue={issue} />
      ))}
    </div>
  )
}

function Note({ issue }: { issue: Issues[number] }) {
  const [open, setOpen] = useState(false)
  const blocking = issue.severity === 'block'
  return (
    <div className="rounded-lg border border-brass/25 bg-brass/[0.06] px-3 py-2">
      <div className="flex items-start gap-2 text-[12.5px] leading-relaxed text-brass-deep">
        <InfoIcon width={14} height={14} className="mt-0.5 shrink-0" />
        <span className="flex-1">
          <span className="rounded bg-brass/15 px-1 font-medium text-ink">“{issue.matchedText}”</span>{' '}
          pode esbarrar nas regras da OAB.
        </span>
        {issue.suggestion && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 font-semibold text-burgundy hover:underline"
          >
            {open ? (
              <XIcon width={13} height={13} />
            ) : (
              blocking ? 'Corrigir' : 'Como ajustar'
            )}
          </button>
        )}
      </div>
      {open && issue.suggestion && (
        <p className="mt-1.5 pl-6 text-[12px] leading-relaxed text-ink-soft">{issue.suggestion}</p>
      )}
    </div>
  )
}
