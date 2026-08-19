import { describe, expect, it } from 'vitest'
import { isValidVideoUrl, parseVideoUrl } from './video'

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
