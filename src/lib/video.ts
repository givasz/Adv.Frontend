// Vídeo de apresentação do perfil (plano Max).
//
// Só ACEITAMOS link de YouTube e Vimeo — nada de upload nem de URL arbitrária:
//  • upload de mídia pesada não cabe no produto (custo, moderação, banda);
//  • um `src` livre num <iframe> é superfície de ataque (clickjacking, tracker).
// O reprodutor (o <iframe>, que é quem carrega scripts e grava cookies) só é
// montado depois do clique, e no domínio sem cookies do YouTube. A CAPA, essa
// sim, vem do provedor já no carregamento — sem ela a seção parecia um retângulo
// vazio, e um perfil de advogado com um bloco quebrado custa mais do que a
// requisição de imagem economizada. É uma imagem estática de CDN, sem cookie e
// sem referrer (ver VideoPlayer), não o player inteiro.
//
// Conformidade: o vídeo em si a plataforma não consegue ler. O que dá para fazer
// é orientar (ver OAB_GUIDANCE_BY_FIELD.video) e passar a legenda pelo mesmo
// checkCompliance dos outros textos. Prov. 205/2021 Art.4º §2º veda mencionar
// decisões ou resultados em imagens e vídeos de atuação profissional.

export type VideoProvider = 'youtube' | 'vimeo'

export interface ParsedVideo {
  provider: VideoProvider
  /** id do vídeo no provedor */
  id: string
  /** URL do player, pronta para o iframe (domínio sem cookies quando existe) */
  embedUrl: string
  /** rótulo curto do provedor, para a UI */
  label: string
  /**
   * Capas do vídeo, da melhor para a pior — a interface tenta em ordem e cai
   * para a próxima quando uma falha. Vazio quando o provedor não publica capa
   * por URL estática (Vimeo exige chamada de API), e aí desenhamos a nossa.
   */
  posters: string[]
}

// Aceita as formas que a pessoa realmente copia da barra de endereços/compartilhar.
const YOUTUBE_PATTERNS = [
  /(?:youtube\.com|youtube-nocookie\.com)\/watch\?(?:.*&)?v=([\w-]{6,20})/i,
  /youtu\.be\/([\w-]{6,20})/i,
  /(?:youtube\.com|youtube-nocookie\.com)\/(?:embed|shorts|live|v)\/([\w-]{6,20})/i,
]
const VIMEO_PATTERNS = [/vimeo\.com\/(?:video\/)?(\d{6,12})/i]

/** Reconhece o link e devolve o necessário para tocar — null se não for suportado. */
export function parseVideoUrl(raw: string | undefined): ParsedVideo | null {
  const url = (raw ?? '').trim()
  if (!url) return null

  for (const re of YOUTUBE_PATTERNS) {
    const id = re.exec(url)?.[1]
    if (id) {
      return {
        provider: 'youtube',
        id,
        // youtube-nocookie + rel=0: sem cookies de rastreio e sem sugerir vídeos
        // de terceiros no fim (que a plataforma não controla e a OAB não perdoa).
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
        label: 'YouTube',
        // maxresdefault é 16:9 de verdade, mas nem todo vídeo tem; hqdefault
        // existe sempre, em 4:3 com tarjas pretas — recortadas pelo object-cover
        // do <img>, o que dá exatamente o quadro 16:9 de volta.
        posters: [
          `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        ],
      }
    }
  }
  for (const re of VIMEO_PATTERNS) {
    const id = re.exec(url)?.[1]
    if (id) {
      return {
        provider: 'vimeo',
        id,
        embedUrl: `https://player.vimeo.com/video/${id}?dnt=1`,
        label: 'Vimeo',
        // O Vimeo não expõe capa por URL previsível (precisa de oEmbed). Em vez
        // de puxar de um serviço de terceiro só para isso, cai na capa desenhada.
        posters: [],
      }
    }
  }
  return null
}

/** O link é aceitável? (vazio conta como válido — o campo é opcional) */
export function isValidVideoUrl(raw: string | undefined): boolean {
  const url = (raw ?? '').trim()
  return !url || parseVideoUrl(url) !== null
}

/** Legenda máxima — uma frase, não um segundo texto de bio. */
export const VIDEO_CAPTION_MAX = 120
