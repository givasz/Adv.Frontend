import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckIcon, InfoIcon, XIcon } from '@/components/ui/icons'

// Botão "ⓘ" com popover de orientações de conformidade da OAB, contextual ao campo.
// Abre no clique; fecha ao clicar fora ou pressionar Esc. Cada item recebe marcador
// de "permitido" (✓) ou "evitar" (✕) conforme começe com "Evite"/"Não".
export function InfoTip({
  items,
  title = 'O que a OAB permite',
  label = 'Ajuda de conformidade OAB',
  align = 'right',
}: {
  items: string[]
  title?: string
  label?: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brass/30 ${
          open ? 'bg-brass/15 text-brass-deep' : 'text-ink-faint hover:bg-brass/10 hover:text-brass-deep'
        }`}
      >
        <InfoIcon width={15} height={15} strokeWidth={1.8} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label={title}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={`absolute top-7 z-30 w-[288px] max-w-[80vw] rounded-xl2 border border-brass/25 bg-paper p-3.5 shadow-lift ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            <p className="mb-2.5 flex items-center gap-1.5 font-display text-[13.5px] font-semibold text-brass-deep">
              <InfoIcon width={14} height={14} strokeWidth={1.8} />
              {title}
            </p>
            <ul className="space-y-2">
              {items.map((g, i) => {
                const avoid = /^(Evite|Não|Nao)/.test(g)
                return (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                    <span
                      className={`mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full ${
                        avoid ? 'bg-ink/[0.06] text-ink-faint' : 'bg-brass/[0.18] text-brass-deep'
                      }`}
                      aria-hidden
                    >
                      {avoid ? (
                        <XIcon width={10} height={10} strokeWidth={2.4} />
                      ) : (
                        <CheckIcon width={10} height={10} strokeWidth={2.6} />
                      )}
                    </span>
                    <span>{g}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 border-t border-brass/10 pt-2 text-[11px] text-ink-faint">
              Provimento 205/2021 do CFOAB · não é aconselhamento jurídico.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}
