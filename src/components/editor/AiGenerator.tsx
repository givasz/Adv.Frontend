import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GenerateKind, Plan } from '@/lib/types'
import { api } from '@/lib/api'
import { checkCompliance } from '@/lib/oab'
import { templatesFor } from '@/lib/templates'
import { useDialog } from '@/lib/a11y'
import { SparkIcon } from '@/components/ui/icons'
import { TextInput } from './fields'

interface AiGeneratorProps {
  kind: GenerateKind
  areaLabel?: string
  name?: string
  plan?: Plan
  city?: string
  areas?: string[]
  /** texto atual — usado quando kind === 'improve' */
  currentText?: string
  onApply: (text: string) => void
  onClose: () => void
}

const TITLES: Record<GenerateKind, string> = {
  bio: 'Gerar bio',
  area: 'Descrição da área',
  headline: 'Frase de apresentação',
  improve: 'Melhorar meu texto',
  article: 'Rascunho de artigo',
}
const HINTS: Record<GenerateKind, string> = {
  bio: 'Escreva palavras-chave sobre sua atuação. A IA redige um texto sóbrio e dentro das normas da OAB — você revisa antes de aplicar.',
  area: 'Palavras-chave sobre o que você faz nessa área. A IA descreve de forma clara e factual.',
  headline: 'Uma frase curta sob o seu nome. Pode dar palavras-chave ou deixar a IA usar suas áreas.',
  improve: 'A IA reescreve seu texto atual mais claro e sóbrio, mantendo o sentido e dentro da OAB.',
  article: 'Um tema e a IA sugere um rascunho de artigo educativo (título + parágrafos) para o seu perfil.',
}
const PLACEHOLDERS: Record<GenerateKind, string> = {
  bio: 'ex: divórcio, guarda, acordo, mediação',
  area: 'ex: inventário, testamento, partilha',
  headline: 'ex: família, sucessões (opcional)',
  improve: '',
  article: 'ex: pensão alimentícia, guarda compartilhada',
}

export function AiGenerator({
  kind,
  areaLabel,
  name,
  plan,
  city,
  areas,
  currentText,
  onApply,
  onClose,
}: AiGeneratorProps) {
  const [keywords, setKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [typed, setTyped] = useState('') // efeito "IA digitando" (revela o texto aos poucos)
  const [typing, setTyping] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialog(dialogRef, onClose)

  // Máquina de escrever: revela o texto do rascunho em ~1s, depois vira editável.
  useEffect(() => {
    if (!typing) return
    if (typed.length >= draft.length) {
      setTyping(false)
      return
    }
    const step = Math.max(1, Math.ceil(draft.length / 70))
    const id = setTimeout(() => setTyped(draft.slice(0, typed.length + step)), 18)
    return () => clearTimeout(id)
  }, [typing, typed, draft])

  const startReveal = (text: string) => {
    setDraft(text)
    setTyped('')
    setTyping(true)
  }

  const issues = draft ? checkCompliance(draft) : []
  const blocked = issues.some((i) => i.severity === 'block')
  const templates = kind === 'bio' || kind === 'area' ? templatesFor(kind, areaLabel) : []
  const needsKeywords = kind === 'bio' || kind === 'area'
  const isImprove = kind === 'improve'
  const enriched = plan === 'premium' && (kind === 'bio' || kind === 'area')

  async function run() {
    const list = keywords
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter(Boolean)
    if (needsKeywords && !list.length) return
    setLoading(true)
    setTyping(false)
    setTyped('')
    setDraft('')
    try {
      const res = await api.generate({ kind, keywords: list, areaLabel, name, plan, city, areas, currentText })
      startReveal(res.text)
    } finally {
      setLoading(false)
    }
  }

  const title = kind === 'area' && areaLabel ? `Descrição — ${areaLabel}` : TITLES[kind]

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
        aria-labelledby="aigen-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-xl2 border border-ink/10 bg-paper p-6 shadow-lift"
      >
        <div className="flex items-center gap-2 text-burgundy">
          <SparkIcon width={20} height={20} />
          <h3 id="aigen-title" className="font-display text-xl font-semibold">
            {title}
          </h3>
          {enriched && (
            <span className="ml-auto rounded-full bg-brass/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brass-deep">
              IA Max
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-faint">{HINTS[kind]}</p>

        {isImprove ? (
          <div className="mt-4">
            <div className="rounded-lg border border-ink/12 bg-paper-soft px-3.5 py-3 text-[13.5px] leading-relaxed text-ink-soft">
              {currentText?.trim() ? currentText : 'Escreva algo primeiro para a IA melhorar.'}
            </div>
            <button
              type="button"
              onClick={run}
              disabled={loading || !currentText?.trim()}
              className="btn-primary mt-3 w-full disabled:opacity-50"
            >
              {loading ? '…' : 'Melhorar com IA'}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <TextInput
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              placeholder={PLACEHOLDERS[kind]}
              aria-label="Palavras-chave"
              autoFocus
            />
            <button type="button" onClick={run} disabled={loading} className="btn-primary shrink-0 !px-4">
              {loading ? '…' : 'Gerar'}
            </button>
          </div>
        )}

        {/* Modelos pré-aprovados (Prov. 205/2021) — só bio/área. */}
        {templates.length > 0 && (
          <div className="mt-3">
            <p className="text-[11.5px] font-medium text-ink-faint">Ou comece de um modelo pronto:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => startReveal(t.text)}
                  className="rounded-full border border-brass/40 bg-brass/[0.08] px-2.5 py-1 text-[12px] font-medium text-brass-deep transition-colors hover:bg-brass/20"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 space-y-2.5"
            >
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-brass-deep">
                A IA está redigindo
                <span className="inline-flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brass-deep [animation-delay:-0.25s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brass-deep [animation-delay:-0.12s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brass-deep" />
                </span>
              </p>
              {[100, 92, 78].map((w) => (
                <div key={w} className="h-3.5 animate-pulse rounded bg-ink/10" style={{ width: `${w}%` }} />
              ))}
            </motion.div>
          )}

          {!loading && typing && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
              <div className="min-h-[7.5rem] w-full whitespace-pre-wrap rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-3 text-[14px] leading-relaxed text-ink">
                {typed}
                <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse bg-burgundy" />
              </div>
            </motion.div>
          )}

          {!loading && !typing && draft && (
            <motion.div key="draft" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={kind === 'article' ? 8 : 5}
                aria-label="Texto gerado — edite se quiser antes de aplicar"
                className="w-full resize-none rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-3 text-[14px] leading-relaxed focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
              />

              {issues.length > 0 && (
                <div
                  className={`mt-2 rounded-lg border p-3 text-[12.5px] ${
                    blocked
                      ? 'border-burgundy/30 bg-burgundy/5 text-burgundy-deep'
                      : 'border-brass/40 bg-brass/10 text-brass-deep'
                  }`}
                >
                  <p className="mb-1 font-semibold">{blocked ? 'Ajuste necessário (OAB)' : 'Atenção (OAB)'}</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {issues.map((i, idx) => (
                      <li key={idx}>
                        <span className="font-medium">“{i.term}”</span> — {i.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    onApply(draft.trim())
                    onClose()
                  }}
                  className="btn-primary flex-1"
                  title={blocked ? 'Corrija os pontos de bloqueio antes de aplicar' : undefined}
                >
                  Aplicar texto
                </button>
                <button type="button" onClick={run} className="btn-ghost">
                  Gerar de novo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 block w-full text-center text-sm text-ink-faint hover:text-ink"
        >
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  )
}

/** Botãozinho "gerar com IA" reutilizável ao lado de campos de texto */
export function AiButton({ onClick, label = 'IA' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass/10 px-2.5 py-1 text-[12px] font-semibold text-brass-deep transition-colors hover:bg-brass/20"
    >
      <SparkIcon width={13} height={13} />
      {label}
    </button>
  )
}
