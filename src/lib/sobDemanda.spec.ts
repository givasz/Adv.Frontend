import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { carregarComRecarga, JANELA_MS, tentarRecarregar, type Ambiente } from './sobDemanda'

// Navegador de mentira: relógio parado, marca em memória e recargas contadas.
function navegador({
  agora,
  marca = null,
  armazenamento = true,
}: {
  agora: number
  marca?: number | null
  armazenamento?: boolean
}) {
  const estado = { marca, recargas: 0 }
  const amb: Ambiente = {
    agora: () => agora,
    lerMarca: () => estado.marca,
    gravarMarca: (quando) => {
      if (!armazenamento) return false
      estado.marca = quando
      return true
    },
    recarregar: () => {
      estado.recargas++
    },
  }
  return { amb, estado }
}

// O erro que o Chrome dá quando o Netlify responde o index.html no lugar do pedaço.
const PEDACO_SUMIU = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
const T0 = 1_757_800_000_000

describe('sobDemanda', () => {
  it('pedaço sumiu num deploy: recarrega uma vez e segura a tela até a página ir embora', async () => {
    const { amb, estado } = navegador({ agora: T0 })
    let terminou = false
    const fim = () => {
      terminou = true
    }
    void carregarComRecarga(PEDACO_SUMIU, amb).then(fim, fim)
    await new Promise((r) => setTimeout(r, 0))
    expect(estado).toEqual({ marca: T0, recargas: 1 })
    expect(terminou).toBe(false)
  })

  it('falhou de novo logo depois da recarga: entrega o erro à tela de falha, sem laço', async () => {
    const { amb, estado } = navegador({ agora: T0 + JANELA_MS - 1, marca: T0 })
    await expect(carregarComRecarga(PEDACO_SUMIU, amb)).rejects.toThrow('Failed to fetch')
    expect(estado.recargas).toBe(0)
  })

  it('passada a janela, um deploy novo volta a ter direito à recarga', () => {
    const { amb, estado } = navegador({ agora: T0 + JANELA_MS, marca: T0 })
    expect(tentarRecarregar(amb)).toBe(true)
    expect(estado).toEqual({ marca: T0 + JANELA_MS, recargas: 1 })
  })

  it('sem sessionStorage não recarrega: sem a marca, a recarga viraria laço', async () => {
    const { amb, estado } = navegador({ agora: T0, armazenamento: false })
    await expect(carregarComRecarga(PEDACO_SUMIU, amb)).rejects.toThrow()
    expect(estado.recargas).toBe(0)
  })

  it('relógio que voltou não trava a recarga', () => {
    const { amb, estado } = navegador({ agora: T0, marca: T0 + 60_000 })
    expect(tentarRecarregar(amb)).toBe(true)
    expect(estado.recargas).toBe(1)
  })

  it('import que dá certo passa direto, sem tocar na marca', async () => {
    const { amb, estado } = navegador({ agora: T0 })
    await expect(carregarComRecarga(() => Promise.resolve({ default: 'ok' }), amb)).resolves.toEqual({
      default: 'ok',
    })
    expect(estado).toEqual({ marca: null, recargas: 0 })
  })

  // Trava: uma página nova com `lazy` cru volta a deixar a tela vazia depois de
  // todo deploy — e só para quem estava com a aba aberta, que é quem não avisa.
  it('nenhum lazy cru em src/', () => {
    const raiz = join(__dirname, '..')
    const arquivos: string[] = []
    const andar = (pasta: string) => {
      for (const item of readdirSync(pasta, { withFileTypes: true })) {
        const caminho = join(pasta, item.name)
        if (item.isDirectory()) andar(caminho)
        else if (/\.tsx?$/.test(item.name) && !/\.spec\.tsx?$/.test(item.name) && item.name !== 'sobDemanda.ts') {
          arquivos.push(caminho)
        }
      }
    }
    andar(raiz)
    const crus = arquivos.filter((f) => /\blazy\(/.test(readFileSync(f, 'utf-8')))
    expect(crus).toEqual([])
  })
})
