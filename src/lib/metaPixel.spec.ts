// O Pixel da Meta mede os anúncios do advoc.me — e só isso. Estes testes travam
// as duas promessas da Política de Cookies: nunca no perfil de um advogado, e
// nunca sem o aceite de quem está na página.

import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROTAS_COM_PIXEL, escolhaDeCookies, gravarEscolha, rotaComPixel } from './metaPixel'

describe('onde o pixel pode medir', () => {
  it('nas páginas de venda', () => {
    for (const r of ['/', '/criar-conta', '/comecar', '/planos', '/planos/']) {
      expect(rotaComPixel(r)).toBe(true)
    }
  })

  it('nunca no perfil, no escritório, no agendamento, na denúncia ou no pagamento', () => {
    for (const r of [
      '/marina-sales',
      '/marina-sales/agendar',
      '/marina-sales/denunciar',
      '/marina-sales/compartilhar',
      '/escritorio/silva-advogados',
      '/assinar/pro',
      '/entrar',
      '/painel',
      '/editor',
    ]) {
      expect(rotaComPixel(r)).toBe(false)
    }
  })

  it('a lista é fechada: nenhuma rota com parâmetro (perfil é /:slug)', () => {
    for (const r of ROTAS_COM_PIXEL) expect(r).not.toContain(':')
  })

  it('o index.html não carrega o pixel — ele é o mesmo arquivo de todo perfil', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    expect(html).not.toMatch(/fbevents|fbq\(|facebook\.com\/tr/)
  })
})

describe('consentimento', () => {
  const guardado = new Map<string, string>()
  beforeEach(() => {
    guardado.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    })
  })

  it('sem escolha, não há aceite', () => {
    expect(escolhaDeCookies()).toBeNull()
  })

  it('a escolha fica guardada e pode ser trocada', () => {
    gravarEscolha('aceito')
    expect(escolhaDeCookies()).toBe('aceito')
    vi.stubGlobal('window', {})
    gravarEscolha('recusado')
    expect(escolhaDeCookies()).toBe('recusado')
  })
})
