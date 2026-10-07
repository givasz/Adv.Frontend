// O Pixel da Meta mede os anúncios do advoc.me — e só isso. Estes testes travam
// as duas promessas da Política de Cookies: nunca no perfil de um advogado, e
// nada sai depois que a pessoa recusa.

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

describe('aviso com direito de recusa', () => {
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

describe('quando o pixel carrega', () => {
  const guardado = new Map<string, string>()
  let scripts: string[]
  beforeEach(() => {
    guardado.clear()
    scripts = []
    vi.resetModules()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    })
    vi.stubGlobal('window', {})
    vi.stubGlobal('location', { hostname: 'advoc.me' })
    vi.stubGlobal('document', {
      cookie: '',
      createElement: () => ({}),
      head: { appendChild: (s: { src: string }) => void scripts.push(s.src) },
    })
  })

  it('sem escolha, carrega nas páginas de venda (aviso, não pedido)', async () => {
    const m = await import('./metaPixel')
    m.registrarVisita('/')
    expect(scripts).toEqual(['https://connect.facebook.net/en_US/fbevents.js'])
  })

  it('no perfil, nunca — nem sem escolha', async () => {
    const m = await import('./metaPixel')
    m.registrarVisita('/marina-sales')
    expect(scripts).toEqual([])
  })

  it('a mesma página não conta duas vezes seguidas (o "Entendi" contava)', async () => {
    const m = await import('./metaPixel')
    const chamadas: unknown[][] = []
    m.registrarVisita('/')
    const fbq = (window as { fbq?: { queue: unknown[][] } }).fbq!
    m.gravarEscolha('aceito')
    m.registrarVisita('/')
    for (const c of fbq.queue) chamadas.push(c)
    expect(chamadas.filter((c) => c[0] === 'trackSingle')).toHaveLength(1)
    m.registrarVisita('/criar-conta')
    m.registrarVisita('/')
    expect(fbq.queue.filter((c) => c[0] === 'trackSingle')).toHaveLength(3)
  })

  it('depois de recusar, não carrega', async () => {
    const m = await import('./metaPixel')
    m.gravarEscolha('recusado')
    m.registrarVisita('/')
    expect(scripts).toEqual([])
  })
})
