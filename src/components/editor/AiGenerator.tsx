import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GenerateKind, Plan } from '@/lib/types'
import { api } from '@/lib/api'
import { checkCompliance } from '@/lib/oab'
import { fitToLimit } from '@/lib/textLimit'
import { templatesFor } from '@/lib/templates'
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
  /**
   * Teto de caracteres do campo de destino. Vai no pedido (o modelo escreve dentro
   * do orçamento), limita a edição manual aqui e é a garantia final no aplicar —
   * texto acima do limite faz o servidor recusar o perfil inteiro no save.
   */
  limit?: number
  onApply: (text: string) => void
  onClose: () => void
}

/** Quando a espera passa a merecer um aviso e um botão de parar. */
const AVISO_DEMORA_MS = 8_000

const TITLES: Record<GenerateKind, string> = {
  bio: 'Gerar bio',
  area: 'Descrição da área',
  headline: 'Frase de apresentação',
  improve: 'Melhorar meu texto',
  faq: 'Resposta do FAQ',
}
const HINTS: Record<GenerateKind, string> = {
  bio: 'Escreva palavras-chave sobre sua atuação. A IA redige um texto sóbrio e dentro das normas da OAB — você revisa antes de aplicar.',
  area: 'Palavras-chave sobre o que você faz nessa área. A IA descreve de forma clara e factual.',
  headline: 'Uma frase curta sob o seu nome. Pode dar palavras-chave ou deixar a IA usar suas áreas.',
  improve: 'A IA reescreve seu texto atual mais claro e sóbrio, mantendo o sentido e dentro da OAB.',
  faq: 'A IA redige (ou reforça) a resposta da sua pergunta: curta, educativa e dentro das normas da OAB. Você revisa antes de aplicar — a resposta é sua.',
}
const PLACEHOLDERS: Record<GenerateKind, string> = {
  bio: 'ex: divórcio, guarda, acordo, mediação',
  area: 'ex: inventário, testamento, partilha',
  headline: 'ex: família, sucessões (opcional)',
  improve: '',
  faq: 'ex: prazo, documentos, custas (opcional)',
}

export function AiGenerator({
  kind,
  areaLabel,
  name,
  plan,
  city,
  areas,
  currentText,
  limit,
  onApply,
  onClose,
}: AiGeneratorProps) {
  const [keywords, setKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [typed, setTyped] = useState('') // efeito "IA digitando" (revela o texto aos poucos)
  const [typing, setTyping] = useState(false)
  // O que a pessoa precisa saber quando NÃO deu certo (04/09/2026). Antes, toda
  // falha virava um texto genérico digitado letra por letra como se fosse a IA —
  // e ninguém tinha por que tentar de novo.
  //   erro       — o servidor disse não (limite de gerações, plano): a frase dele.
  //   fallback   — a IA não respondeu e o texto abaixo é um modelo-base.
  //   demorando  — passou do tempo normal; dá para parar.
  const [erro, setErro] = useState('')
  const [fallback, setFallback] = useState(false)
  const [demorando, setDemorando] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // Painel EM LINHA, não modal. O gerador é a ferramenta mais usada de quem está
  // montando o perfil; abrir uma janela por cima escondia justamente o campo que
  // ia receber o texto, prendia o foco e, no celular, brigava com o teclado.
  // Aqui ele entra no fluxo da página, logo acima do campo, e sai sem fechar nada.
  const painelRef = useRef<HTMLDivElement>(null)

  // Ao abrir, traz o painel para a vista e põe o foco no primeiro campo — o que o
  // modal ganhava de graça por ser sobreposto, aqui é explícito.
  useEffect(() => {
    const el = painelRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.querySelector<HTMLElement>('input,textarea,button')?.focus({ preventScroll: true })
  }, [])

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
    abortRef.current?.abort()
    const abortar = new AbortController()
    abortRef.current = abortar
    setLoading(true)
    setDemorando(false)
    setErro('')
    setFallback(false)
    setTyping(false)
    setTyped('')
    setDraft('')
    // O backend responde em 1–4 s no caso normal. Aos 8 s a espera deixou de ser
    // normal, e a pessoa merece saber que está sendo tentado outro caminho — e
    // que pode parar. O teto de verdade (22 s + proxy) continua no backend.
    const relogio = setTimeout(() => setDemorando(true), AVISO_DEMORA_MS)
    try {
      const res = await api.generate(
        {
          kind,
          keywords: list,
          areaLabel,
          name,
          plan,
          city,
          areas,
          currentText,
          maxChars: limit,
        },
        abortar.signal,
      )
      if (abortar.signal.aborted) return
      setFallback(!!res.usedFallback)
      startReveal(res.text)
    } catch (err) {
      if (abortar.signal.aborted || (err as Error)?.name === 'AbortError') return
      setErro((err as Error)?.message || 'A IA não respondeu. Tente de novo em instantes.')
    } finally {
      clearTimeout(relogio)
      if (abortRef.current === abortar) {
        abortRef.current = null
        setLoading(false)
        setDemorando(false)
      }
    }
  }

  /** "Parar": aborta a chamada em curso e devolve o painel ao estado de antes. */
  function parar() {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setDemorando(false)
  }

  // Fechar o painel no meio de uma geração não deixa a chamada pendurada.
  useEffect(() => () => abortRef.current?.abort(), [])

  const title = kind === 'area' && areaLabel ? `Descrição — ${areaLabel}` : TITLES[kind]

  return (
    <motion.div
      ref={painelRef}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="aigen-title"
      className="rounded-xl2 border border-brass/30 bg-paper p-4 shadow-card sm:p-5"
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

        {/* O servidor disse não (limite de gerações, plano). A frase é dele. */}
        {!loading && erro && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-burgundy/30 bg-burgundy/5 p-3 text-[12.5px] text-burgundy-deep"
          >
            <span>{erro}</span>
            <button type="button" onClick={run} className="btn-ghost !px-3 !py-1 text-[12.5px]">
              Tentar de novo
            </button>
          </div>
        )}

        {/* A IA não respondeu: o texto abaixo é um modelo-base, e a pessoa sabe. */}
        {!loading && fallback && draft && (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brass/40 bg-brass/10 p-3 text-[12.5px] text-brass-deep"
          >
            <span>
              A IA não conseguiu redigir agora. Este é um texto-base, dentro das normas — edite à
              vontade ou tente de novo em instantes.
            </span>
            <button type="button" onClick={run} className="btn-ghost !px-3 !py-1 text-[12.5px]">
              Tentar de novo
            </button>
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
              <p
                className="flex items-center gap-1.5 text-[13px] font-medium text-brass-deep"
                role="status"
                aria-live="polite"
              >
                {demorando ? 'Está demorando mais que o normal' : 'A IA está redigindo'}
                <span className="inline-flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brass-deep [animation-delay:-0.25s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brass-deep [animation-delay:-0.12s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brass-deep" />
                </span>
              </p>
              {[100, 92, 78].map((w) => (
                <div key={w} className="h-3.5 animate-pulse rounded bg-ink/10" style={{ width: `${w}%` }} />
              ))}
              {demorando && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12.5px] text-ink-faint">
                  <span>Estamos tentando outro caminho. Você pode esperar ou parar.</span>
                  <button type="button" onClick={parar} className="btn-ghost !px-3 !py-1 text-[12.5px]">
                    Parar
                  </button>
                </div>
              )}
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
                rows={kind === 'faq' ? 6 : 5}
                maxLength={limit}
                aria-label="Texto gerado — edite se quiser antes de aplicar"
                className="w-full resize-none rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-3 text-[14px] leading-relaxed focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
              />
              {/* Contador do campo de destino: o que for editado aqui já sai no
                  tamanho que o perfil aceita salvar. */}
              {!!limit && (
                <p className="mt-1 text-right text-[11px] tabular-nums text-ink-faint">
                  {draft.length}/{limit}
                </p>
              )}

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
                    onApply(fitToLimit(draft, limit ?? 0))
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
        className="mt-4 block w-full py-2 text-center text-sm text-ink-faint hover:text-ink"
      >
        Cancelar
      </button>
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
