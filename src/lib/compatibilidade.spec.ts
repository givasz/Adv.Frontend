import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkCompliance } from './oab'
import { conferirPergunta } from './triagemDados'

// Travas do que já quebrou em navegador de verdade — e que nenhum teste em Node
// pegaria sozinho, porque o Node entende tudo isto.

/** Todo .ts/.tsx de src/, fora os testes. */
function fontes(): { arquivo: string; texto: string }[] {
  const raiz = join(__dirname, '..')
  const saida: { arquivo: string; texto: string }[] = []
  const andar = (pasta: string) => {
    for (const item of readdirSync(pasta, { withFileTypes: true })) {
      const caminho = join(pasta, item.name)
      if (item.isDirectory()) andar(caminho)
      else if (/\.tsx?$/.test(item.name) && !/\.spec\.tsx?$/.test(item.name)) {
        saida.push({ arquivo: caminho.slice(raiz.length + 1), texto: readFileSync(caminho, 'utf-8') })
      }
    }
  }
  andar(raiz)
  return saida
}

describe('compatibilidade com navegadores', () => {
  // O Safari/iOS só entende lookbehind a partir do 16.4 (março de 2023). O build
  // tem alvo safari14, e o esbuild reescreve essas regex como `new RegExp(...)` —
  // que nos iPhones anteriores lança SyntaxError ao carregar o pedaço e derruba a
  // página inteira: home, assistente, denúncia, compartilhar, painel, editor.
  // Achado em 13/09/2026 simulando o iPhone antigo contra produção.
  it('nenhuma regex com lookbehind em src/', () => {
    const comLookbehind = fontes()
      .filter(({ texto }) => texto.includes('(?<!') || texto.includes('(?<='))
      .map(({ arquivo }) => arquivo)
    expect(comLookbehind).toEqual([])
  })

  it('o aviso mostra o trecho sem o separador que a fronteira engole', () => {
    const [isca] = checkCompliance('Atendimento (de graça) para todos')
    expect(isca?.ruleId).toBe('free-bait')
    expect(isca?.matchedText).toBe('de graça')

    // Número no começo do trecho não é separador: "100%" segue inteiro.
    const promessa = checkCompliance('Garantia: 100% de acerto').find((i) => i.ruleId === 'promise-result')
    expect(promessa?.matchedText).toBe('100%')

    expect(conferirPergunta('Pode mandar o (cpf)?')[0]?.trecho).toBe('cpf')
  })
})
