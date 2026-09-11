// Números por extenso — "R$ 5.000,00 (cinco mil reais)".
//
// Em contrato, o valor escrito por extenso é o que desempata quando o número foi
// digitado errado. Deixar o advogado escrevê-lo à mão é pedir a divergência que
// ele existe para evitar: "R$ 15.000,00 (cinco mil reais)". Aqui os dois saem do
// MESMO número, sempre.

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const UNIDADES_F = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_DEZENOVE = [
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
]
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos',
  'oitocentos', 'novecentos',
]

interface Opcoes {
  /** "duas parcelas", "duzentas" — concordância com substantivo feminino */
  feminino?: boolean
}

/** 0–999, sem o "e" de ligação com grupos maiores. */
function ate999(n: number, feminino: boolean): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c) {
    let centena = CENTENAS[c]!
    if (feminino && c > 1) centena = centena.replace(/os$/, 'as')
    partes.push(centena)
  }
  if (resto >= 10 && resto < 20) {
    partes.push(DEZ_A_DEZENOVE[resto - 10]!)
  } else {
    const d = Math.floor(resto / 10)
    const u = resto % 10
    if (d) partes.push(DEZENAS[d]!)
    if (u) partes.push((feminino ? UNIDADES_F : UNIDADES)[u]!)
  }
  return partes.join(' e ')
}

const GRUPOS: [singular: string, plural: string][] = [
  ['', ''],
  ['mil', 'mil'],
  ['milhão', 'milhões'],
  ['bilhão', 'bilhões'],
]

/**
 * Inteiro por extenso, de 0 a 999.999.999.999.
 *
 * A ligação entre os grupos segue o uso: "mil e cem", "mil e cinco", "mil
 * duzentos e cinquenta", "um milhão e quinhentos mil", "dois milhões, trezentos
 * mil e quarenta".
 */
export function numeroPorExtenso(valor: number, opcoes: Opcoes = {}): string {
  const n = Math.floor(Math.abs(valor))
  if (!Number.isFinite(n) || n > 999_999_999_999) throw new RangeError('Número fora do intervalo')
  if (n === 0) return 'zero'

  const grupos: number[] = []
  for (let r = n; r > 0; r = Math.floor(r / 1000)) grupos.push(r % 1000)

  const pedacos: { texto: string; valor: number }[] = []
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i]!
    if (!g) continue
    // O gênero só alcança o grupo das unidades e o dos milhares ("duas mil"
    // soa errado, mas "duzentas mil parcelas" é o certo). Milhão é masculino.
    const fem = !!opcoes.feminino && i <= 1
    let texto: string
    if (i === 0) texto = ate999(g, fem)
    else if (i === 1) texto = g === 1 ? 'mil' : `${ate999(g, fem)} mil`
    else texto = `${ate999(g, false)} ${g === 1 ? GRUPOS[i]![0] : GRUPOS[i]![1]}`
    pedacos.push({ texto, valor: g })
  }

  return pedacos
    .map((p, idx) => {
      if (idx === 0) return p.texto
      const ultimo = idx === pedacos.length - 1
      // "e" antes do último grupo quando ele é redondo (cem, duzentos) ou menor
      // que cem; nos demais casos, o grupo entra direto.
      const liga = ultimo && (p.valor < 100 || p.valor % 100 === 0) ? ' e ' : ultimo ? ' ' : ', '
      return `${liga}${p.texto}`
    })
    .join('')
}

/** Valor em centavos por extenso: "mil e quinhentos reais e cinquenta centavos". */
export function reaisPorExtenso(centavos: number): string {
  const total = Math.round(Math.abs(centavos))
  const reais = Math.floor(total / 100)
  const cents = total % 100
  const partes: string[] = []
  if (reais > 0) {
    const texto = numeroPorExtenso(reais)
    // "um milhão DE reais" — quando o número termina em milhão/bilhão redondo.
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? ' de' : ''
    partes.push(`${texto}${de} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (cents > 0) partes.push(`${numeroPorExtenso(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`)
  if (!partes.length) return 'zero real'
  return partes.join(' e ')
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "R$ 1.500,50" (com espaço não separável entre o símbolo e o número). */
export function formatarReais(centavos: number): string {
  return BRL.format(centavos / 100)
}

/** "R$ 1.500,50 (mil e quinhentos reais e cinquenta centavos)" */
export function reaisComExtenso(centavos: number): string {
  return `${formatarReais(centavos)} (${reaisPorExtenso(centavos)})`
}

/**
 * Lê o que foi digitado num campo de dinheiro. Aceita "5000", "5.000", "5.000,00",
 * "R$ 5.000,50" e "5000.5". Devolve centavos, ou `null` se não há número.
 *
 * O ponto é ambíguo ("5.000" é cinco mil; "5000.5" é cinco mil e cinquenta
 * centavos). A regra: com vírgula, a vírgula é o decimal; sem vírgula, um ponto
 * seguido de exatamente três dígitos é milhar, qualquer outro é decimal.
 */
export function lerReais(texto: string): number | null {
  let t = (texto ?? '').replace(/[^\d.,]/g, '')
  if (!/\d/.test(t)) return null
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.')
  } else if (/\.\d{3}(\.|$)/.test(t)) {
    t = t.replace(/\./g, '')
  }
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}
