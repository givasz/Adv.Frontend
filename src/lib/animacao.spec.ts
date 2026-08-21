// Trava contra sanfona lenta.
//
// Animar `height: 0 ↔ auto` obriga o navegador a remedir o elemento e repintar
// tudo o que está abaixo dele, quadro a quadro, nos dois sentidos. Numa página com
// textura fixa (.grain) e sombras, isso é o suficiente para o toque parecer travado
// no celular: medido a 6x de estrangulamento de CPU, o pior quadro do FAQ do perfil
// era 100ms ao abrir, contra 17ms da sanfona de áreas, que não anima altura.
//
// A regra do projeto passou a ser: abrir e fechar é opacidade + alguns pixels de
// deslize, que o compositor resolve sozinho. Este teste existe porque o problema já
// voltou uma vez, numa tela diferente daquela em que foi corrigido.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = join(__dirname, '..')

function arquivosFonte(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivosFonte(caminho)
    return /\.(tsx|ts)$/.test(nome) && !nome.endsWith('.spec.ts') ? [caminho] : []
  })
}

const fontes = arquivosFonte(RAIZ).map((caminho) => ({
  caminho: caminho.slice(RAIZ.length + 1).replace(/\\/g, '/'),
  texto: readFileSync(caminho, 'utf8'),
}))

describe('nenhuma sanfona anima altura', () => {
  it('encontra os arquivos-fonte (o teste não pode passar por vasculhar nada)', () => {
    expect(fontes.length).toBeGreaterThan(30)
  })

  it('ninguém anima height para "auto"', () => {
    const culpados = fontes
      .filter((f) => /height:\s*'auto'/.test(f.texto))
      .map((f) => f.caminho)
    expect(culpados, 'use opacidade + deslize; ver o comentário no topo deste arquivo').toEqual([])
  })

  it('ninguém anima maxHeight, que tem o mesmo custo', () => {
    const culpados = fontes
      .filter((f) => /animate=\{[^}]*maxHeight|maxHeight:\s*'?(auto|\d)/.test(f.texto))
      .map((f) => f.caminho)
    expect(culpados, 'animar maxHeight refaz o layout igual a height').toEqual([])
  })
})
