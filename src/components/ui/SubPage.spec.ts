// Travas da navegação das subpáginas que substituíram os modais.
// O "voltar" viaja pela URL — e por isso precisa ser validado como qualquer
// entrada vinda de fora.

import { describe, expect, it } from 'vitest'
import { caminhoDeVolta, comVolta } from './SubPage'

describe('caminho de volta', () => {
  it('aceita caminho interno', () => {
    expect(caminhoDeVolta('/editor?section=faq', '/painel')).toBe('/editor?section=faq')
  })

  it('cai no destino de reserva quando não veio nada', () => {
    expect(caminhoDeVolta(null, '/painel')).toBe('/painel')
    expect(caminhoDeVolta('', '/painel')).toBe('/painel')
  })

  it('recusa endereço externo — a subpágina não vira trampolim', () => {
    expect(caminhoDeVolta('https://exemplo.com', '/painel')).toBe('/painel')
    expect(caminhoDeVolta('//exemplo.com', '/painel')).toBe('/painel')
    expect(caminhoDeVolta('javascript:alert(1)', '/painel')).toBe('/painel')
  })

  it('recusa a barra invertida — o navegador a lê como endereço externo', () => {
    expect(caminhoDeVolta('/\\exemplo.com', '/painel')).toBe('/painel')
    expect(caminhoDeVolta('/\\\\exemplo.com', '/painel')).toBe('/painel')
    expect(caminhoDeVolta('  //exemplo.com', '/painel')).toBe('/painel')
  })

  it('recusa caractere de controle no caminho', () => {
    expect(caminhoDeVolta('/painel\nhttps://exemplo.com', '/painel')).toBe('/painel')
    expect(caminhoDeVolta('/\tpainel', '/painel')).toBe('/painel')
  })
})

describe('montagem do endereço', () => {
  it('embute a volta codificada', () => {
    expect(comVolta('/suporte', '/painel')).toBe('/suporte?voltar=%2Fpainel')
  })

  it('usa & quando o destino já tem parâmetros', () => {
    expect(comVolta('/planos?recurso=faq', '/editor?section=faq')).toBe(
      '/planos?recurso=faq&voltar=%2Feditor%3Fsection%3Dfaq',
    )
  })

  it('a ida e a volta se fecham', () => {
    const origem = '/editor?section=aparencia'
    const url = comVolta('/assinar/pro', origem)
    const voltar = new URLSearchParams(url.split('?')[1]).get('voltar')
    expect(caminhoDeVolta(voltar, '/painel')).toBe(origem)
  })
})
