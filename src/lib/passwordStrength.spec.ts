import { describe, expect, it } from 'vitest'
import { PASSWORD_MIN, passwordProblem, passwordStrength } from './passwordStrength'

const ok = (s: string, email = 'joao@escritorio.adv.br') => passwordStrength(s, email).acceptable

describe('senha — o que NÃO passa', () => {
  it('curta demais', () => {
    expect(ok('abc12')).toBe(false)
    expect(passwordProblem('abc12')).toContain(String(PASSWORD_MIN))
  })

  it('as manjadas do dicionário, com ou sem maiúscula e acento', () => {
    for (const s of ['12345678', 'password', 'senha123', 'Senha123', 'advogado', 'ADVOGADA']) {
      expect(ok(s), s).toBe(false)
    }
  })

  it('senha que é quase toda sequência de teclado ou de alfabeto', () => {
    for (const s of ['qwertyui1', 'abcdefg9', 'x1234567', 'lkjhgfds1', '123456789a', 'asdf1234', 'aaaa1234']) {
      expect(ok(s), s).toBe(false)
    }
  })

  it('repetição do mesmo caractere', () => {
    expect(ok('aaaaaaaa')).toBe(false)
    expect(ok('zzzzzzz9')).toBe(false)
    expect(passwordProblem('zzzzzzz9')).toContain('repetir')
  })

  it('a senha derivada do próprio e-mail', () => {
    // É a primeira coisa que um ataque direcionado tenta.
    expect(ok('joao2026!', 'joao@escritorio.adv.br')).toBe(false)
    expect(ok('marinasales9', 'marinasales@x.com')).toBe(false)
  })

  it('o nome do site', () => {
    expect(ok('advocme2026')).toBe(false)
  })

  it('só uma classe de caractere quando é curta', () => {
    expect(ok('tribunal')).toBe(false) // 8 letras, sem número nem símbolo
    expect(ok('93857261')).toBe(false) // só dígitos
  })
})

describe('senha — o que passa', () => {
  // Afrouxada em 08/10/2026: um trecho previsível no meio de uma senha própria
  // não reprova mais, e nada de "oab" escondido em nome barrar o cadastro.
  it('nome com 1234 no fim — sobra senha fora da sequência', () => {
    expect(ok('maria1234')).toBe(true)
    expect(ok('Paulo2026')).toBe(true)
  })

  it('nome que contém "oab" por acaso', () => {
    expect(ok('joaobarros7', 'contato@escritorio.adv.br')).toBe(true)
  })

  it('10 letras já bastam, sem número nem símbolo', () => {
    expect(ok('verdadeiro')).toBe(true)
    expect(ok('girassolazul')).toBe(true)
  })

  it('senha aceita nunca aparece como "fraca" na barra', () => {
    expect(passwordStrength('verdadeiro').level).not.toBe('fraca')
  })

  it('curta porém variada', () => {
    expect(ok('Chuva!47')).toBe(true)
    expect(ok('tribunal7x')).toBe(true)
  })

  it('frase longa sem firula — comprimento basta', () => {
    // NIST: não obrigar composição. Uma frase é mais forte e mais memorável que
    // "Senha@123", que é justamente o padrão que os ataques testam primeiro.
    expect(ok('cavalo bateria grampo')).toBe(true)
    expect(passwordStrength('cavalo bateria grampo').level).toBe('forte')
  })

  it('e-mail vazio não quebra a checagem', () => {
    expect(passwordStrength('Chuva!47', '').acceptable).toBe(true)
    expect(passwordStrength('Chuva!47').acceptable).toBe(true)
  })
})

describe('senha — pontuação e rótulo', () => {
  it('vazia não pontua e não trava a interface', () => {
    const s = passwordStrength('')
    expect(s.score).toBe(0)
    expect(s.acceptable).toBe(false)
    expect(s.problems).toEqual([])
  })

  it('a barra sobe com o comprimento', () => {
    const curta = passwordStrength('Chuva!47').score
    const media = passwordStrength('Chuva!47torre').score
    const longa = passwordStrength('Chuva!47torre azul manhã').score
    expect(curta).toBeLessThan(media)
    expect(media).toBeLessThanOrEqual(longa)
    expect(longa).toBe(4)
  })

  it('qualquer problema derruba a pontuação, por mais longa que seja', () => {
    expect(passwordStrength('abcdefghijklmnopqrst').score).toBeLessThanOrEqual(1)
  })

  it('passwordProblem devolve a primeira coisa a corrigir, ou null', () => {
    expect(passwordProblem('Chuva!47')).toBeNull()
    expect(passwordProblem('abc')).toBeTruthy()
  })
})
