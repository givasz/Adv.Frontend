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

export function fitToLimit(text: string, limit: number): string {
  const clean = text.trim()
  if (!limit || clean.length <= limit) return clean

  const cut = clean.slice(0, limit)
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
