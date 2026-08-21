import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckIcon } from '@/components/ui/icons'

// Vocabulário visual da conversa guiada, compartilhado pelos dois assistentes
// (perfil individual e escritório). Saiu de AssistantChat.tsx quando o escritório
// ganhou o seu: o roteiro de cada um é diferente, mas balão, "digitando…", chip,
// campo e resumo são a mesma conversa — duplicá-los seria deixá-los divergir.
//
// Tudo aqui se pinta pelas variáveis --c-* do tema (ver lib/themes.ts). Quem usa
// fora do sistema de temas — a página do escritório — declara essas mesmas
// variáveis no contêiner.

export function Bubble({
  from,
  text,
  reduced,
}: {
  from: 'bot' | 'user'
  text: string
  reduced: boolean
}) {
  const bot = from === 'bot'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${bot ? 'justify-start' : 'justify-end'}`}
    >
      <p
        className={`max-w-[85%] px-3.5 py-2.5 text-[14px] leading-relaxed ${
          bot
            ? 'rounded-[16px] rounded-bl-[5px] border'
            : 'rounded-[16px] rounded-br-[5px] font-medium'
        }`}
        style={
          bot
            ? {
                background: 'var(--c-surface)',
                borderColor: 'var(--c-border)',
                color: 'var(--c-muted)',
              }
            : { background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }
        }
      >
        {text}
      </p>
    </motion.div>
  )
}

export function TypingDots() {
  return (
    <div className="flex justify-start">
      <span
        className="flex items-center gap-1 rounded-[16px] rounded-bl-[5px] border px-3.5 py-3"
        style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
        aria-label="digitando"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--c-faint)' }}
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
          />
        ))}
      </span>
    </div>
  )
}

// Cartão de resumo — o "comprovante" do que foi combinado, antes de enviar.
export function Summary({
  title,
  rows,
  reduced,
}: {
  title: string
  rows: [string, string][]
  reduced: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mt-1 overflow-hidden rounded-[16px] border"
      style={{ borderColor: 'var(--c-ring)', background: 'var(--c-surface)' }}
    >
      <p
        className="flex items-center gap-2 px-4 py-2.5 font-display text-[13px] font-semibold uppercase tracking-[0.14em]"
        style={{ background: 'var(--c-accent-soft)' }}
      >
        <CheckIcon width={14} height={14} className="t-accent" strokeWidth={2.4} />
        {title}
      </p>
      <dl className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 px-4 py-2.5">
            <dt className="t-faint w-[74px] shrink-0 text-[11.5px] uppercase tracking-wider">{k}</dt>
            <dd className="t-muted flex-1 text-[13.5px] leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  )
}

export function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="t-faint mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Chip({
  children,
  onClick,
  subtle = false,
}: {
  children: React.ReactNode
  onClick: () => void
  subtle?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-all duration-200 hover:-translate-y-px active:translate-y-0"
      style={{
        borderColor: subtle ? 'var(--c-border)' : 'var(--c-ring)',
        background: subtle ? 'transparent' : 'var(--c-accent-soft)',
        color: subtle ? 'var(--c-faint)' : 'var(--c-text)',
      }}
    >
      {children}
    </button>
  )
}

export function Composer({
  value,
  onChange,
  onSend,
  placeholder,
  label,
  canSend,
  skipLabel,
  onSkip,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder: string
  label: string
  canSend: boolean
  skipLabel?: string
  onSkip?: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSend()
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={140}
        className="min-w-0 flex-1 rounded-full border px-4 py-2.5 text-[14px] outline-none transition-colors"
        style={{
          borderColor: 'var(--c-border)',
          background: 'var(--c-bg)',
          color: 'var(--c-text)',
        }}
      />
      {skipLabel && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="t-faint shrink-0 px-1 text-[13px] font-medium underline-offset-4 hover:underline"
        >
          {skipLabel}
        </button>
      )}
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Enviar resposta"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-40"
        style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
      >
        <ArrowRight width={18} height={18} />
      </button>
    </form>
  )
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
