import { useEffect, useRef, useState } from 'react'
import type { Profile } from '@/lib/types'
import { themeStyle } from '@/lib/themes'
import { ProfileView } from '@/components/profile/ProfileView'

// Indicador de scroll próprio (overlay), interativo — as scrollbars nativas variam por
// SO/navegador (overlay some, temas diferentes). Este thumb é desenhado e controlado por
// nós: aparece só quando há conteúdo para rolar, acompanha a rolagem e pode ser arrastado
// (ou clicar no trilho para pular).
export function PhonePreview({ profile, hero = false }: { profile: Profile; hero?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null)
  const [thumb, setThumb] = useState({ height: 0, top: 0, show: false })
  const [dragging, setDragging] = useState(false)

  // geometria atual do trilho/thumb, derivada do elemento de scroll
  const geom = () => {
    const el = scrollRef.current
    if (!el) return null
    const { scrollTop, scrollHeight, clientHeight } = el
    const trackH = clientHeight - 12 // margem de 6px em cima/baixo
    const thumbH = Math.max(32, (clientHeight / scrollHeight) * trackH)
    const maxTravel = trackH - thumbH
    const maxScroll = scrollHeight - clientHeight
    return { scrollTop, scrollHeight, clientHeight, trackH, thumbH, maxTravel, maxScroll }
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const g = geom()
      if (!g || g.maxScroll <= 1) {
        setThumb((t) => (t.show ? { ...t, show: false } : t))
        return
      }
      const top = (g.scrollTop / g.maxScroll) * g.maxTravel
      setThumb({ height: g.thumbH, top, show: true })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [profile, hero])

  const onThumbPointerDown = (e: React.PointerEvent) => {
    const el = scrollRef.current
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, startScroll: el.scrollTop }
    setDragging(true)
  }

  const onThumbPointerMove = (e: React.PointerEvent) => {
    const el = scrollRef.current
    const g = geom()
    if (!el || !g || !dragRef.current || g.maxTravel <= 0) return
    const dy = e.clientY - dragRef.current.startY
    el.scrollTop = dragRef.current.startScroll + (dy / g.maxTravel) * g.maxScroll
  }

  const onThumbPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null
    setDragging(false)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  // clique no trilho (fora do thumb) → pula para a posição, centralizando o thumb
  const onTrackPointerDown = (e: React.PointerEvent) => {
    const el = scrollRef.current
    const g = geom()
    if (!el || !g) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top - g.thumbH / 2
    el.scrollTop = Math.max(0, Math.min(g.maxScroll, (y / g.maxTravel) * g.maxScroll))
  }

  return (
    // hero (home): maior, e rolável como o perfil de verdade — é o exemplo vivo do
    // produto. Padrão (editor/onboarding): menor no mobile, também rolável.
    //
    // O hero estava travado em 300px enquanto a coluna oferecia 320 (a home tem
    // `px-5`): sobrava folga dos dois lados e o telefone ficava menor do que
    // podia. Pior, o aperto passava para DENTRO — os ladrilhos de rede social
    // ficavam com 115px, e "Instagram" não cabia ao lado do ícone; a palavra saía
    // cortada. Num perfil de verdade isso não acontece, porque lá a mesma coluna
    // tem a largura da tela inteira.
    //
    // `w-full` com um teto alto deixa o telefone ocupar o que houver: 320px num
    // aparelho de 360, 340 num de 400 para cima. O teto existe para ele não virar
    // um retângulo largo demais para parecer um celular.
    <div className={`mx-auto w-full ${hero ? 'max-w-[340px] sm:max-w-[380px]' : 'max-w-[300px] sm:max-w-[340px]'}`}>
      <div className="relative rounded-[2.5rem] border-[10px] border-ink bg-ink p-0 shadow-lift">
        {/* notch */}
        {/* notch acima da faixa de status (que também é z-10, porém depois no DOM) */}
        <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
        {/* `data-moldura-telefone` é o que o balão de conversa procura para saber
            que está dentro de uma maquete e não numa página de verdade: ali ele
            se prende a ESTA caixa, e não à janela do navegador. Ver
            BalaoDeConversa.tsx. */}
        <div data-moldura-telefone className="relative overflow-hidden rounded-[1.8rem]">
          <div
            ref={scrollRef}
            // as variáveis do tema aqui deixam a faixa de status abaixo usar a cor do perfil
            style={themeStyle(profile.theme)}
            className={`no-scrollbar relative flex flex-col overflow-x-hidden ${
              hero
                ? 'h-[560px] max-h-[74svh] overflow-y-auto'
                : 'h-[540px] max-h-[62svh] overflow-y-auto sm:h-[620px] sm:max-h-[72svh]'
            }`}
          >
            {/* Faixa de status: acompanha a rolagem e evita que o conteúdo passe
                por baixo do notch (como num aparelho de verdade). */}
            <div
              className="sticky top-0 z-10 h-7 shrink-0"
              style={{ background: 'var(--c-bg)' }}
              aria-hidden
            />
            {/* No hero a conversa do assistente ABRE de verdade (é a demonstração);
                no editor a prévia continua inerte. */}
            <ProfileView profile={profile} preview chatEnabled={hero} />
          </div>
          {/* trilho + thumb interativos (área de toque generosa, thumb fino) */}
          {thumb.show && (
            <div
              onPointerDown={onTrackPointerDown}
              className="absolute bottom-1.5 right-0.5 top-1.5 w-3.5 cursor-pointer touch-none"
            >
              <div
                role="scrollbar"
                aria-orientation="vertical"
                onPointerDown={onThumbPointerDown}
                onPointerMove={onThumbPointerMove}
                onPointerUp={onThumbPointerUp}
                onPointerCancel={onThumbPointerUp}
                className={`absolute right-0 w-1.5 rounded-full transition-colors ${
                  dragging ? 'w-2 cursor-grabbing bg-ink/50' : 'cursor-grab bg-ink/25 hover:bg-ink/40'
                }`}
                style={{ height: `${thumb.height}px`, top: `${thumb.top}px` }}
              />
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-faint">
        advoc.me/<span className="font-semibold text-ink">{profile.slug}</span>
      </p>
      {hero && (
        <p className="mt-1 text-center text-[11.5px] leading-snug text-ink-faint/85">
          Perfil de exemplo — role o telefone e toque em “Agendar uma conversa”.
        </p>
      )}
    </div>
  )
}
