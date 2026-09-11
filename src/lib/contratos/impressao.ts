// Impressão digital (SHA-256) de um arquivo — calculada no aparelho.
//
// O arquivo nunca sobe para o servidor. Nem para registrar, nem para conferir:
// o que viaja é esta sequência de 64 caracteres, da qual não se recupera uma
// letra do contrato.

/** SHA-256 em hexadecimal minúsculo. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copia = new Uint8Array(bytes.byteLength)
  copia.set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copia.buffer)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const EOF = [0x25, 0x25, 0x45, 0x4f, 0x46] // "%%EOF"
const MAX_TRECHOS = 11

/**
 * Onde terminam os PDFs "empilhados" dentro deste arquivo.
 *
 * Assinar um PDF com certificado (o assinador do gov.br, os de token ICP-Brasil)
 * não reescreve o arquivo: acrescenta a assinatura DEPOIS do fim do original, e
 * cada acréscimo termina com o seu próprio `%%EOF`. Então o arquivo registrado
 * continua ali, byte a byte, como o começo do arquivo assinado. Estas são as
 * posições candidatas a "fim do original" — logo depois de cada `%%EOF`, com ou
 * sem a quebra de linha que costuma segui-lo.
 */
export function finsDePdf(bytes: Uint8Array): number[] {
  const fins = new Set<number>()
  for (let i = 0; i + EOF.length <= bytes.length; i++) {
    if (bytes[i] !== 0x25) continue
    let igual = true
    for (let k = 1; k < EOF.length; k++) {
      if (bytes[i + k] !== EOF[k]) {
        igual = false
        break
      }
    }
    if (!igual) continue
    let fim = i + EOF.length
    fins.add(fim)
    if (bytes[fim] === 0x0d) fins.add(++fim)
    if (bytes[fim] === 0x0a) fins.add(++fim)
  }
  fins.delete(bytes.length)
  return [...fins].sort((a, b) => a - b).slice(0, MAX_TRECHOS)
}

export interface ImpressoesDoArquivo {
  inteiro: { hash: string; tamanho: number }
  /** hash de cada começo do arquivo que termina num fim de PDF */
  trechos: { hash: string; tamanho: number }[]
}

export async function impressoesParaConferir(bytes: Uint8Array): Promise<ImpressoesDoArquivo> {
  const inteiro = { hash: await sha256Hex(bytes), tamanho: bytes.length }
  const trechos = []
  for (const fim of finsDePdf(bytes)) {
    trechos.push({ hash: await sha256Hex(bytes.subarray(0, fim)), tamanho: fim })
  }
  return { inteiro, trechos }
}

export async function lerArquivo(arquivo: Blob): Promise<Uint8Array> {
  return new Uint8Array(await arquivo.arrayBuffer())
}
