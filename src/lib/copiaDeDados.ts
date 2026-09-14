/**
 * Cópia profunda de dado puro — o que cabe num JSON: texto, número, lista, objeto.
 *
 * Não é `structuredClone`: ele só existe no Safari/iOS a partir do 15.4, e nos
 * iPhones anteriores o painel, o editor e o onboarding davam ReferenceError ao
 * abrir (achado em 13/09/2026). Os usos daqui — a configuração do assistente e o
 * documento do contrato — já são gravados como JSON, então a cópia por JSON é
 * exatamente o que esses dados aguentam.
 */
export function copiaDeDados<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}
