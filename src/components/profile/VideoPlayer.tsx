import { useState } from 'react'
import type { ParsedVideo } from '@/lib/video'
import { PlayIcon } from '@/components/ui/icons'

// Reprodutor do vídeo de apresentação.
//
// Duas decisões que valem a pena não desfazer:
//
// 1. O <iframe> só é montado DEPOIS do clique. Antes disso a página não fala com
//    YouTube/Vimeo — quem só abriu o perfil não é rastreado por isso (LGPD), e o
//    perfil continua leve mesmo em rede ruim. A capa é desenhada com as cores do
//    tema, sem baixar a miniatura do provedor (que já seria uma requisição a
//    terceiro e mudaria a cara do perfil a cada tema).
//
// 2. A proporção vem de `aspect-[16/9]` sobre `w-full`, sem altura fixa. É o que
//    faz o mesmo componente caber no telefone da prévia (≈300px), no celular de
//    verdade e na coluna larga do desktop sem nenhum breakpoint.

export function VideoPlayer({
  video,
  caption,
  name,
  /** true no editor: a capa aparece, mas não toca (não faz sentido no rascunho) */
  inert = false,
}: {
  video: ParsedVideo
  caption?: string
  name: string
  inert?: boolean
}) {
  const [playing, setPlaying] = useState(false)
  const firstName = name.split(' ')[0] || 'advogado(a)'

  return (
    <figure className="m-0">
      <div
        className="relative w-full overflow-hidden rounded-xl2"
        style={{ aspectRatio: '16 / 9', background: 'var(--c-accent-soft)' }}
      >
        {playing ? (
          <iframe
            src={`${video.embedUrl}&autoplay=1`}
            title={`Vídeo de apresentação de ${firstName}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={inert ? undefined : () => setPlaying(true)}
            aria-label={`Assistir ao vídeo de apresentação de ${firstName} (${video.label})`}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-2.5"
            style={{ border: '1px solid var(--c-border)' }}
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full transition-transform group-hover:scale-105 sm:h-16 sm:w-16"
              style={{ background: 'var(--c-accent)' }}
              aria-hidden
            >
              <PlayIcon width={22} height={22} className="ml-0.5" style={{ color: 'var(--c-bg)' }} />
            </span>
            <span className="t-faint px-4 text-center text-[11.5px] leading-snug">
              Assistir · {video.label}
            </span>
          </button>
        )}
      </div>
      {caption?.trim() && (
        <figcaption className="t-muted mt-2 text-center text-[13px] leading-relaxed">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
