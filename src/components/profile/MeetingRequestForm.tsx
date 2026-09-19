import { useState, type FormEvent } from 'react'
import { agendaDigital } from '@/lib/agendaDigital'
import type { RespostaDeTriagem } from '@/lib/triagem'
import { PrivacyNote } from '@/components/ui/PrivacyNote'

export function MeetingRequestForm({
  slug, initialName = '', initialSubject = '', preferredAt = '', triage = [], demo = false, themed = false,
}: {
  slug: string
  initialName?: string
  initialSubject?: string
  preferredAt?: string
  triage?: RespostaDeTriagem[]
  demo?: boolean
  themed?: boolean
}) {
  const [name, setName] = useState(initialName)
  const [subject, setSubject] = useState(initialSubject)
  const [when, setWhen] = useState(preferredAt)
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (demo) { setSent(true); return }
    setBusy(true)
    setError('')
    try {
      await agendaDigital.submit(slug, { name, whatsapp, email, subject, preferredAt: when || undefined, triage, consent })
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar. Tente novamente.')
    } finally { setBusy(false) }
  }

  const field = themed
    ? 'w-full rounded-xl border px-3.5 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[var(--c-accent)]'
    : 'w-full rounded-xl border border-ink/15 bg-paper-soft px-3.5 py-3 text-[14px] text-ink outline-none focus:border-burgundy focus:ring-2 focus:ring-burgundy/20'
  const themedStyle = themed ? { borderColor: 'var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)' } : undefined
  const label = themed ? 'block text-[12px] font-semibold' : 'block text-[12px] font-semibold text-ink'
  const phoneDigits = whatsapp.replace(/\D/g, '').length
  const hasContact = /^\S+@\S+\.\S+$/.test(email.trim()) || (phoneDigits >= 10 && phoneDigits <= 15)

  if (sent) return (
    <div role="status" className={themed ? 'rounded-xl border p-5 text-center' : 'rounded-xl border border-brass/30 bg-brass/10 p-5 text-center'} style={themedStyle}>
      <p className="font-display text-xl font-semibold">{demo ? 'Este é um perfil de exemplo' : 'Solicitação enviada'}</p>
      <p className="mt-2 text-[13px] leading-relaxed">{demo ? 'Nenhum pedido foi enviado.' : 'O advogado recebeu seus dados no painel e entrará em contato pelo canal informado. O horário só fica marcado após a confirmação dele.'}</p>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Solicitar reunião">
      <p className={themed ? 'text-[13px] leading-relaxed' : 'text-[13px] leading-relaxed text-ink-soft'}>
        Deixe um contato para o advogado responder. Isto é um pedido, ainda não é uma reserva.
      </p>
      <label className={label}>Seu nome
        <input className={`${field} mt-1`} style={themedStyle} value={name} onChange={(e) => setName(e.target.value)} maxLength={70} required minLength={2} autoComplete="name" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>WhatsApp
          <input className={`${field} mt-1`} style={themedStyle} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={30} type="tel" autoComplete="tel" placeholder="(11) 99999-9999" />
        </label>
        <label className={label}>E-mail
          <input className={`${field} mt-1`} style={themedStyle} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} type="email" autoComplete="email" placeholder="voce@exemplo.com" />
        </label>
      </div>
      {!hasContact && <p className={themed ? 't-faint text-[11px]' : 'text-[11px] text-ink-faint'}>Informe um WhatsApp com DDD ou um e-mail válido.</p>}
      <label className={label}>Assunto em poucas palavras
        <input className={`${field} mt-1`} style={themedStyle} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={220} required minLength={2} placeholder="Ex.: conversa sobre Direito de Família" />
      </label>
      {preferredAt ? (
        <p className={themed ? 'text-[12px]' : 'text-[12px] text-ink-soft'}>Horário pedido: <strong>{new Date(`${preferredAt}:00`).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</strong></p>
      ) : (
        <label className={label}>Preferência de data e hora <span className="font-normal opacity-70">(opcional)</span>
          <input className={`${field} mt-1`} style={themedStyle} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
      )}
      <label className="flex items-start gap-2.5 text-[12px] leading-relaxed">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-0.5 h-4 w-4 shrink-0 accent-burgundy" />
        <span>Autorizo o envio e armazenamento destes dados no painel do advogado para resposta à solicitação.</span>
      </label>
      <PrivacyNote fluxo="solicitacao" tone={themed ? 'themed' : 'page'} />
      {error && <p role="alert" className={themed ? 'text-[12px] font-semibold' : 'text-[12px] font-semibold text-burgundy'}>{error}</p>}
      <button type="submit" disabled={busy || !name.trim() || !subject.trim() || !hasContact || !consent}
        className={themed ? 't-btn w-full !py-3.5 disabled:opacity-50' : 'btn-primary w-full !py-3.5 disabled:opacity-50'}>
        {busy ? 'Enviando…' : 'Enviar solicitação'}
      </button>
    </form>
  )
}
