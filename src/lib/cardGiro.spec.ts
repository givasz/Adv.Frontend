import { describe, expect, it } from 'vitest'
import {
  INCLINACAO_MAX,
  brilhoDoGiro,
  encaixarGiro,
  giroParaLado,
  ladoDoGiro,
  limitarInclinacao,
} from './cardGiro'

describe('ladoDoGiro', () => {
  it('frente em 0 e a cada volta inteira, verso em meia volta — nos dois sentidos', () => {
    expect(ladoDoGiro(0)).toBe('frente')
    expect(ladoDoGiro(180)).toBe('verso')
    expect(ladoDoGiro(-180)).toBe('verso')
    expect(ladoDoGiro(360)).toBe('frente')
    expect(ladoDoGiro(-360)).toBe('frente')
    expect(ladoDoGiro(540)).toBe('verso')
  })

  it('a face muda quando o cartão passa de perfil (90°)', () => {
    expect(ladoDoGiro(89)).toBe('frente')
    expect(ladoDoGiro(91)).toBe('verso')
    expect(ladoDoGiro(-91)).toBe('verso')
    expect(ladoDoGiro(269)).toBe('verso')
    expect(ladoDoGiro(271)).toBe('frente')
  })
})

describe('encaixarGiro', () => {
  it('parado, para na face mais próxima', () => {
    expect(encaixarGiro(80)).toBe(0)
    expect(encaixarGiro(100)).toBe(180)
    expect(encaixarGiro(-100)).toBe(-180)
    expect(encaixarGiro(370)).toBe(360)
  })

  it('um puxão rápido completa a virada mesmo com pouco arrasto', () => {
    // 40° arrastados voltariam para 0; com velocidade, seguem para 180
    expect(encaixarGiro(40, 0.5)).toBe(180)
    expect(encaixarGiro(-40, -0.5)).toBe(-180)
  })

  it('um arrasto lento e curto volta para onde estava', () => {
    expect(encaixarGiro(40, 0.05)).toBe(0)
  })

  it('por mais rápido que solte, a inércia nunca pula uma face inteira', () => {
    // 190°: acabou de passar do verso. Um puxão violento para em 180, não em 360.
    expect(encaixarGiro(190, 5)).toBe(180)
    expect(encaixarGiro(-190, -5)).toBe(-180)
    // e do repouso, o mesmo puxão vira UMA face
    expect(encaixarGiro(20, 5)).toBe(180)
  })
})

describe('giroParaLado', () => {
  it('já no lado pedido, só encaixa', () => {
    expect(giroParaLado(10, 'frente')).toBe(0)
    expect(giroParaLado(200, 'verso')).toBe(180)
  })

  it('do outro lado, avança meia volta no sentido pedido', () => {
    expect(giroParaLado(0, 'verso')).toBe(180)
    expect(giroParaLado(0, 'verso', -1)).toBe(-180)
    expect(giroParaLado(350, 'verso')).toBe(540)
    expect(giroParaLado(180, 'frente')).toBe(360)
  })
})

describe('limitarInclinacao', () => {
  it('não deixa o cartão virar de cabeça para baixo', () => {
    expect(limitarInclinacao(90)).toBe(INCLINACAO_MAX)
    expect(limitarInclinacao(-90)).toBe(-INCLINACAO_MAX)
    expect(limitarInclinacao(5)).toBe(5)
  })
})

describe('brilhoDoGiro', () => {
  it('some nas duas faces em repouso e é máximo de perfil', () => {
    expect(brilhoDoGiro(0)).toBe(0)
    expect(Math.abs(brilhoDoGiro(180))).toBeLessThan(1e-9)
    expect(brilhoDoGiro(90)).toBeCloseTo(1)
    expect(brilhoDoGiro(-90)).toBeCloseTo(-1)
  })
})
