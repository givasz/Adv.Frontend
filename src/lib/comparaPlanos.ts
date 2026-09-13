// A LEITURA da tabela comparativa — o que muda de um plano para o seguinte.
//
// A tabela (lib/planOffer.ts, PLAN_COMPARE) diz o valor de cada plano. No
// celular ela não cabe lado a lado: três colunas de plano mais a do recurso
// viravam uma janela que rolava de lado, com o Free cortado ao meio e Pro e Max
// escondidos atrás de um "deslize para ver". A comparação em si sumia.
//
// Então o celular mostra UM plano por vez — e a comparação volta por dois
// caminhos, calculados aqui a partir das mesmas células, nunca digitados:
//   • a RÉGUA: todo limite numérico vira uma barra na escala do maior plano,
//     então "600 caracteres" aparece como o que é, perto dos 1.200 do Max;
//   • o GANHO: o que este plano acrescenta ao anterior ("novo", "+360").
//
// Módulo puro, sem React: é testado sem navegador (comparaPlanos.spec.ts).
import type { Plan } from './types'
import { PLAN_COMPARE, type CompareGroup, type CompareRow, type CompareValue } from './planOffer'

/** Os planos da tabela, na ordem da escada. */
export const PLANOS_COMPARADOS: Plan[] = ['free', 'pro', 'premium']

/** O degrau abaixo. O Free não tem — é o chão. */
export function planoAnterior(p: Plan): Plan | null {
  const i = PLANOS_COMPARADOS.indexOf(p)
  return i > 0 ? PLANOS_COMPARADOS[i - 1] : null
}

/**
 * O número de uma célula, quando ela é um LIMITE.
 *
 * `false` conta como zero ("não tem nenhuma"), e é o que deixa a linha de
 * perguntas frequentes virar régua mesmo com um plano sem o recurso. `true` e
 * texto não são número: "3 de 8" diz a quantidade junto com o total, e medir
 * isso numa barra seria inventar uma escala que a célula não tem.
 */
export function numeroDaCelula(v: CompareValue): number | null {
  if (v === false) return 0
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim())
  return null
}

/**
 * A escala da régua desta linha: o maior valor entre os planos. `null` quando a
 * linha não é de limites (alguma célula não é número) ou quando ninguém tem nada.
 */
export function escalaDaLinha(row: CompareRow): number | null {
  const numeros = PLANOS_COMPARADOS.map((p) => numeroDaCelula(row.values[p]))
  if (numeros.some((n) => n === null)) return null
  const maior = Math.max(...(numeros as number[]))
  return maior > 0 ? maior : null
}

export type Ganho = { tipo: 'novo' } | { tipo: 'mais'; delta: number }

/**
 * O que ESTE plano acrescenta ao anterior nesta linha.
 *
 * Só marca o que é ganho sem discussão: um recurso que passa a existir
 * (`false` → `true`, ou zero → algum) e um limite que sobe. Mudança de TEXTO não
 * ganha marca — e não por preguiça: "Cartão de crédito para começar" vai de
 * "não pede" a ✓ no Pro, e carimbar "novo" ali anunciaria como vantagem o fato
 * de o plano pago pedir cartão.
 */
export function ganhoSobreAnterior(row: CompareRow, p: Plan): Ganho | null {
  const anterior = planoAnterior(p)
  if (!anterior || row.emPreparo) return null
  const antes = row.values[anterior]
  const agora = row.values[p]
  if (antes === false && agora === true) return { tipo: 'novo' }
  if (typeof agora !== 'string') return null
  const a = numeroDaCelula(antes)
  const b = numeroDaCelula(agora)
  if (a === null || b === null || b <= a) return null
  return a === 0 ? { tipo: 'novo' } : { tipo: 'mais', delta: b - a }
}

/** Quantas linhas da tabela este plano melhora em relação ao anterior. */
export function ganhosDoPlano(p: Plan, grupos: CompareGroup[] = PLAN_COMPARE): number {
  return grupos.reduce(
    (total, g) => total + g.rows.filter((r) => ganhoSobreAnterior(r, p) !== null).length,
    0,
  )
}

/**
 * Os grupos a desenhar. Com `soOQueMuda`, só as linhas que este plano melhora —
 * e o grupo que fica sem linha nenhuma some inteiro, em vez de sobrar um título
 * pendurado sobre o nada. No Free o filtro não se aplica: não há degrau abaixo.
 */
export function gruposVisiveis(
  p: Plan,
  soOQueMuda: boolean,
  grupos: CompareGroup[] = PLAN_COMPARE,
): CompareGroup[] {
  if (!soOQueMuda || !planoAnterior(p)) return grupos
  return grupos
    .map((g) => ({ ...g, rows: g.rows.filter((r) => ganhoSobreAnterior(r, p) !== null) }))
    .filter((g) => g.rows.length > 0)
}
