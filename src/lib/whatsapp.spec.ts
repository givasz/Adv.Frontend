// O caminho até o WhatsApp.
//
// Esta suíte existe porque a falha aqui é SILENCIOSA nos dois lados: a mensagem é
// montada no aparelho de quem visita e vai direto para o advogado, sem passar por
// nós. Link quebrado não vira erro em log nenhum — vira um advogado que acha que
// ninguém o procura e um visitante que acha que o perfil está quebrado.

import { describe, expect, it, vi, afterEach } from 'vitest'
import { comoAbrirWhatsapp, numeroWhatsapp, whatsappHref } from './whatsapp'

describe('o número vira o que o wa.me entende: só dígitos, com DDI', () => {
  it('tira a pontuação que o servidor aceita gravar', () => {
    // `safePhone` do backend valida FORMATO DE TELEFONE, não formato de link:
    // "+55 (11) 99000-0000" passa por ele e ia inteiro para dentro da URL.
    expect(numeroWhatsapp('+55 (11) 99000-0000')).toBe('5511990000000')
    expect(numeroWhatsapp('55 11 99887-7665')).toBe('5511998877665')
    expect(numeroWhatsapp(' 5511998877665 ')).toBe('5511998877665')
  })

  it('põe o DDI em número brasileiro que veio sem ele', () => {
    // Dez ou onze dígitos é DDD + número. Sem o 55 na frente o link não abre, e o
    // campo do editor não é a única porta por onde o número entra.
    expect(numeroWhatsapp('11998877665')).toBe('5511998877665')
    expect(numeroWhatsapp('1133334444')).toBe('551133334444')
  })

  it('descarta o zero de operadora colado na frente', () => {
    expect(numeroWhatsapp('011998877665')).toBe('5511998877665')
  })

  it('número que não dá para usar vira vazio, nunca um link torto', () => {
    // Vazio é o ponto: é o que faz o botão SUMIR em vez de virar link morto.
    expect(numeroWhatsapp('')).toBe('')
    expect(numeroWhatsapp(null)).toBe('')
    expect(numeroWhatsapp(undefined)).toBe('')
    expect(numeroWhatsapp('99999')).toBe('') // curto demais
    expect(numeroWhatsapp('1'.repeat(20))).toBe('') // acima do E.164
    expect(numeroWhatsapp('não tenho')).toBe('')
  })

  it('número internacional já completo passa intacto', () => {
    expect(numeroWhatsapp('+351 912 345 678')).toBe('351912345678')
  })
})

describe('o link', () => {
  it('leva a mensagem com as quebras de linha preservadas', () => {
    // A mensagem do assistente é multilinha, e é dela que o advogado lê dia,
    // horário e assunto. `%0A` é o que o WhatsApp devolve como quebra.
    const href = whatsappHref('5511998877665', 'Olá!\nQuinta às 14h.')!
    expect(href).toBe('https://wa.me/5511998877665?text=Ol%C3%A1!%0AQuinta%20%C3%A0s%2014h.')
  })

  it('sem número utilizável não existe link', () => {
    expect(whatsappHref('', 'oi')).toBeUndefined()
    expect(whatsappHref('123', 'oi')).toBeUndefined()
    expect(whatsappHref(undefined)).toBeUndefined()
  })

  it('sem mensagem, abre a conversa vazia — e sem "?text=" pendurado', () => {
    expect(whatsappHref('5511998877665')).toBe('https://wa.me/5511998877665')
    expect(whatsappHref('5511998877665', '   ')).toBe('https://wa.me/5511998877665')
  })
})

describe('como a página abre o WhatsApp', () => {
  const fingirPonteiro = (dedo: boolean) => {
    vi.stubGlobal('window', {
      matchMedia: (q: string) => ({ matches: dedo && q.includes('pointer: coarse') }),
    })
  }
  afterEach(() => vi.unstubAllGlobals())

  it('no celular vai na MESMA aba', () => {
    // É o caso que quebrava: dentro do Instagram e do Facebook a página roda num
    // navegador embutido sem abas, e o `_blank` é descartado em silêncio — nada
    // acontece ao tocar no botão.
    fingirPonteiro(true)
    expect(comoAbrirWhatsapp().target).toBe('_self')
  })

  it('no computador abre em aba nova, preservando o perfil', () => {
    fingirPonteiro(false)
    expect(comoAbrirWhatsapp().target).toBe('_blank')
  })

  it('sempre com rel, inclusive na mesma aba', () => {
    for (const dedo of [true, false]) {
      fingirPonteiro(dedo)
      expect(comoAbrirWhatsapp().rel).toContain('noopener')
    }
  })

  it('navegador sem matchMedia não derruba a tela', () => {
    vi.stubGlobal('window', {})
    expect(comoAbrirWhatsapp().target).toBe('_blank')
  })
})
