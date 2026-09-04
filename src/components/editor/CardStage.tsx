import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { Profile } from '@/lib/types'
import { BLEED_H, BLEED_W, CARD_MM, renderCard, type CardConfig, type CardSide } from '@/lib/cardArt'
import {
  GRAUS_POR_PX,
  TOQUE_MAX_PX,
  brilhoDoGiro,
  encaixarGiro,
  giroParaLado,
  ladoDoGiro,
  limitarInclinacao,
} from '@/lib/cardGiro'

// O palco do cartão: o cartão de papel na mão, na tela.
//
// A pessoa arrasta para girar (o verso está literalmente atrás da frente), toca
// para virar, inclina com o mouse para ver o papel de outro ângulo. É a mesma
// coisa que ela faria com o cartão impresso antes de aprovar a tiragem — e é para
// isso que existe: decidir se está bom ANTES de pagar a gráfica.
//
// Duas faces reais, uma de costas para a outra, dentro de um objeto 3D. Só
// `transform` e `opacity` mudam — nada de altura, largura ou fundo animado
// (ver lib/animacao.spec.ts). A conta do giro está em lib/cardGiro.ts.
//
// Durante o arrasto o transform vai direto no elemento, sem passar pelo React:
// o gesto precisa acompanhar o dedo quadro a quadro, e cada render aqui refaz
// dois SVGs. O React só fica sabendo do valor em que o cartão PAROU.

const TRANSICAO_ENCAIXE = 'transform 0.65s cubic-bezier(0.2, 0.7, 0.2, 1)'
const TRANSICAO_MOUSE = 'transform 0.25s ease-out'
/** Quanto o mouse inclina o cartão só de passar por cima, em graus. */
const INCLINACAO_MOUSE = 9

type Gesto = {
  id: number
  x0: number
  y0: number
  yaw0: number
  pitch0: number
  ultX: number
  ultT: number
  /** graus por milissegundo, do último trecho do movimento */
  vel: number
  moveu: boolean
}

export function CardStage({
  profile,
  card,
  onSide,
}: {
  profile: Profile
  card: CardConfig
  /** avisa qual face ficou de frente — é ela que o PNG e o SVG exportam */
  onSide?: (side: CardSide) => void
}) {
  // Giro em que o cartão está PARADO. Nunca normalizado: guarda as voltas.
  const [yaw, setYaw] = useState(0)
  const [guias, setGuias] = useState(false)
  const [tamanhoReal, setTamanhoReal] = useState(false)
  const side = ladoDoGiro(yaw)

  useEffect(() => {
    onSide?.(side)
  }, [side, onSide])

  // Com guias, a prévia mostra os 96 × 56 mm inteiros (sangria incluída) para a
  // linha de corte ter o que riscar. Sem guias, mostra o que sai da guilhotina.
  const sangria = guias
  const frente = useMemo(() => renderCard(profile, card, 'frente', { sangria }), [profile, card, sangria])
  const verso = useMemo(() => renderCard(profile, card, 'verso', { sangria }), [profile, card, sangria])
  const larguraMm = sangria ? BLEED_W : CARD_MM.trimW
  const alturaMm = sangria ? BLEED_H : CARD_MM.trimH

  const objeto = useRef<HTMLDivElement>(null)
  const encaixando = useRef(false)
  const gesto = useRef<Gesto | null>(null)
  /** última posição aplicada no elemento (inclui inclinação do mouse) */
  const atual = useRef({ yaw: 0, pitch: 0 })
  /** sentido em que a pessoa girou por último — os botões seguem esse sentido */
  const sentido = useRef<1 | -1>(1)
  const yawRef = useRef(yaw)
  yawRef.current = yaw

  const ambiente = useRef({ mouse: false, menosMovimento: false })
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    ambiente.current = {
      mouse: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
      menosMovimento: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }
  }, [])

  function aplicar(y: number, pitch: number, transicao: string) {
    const mudou = atual.current.yaw !== y || atual.current.pitch !== pitch
    atual.current = { yaw: y, pitch }
    const el = objeto.current
    if (!el) return
    el.style.transition = transicao
    el.style.transform = `rotateX(${pitch}deg) rotateY(${y}deg)`
    // Enquanto o encaixe anima, o mouse não inclina — senão a virada é cortada
    // no meio por uma transição mais curta. `transitionend` libera de novo.
    if (transicao === TRANSICAO_ENCAIXE && mudou) encaixando.current = true
    const s = brilhoDoGiro(y)
    el.querySelectorAll<HTMLElement>('[data-brilho]').forEach((b) => {
      b.style.transition =
        transicao === 'none' ? 'none' : `${transicao}, ${transicao.replace('transform', 'opacity')}`
      b.style.transform = `translateX(${s * 25}%)`
      b.style.opacity = String(Math.abs(s))
    })
  }

  // Todo giro que o React conhece passa por aqui — botões, teclado, fim de arrasto.
  useLayoutEffect(() => {
    aplicar(yaw, 0, TRANSICAO_ENCAIXE)
  }, [yaw])

  const girar = (s: 1 | -1) => {
    sentido.current = s
    setYaw((y) => encaixarGiro(y) + 180 * s)
  }
  const mostrar = (lado: CardSide) => setYaw((y) => giroParaLado(y, lado, sentido.current))

  // ---- Ponteiro ------------------------------------------------------------

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    gesto.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      yaw0: atual.current.yaw,
      pitch0: atual.current.pitch,
      ultX: e.clientX,
      ultT: e.timeStamp,
      vel: 0,
      moveu: false,
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesto.current
    if (g && g.id === e.pointerId) {
      const dx = e.clientX - g.x0
      const dy = e.clientY - g.y0
      if (!g.moveu && Math.hypot(dx, dy) > TOQUE_MAX_PX) g.moveu = true
      const dt = Math.max(1, e.timeStamp - g.ultT)
      g.vel = ((e.clientX - g.ultX) * GRAUS_POR_PX) / dt
      g.ultX = e.clientX
      g.ultT = e.timeStamp
      if (g.moveu) {
        const y = g.yaw0 + dx * GRAUS_POR_PX
        // Inclinar puxando para baixo/cima só faz sentido com mouse ou caneta:
        // no dedo, o eixo vertical é da rolagem da página (touch-action: pan-y).
        const pitch = e.pointerType === 'touch' ? g.pitch0 : limitarInclinacao(g.pitch0 - dy * 0.25)
        aplicar(y, pitch, 'none')
      }
      return
    }
    // Sem arrasto, o mouse só inclina o papel de leve — dá a noção de objeto.
    if (encaixando.current) return
    if (!ambiente.current.mouse || ambiente.current.menosMovimento || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    aplicar(yawRef.current + nx * INCLINACAO_MOUSE * 2, -ny * INCLINACAO_MOUSE * 2, TRANSICAO_MOUSE)
  }

  const soltar = (e: ReactPointerEvent<HTMLDivElement>, cancelado: boolean) => {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    gesto.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)

    if (!g.moveu) {
      // Toque seco: vira o cartão. Só quando o gesto terminou de fato — se o
      // navegador tomou o ponteiro para rolar a página, não foi um toque.
      if (!cancelado) girar(1)
      return
    }
    if (atual.current.yaw !== g.yaw0) sentido.current = atual.current.yaw > g.yaw0 ? 1 : -1
    const destino = encaixarGiro(atual.current.yaw, cancelado ? 0 : g.vel)
    // Mesmo destino de antes (arrastou e voltou): o efeito não dispara, então
    // encaixa aqui. Destino novo: o estado muda e o efeito encaixa.
    if (destino === yawRef.current) aplicar(destino, 0, TRANSICAO_ENCAIXE)
    else setYaw(destino)
  }

  const onPointerLeave = () => {
    if (gesto.current) return
    if (atual.current.pitch !== 0 || atual.current.yaw !== yawRef.current) {
      aplicar(yawRef.current, 0, TRANSICAO_ENCAIXE)
    }
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      girar(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      girar(-1)
    }
  }

  const pill = (ativo: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
      ativo ? 'bg-ink text-paper' : 'bg-ink/[0.06] text-ink-soft hover:bg-ink/10'
    }`

  return (
    <div className="rounded-lg border border-ink/10 bg-paper-soft/60 px-3 py-5 sm:px-4">
      {/* Um pouco de folga em cima e embaixo: o cartão inclinado sai da própria
          caixa, e o pai NÃO pode cortar (overflow hidden achata o 3D no WebKit). */}
      <div className="mx-auto w-full max-w-[440px]" style={{ perspective: '1100px' }}>
        <div
          ref={objeto}
          role="button"
          tabIndex={0}
          aria-label={`Cartão de visita, mostrando ${side === 'frente' ? 'a frente' : 'o verso'}. Arraste ou use as setas para girar; Enter vira.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => soltar(e, false)}
          onPointerCancel={(e) => soltar(e, true)}
          onPointerLeave={onPointerLeave}
          onKeyDown={onKeyDown}
          onTransitionEnd={() => {
            encaixando.current = false
          }}
          className="relative mx-auto cursor-grab touch-pan-y select-none rounded-[4px] outline-none will-change-transform [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-burgundy/40 focus-visible:ring-offset-4 focus-visible:ring-offset-paper-soft active:cursor-grabbing"
          style={{
            aspectRatio: `${larguraMm} / ${alturaMm}`,
            // "Tamanho real" usa o milímetro do CSS: sai perto do papel na maioria
            // das telas. Numa tela estreita, cede ao espaço que há.
            width: tamanhoReal ? `${larguraMm}mm` : '100%',
            maxWidth: '100%',
          }}
        >
          <Face svg={frente} guias={guias} />
          <Face svg={verso} guias={guias} atras />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        <div className="flex gap-1.5" role="group" aria-label="Lado do cartão">
          {(['frente', 'verso'] as CardSide[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => mostrar(s)}
              aria-pressed={side === s}
              className={`${pill(side === s)} capitalize`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="hidden h-4 w-px bg-ink/15 sm:block" aria-hidden />
        <button type="button" onClick={() => setGuias((v) => !v)} aria-pressed={guias} className={pill(guias)}>
          Guias de corte
        </button>
        <button
          type="button"
          onClick={() => setTamanhoReal((v) => !v)}
          aria-pressed={tamanhoReal}
          className={pill(tamanhoReal)}
        >
          Tamanho real
        </button>
      </div>

      <p className="mt-2.5 text-center text-[11px] leading-relaxed text-ink-faint">
        {guias ? (
          <>
            <Legenda cor="border-burgundy" /> linha de corte · <Legenda cor="border-ink/45" /> área segura
            (texto nunca passa dela) · sangria de {CARD_MM.bleed} mm por fora
          </>
        ) : tamanhoReal ? (
          <>
            {CARD_MM.trimW} × {CARD_MM.trimH} mm, perto do tamanho no papel — varia um pouco com a tela
          </>
        ) : (
          <>
            Arraste para girar, toque para virar · {CARD_MM.trimW} × {CARD_MM.trimH} mm
          </>
        )}
      </p>
    </div>
  )
}

/**
 * Uma face do cartão. `atras` põe a face de costas: virada 180° no mesmo eixo do
 * giro, ela só aparece quando o objeto inteiro dá meia volta.
 */
function Face({
  svg,
  guias,
  atras = false,
}: {
  svg: string
  guias: boolean
  atras?: boolean
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[4px] bg-paper shadow-card [backface-visibility:hidden]"
      style={{ WebkitBackfaceVisibility: 'hidden', transform: atras ? 'rotateY(180deg)' : undefined }}
    >
      {/* O SVG vem do nosso gerador e TODO texto de usuário passa por esc() em
          lib/cardArt.ts — é lá que essa garantia mora (e é testada). */}
      <div className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      {guias && <Guias />}
      <Brilho />
    </div>
  )
}

/**
 * O reflexo que corre pelo papel enquanto ele gira. Fica invisível nas duas
 * faces em repouso; quem o move é aplicar(), pelo atributo data-brilho.
 */
function Brilho() {
  return (
    <div
      data-brilho
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-[200%] opacity-0"
      style={{
        background: 'linear-gradient(100deg, transparent 38%, rgba(255,255,255,0.28) 50%, transparent 62%)',
      }}
    />
  )
}

/** Linha de corte e área segura, em porcentagem da arte com sangria. */
function Guias() {
  const pct = (mm: number, total: number) => `${(mm / total) * 100}%`
  const corte = { top: pct(CARD_MM.bleed, BLEED_H), bottom: pct(CARD_MM.bleed, BLEED_H), left: pct(CARD_MM.bleed, BLEED_W), right: pct(CARD_MM.bleed, BLEED_W) }
  const seguro = {
    top: pct(CARD_MM.bleed + CARD_MM.safe, BLEED_H),
    bottom: pct(CARD_MM.bleed + CARD_MM.safe, BLEED_H),
    left: pct(CARD_MM.bleed + CARD_MM.safe, BLEED_W),
    right: pct(CARD_MM.bleed + CARD_MM.safe, BLEED_W),
  }
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute border border-dashed border-burgundy" style={corte} />
      <div className="absolute border border-dashed border-ink/45" style={seguro} />
    </div>
  )
}

function Legenda({ cor }: { cor: string }) {
  return <span className={`mr-0.5 inline-block h-2.5 w-4 border border-dashed align-[-1px] ${cor}`} aria-hidden />
}
