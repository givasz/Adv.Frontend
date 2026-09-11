// O que cabe no PDF.
//
// O PDF usa as fontes-padrão do formato (Times), que qualquer leitor de PDF
// tem — nada de fonte embutida para pesar o arquivo. O preço é o conjunto de
// caracteres: o do Windows-1252, que cobre todo o português (acentos, ç, º, ª,
// §, aspas curvas, travessão) e deixa de fora emoji, setas e símbolos.
//
// O texto da tela e o do PDF têm de ser o MESMO texto. Por isso a revisão avisa
// quando algo não vai sair — trocar em silêncio por "?" seria registrar um
// arquivo diferente do que o advogado leu e aprovou.

// Os 27 caracteres que o Windows-1252 põe entre 0x80 e 0x9F.
const EXTRAS_1252 = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

function cabe(ch: string): boolean {
  const cp = ch.codePointAt(0)!
  return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || EXTRAS_1252.has(ch)
}

/**
 * Normaliza sem mudar o sentido: acentos decompostos viram compostos (texto
 * colado do Mac chega assim), hífens e espaços tipográficos viram os comuns, e
 * caracteres invisíveis saem.
 */
export function normalizarTexto(texto: string): string {
  return (texto ?? '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[​-‍⁠﻿­]/g, '')
    .replace(/[‐-‒−]/g, '-')
    .replace(/[ -   ]/g, ' ')
    .replace(/′/g, "'")
    .replace(/″/g, '"')
}

/** Caracteres (únicos) que não sairiam no PDF. */
export function caracteresSemImpressao(texto: string): string[] {
  const achados = new Set<string>()
  for (const ch of normalizarTexto(texto)) {
    if (ch !== '\n' && !cabe(ch)) achados.add(ch)
  }
  return [...achados]
}
