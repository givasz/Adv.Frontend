// TRAVA CONTRA A ARMADILHA DA FRONTEIRA DE PALAVRA ASCII.
//
// A fronteira de palavra do JavaScript e ASCII: ela so enxerga limite entre
// [A-Za-z0-9_] e o resto. Entre um espaco e o "E" de "exito" (com circunflexo)
// NAO ha fronteira para ela — logo um grupo ancorado assim nunca casa, e a regra
// morre em silencio. Nao e hipotese: em 2026-08-21 a vedacao mais canonica da
// profissao estava desligada havia tres revisoes do ruleset, sem nenhum teste
// reclamando. "exito garantido" (com circunflexo) passava em qualquer posicao;
// "vitoria garantida" funcionava so porque o "V" e ASCII.
//
// Os testes por exemplo nao pegaram porque nenhum examplesForbidden usava a forma
// acentuada. Este arquivo ataca a CAUSA em vez do sintoma: le o codigo-fonte de
// cada regex e reprova qualquer ramo de alternancia acentuado pendurado numa
// fronteira ASCII. A saida e sempre a mesma — trocar por lookaround com \p{L} e
// ligar a flag u, como ja fazem superlative-comparison e urgency-appeal.
//
// Nota sobre falso alarme: acento no MEIO da palavra e inofensivo. "analise
// gratuita" comeca com "a" simples e sempre funcionou — foi a primeira suspeita
// desta investigacao e nao se confirmou. So o inicio e o fim do ramo importam.

import { describe, expect, it } from 'vitest'
import { checkCompliance, RULES } from './oab'

/** Fora do ASCII: e onde a fronteira de palavra do JS deixa de enxergar letra.
 *  Predicado em vez de regex de proposito — este arquivo fala DE escapes, e
 *  escrever um aqui ja produziu byte de controle no meio do codigo. */
const acentuado = (c: string | undefined) => !!c && c.charCodeAt(0) > 127

/**
 * Fatia o corpo de um grupo nos ramos de alternância de PRIMEIRO nível, pulando
 * escapes (`\(`) e classes (`[...]`), que podem conter `|` e parênteses literais.
 */
function ramos(corpo: string): string[] {
  const out: string[] = []
  let nivel = 0
  let atual = ''
  for (let i = 0; i < corpo.length; ) {
    const c = corpo[i]
    if (c === '\\') {
      atual += corpo.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '[') {
      const fim = corpo.indexOf(']', i + 1)
      const ate = fim === -1 ? corpo.length : fim + 1
      atual += corpo.slice(i, ate)
      i = ate
      continue
    }
    if (c === '(') nivel++
    if (c === ')') nivel--
    if (c === '|' && nivel === 0) {
      out.push(atual)
      atual = ''
      i++
      continue
    }
    atual += c
    i++
  }
  out.push(atual)
  return out
}

/** Índice do ')' que fecha o '(' em `abre`, respeitando escapes e classes. */
function fechaGrupo(src: string, abre: number): number {
  let nivel = 0
  for (let i = abre; i < src.length; ) {
    const c = src[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '[') {
      const fim = src.indexOf(']', i + 1)
      i = fim === -1 ? src.length : fim + 1
      continue
    }
    if (c === '(') nivel++
    if (c === ')') {
      nivel--
      if (nivel === 0) return i
    }
    i++
  }
  return -1
}

/** Tira prefixos de grupo (?:, ?<!, ?=, ?!, ?<=) para chegar ao conteúdo. */
const semPrefixo = (corpo: string) => corpo.replace(/^\?(?:<[=!]|[:=!])/, '')

/** Ramos ancorados por um `\b` que começam ou terminam com letra acentuada. */
function ramosQuebrados(source: string): string[] {
  const problemas: string[] = []

  for (let i = 0; i < source.length - 1; i++) {
    if (source[i] !== '\\' || source[i + 1] !== 'b') continue

    // `\b` seguido direto de letra acentuada — o caso mais cru.
    const depois = source[i + 2]
    if (depois && acentuado(depois)) problemas.push(`\\b${source.slice(i + 2, i + 12)}`)

    // `\b(` — o `\b` vale para TODOS os ramos do grupo, inclusive os do meio.
    if (source[i + 2] === '(') {
      const fim = fechaGrupo(source, i + 2)
      if (fim > 0) {
        for (const r of ramos(semPrefixo(source.slice(i + 3, fim)))) {
          if (r && acentuado(r[0])) problemas.push(`\\b(…|${r.slice(0, 20)}`)
        }
      }
    }

    // `)\b` — mesma história, do outro lado.
    if (i > 0 && source[i - 1] === ')') {
      let abre = -1
      for (let j = i - 1; j >= 0; j--) {
        if (source[j] === '(' && fechaGrupo(source, j) === i - 1) {
          abre = j
          break
        }
      }
      if (abre >= 0) {
        for (const r of ramos(semPrefixo(source.slice(abre + 1, i - 1)))) {
          const ultima = r[r.length - 1]
          if (ultima && acentuado(ultima)) problemas.push(`${r.slice(-20)})\\b`)
        }
      }
    }
  }
  return [...new Set(problemas)]
}

describe('regras — nenhuma vedação desligada pelo \\b ASCII', () => {
  it.each(RULES.map((r) => [r.id, r] as const))(
    '%s: nenhum ramo acentuado pendurado num \\b',
    (_id, rule) => {
      expect(
        ramosQuebrados(rule.test.source),
        `a regra "${rule.id}" tem ramo acentuado ancorado em \\b — ele nunca vai casar. ` +
          `Troque o \\b por (?<![\\p{L}]) / (?![\\p{L}]) e ligue a flag u.`,
      ).toEqual([])
    },
  )

  // O parser acima é código: se ele parar de detectar, a trava vira enfeite.
  it('a checagem realmente pega o padrão que passou despercebido', () => {
    // Ramo acentuado no INICIO — o bug real de promise-result.
    expect(ramosQuebrados(String.raw`\b(êxito|exito|ganho)\b`)).not.toEqual([])
    expect(ramosQuebrados(String.raw`\bêxito garantido`)).not.toEqual([])
    // Ramo acentuado no FIM, do outro lado da ancora.
    expect(ramosQuebrados(String.raw`(ganho|até você)\b`)).not.toEqual([])

    // --- o que NAO pode virar alarme falso ---
    // Acento no MEIO da palavra: "análise" comeca com "a" simples e sempre casou.
    expect(ramosQuebrados(String.raw`\b(de graça|sem custo|análise gratuita)\b`)).toEqual([])
    expect(ramosQuebrados(String.raw`\b(melhor custo[- ]benefício|vagas limitadas)\b`)).toEqual([])
    // Grupo sem ancora nenhuma: nao ha fronteira para quebrar.
    expect(ramosQuebrados(String.raw`promo(?:ção|ções|cional)`)).toEqual([])
  })
})

// Prova de vida da vedação que estava desligada — e das formas sem acento, que é
// como muita gente digita. Se alguém reescrever as regexes e derrubá-las de novo,
// é aqui que aparece.
describe('as vedações acentuadas disparam de fato', () => {
  const dispara = (t: string, id: string) => checkCompliance(t).some((i) => i.ruleId === id)

  it.each([
    'Êxito garantido no seu processo',
    'Trabalho com êxito garantido',
    'Advocacia Êxito Garantido',
    'Exito garantido no seu processo',
    'Vitória garantida na sua causa',
  ])('"%s" dispara promise-result', (t) => {
    expect(dispara(t, 'promise-result')).toBe(true)
  })

  it.each(['Análise gratuita do seu caso', 'Analise gratuita do seu caso', 'Avaliação gratuita'])(
    '"%s" dispara free-bait',
    (t) => {
      expect(dispara(t, 'free-bait')).toBe(true)
    },
  )
})
