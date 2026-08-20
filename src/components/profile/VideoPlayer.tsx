import { useState } from 'react'
import type { ParsedVideo } from '@/lib/video'
import { PlayIcon } from '@/components/ui/icons'

// Reprodutor do vídeo de apresentação.
//
// Duas decisões que valem a pena não desfazer:
//
// 1. O <iframe> só é montado DEPOIS do clique. É ele que carrega scripts, grava
//    cookies e pesa — não a capa. Assim, quem apenas abre o perfil não entra num
//    player de terceiro (LGPD) e a página continua leve em rede ruim.
//
//    A CAPA vem do provedor já no carregamento. A primeira versão desenhava um
//    retângulo com as cores do tema para não fazer requisição nenhuma, mas o
//    resultado parecia um bloco quebrado no meio do perfil — e um advogado com
//    uma seção vazia na página perde mais do que a requisição economizada. É uma
//    imagem estática de CDN, com `referrerpolicy=no-referrer` (não revela de que
//    perfil veio) e `loading=lazy`.
//
// 2. A proporção vem de `aspect-ratio: 16/9` sobre `w-full`, sem altura fixa. É o
//    que faz o mesmo componente caber no telefone da prévia (≈300px), no celular
//    de verdade e na coluna larga do desktop sem nenhum breakpoint.

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
  // Índice da capa em uso. maxresdefault não existe para todo vídeo, então uma
  // falha avança para a próxima; esgotadas, fica a capa desenhada.
  const [posterIndex, setPosterIndex] = useState(0)
  const poster = video.posters[posterIndex]
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
            className="group absolute inset-0 block"
            style={{ border: '1px solid var(--c-border)' }}
          >
            {poster && (
              <img
                src={poster}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setPosterIndex((i) => i + 1)}
                // object-cover recorta as tarjas pretas do hqdefault (4:3) e
                // devolve o quadro 16:9 sem deformar a imagem.
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            {/* Véu escuro: garante contraste do botão e do rótulo sobre qualquer
                capa — não dá para saber se o quadro do vídeo é claro ou escuro. */}
            <span
              aria-hidden
              className={`absolute inset-0 transition-colors ${
                poster ? 'bg-black/30 group-hover:bg-black/20' : ''
              }`}
            />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform group-hover:scale-105 sm:h-16 sm:w-16"
                style={{ background: 'var(--c-accent)' }}
                aria-hidden
              >
                <PlayIcon width={22} height={22} className="ml-0.5" style={{ color: 'var(--c-bg)' }} />
              </span>
              <span
                className={`px-4 text-center text-[11.5px] leading-snug ${
                  poster ? 'font-medium text-white/90' : 't-faint'
                }`}
              >
                Assistir · {video.label}
              </span>
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
