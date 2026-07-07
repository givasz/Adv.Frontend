import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Acessibilidade de diálogo modal: ao montar, foca o primeiro elemento focável e prende
// o Tab dentro do modal; fecha no Esc; ao desmontar, devolve o foco a quem o abriu.
// Use junto de role="dialog" aria-modal="true" aria-labelledby no container referenciado.
export function useDialog(ref: RefObject<HTMLElement>, onClose: () => void) {
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const el = ref.current
    const focusables = () =>
      el
        ? Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (n) => n.offsetParent !== null,
          )
        : []

    // foca o primeiro campo/ação do modal (se algum já não tiver autofoco)
    if (el && !el.contains(document.activeElement)) focusables()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && el) {
        const f = focusables()
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [ref, onClose])
}
