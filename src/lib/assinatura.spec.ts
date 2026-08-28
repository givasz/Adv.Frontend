// O que a tela DIZ quando a cobrança dá errado.
//
// A regra que estes testes travam não é de layout, é de honestidade: todo aviso
// precisa dizer o que acontece, quando, e que nada é apagado. Um aviso que só diz
// "há um problema com seu pagamento" transforma cartão vencido em cliente perdido
// — a pessoa presume que o produto quebrou e vai embora sem ter decidido ir.

import { describe, expect, it } from 'vitest'
import { avisoDeCobranca, diasAte, type Subscription } from './assinatura'

const HOJE = new Date('2026-08-28T12:00:00.000Z')
const dias = (n: number) => new Date(HOJE.getTime() + n * 24 * 60 * 60 * 1000).toISOString()

function assinatura(p: Partial<Subscription> = {}): Subscription {
  return {
    plan: 'premium',
    status: 'active',
    cortesia: false,
    rebaixado: false,
    validoAte: null,
    currentPeriodEnd: null,
    graceUntil: null,
    planScheduled: null,
    ...p,
  }
}

describe('quando NÃO há nada a dizer', () => {
  it('assinatura em dia não vira tarja', () => {
    expect(avisoDeCobranca(assinatura(), HOJE)).toBeNull()
  })

  it('quem está no Free nunca vê aviso de cobrança', () => {
    expect(avisoDeCobranca(assinatura({ plan: 'free', status: 'past_due' }), HOJE)).toBeNull()
  })

  it('sem informação de assinatura, silêncio', () => {
    expect(avisoDeCobranca(undefined, HOJE)).toBeNull()
  })
})

describe('cobrança falhada', () => {
  const s = assinatura({ status: 'past_due', cortesia: true, validoAte: dias(5) })

  it('diz o prazo, não só que houve um problema', () => {
    const a = avisoDeCobranca(s, HOJE)!
    expect(a.texto).toMatch(/5 dias/)
    expect(a.texto).toMatch(/setembro/)
  })

  it('promete que os recursos VOLTAM sozinhos — é a dúvida real de quem lê', () => {
    expect(avisoDeCobranca(s, HOJE)!.texto).toMatch(/voltam sozinhos/i)
  })

  it('aperta o tom só quando o prazo está no fim', () => {
    expect(avisoDeCobranca(s, HOJE)!.tom).toBe('atencao')
    const quase = assinatura({ status: 'past_due', cortesia: true, validoAte: dias(1) })
    expect(avisoDeCobranca(quase, HOJE)!.tom).toBe('urgente')
  })
})

describe('já rebaixado', () => {
  const s = assinatura({ status: 'canceled', rebaixado: true })

  it('diz que a PÁGINA continua no ar — é a primeira coisa que a pessoa teme', () => {
    expect(avisoDeCobranca(s, HOJE)!.texto).toMatch(/continua no ar/i)
  })

  it('diz que nada foi apagado', () => {
    expect(avisoDeCobranca(s, HOJE)!.texto).toMatch(/Nada foi apagado/i)
  })

  it('oferece o caminho de volta', () => {
    expect(avisoDeCobranca(s, HOJE)!.destino).toBe('/assinar/premium')
  })
})

describe('cancelada com mês pago em aberto', () => {
  it('mostra até quando vale, sem alarme', () => {
    const a = avisoDeCobranca(
      assinatura({ status: 'canceled', cortesia: true, validoAte: dias(12) }),
      HOJE,
    )!
    expect(a.tom).toBe('atencao')
    expect(a.titulo).toMatch(/termina em/i)
  })
})

describe('rebaixamento agendado', () => {
  it('avisa a data e garante o plano até lá', () => {
    const a = avisoDeCobranca(
      assinatura({ planScheduled: 'pro', currentPeriodEnd: dias(9) }),
      HOJE,
    )!
    expect(a.tom).toBe('info')
    expect(a.titulo).toMatch(/Pro/)
    expect(a.texto).toMatch(/mês já está pago/i)
  })
})

describe('cobrança pausada por sanção', () => {
  it('explica que o prazo também para — a pessoa não perde os dias', () => {
    const a = avisoDeCobranca(assinatura({ status: 'paused' }), HOJE)!
    expect(a.tom).toBe('info')
    expect(a.texto).toMatch(/não perde os dias/i)
    // Sem botão: não há ação do usuário aqui, e oferecer uma seria mentira.
    expect(a.acao).toBeUndefined()
  })
})

describe('diasAte', () => {
  it('arredonda para cima e nunca devolve negativo', () => {
    expect(diasAte(dias(2), HOJE)).toBe(2)
    expect(diasAte(dias(-5), HOJE)).toBe(0)
    expect(diasAte(null, HOJE)).toBe(0)
    expect(diasAte('data-quebrada', HOJE)).toBe(0)
  })
})
