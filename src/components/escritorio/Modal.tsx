import { useEffect, type ReactNode } from 'react'
import { XIcon } from '@/components/ui/icons'

// Casca de modal sóbria: fundo escurecido semitransparente, card off-white centralizado,
// cantos levemente arredondados e botão de fechar discreto no canto superior direito.
// Fecha no Esc e no clique fora. Reutilizada por triagem, contato e mini-perfil.
export function Modal({
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[440px] rounded-t-2xl border border-ink/10 bg-paper-soft p-6 shadow-lift sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
        >
          <XIcon width={18} height={18} />
        </button>
        {title && (
          <h2 id={labelledBy} className="pr-8 font-display text-lg font-semibold text-ink">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}
