// Navegador de dentro de aplicativo — onde o "Continuar com o Google" não funciona.
//
// O Google recusa a tela de login dentro de webview de aplicativo (erro 403
// "disallowed_useragent"): é a política dele contra app que poderia ler a senha
// digitada. E é justamente por onde muita gente chega ao advoc.me — o link na bio
// do Instagram abre DENTRO do Instagram (a mesma raiz de lib/whatsapp.ts, que
// abre o WhatsApp na mesma aba por causa dessa webview).
//
// Então, aí, o botão dá lugar a uma frase dizendo o que fazer. Um botão que leva
// a uma página de erro do Google, em inglês, é pior do que nenhum botão.

// Marcas que os próprios apps põem no user agent. `; wv)` é a do WebView genérico
// do Android, que é o que todo app sem marca própria usa por baixo.
const WEBVIEW_DE_APP =
  /\b(Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|LinkedInApp|musical_ly|TikTok|BytedanceWebview|Snapchat|Pinterest)\b|; wv\)/i

/** Este navegador é a webview de algum aplicativo? */
export function navegadorEmbutido(
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): boolean {
  return WEBVIEW_DE_APP.test(userAgent)
}
