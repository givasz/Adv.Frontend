// Ajuste de texto ao limite de caracteres do campo.
//
// O editor impede DIGITAR além do limite (maxLength), mas texto vindo da IA entra
// pelo estado e escapava dessa trava: o servidor recusava o save inteiro com
// "excede o limite de N caracteres" e o advogado ficava com um perfil que não
// grava — sem ter feito nada de errado.
//
// Cortar no meio de uma frase é pior que não cortar, então a ordem é:
//   1) cabe inteiro → devolve como está;
//   2) termina na última frase completa que couber;
//   3) sem frase completa, termina na última palavra inteira.
// ⚠️ MANTER EM SINCRONIA com fitToLimit em backend/src/ai/ai.service.ts.

/**
 * Corta em `max` unidades sem partir um emoji ao meio.
 *
 * `String.slice` conta unidades UTF-16, e um emoji ocupa duas. Cortar entre elas
 * deixa meia letra solta — e meia letra solta faz o `encodeURIComponent` lançar
 * URIError: a conversa do assistente caía inteira ao montar o link do WhatsApp.
 * No iPhone isso acontece de verdade, porque o `maxlength` do WebKit conta o que
 * a pessoa vê (um emoji = 1) e o texto chega aqui maior do que o limite.
 */
export function cortarSemPartir(texto: string, max: number): string {
  if (texto.length <= max) return texto
  const corte = texto.slice(0, Math.max(max, 0))
  const ultima = corte.charCodeAt(corte.length - 1)
  return ultima >= 0xd800 && ultima <= 0xdbff ? corte.slice(0, -1) : corte
}

/**
 * Tira a meia letra solta (metade de emoji sem o par) de um texto que alguém
 * cortou no meio em outro lugar. É o que vai antes de todo `encodeURIComponent`
 * de texto digitado — ele lança URIError com ela, e derruba a tela junto.
 */
export function semMeiaLetra(texto: string): string {
  let saida = ''
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) {
      const par = texto.charCodeAt(i + 1)
      if (par >= 0xdc00 && par <= 0xdfff) saida += texto[i]! + texto[++i]!
      continue
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue
    saida += texto[i]!
  }
  return saida
}

export function fitToLimit(text: string, limit: number): string {
  const clean = text.trim()
  if (!limit || clean.length <= limit) return clean

  const cut = cortarSemPartir(clean, limit)
  // Última pontuação de fim de frase dentro do limite.
  const lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  const endsClean = /[.!?]$/.test(cut)
  if (endsClean) return cut.trim()
  // Só vale a pena cortar por frase se sobrar a maior parte do texto — senão o
  // resultado fica curto demais e perde o sentido.
  if (lastSentence > limit * 0.5) return cut.slice(0, lastSentence + 1).trim()

  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()
}
