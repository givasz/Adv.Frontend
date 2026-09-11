// Código de registro — "AVM-7K2P-9QXD", impresso no rodapé de cada página.
//
// É sorteado no APARELHO, antes de o PDF existir: o rodapé faz parte do arquivo,
// e a impressão digital cobre o arquivo inteiro — então o código tem de estar lá
// antes do hash ser calculado. Se por azar ele já estiver em uso, o servidor
// responde 409 e o aparelho sorteia outro (ver registros.ts).
//
// Alfabeto de Crockford: sem I, L, O e U, que se confundem com 1, 0 e V quando
// alguém lê o código em voz alta ao telefone.

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Espelha CODIGO_DE_REGISTRO de backend/src/contratos/modelos.ts. */
export const CODIGO_DE_REGISTRO = /^AVM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

export function sortearCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  // 256 é múltiplo de 32: o resto da divisão não favorece símbolo nenhum.
  const s = Array.from(bytes, (b) => ALFABETO[b % 32]).join('')
  return `AVM-${s.slice(0, 4)}-${s.slice(4)}`
}

/** A impressão digital em quatro blocos de 16, para caber numa tela de celular. */
export function hashEmBlocos(hash: string): string[] {
  return hash.match(/.{1,16}/g) ?? []
}
