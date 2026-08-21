import { useNavigate } from 'react-router-dom'

// Botão "Compartilhar" que flutua no canto do perfil.
//
// Quando o navegador tem compartilhamento nativo (celular), é ele que abre — é o
// caminho que a pessoa conhece. Quando não tem (desktop), vai para a PÁGINA de
// compartilhamento (/:slug/compartilhar), que antes era um painel sobreposto.
export function ShareBar({
  slug,
  name,
  topOffset = 0,
}: {
  slug: string
  name: string
  /** altura das barras grudentas acima (aviso de exemplo, barra do dono) */
  topOffset?: number
}) {
  const navigate = useNavigate()
  const url = `${window.location.origin}/${slug}`

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} · advoc.me`, url })
        return
      } catch {
        /* usuário cancelou ou o navegador recusou — cai para a página */
      }
    }
    navigate(`/${slug}/compartilhar`)
  }

  return (
    <button
      type="button"
      onClick={share}
      // `top` calculado: o botão é fixo e as barras do topo (aviso de exemplo,
      // barra do dono) são grudentas — sem desviar, ele fica atrás delas.
      style={{ top: `calc(1rem + ${topOffset}px)` }}
      className="fixed right-4 z-20 inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/10 bg-paper-soft/80 px-4 text-sm font-medium text-ink shadow-card backdrop-blur transition-colors hover:border-brass/50"
      aria-label="Compartilhar perfil"
    >
      Compartilhar
    </button>
  )
}
