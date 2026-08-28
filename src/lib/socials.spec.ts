// O campo de redes recebe o que a pessoa tem na cabeça — `@joaosilva` —, não a
// URL que a plataforma precisa. Antes, tudo que não fosse um endereço completo
// virava "Endereço inválido" na tela e, no salvamento, DESAPARECIA: `safeUrl`
// monta `https://@joao`, que não tem hostname, devolve null, e o backend filtra a
// linha fora. A rede sumia do perfil sem erro e sem aviso.

import { describe, expect, it } from 'vitest'
import { normalizeSocialUrl, validateSocialUrl, explicaNormalizacao } from './socials'

describe('nome de usuário vira endereço', () => {
  it('aceita o @ que todo mundo escreve', () => {
    expect(normalizeSocialUrl('instagram', '@joaosilva').url).toBe('https://instagram.com/joaosilva')
    expect(normalizeSocialUrl('tiktok', '@joaosilva').url).toBe('https://tiktok.com/@joaosilva')
    expect(normalizeSocialUrl('youtube', '@canaljuridico').url).toBe(
      'https://youtube.com/@canaljuridico',
    )
  })

  it('aceita o usuário sem @ também', () => {
    expect(normalizeSocialUrl('instagram', 'joaosilva').url).toBe('https://instagram.com/joaosilva')
    expect(normalizeSocialUrl('facebook', 'joao.silva').url).toBe('https://facebook.com/joao.silva')
  })

  // O LinkedIn separa pessoa (/in/) de empresa (/company/); este campo é o perfil
  // do advogado. Sem o /in/, o link cai numa página que não existe.
  it('põe o LinkedIn em /in/, que é onde mora a pessoa', () => {
    expect(normalizeSocialUrl('linkedin', '@joaosilva').url).toBe(
      'https://linkedin.com/in/joaosilva',
    )
  })

  it('o resultado passa na validação — que era o ponto', () => {
    for (const kind of ['instagram', 'linkedin', 'facebook', 'youtube', 'tiktok'] as const) {
      const { url } = normalizeSocialUrl(kind, '@joaosilva')
      expect(validateSocialUrl(kind, url).status).toBe('ok')
    }
  })
})

describe('endereço colado pela metade', () => {
  it('completa o https:// que ninguém digita', () => {
    expect(normalizeSocialUrl('instagram', 'instagram.com/joao').url).toBe(
      'https://instagram.com/joao',
    )
    expect(normalizeSocialUrl('website', 'www.silva.adv.br').url).toBe('https://www.silva.adv.br')
  })

  it('não mexe no que já está completo', () => {
    const pronto = 'https://instagram.com/joao'
    const r = normalizeSocialUrl('instagram', pronto)
    expect(r.url).toBe(pronto)
    expect(r.changed).toBe(false)
  })

  it('um @ grudado num endereço é erro de digitação, não abreviação', () => {
    expect(normalizeSocialUrl('instagram', '@instagram.com/joao').url).toBe(
      'https://instagram.com/joao',
    )
  })
})

describe('o que não dá para adivinhar, explica', () => {
  it('só o @, sem nada depois', () => {
    const r = normalizeSocialUrl('instagram', '@')
    expect(r.url).toBe('')
    expect(r.error).toMatch(/usuário depois do @/i)
  })

  it('usuário com espaço', () => {
    const r = normalizeSocialUrl('instagram', '@joao silva')
    expect(r.url).toBe('')
    expect(r.error).toMatch(/espaços/i)
  })

  // Um site não tem "usuário" — `@algo` ali é campo trocado, e mandar para
  // `https://@algo` só reproduziria o sumiço silencioso de antes.
  it('site não aceita nome de usuário solto', () => {
    const r = normalizeSocialUrl('website', '@meusite')
    expect(r.url).toBe('')
    expect(r.error).toMatch(/endereço completo/i)
  })

  it('campo vazio é vazio, não é erro', () => {
    const r = normalizeSocialUrl('instagram', '   ')
    expect(r.url).toBe('')
    expect(r.error).toBeUndefined()
  })
})

describe('a tela conta o que foi entendido', () => {
  // O campo mudar sozinho debaixo da pessoa, calado, é o que faz um produto
  // prestativo parecer um produto com bug.
  it('avisa quando corrigiu', () => {
    expect(explicaNormalizacao('@joao', 'https://instagram.com/joao')).toMatch(
      /https:\/\/instagram\.com\/joao/,
    )
  })

  it('cala quando não mexeu em nada', () => {
    expect(explicaNormalizacao('https://instagram.com/joao', 'https://instagram.com/joao')).toBeNull()
    expect(explicaNormalizacao('', '')).toBeNull()
  })
})

describe('rede trocada continua sendo avisada', () => {
  it('link do Instagram no campo do LinkedIn', () => {
    const r = validateSocialUrl('linkedin', 'https://instagram.com/joao')
    expect(r.status).toBe('mismatch')
    expect(r.message).toMatch(/LinkedIn/)
  })
})

// A ambiguidade que um teste pegou: `joao.silva` é usuário legítimo no Facebook e
// no Instagram. A primeira versão tratava "tem ponto" como "é domínio" e gravava
// `https://joao.silva` — link morto, e ninguém perceberia.
describe('ponto no meio: usuário ou domínio?', () => {
  it('usuário com ponto continua sendo usuário', () => {
    expect(normalizeSocialUrl('facebook', 'joao.silva').url).toBe('https://facebook.com/joao.silva')
    expect(normalizeSocialUrl('instagram', '@dra.ana.paula').url).toBe(
      'https://instagram.com/dra.ana.paula',
    )
  })

  it('a BARRA é o que denuncia um endereço', () => {
    expect(normalizeSocialUrl('instagram', 'instagram.com/joao.silva').url).toBe(
      'https://instagram.com/joao.silva',
    )
  })

  it('o domínio da própria rede também é endereço, mesmo sem barra', () => {
    expect(normalizeSocialUrl('instagram', 'instagram.com').url).toBe('https://instagram.com')
  })

  it('no site, domínio solto é a resposta certa', () => {
    expect(normalizeSocialUrl('website', 'silva.adv.br').url).toBe('https://silva.adv.br')
  })
})
