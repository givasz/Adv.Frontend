import { describe, expect, it } from 'vitest'
import { guardarPendente, horaDaCopia, lerPendente, limparPendente, type Armazem } from './alteracoesPendentes'

// Um Storage de mentira: o teste roda em Node, sem sessionStorage.
function armazem(): Armazem & { mapa: Map<string, string> } {
  const mapa = new Map<string, string>()
  return {
    mapa,
    getItem: (k) => mapa.get(k) ?? null,
    setItem: (k, v) => void mapa.set(k, v),
    removeItem: (k) => void mapa.delete(k),
  }
}

describe('cópia de segurança do que não foi salvo', () => {
  it('guarda, lê de volta com a hora, e apaga', () => {
    const s = armazem()
    const antes = Date.now()
    guardarPendente('perfil', { name: 'Ana', bio: 'x' }, s)
    const p = lerPendente<{ name: string; bio: string }>('perfil', s)
    expect(p?.dados).toEqual({ name: 'Ana', bio: 'x' })
    expect(p!.quando).toBeGreaterThanOrEqual(antes)
    limparPendente('perfil', s)
    expect(lerPendente('perfil', s)).toBeNull()
  })

  it('cada chave é uma cópia — o perfil não pisa no escritório', () => {
    const s = armazem()
    guardarPendente('perfil', 1, s)
    guardarPendente('escritorio', 2, s)
    expect(lerPendente('perfil', s)?.dados).toBe(1)
    expect(lerPendente('escritorio', s)?.dados).toBe(2)
  })

  it('conteúdo estranho no armazenamento não quebra a tela', () => {
    const s = armazem()
    s.setItem('advocme:pendente:perfil', '{nao é json')
    expect(lerPendente('perfil', s)).toBeNull()
    s.setItem('advocme:pendente:perfil', JSON.stringify({ quando: 'ontem' }))
    expect(lerPendente('perfil', s)).toBeNull()
    s.setItem('advocme:pendente:perfil', 'null')
    expect(lerPendente('perfil', s)).toBeNull()
  })

  it('sem armazenamento (acesso negado) tudo vira não-operação', () => {
    expect(() => guardarPendente('perfil', {}, null)).not.toThrow()
    expect(lerPendente('perfil', null)).toBeNull()
    expect(() => limparPendente('perfil', null)).not.toThrow()
  })

  it('armazenamento que estoura a cota também não quebra', () => {
    const s: Armazem = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('cheio', 'QuotaExceededError')
      },
      removeItem: () => undefined,
    }
    expect(() => guardarPendente('perfil', { grande: 'x'.repeat(10) }, s)).not.toThrow()
  })

  it('a hora sai como "HHhMM"', () => {
    const d = new Date()
    d.setHours(9, 5, 0, 0)
    expect(horaDaCopia(d.getTime())).toBe('09h05')
  })
})
