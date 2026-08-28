import { describe, expect, it } from 'vitest'
import { isValidVideoUrl, orientacaoDoVideo, parseVideoUrl } from './video'

describe('video — links aceitos', () => {
  const youtube = [
    'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    'https://youtube.com/watch?v=aqz-KE-bpKQ&t=42s',
    'https://www.youtube.com/watch?list=PL123&v=aqz-KE-bpKQ',
    'https://youtu.be/aqz-KE-bpKQ',
    'https://youtu.be/aqz-KE-bpKQ?si=abc',
    'https://www.youtube.com/embed/aqz-KE-bpKQ',
    'https://www.youtube.com/shorts/aqz-KE-bpKQ',
    'https://m.youtube.com/watch?v=aqz-KE-bpKQ',
    '  https://www.youtube.com/watch?v=aqz-KE-bpKQ  ',
  ]

  it.each(youtube)('reconhece %s', (url) => {
    const v = parseVideoUrl(url)
    expect(v?.provider).toBe('youtube')
    expect(v?.id).toBe('aqz-KE-bpKQ')
  })

  it('reconhece Vimeo em suas duas formas', () => {
    expect(parseVideoUrl('https://vimeo.com/347119375')?.id).toBe('347119375')
    expect(parseVideoUrl('https://vimeo.com/video/347119375')?.provider).toBe('vimeo')
  })
})

describe('video — o que NÃO entra no iframe', () => {
  const rejeitados = [
    'https://example.com/meu-video.mp4',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://evil.com/watch?v=aqz-KE-bpKQ', // domínio errado, id parecido
    'https://tiktok.com/@alguem/video/123456',
    'youtube',
    'https://vimeo.com/perfil-do-usuario',
  ]

  it.each(rejeitados)('recusa %s', (url) => {
    expect(parseVideoUrl(url)).toBeNull()
    expect(isValidVideoUrl(url)).toBe(false)
  })

  it('campo vazio é válido — o vídeo é opcional', () => {
    expect(isValidVideoUrl('')).toBe(true)
    expect(isValidVideoUrl(undefined)).toBe(true)
    expect(isValidVideoUrl('   ')).toBe(true)
    expect(parseVideoUrl('')).toBeNull()
  })
})

describe('video — embed sem rastreio', () => {
  it('YouTube toca no domínio sem cookies e sem sugerir vídeos de terceiros', () => {
    const v = parseVideoUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ')!
    expect(v.embedUrl).toContain('youtube-nocookie.com/embed/')
    expect(v.embedUrl).toContain('rel=0')
    expect(v.embedUrl).not.toContain('youtube.com/watch')
  })

  it('Vimeo pede para não rastrear', () => {
    expect(parseVideoUrl('https://vimeo.com/347119375')!.embedUrl).toContain('dnt=1')
  })

  it('a URL do player nunca carrega o que o usuário digitou', () => {
    // O embed é montado a partir do ID extraído, não da string original: um
    // parâmetro pendurado no link não chega ao iframe.
    const v = parseVideoUrl('https://youtu.be/aqz-KE-bpKQ?si=x"><script>')!
    expect(v.embedUrl).toBe(
      'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0&modestbranding=1',
    )
  })
})

// ORIENTAÇÃO — o quadro era fixo em 16:9, e quem gravasse em pé (que é como quase
// todo mundo grava hoje) via o próprio vídeo minúsculo entre duas tarjas pretas.
describe('deitado ou em pé', () => {
  it('reconhece um Short do YouTube como vertical, sem perguntar a ninguém', () => {
    const v = parseVideoUrl('https://www.youtube.com/shorts/abc123XYZ')
    expect(v?.orientacaoDetectada).toBe('vertical')
    expect(orientacaoDoVideo(v!, 'auto')).toBe('vertical')
  })

  it('vídeo comum do YouTube não entrega a orientação — e assume deitado', () => {
    const v = parseVideoUrl('https://www.youtube.com/watch?v=abc123XYZ')
    expect(v?.orientacaoDetectada).toBeNull()
    expect(orientacaoDoVideo(v!, 'auto')).toBe('horizontal')
  })

  it('Vimeo nunca entrega — descobrir exigiria chamar o provedor', () => {
    const v = parseVideoUrl('https://vimeo.com/123456789')
    expect(v?.orientacaoDetectada).toBeNull()
    expect(orientacaoDoVideo(v!, 'auto')).toBe('horizontal')
  })

  it('a escolha do advogado vence a dedução', () => {
    const short = parseVideoUrl('https://www.youtube.com/shorts/abc123XYZ')!
    expect(orientacaoDoVideo(short, 'horizontal')).toBe('horizontal')
    const comum = parseVideoUrl('https://www.youtube.com/watch?v=abc123XYZ')!
    expect(orientacaoDoVideo(comum, 'vertical')).toBe('vertical')
  })

  it('perfil antigo, sem o campo, continua deitado', () => {
    const v = parseVideoUrl('https://www.youtube.com/watch?v=abc123XYZ')!
    expect(orientacaoDoVideo(v, undefined)).toBe('horizontal')
  })

  // A capa 16:9 de um Short traz o vídeo em pé espremido no meio; num quadro
  // vertical com object-cover sobraria uma tira do centro.
  it('Short pede a capa na proporção dele (oar), com as 16:9 como reserva', () => {
    const v = parseVideoUrl('https://www.youtube.com/shorts/abc123XYZ')!
    expect(v.posters[0]).toContain('oardefault')
    expect(v.posters.length).toBeGreaterThan(1)
  })

  it('Short e vídeo comum tocam pelo mesmo player — só o enquadramento muda', () => {
    const short = parseVideoUrl('https://www.youtube.com/shorts/abc123XYZ')!
    const comum = parseVideoUrl('https://www.youtube.com/watch?v=abc123XYZ')!
    expect(short.embedUrl).toBe(comum.embedUrl)
  })
})

// ARQUIVO DO PRÓPRIO SITE — o vídeo do perfil de demonstração fica em `public/`.
// Não é upload: o servidor continua recusando qualquer coisa que não seja YouTube
// ou Vimeo (backend/src/video.ts), então nenhum advogado consegue gravar um
// caminho destes. Este reconhecimento vale só para o que já vem no pacote.
describe('vídeo servido pelo próprio site', () => {
  it('reconhece um caminho da nossa origem', () => {
    const v = parseVideoUrl('/video_de_apresentacao.mp4')
    expect(v?.provider).toBe('arquivo')
    expect(v?.embedUrl).toBe('/video_de_apresentacao.mp4')
  })

  it('a capa é o mesmo caminho com .jpg', () => {
    expect(parseVideoUrl('/video_de_apresentacao.mp4')?.posters).toEqual([
      '/video_de_apresentacao.jpg',
    ])
    expect(parseVideoUrl('/midia/ana.webm')?.posters).toEqual(['/midia/ana.jpg'])
  })

  // A trava que não pode cair: `//evil.com/x.mp4` é uma URL relativa a protocolo,
  // que o navegador lê como OUTRO domínio. Uma barra, e só uma.
  it('recusa endereço de outro domínio disfarçado de caminho', () => {
    expect(parseVideoUrl('//evil.com/x.mp4')).toBeNull()
    expect(parseVideoUrl('https://evil.com/x.mp4')).toBeNull()
    expect(parseVideoUrl('http://evil.com/x.mp4')).toBeNull()
  })

  it('recusa caminho relativo e travessia de diretório', () => {
    expect(parseVideoUrl('video.mp4')).toBeNull()
    expect(parseVideoUrl('/../segredo.mp4')).toBeNull()
  })

  it('recusa extensão que o navegador não toca como vídeo', () => {
    expect(parseVideoUrl('/arquivo.exe')).toBeNull()
    expect(parseVideoUrl('/arquivo.svg')).toBeNull()
    expect(parseVideoUrl('/arquivo.mp3')).toBeNull()
  })

  it('não tem orientação deduzida — quem sobe o arquivo é quem sabe', () => {
    const v = parseVideoUrl('/video_de_apresentacao.mp4')!
    expect(v.orientacaoDetectada).toBeNull()
    expect(orientacaoDoVideo(v, 'auto')).toBe('horizontal')
    expect(orientacaoDoVideo(v, 'vertical')).toBe('vertical')
  })
})
