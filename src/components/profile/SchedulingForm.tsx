import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { useDialog } from '@/lib/a11y'
import { ArrowRight, WhatsappIcon, XIcon } from '@/components/ui/icons'

// "Agendar consulta" sem calendário: o cliente diz o assunto e a preferência de
// horário, e isso vira uma mensagem pré-formatada no WhatsApp do advogado. Modal
// em paper/ink (sai da estética do tema do perfil, como os outros diálogos).
export function SchedulingForm({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onClose)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [when, setWhen] = useState('')

  const wa = profile.contact.whatsapp
  const areas = profile.areas.filter((a) => a.label.trim())

  const message = [
    'Olá! Vim pelo seu perfil no advoc.me e gostaria de agendar uma consulta.',
    name.trim() && `Meu nome é ${name.trim()}.`,
    subject.trim() && `Assunto: ${subject.trim()}`,
    when.trim() && `Preferência de dia/horário: ${when.trim()}`,
  ]
    .filter(Boolean)
    .join('\n')

  const ready = !!wa && subject.trim().length > 0
  const href = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}` : undefined

  const inputCls =
    'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink ' +
    'placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sched-title"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-xl2 bg-paper text-ink shadow-lift sm:rounded-xl2"
        initial={{ y: 26, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 26, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div>
            <h2 id="sched-title" className="font-display text-[18px] font-semibold">
              Agendar uma consulta
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">
              Conte o assunto e sua preferência de horário — a mensagem vai pelo WhatsApp.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 shrink-0 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <XIcon width={18} height={18} />
          </button>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Seu nome <span className="font-normal text-ink-faint">· opcional</span>
            </span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar" />
          </label>

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">Assunto da consulta</span>
            {areas.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {areas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSubject(a.label)}
                    className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                      subject === a.label
                        ? 'border-burgundy bg-burgundy/[0.06] text-burgundy'
                        : 'border-ink/15 text-ink-soft hover:border-brass/50'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            <input
              className={inputCls}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: divórcio consensual"
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">Preferência de dia e horário</span>
            <input
              className={inputCls}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              placeholder="Ex.: terça de manhã, ou 15/08 às 14h"
            />
          </label>

          <a
            href={ready ? href : undefined}
            target="_blank"
            rel="noreferrer noopener"
            aria-disabled={!ready}
            onClick={(e) => {
              if (!ready) e.preventDefault()
              else onClose()
            }}
            className={`btn-primary mt-1 w-full !py-3 ${ready ? '' : 'pointer-events-none opacity-50'}`}
          >
            <WhatsappIcon width={18} height={18} />
            Enviar no WhatsApp
            <ArrowRight width={16} height={16} />
          </a>
          {!wa ? (
            <p className="text-center text-[12px] text-brass-deep">
              Este perfil ainda não informou um WhatsApp.
            </p>
          ) : (
            <p className="text-center text-[11.5px] leading-relaxed text-ink-faint">
              Contato informativo. Nenhuma orientação jurídica é prestada antes da análise do caso.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
