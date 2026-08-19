import { useMemo, useState } from 'react'
import type { Profile } from '@/lib/types'
import { checkCompliance } from '@/lib/oab'
import { openAuditReport } from '@/lib/auditReport'
import { Card } from './fields'
import { LockedFeature } from './upsellBits'
import { CheckIcon } from '@/components/ui/icons'

// Comprovante de conformidade — recurso do Max anunciado na home que nunca teve
// botão. O motor (lib/auditReport.ts) já existia pronto: gera uma página para
// impressão/PDF registrando QUE regras estavam vigentes na data, o status do
// perfil e os itens verificados. Serve como prova documental se o advogado for
// questionado sobre uma publicação (REGRAS.md §4 — Registro e auditoria).

export function AuditReportCard({
  profile,
  onUpsell,
}: {
  profile: Profile
  onUpsell: () => void
}) {
  const [blocked, setBlocked] = useState(false)
  const issues = useMemo(
    () =>
      checkCompliance(
        [profile.bio, profile.headline, ...profile.areas.map((a) => a.description)]
          .filter(Boolean)
          .join('\n'),
      ),
    [profile],
  )

  const body = (
    <>
      <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
        Um documento datado com as regras vigentes, o resultado da verificação do seu perfil e os
        itens conferidos. Abra e salve como PDF — vale como registro se alguém questionar uma
        publicação sua.
      </p>
      <div className="flex items-start gap-2.5 rounded-lg border border-ink/10 bg-paper-soft/60 px-3.5 py-3">
        <CheckIcon width={16} height={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-brass-deep" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          {issues.length === 0
            ? 'Seu perfil não tem nenhum apontamento no momento — o comprovante sai limpo.'
            : `Seu perfil tem ${issues.length} ${issues.length === 1 ? 'apontamento' : 'apontamentos'} — eles aparecem listados no comprovante.`}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setBlocked(!openAuditReport(profile, issues))}
        className="btn-ghost w-full"
      >
        Gerar comprovante (PDF)
      </button>
      {blocked && (
        <p className="text-[11.5px] leading-relaxed text-brass-deep">
          O navegador bloqueou a nova aba. Libere os pop-ups deste site e tente de novo.
        </p>
      )}
    </>
  )

  if (profile.plan !== 'premium') {
    return (
      <Card title="Comprovante de conformidade">
        <LockedFeature unlockPlan="premium" onOpen={onUpsell}>
          <div className="space-y-4 p-1">{body}</div>
        </LockedFeature>
      </Card>
    )
  }

  return <Card title="Comprovante de conformidade">{body}</Card>
}
