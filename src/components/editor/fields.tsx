import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

export function Field({
  label,
  hint,
  info,
  children,
}: {
  label: string
  /** dica à direita do rótulo — texto simples ou um nó (ex.: contador de cota) */
  hint?: ReactNode
  /** slot opcional à direita do rótulo (ex.: botão de ajuda InfoTip) */
  info?: ReactNode
  children: ReactNode
}) {
  const labelId = useId()
  // Com `info`, o cabeçalho tem um botão (popover) — não pode ficar dentro de <label>,
  // senão clicar no botão foca o input. Nesse caso associamos o rótulo ao campo via
  // aria-labelledby (para o leitor de tela). Sem `info`, o <label> envolvente já associa.
  const Wrapper = info ? 'div' : 'label'
  const child =
    info && isValidElement(children)
      ? cloneElement(children as ReactElement<{ 'aria-labelledby'?: string }>, {
          'aria-labelledby': labelId,
        })
      : children
  return (
    <Wrapper className="block">
      <span className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
          <span id={labelId}>{label}</span>
          {info}
        </span>
        {hint && <span className="shrink-0 text-[11px] text-ink-faint">{hint}</span>}
      </span>
      {child}
    </Wrapper>
  )
}

const inputClass =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink ' +
  'placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none ' +
  'focus:ring-2 focus:ring-burgundy/15'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} resize-none leading-relaxed ${props.className ?? ''}`} />
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-left"
    >
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-burgundy' : 'bg-ink/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper-soft shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className="text-[14px] leading-tight text-ink">{label}</span>
    </button>
  )
}

export function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
