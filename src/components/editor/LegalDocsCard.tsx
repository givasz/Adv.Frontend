import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { generateLegalDocs, type LegalDoc } from '@/lib/legalDocs'
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
//
// Os documentos abrem EM LINHA, dentro do próprio card. Eram uma janela sobre a
// página: texto longo dentro de uma caixa com rolagem própria, no celular, é a
// pior combinação possível — e ler o documento inteiro é o objetivo da tela.
export function LegalDocsCard({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const docs = useMemo(() => generateLegalDocs(profile), [profile])
  const doc = docs[tab]

  async function copy() {
    try {
      await navigator.clipboard.writeText(doc.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* área de transferência indisponível */
    }
  }

  return (
    <Card title="Documentos legais (LGPD)">
      <p className="-mt-1 flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
        <LockIcon width={14} height={14} className="mt-0.5 shrink-0" />
        <span>
          Se você recebe contatos pelo perfil (WhatsApp, e-mail, agendamento), gere uma Política de
          Privacidade e Termos de Uso já preenchidos com os seus dados.
        </span>
      </p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full">
          Gerar documentos
        </button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-lg border border-ink/10 bg-paper-soft/60"
          >
            {/* Abas dos documentos gerados */}
            <div className="flex flex-wrap gap-1.5 border-b border-ink/10 p-3">
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

            {/* Altura limitada com rolagem própria: o documento é longo e não pode
                empurrar o resto do editor para fora da tela. */}
            <div className="max-h-[50vh] overflow-y-auto p-3.5">
              <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink-soft">
                {doc.body}
              </pre>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 p-3">
              <button type="button" onClick={() => download(doc)} className="btn-primary flex-1 !py-2.5">
                Baixar .txt
              </button>
              <button type="button" onClick={copy} className="btn-ghost !py-2.5">
                <CopyIcon width={16} height={16} />
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost !py-2.5">
                Fechar
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </Card>
  )
}
