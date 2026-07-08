import { useState } from 'react'
import { Modal } from './Modal'

// Formulário sóbrio de "Solicitar contato" (nunca "Contrate agora"). Mockado:
// não envia a lugar nenhum — apenas simula a confirmação. Trocável por API depois.
export function ModalContato({
  onClose,
  subjectName,
}: {
  onClose: () => void
  /** nome do advogado ou do escritório a quem o contato se destina (contexto) */
  subjectName: string
}) {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', contact: '', situation: '' })

  const valid = form.name.trim() && form.contact.trim() && form.situation.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    // Protótipo: sem backend. Aqui entraria a chamada de API.
    setSent(true)
  }

  return (
    <Modal title="Solicitar contato" onClose={onClose} labelledBy="contato-title">
      {sent ? (
        <div className="mt-4 text-center">
          <p className="text-sm text-ink-soft">
            Sua solicitação foi registrada. {subjectName.split(' ')[0]} retornará pelos dados
            informados.
          </p>
          <button type="button" onClick={onClose} className="btn-ghost mt-5">
            Fechar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <p className="text-sm text-ink-soft">
            Deixe seus dados e um breve resumo. O contato é destinado a{' '}
            <span className="font-medium text-ink">{subjectName}</span>.
          </p>

          <Field
            label="Nome"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Seu nome completo"
          />
          <Field
            label="Telefone ou e-mail"
            value={form.contact}
            onChange={(v) => setForm((f) => ({ ...f, contact: v }))}
            placeholder="(11) 90000-0000 ou voce@email.com"
          />
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">
              Descreva brevemente a situação
            </label>
            <textarea
              value={form.situation}
              onChange={(e) => setForm((f) => ({ ...f, situation: e.target.value }))}
              rows={4}
              placeholder="Em poucas linhas, sobre o que você precisa de orientação."
              className="w-full resize-none rounded-xl border border-ink/12 bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-brass"
            />
          </div>

          <button
            type="submit"
            disabled={!valid}
            className="btn-primary w-full disabled:cursor-not-allowed"
            style={valid ? { background: 'var(--firm-accent)' } : undefined}
          >
            Enviar solicitação
          </button>
          <p className="text-center text-[11.5px] leading-relaxed text-ink-faint">
            O envio não cria vínculo profissional nem representa aceitação de causa.
          </p>
        </form>
      )}
    </Modal>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink/12 bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-brass"
      />
    </div>
  )
}
