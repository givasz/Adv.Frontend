// Cartão de visita — a MATEMÁTICA do giro, sem DOM.
//
// A prévia do cartão (components/editor/CardStage.tsx) deixa o advogado pegar o
// cartão e girar como faria com o de papel: arrasta, vira, inclina, confere o
// verso. Toda a conta que decide "que lado está de frente" e "onde o cartão
// para quando a pessoa solta" mora aqui, pura, para ter teste e para o
// componente ficar só com o que é de tela (ponteiro, transform, foco).
//
// Convenção: `yaw` é o giro em torno do eixo vertical, em GRAUS, sem limite —
// 0 é a frente, 180 é o verso, 360 é a frente de novo. Ele nunca é normalizado
// para 0–360: se a pessoa deu três voltas, o número guarda as três voltas e a
// animação entre um valor e outro segue sempre pelo caminho que ela puxou.
// `pitch` é a inclinação (eixo horizontal), limitada para o cartão não virar
// de cabeça para baixo nem sumir de perfil.

import type { CardSide } from './cardArt'

/** Graus de giro por pixel arrastado. Meia volta em ~360 px: o cartão inteiro. */
export const GRAUS_POR_PX = 0.5
/** Inclinação máxima, em graus, para cada lado. */
export const INCLINACAO_MAX = 28
/** Abaixo disto o gesto não é arrasto, é toque — e toque vira o cartão. */
export const TOQUE_MAX_PX = 5
/**
 * Quanto a velocidade do arrasto (graus/ms) pesa na decisão de onde parar.
 * Um puxão rápido e curto ainda vira o cartão; um arrasto lento e curto volta.
 */
export const INERCIA_MS = 140

/** Qual face está voltada para quem olha, dado o giro. */
export function ladoDoGiro(yaw: number): CardSide {
  // Cada face ocupa um "quadrante" de 180°, centrado em 0 (frente) e 180 (verso).
  const voltas = Math.round(yaw / 180)
  return ((voltas % 2) + 2) % 2 === 0 ? 'frente' : 'verso'
}

/** Mantém a inclinação dentro do limite. */
export function limitarInclinacao(pitch: number): number {
  return Math.max(-INCLINACAO_MAX, Math.min(INCLINACAO_MAX, pitch))
}

/**
 * Onde o cartão para depois que a pessoa solta: na face mais próxima do ponto
 * para onde o movimento estava indo, contando a velocidade.
 */
export function encaixarGiro(yaw: number, velocidade = 0): number {
  const projetado = yaw + velocidade * INERCIA_MS
  return Math.round(projetado / 180) * 180
}

/**
 * O giro mais curto, a partir de `yaw`, que mostra o lado pedido. Se já está
 * nele, só encaixa; se não, avança meia volta no sentido em que já vinha girando
 * (ou para a direita, quando parado).
 */
export function giroParaLado(yaw: number, lado: CardSide, sentido: 1 | -1 = 1): number {
  const base = encaixarGiro(yaw)
  return ladoDoGiro(base) === lado ? base : base + 180 * sentido
}

/**
 * Deslocamento do brilho que passa pelo papel enquanto ele gira, em fração da
 * largura da face (-1 … 1). Só dá a sensação de material — de longe, um cartão
 * em movimento reflete a luz; parado, não.
 */
export function brilhoDoGiro(yaw: number): number {
  return Math.sin((yaw * Math.PI) / 180)
}
