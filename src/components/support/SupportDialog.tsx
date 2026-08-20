import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useDialog } from '@/lib/a11y'
import {
  myTickets,
  openTicket,
  SUPPORT_KIND_LABEL,
  SUPPORT_KINDS,
  SUPPORT_STATUS_LABEL,
  type SupportKind,
  type SupportTicket,
} from '@/lib/support'
import { CheckIcon, XIcon, ScaleIcon } from '@/components/ui/icons'

// Canal de suporte do cliente.
//
// Três decisões que fazem um chamado ser aberto em vez de abandonado:
//
//  • O tipo é escolhido em um toque, não digitado. "Algo quebrado" e "Dúvida"
//    chegam ao admin já separados, sem custar nada a quem escreve.
//  • URL e navegador vão junto automaticamente (ver lib/support.ts). Pedir isso
//    num formulário é o jeito mais rápido de não receber chamado nenhum.
//  • O histórico fica na mesma janela. Sem ele, quem escreveu não sabe se
//    alguém leu — e escreve de novo.

type Phase = 'form' | 'sent'

export function SupportDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onClose)

  const [kind, setKind] = useState<SupportKind>('bug')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('form')
  const [historico, setHistorico] = useState<SupportTicket[]>([])

  useEffect(() => {
    myTickets().then(setHistorico)
  }, [phase])

  const podeEnviar = !busy && subject.trim().length >= 3 && message.trim().length >= 10

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!podeEnviar) return
    setBusy(true)
    setError(null)
    try {
      await openTicket({ kind, subject, message })
      setPhase('sent')
      setSubject('')
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="suporte-titulo"
        className="flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl2 bg-paper shadow-lift sm:rounded-xl2"
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 26, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div>
            <h2
              id="suporte-titulo"
              className="flex items-center gap-2 font-display text-[18px] font-semibold text-ink"
            >
              <ScaleIcon width={17} height={17} className="text-burgundy" />
              Falar com o suporte
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
              Atendimento a quem tem conta no advoc.me. Respondemos por aqui e pelo seu e-mail.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <XIcon width={18} height={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {phase === 'sent' ? (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brass/20 text-brass-deep">
                <CheckIcon width={30} height={30} strokeWidth={2.4} />
              </span>
              <h3 className="mt-4 font-display text-[19px] font-semibold text-ink">
                Chamado enviado.
              </h3>
              <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-ink-soft">
                Ele aparece abaixo com a situação. Quando alguém responder, a resposta fica aqui
                mesmo.
              </p>
              <button type="button" onClick={() => setPhase('form')} className="btn-ghost mt-5">
                Abrir outro chamado
              </button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4" noValidate>
              <fieldset>
                <legend className="mb-2 text-[12.5px] font-semibold text-ink">
                  Do que se trata?
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SUPPORT_KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      role="radio"
                      aria-checked={kind === k.value}
                      onClick={() => setKind(k.value)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        kind === k.value
                          ? 'border-burgundy bg-burgundy/[0.06] ring-1 ring-burgundy/30'
                          : 'border-ink/15 bg-paper-soft hover:border-ink/30'
                      }`}
                    >
                      <span className="block text-[13px] font-semibold text-ink">{k.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">
                        {k.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="suporte-assunto" className="mb-1.5 block text-[12.5px] font-semibold text-ink">
                  Assunto
                </label>
                <input
                  id="suporte-assunto"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  placeholder="Ex.: o botão de agendar não abre no celular"
                  className="w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
                />
              </div>

              <div>
                <label htmlFor="suporte-msg" className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[12.5px] font-semibold text-ink">O que aconteceu</span>
                  <span className="text-[11px] text-ink-faint">{message.length}/4000</span>
                </label>
                <textarea
                  id="suporte-msg"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={4000}
                  placeholder="Conte o que você fez, o que esperava e o que apareceu. Se souber repetir o problema, descreva o passo a passo."
                  className="w-full resize-none rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
                />
              </div>

              <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-faint">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass-deep/70" />
                Enviamos junto a página em que você está e o seu navegador — é o que costuma
                explicar o problema. Nada do conteúdo dos seus clientes é enviado.
              </p>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-burgundy-deep"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!podeEnviar}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Enviando…' : 'Enviar chamado'}
              </button>
            </form>
          )}

          {historico.length > 0 && (
            <div className="mt-6 border-t border-ink/10 pt-4">
              <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
                Seus chamados
              </h3>
              <ul className="mt-3 space-y-2">
                {historico.map((t) => (
                  <li key={t.id} className="rounded-lg border border-ink/10 bg-paper-soft/60 px-3.5 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-medium text-ink">{t.subject}</span>
                      <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                        {SUPPORT_KIND_LABEL[t.kind]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          t.status === 'resolved'
                            ? 'bg-brass/20 text-brass-deep'
                            : t.status === 'in_progress'
                              ? 'bg-burgundy/10 text-burgundy'
                              : 'bg-ink/[0.06] text-ink-faint'
                        }`}
                      >
                        {SUPPORT_STATUS_LABEL[t.status]}
                      </span>
                    </div>
                    {t.adminNote && (
                      <p className="mt-1.5 border-l-2 border-brass/50 pl-2.5 text-[12.5px] leading-relaxed text-ink-soft">
                        {t.adminNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
