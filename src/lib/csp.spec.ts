// O CSP e o código precisam concordar sobre QUEM pode ser emoldurado.
//
// Estavam em desacordo, e o efeito era invisível: `frame-src 'none'` bloqueava o
// <iframe> do YouTube, então o vídeo de apresentação — o recurso mais caro do
// plano Max — mostrava uma caixa vazia em produção. O motivo só aparecia no
// console do navegador, e o defeito exige três coisas ao mesmo tempo para
// aparecer (perfil Max + vídeo preenchido + alguém clicando em assistir).
//
// Este teste lê o netlify.toml de verdade. Ele quebra tanto se alguém fechar o
// `frame-src` de novo quanto se o código passar a montar um provedor que o CSP
// não conhece.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseVideoUrl } from './video'

const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8')
const csp = /Content-Security-Policy = "([^"]*)"/.exec(toml)?.[1] ?? ''

const diretiva = (nome: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${nome} `))
    ?.slice(nome.length + 1)
    .trim() ?? ''

describe('o CSP existe e é lido', () => {
  it('o netlify.toml tem uma política', () => {
    expect(csp).toContain("default-src 'self'")
  })
})

describe('o vídeo consegue tocar', () => {
  const frameSrc = diretiva('frame-src')

  it('frame-src não é "none" — era, e a caixa do vídeo ficava vazia', () => {
    expect(frameSrc).not.toBe("'none'")
    expect(frameSrc).toBeTruthy()
  })

  // A prova real: pega o host que o CÓDIGO monta e confere se o CSP o permite.
  it('o host que o player monta está liberado', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      'https://www.youtube.com/shorts/aqz-KE-bpKQ',
      'https://vimeo.com/123456789',
    ]) {
      const { origin } = new URL(parseVideoUrl(link)!.embedUrl)
      expect(frameSrc.split(/\s+/)).toContain(origin)
    }
  })

  it('o vídeo servido por nós mesmos passa por media-src', () => {
    expect(parseVideoUrl('/video_de_apresentacao.mp4')?.provider).toBe('arquivo')
    expect(diretiva('media-src')).toContain("'self'")
  })
})

describe('a abertura do frame-src é MÍNIMA', () => {
  it('não vira curinga — só os provedores de vídeo entram', () => {
    const hosts = diretiva('frame-src').split(/\s+/).filter(Boolean)
    expect(hosts).not.toContain('*')
    expect(hosts).not.toContain('https:')
    for (const h of hosts) {
      expect(h).toMatch(/^https:\/\/(www\.youtube(-nocookie)?\.com|player\.vimeo\.com)$/)
    }
  })

  // O resto da política não pode ser afrouxado de carona.
  it('as travas que não têm nada a ver com vídeo continuam de pé', () => {
    expect(diretiva('object-src')).toBe("'none'")
    expect(diretiva('frame-ancestors')).toBe("'none'")
    expect(diretiva('script-src')).toBe("'self'")
    expect(diretiva('base-uri')).toBe("'self'")
  })
})
