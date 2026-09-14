// COMO ABRIR UM LINK QUE SAI DO advoc.me — WhatsApp, redes, mapa, CNA, agenda
// externa, LinkedIn de quem é do escritório.
//
// Perfil de advogado é link de bio: ele é aberto de dentro do Instagram, do
// Facebook, do LinkedIn. Esses aplicativos abrem páginas num navegador embutido
// (webview) que NÃO TEM ABAS — e, sem abas, `target="_blank"` costuma ser
// descartado sem erro, sem aviso e sem nada acontecer na tela.
//
// Foi corrigido primeiro no botão do WhatsApp (ver whatsapp.ts). As redes, o
// mapa, o CNA e a agenda externa ficaram com `_blank` fixo até 13/09/2026: quem
// chegava pelo Instagram tocava em "Instagram" e nada acontecia.
//
// A pergunta é a mesma para todos: isto é um dedo numa tela pequena? No celular,
// MESMA ABA — o app de destino (WhatsApp, Instagram, Maps) abre por cima e o
// "voltar" devolve ao perfil; aba nova só deixaria uma aba órfã para trás. No
// computador, aba nova: o perfil continua aberto atrás.

/**
 * É um dedo numa tela pequena?
 *
 * `(hover: none) and (pointer: coarse)` é a mesma pergunta que o CSS faz, e é
 * respondida pelo próprio navegador — não por uma lista de nomes de aplicativos
 * que envelhece. Todo navegador embutido de rede social é, por construção, um
 * navegador de celular, então esta única pergunta cobre o caso que quebrava.
 */
function noDedo(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches
  } catch {
    // Navegador antigo sem suporte à consulta: cai no comportamento de
    // computador, que é o que ele provavelmente é.
    return false
  }
}

/**
 * Os atributos prontos para espalhar na âncora de um link que sai do site.
 *
 * `rel` fica nos dois casos. Ele é inofensivo na mesma aba e, na aba nova, é o
 * que impede a página de destino de alcançar a nossa pelo `window.opener`.
 */
export function comoAbrirFora(): { target: '_self' | '_blank'; rel: string } {
  return noDedo()
    ? { target: '_self', rel: 'noreferrer noopener' }
    : { target: '_blank', rel: 'noreferrer noopener' }
}
