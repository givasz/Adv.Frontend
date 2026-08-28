import { useState } from 'react'
import { orientacaoDoVideo, type ParsedVideo, type VideoOrientation } from '@/lib/video'
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
// 2. A proporção vem de `aspect-ratio` sobre `w-full`, sem altura fixa. É o que
//    faz o mesmo componente caber no telefone da prévia (≈300px), no celular de
//    verdade e na coluna larga do desktop sem nenhum breakpoint.
//
//    Ela era FIXA em 16/9, e um vídeo gravado em pé aparecia minúsculo entre duas
//    tarjas pretas — que é como a maioria das pessoas grava vídeo hoje. Agora
//    segue a orientação (ver lib/video.ts): o sistema reconhece sozinho um Short
//    do YouTube, e para o que a URL não entrega quem responde é o advogado.

export function VideoPlayer({
  video,
  caption,
  name,
  /** true no editor: a capa aparece, mas não toca (não faz sentido no rascunho) */
  inert = false,
  /** 'auto' deduz do link (Short = em pé) — ver orientacaoDoVideo */
  orientation,
}: {
  video: ParsedVideo
  caption?: string
  name: string
  inert?: boolean
  orientation?: VideoOrientation
}) {
  const emPe = orientacaoDoVideo(video, orientation) === 'vertical'
  const [playing, setPlaying] = useState(false)
  // Índice da capa em uso. maxresdefault não existe para todo vídeo, então uma
  // falha avança para a próxima; esgotadas, fica a capa desenhada.
  const [posterIndex, setPosterIndex] = useState(0)
  const poster = video.posters[posterIndex]
  // A capa em uso é vertical? Só a primeira de um Short é (`oardefault`, a capa na
  // proporção original). Se ela faltar, o 404 avança para as 16:9 de sempre.
  const capaVertical = video.orientacaoDetectada === 'vertical' && posterIndex === 0
  const firstName = name.split(' ')[0] || 'advogado(a)'

  return (
    <figure className="m-0">
      <div
        className="relative w-full overflow-hidden rounded-xl2"
        style={{
          aspectRatio: emPe ? '9 / 16' : '16 / 9',
          background: 'var(--c-accent-soft)',
          // Vídeo em pé precisa de RÉDEA na largura. Sem isto, 9:16 ocupando a
          // coluna inteira (≈440px no perfil) daria quase 780px de altura: o
          // vídeo empurraria o rodapé para fora da tela e viraria a página
          // inteira. Estreitando para 300px ele fica com ~533px — alto, como
          // convém a um vídeo em pé, sem engolir o perfil.
          //
          // `margin: auto` porque, mais estreito que a coluna, ele precisa ficar
          // centralizado — encostado à esquerda pareceria desalinhamento.
          ...(emPe ? { maxWidth: '300px', marginInline: 'auto' } : null),
        }}
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
                // `cover` recorta as tarjas pretas do hqdefault (4:3) e devolve o
                // quadro 16:9 sem deformar a imagem.
                //
                // Num quadro EM PÉ com capa 16:9, porém, `cover` cortaria ~68% da
                // largura: sobra uma tira do centro, num zoom que não mostra nada.
                // Aí `contain` é o certo — a capa aparece inteira, com a cor do
                // tema em volta. Só a capa do Short (`oardefault`) já é vertical, e
                // essa preenche o quadro sem cortar nada.
                className={`absolute inset-0 h-full w-full ${
                  emPe && !capaVertical ? 'object-contain' : 'object-cover'
                }`}
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
