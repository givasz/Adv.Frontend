import { useEffect, useRef, type ReactNode } from 'react'
import { XIcon } from '@/components/ui/icons'

// Bloco que se abre DENTRO da página do escritório, no lugar de uma janela por
// cima dela. Mesma sobriedade de antes (card off-white, título, fechar discreto),
// mas sem overlay: a página continua sendo a página, o dedo continua rolando o
// que estava rolando, e fechar é um botão — não um clique fora que ninguém acha.
export function PainelEmLinha({
  title,
  onClose,
  children,
  labelledBy,
}: {
  title?: string
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Abriu: traz para a vista. Em página longa (a do escritório é), o bloco pode
  // nascer fora da tela.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  return (
    <div
      ref={ref}
      className="relative mt-4 rounded-xl2 border border-ink/12 bg-paper-soft p-5 shadow-card sm:p-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-3 top-3 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink"
      >
        <XIcon width={17} height={17} />
      </button>
      {title && (
        <h3 id={labelledBy} className="pr-8 font-display text-lg font-semibold text-ink">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
