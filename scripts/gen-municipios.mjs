// Gera src/lib/municipios.data.ts a partir da base oficial do IBGE.
//
// POR QUE UM ARQUIVO GERADO, E NÃO UMA CHAMADA À API DO IBGE NA HORA:
//
// 1. A lista de municípios do Brasil muda de década em década, não de hora em
//    hora. Buscar 5.570 nomes pela rede toda vez que alguém abre o editor é
//    pagar latência (e uma dependência externa que pode cair) por um dado que
//    é, na prática, constante.
// 2. O editor é onde o advogado escreve o perfil dele. Se o autocompletar de
//    cidade depender de um servidor de terceiro, ele some quando esse servidor
//    estiver fora do ar — e o campo volta a aceitar "São Paolo" em silêncio,
//    que é exatamente o problema que este recurso existe para resolver.
// 3. Nada do que o advogado digita sai da nossa origem. Um autocompletar que
//    manda cada tecla para servicodados.ibge.gov.br conta a um terceiro o que
//    ele está preenchendo.
//
// O custo é ~90 KB de texto, carregado sob demanda (import dinâmico em
// lib/municipios.ts) — só entra na rede de quem realmente abre um campo de
// cidade, nunca no pacote principal.
//
// Rodar: npm run municipios   (dentro de frontend/)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const FONTE = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'
const raiz = dirname(dirname(fileURLToPath(import.meta.url)))
const destino = resolve(raiz, 'src/lib/municipios.data.ts')

const res = await fetch(FONTE)
if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`)
const bruto = await res.json()

/** @type {Record<string, string[]>} */
const porUf = {}
for (const m of bruto) {
  // A sigla da UF aparece em dois caminhos diferentes do JSON do IBGE
  // (microrregiao e regiao-imediata). Alguns municípios têm um deles nulo —
  // por isso os dois, com o que vier primeiro.
  const uf =
    m?.microrregiao?.mesorregiao?.UF?.sigla ??
    m?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
  const nome = typeof m?.nome === 'string' ? m.nome.trim() : ''
  if (!uf || !nome) continue
  // O separador do formato compacto é "|": nenhum nome de município o contém,
  // mas conferir aqui é o que impede um dado novo de corromper a lista inteira
  // em silêncio.
  if (nome.includes('|')) throw new Error(`Nome com separador reservado: ${nome}`)
  ;(porUf[uf] ??= []).push(nome)
}

const ufs = Object.keys(porUf).sort()
if (ufs.length !== 27) throw new Error(`Esperava 27 UFs, vieram ${ufs.length}`)

let total = 0
const linhas = ufs.map((uf) => {
  const nomes = [...new Set(porUf[uf])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  total += nomes.length
  return `  ${uf}: ${JSON.stringify(nomes.join('|'))},`
})

const arquivo = `// ARQUIVO GERADO — não editar à mão.
// Fonte: IBGE (${FONTE})
// Gerado por: npm run municipios   ·   ${total} municípios em ${ufs.length} UFs.
//
// Formato compacto de propósito: um objeto com 5.570 strings soltas custa ~3x
// mais bytes em aspas e vírgulas do que 27 strings separadas por "|". Quem lê
// isto é lib/municipios.ts, que faz o split uma vez por UF e guarda o resultado.

export const MUNICIPIOS_POR_UF: Record<string, string> = {
${linhas.join('\n')}
}

/** Quantos municípios a base traz — usado pelo teste de sanidade. */
export const TOTAL_MUNICIPIOS = ${total}
`

writeFileSync(destino, arquivo, 'utf8')
console.log(`${destino}: ${total} municípios, ${ufs.length} UFs`)
