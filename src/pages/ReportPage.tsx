import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { REPORT_GUIDELINES, REPORT_REASONS } from '@/lib/reportReasons'
import type { ReportReason } from '@/lib/types'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { PrivacyNote } from '@/components/ui/PrivacyNote'
import { CheckIcon, FlagIcon, XIcon } from '@/components/ui/icons'

// Denúncia de um perfil — /:slug/denunciar.
//
// Era um modal. Virou página porque denúncia é formulário sério, com diretrizes
// para ler antes de escolher o motivo: no celular, uma folha sobreposta obrigava
// a rolar dentro de uma caixa dentro da página, e o teclado cobria metade dela.
// Agora a tela é inteira, o voltar do navegador funciona e o endereço é real.
export default function ReportPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const voltar = useVoltar(`/${slug}`)

  const [nome, setNome] = useState('')
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [error, setError] = useState<string | null>(null)

  // O nome é só para o cabeçalho ("Denunciar o perfil de X"). Se a busca falhar,
  // a página continua funcionando — a denúncia não depende dele.
  useEffect(() => {
    let alive = true
    api
      .getProfile(slug)
      .then((p) => {
        if (alive && p) setNome(p.name)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [slug])

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

  if (state === 'done') {
    return (
      <SubPage
        title="Denúncia enviada"
        backTo={voltar}
        backLabel="Voltar ao perfil"
        documentTitle="Denúncia enviada"
      >
        <div className="flex flex-col items-center gap-3 rounded-xl2 border border-ink/10 bg-paper px-6 py-12 text-center shadow-card">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brass/15 text-brass-deep">
            <CheckIcon width={26} height={26} strokeWidth={2.4} />
          </span>
          <h2 className="font-display text-lg font-semibold text-ink">Recebemos sua denúncia</h2>
          <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-faint">
            Um moderador vai avaliar o conteúdo à luz das normas da OAB. Se você deixou um e-mail,
            poderá receber retorno.
          </p>
          <button type="button" onClick={() => navigate(voltar)} className="btn-primary mt-2 !py-2.5">
            Voltar ao perfil
          </button>
        </div>
      </SubPage>
    )
  }

  return (
    <SubPage
      title="Denunciar perfil"
      subtitle={nome ? `Perfil de ${nome}` : `advoc.me/${slug}`}
      icon={<FlagIcon width={18} height={18} />}
      backTo={voltar}
      backLabel="Voltar ao perfil"
      documentTitle="Denunciar perfil"
      footer={
        <>
          <button type="button" onClick={() => navigate(voltar)} className="btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || state === 'sending'}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === 'sending' ? 'Enviando…' : 'Enviar denúncia'}
          </button>
        </>
      }
    >
      {/* Diretrizes: o que ajuda a moderação e o que não é caso de denúncia. */}
      <div className="rounded-xl2 border border-brass/25 bg-brass/[0.06] p-4">
        <p className="text-[13px] font-semibold text-brass-deep">{REPORT_GUIDELINES.title}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{REPORT_GUIDELINES.intro}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ul className="space-y-1.5">
            {REPORT_GUIDELINES.do.map((g, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-soft">
                <CheckIcon
                  width={12}
                  height={12}
                  strokeWidth={2.6}
                  className="mt-0.5 shrink-0 text-brass-deep"
                />
                {g}
              </li>
            ))}
          </ul>
          <ul className="space-y-1.5">
            {REPORT_GUIDELINES.dont.map((g, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-faint">
                <XIcon width={12} height={12} strokeWidth={2.4} className="mt-0.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <fieldset className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card">
        <legend className="px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
          Qual é o problema?
        </legend>
        <div className="mt-1 space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <label
              key={r.id}
              className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors ${
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
                <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card">
        <label htmlFor="report-details" className="mb-1.5 block text-[13px] font-semibold text-ink">
          Descrição {needsDetails ? '(obrigatória)' : '(opcional)'}
        </label>
        <textarea
          id="report-details"
          rows={4}
          value={details}
          maxLength={2000}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Aponte o trecho ou a seção do perfil que viola as regras."
          className="w-full resize-none rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />

        <label htmlFor="report-email" className="mb-1.5 mt-4 block text-[13px] font-semibold text-ink">
          Seu e-mail <span className="font-normal text-ink-faint">(opcional, para retorno)</span>
        </label>
        <input
          id="report-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          className="w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />

        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">{REPORT_GUIDELINES.outcome}</p>
        <PrivacyNote fluxo="denuncia" className="mt-2" />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep"
        >
          {error}
        </p>
      )}
    </SubPage>
  )
}
