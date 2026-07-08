import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { REPORT_GUIDELINES, REPORT_REASONS } from '@/lib/reportReasons'
import type { ReportReason } from '@/lib/types'
import { CheckIcon, ScaleIcon, XIcon } from '@/components/ui/icons'

interface ReportDialogProps {
  slug: string
  name: string
  onClose: () => void
}

export function ReportDialog({ slug, name, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [error, setError] = useState<string | null>(null)

  const needsDetails = reason === 'other'
  const canSubmit = !!reason && (!needsDetails || details.trim().length >= 5)

  async function submit() {
    if (!reason || !canSubmit) return
    setState('sending')
    setError(null)
    try {
      await api.reportProfile(slug, {
        reason,
        details: details.trim(),
        reporterEmail: email.trim() || undefined,
      })
      setState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar a denúncia.')
      setState('form')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Denunciar o perfil de ${name}`}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-paper shadow-xl sm:rounded-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
              <ScaleIcon width={18} height={18} />
            </span>
            <div>
              <h2 className="font-display text-[16px] font-semibold text-ink">Denunciar perfil</h2>
              <p className="text-[12px] text-ink-faint">{name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <XIcon width={18} height={18} />
          </button>
        </div>

        {state === 'done' ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brass/15 text-brass-deep">
              <CheckIcon width={26} height={26} strokeWidth={2.4} />
            </span>
            <h3 className="font-display text-lg font-semibold text-ink">Denúncia enviada</h3>
            <p className="max-w-xs text-[13.5px] leading-relaxed text-ink-faint">
              Obrigado. Um moderador vai avaliar o conteúdo à luz das normas da OAB. Se você deixou
              um e-mail, poderá receber retorno.
            </p>
            <button type="button" onClick={onClose} className="btn-primary mt-2 !py-2.5">
              Fechar
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Aviso / diretrizes */}
            <div className="rounded-xl2 border border-brass/25 bg-brass/[0.06] p-3.5">
              <p className="text-[12.5px] font-semibold text-brass-deep">{REPORT_GUIDELINES.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                {REPORT_GUIDELINES.intro}
              </p>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <ul className="space-y-1">
                  {REPORT_GUIDELINES.do.map((g, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-soft">
                      <CheckIcon width={12} height={12} strokeWidth={2.6} className="mt-0.5 shrink-0 text-brass-deep" />
                      {g}
                    </li>
                  ))}
                </ul>
                <ul className="space-y-1">
                  {REPORT_GUIDELINES.dont.map((g, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-faint">
                      <XIcon width={12} height={12} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-faint" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Motivos */}
            <fieldset className="mt-4">
              <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                Qual é o problema?
              </legend>
              <div className="space-y-1.5">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer gap-2.5 rounded-lg border p-2.5 transition-colors ${
                      reason === r.id
                        ? 'border-burgundy/40 bg-burgundy/[0.05]'
                        : 'border-ink/10 hover:border-ink/25 hover:bg-ink/[0.02]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.id}
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-burgundy"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-ink">{r.label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">
                        {r.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Detalhes */}
            <div className="mt-4">
              <label htmlFor="report-details" className="mb-1.5 block text-[12.5px] font-medium text-ink">
                Descrição {needsDetails ? '(obrigatória)' : '(opcional)'}
              </label>
              <textarea
                id="report-details"
                rows={3}
                value={details}
                maxLength={2000}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Aponte o trecho ou a seção do perfil que viola as regras."
                className="w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
              />
            </div>

            {/* E-mail opcional */}
            <div className="mt-3">
              <label htmlFor="report-email" className="mb-1.5 block text-[12.5px] font-medium text-ink">
                Seu e-mail (opcional, para retorno)
              </label>
              <input
                id="report-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
              />
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">{REPORT_GUIDELINES.outcome}</p>

            {error && (
              <p className="mt-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2 pb-1">
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || state === 'sending'}
                className="btn-primary disabled:cursor-not-allowed"
              >
                {state === 'sending' ? 'Enviando…' : 'Enviar denúncia'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
