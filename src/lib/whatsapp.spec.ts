// O caminho até o WhatsApp.
//
// Esta suíte existe porque a falha aqui é SILENCIOSA nos dois lados: a mensagem é
// montada no aparelho de quem visita e vai direto para o advogado, sem passar por
// nós. Link quebrado não vira erro em log nenhum — vira um advogado que acha que
// ninguém o procura e um visitante que acha que o perfil está quebrado.

import { describe, expect, it, vi, afterEach } from 'vitest'
import { comoAbrirWhatsapp, numeroWhatsapp, TINTA_SOBRE_O_VERDE, VERDE_WHATSAPP, whatsappHref } from './whatsapp'

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

describe('o verde do atalho flutuante', () => {
  // O rótulo do balão é texto de 14 px sobre este verde: precisa de 4,5:1 (AA).
  // O #25D366 da marca fica em 2:1 com texto branco — por isso o tom fechado.
  const canal = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
  }
  it('a tinta passa em AA sobre o verde', () => {
    const [a, b] = [lum(VERDE_WHATSAPP), lum(TINTA_SOBRE_O_VERDE)]
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })
  it('é verde de verdade — o canal verde domina', () => {
    const n = parseInt(VERDE_WHATSAPP.slice(1), 16)
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    expect(g).toBeGreaterThan(r * 2)
    expect(g).toBeGreaterThan(b * 1.5)
  })
})
