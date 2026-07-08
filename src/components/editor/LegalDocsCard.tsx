import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { generateLegalDocs, type LegalDoc } from '@/lib/legalDocs'
import { useDialog } from '@/lib/a11y'
import { Card } from './fields'
import { CopyIcon, LockIcon } from '@/components/ui/icons'

function download(doc: LegalDoc) {
  const blob = new Blob([doc.body], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.filename
  a.click()
  URL.revokeObjectURL(url)
}

// Gerador de Política de Privacidade e Termos de Uso (LGPD) a partir dos dados do
// perfil — útil para quem coleta contato pelo link. Modelo informativo, não é
// aconselhamento jurídico.
export function LegalDocsCard({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const docs = useMemo(() => generateLegalDocs(profile), [profile])

  return (
    <Card title="Documentos legais (LGPD)">
      <p className="-mt-1 flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
        <LockIcon width={14} height={14} className="mt-0.5 shrink-0" />
        <span>
          Se você recebe contatos pelo perfil (WhatsApp, e-mail, agendamento), gere uma Política de
          Privacidade e Termos de Uso já preenchidos com os seus dados.
        </span>
      </p>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full">
        Gerar documentos
      </button>
      {open && <LegalDocsDialog docs={docs} onClose={() => setOpen(false)} />}
    </Card>
  )
}

function LegalDocsDialog({ docs, onClose }: { docs: LegalDoc[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState(0)
  const [copied, setCopied] = useState(false)
  useDialog(dialogRef, onClose)
  const doc = docs[tab]

  async function copy() {
    try {
      await navigator.clipboard.writeText(doc.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/45 p-3 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl2 border border-ink/10 bg-paper shadow-lift"
      >
        <div className="border-b border-ink/10 p-4">
          <h3 id="legal-title" className="font-display text-lg font-semibold">
            Documentos legais
          </h3>
          <div className="mt-3 flex gap-1.5">
            {docs.map((d, i) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setTab(i)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  i === tab ? 'bg-burgundy text-paper-soft' : 'bg-ink/[0.05] text-ink-faint'
                }`}
              >
                {d.title}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink-soft">
            {doc.body}
          </pre>
        </div>

        <div className="flex items-center gap-2 border-t border-ink/10 p-4">
          <button type="button" onClick={() => download(doc)} className="btn-primary flex-1">
            Baixar .txt
          </button>
          <button type="button" onClick={copy} className="btn-ghost">
            <CopyIcon width={16} height={16} />
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Fechar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
