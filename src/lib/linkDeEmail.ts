// O token dos links que mandamos por e-mail (confirmar e-mail, redefinir senha).
//
// Ele vem depois do `#` de propósito: o fragmento não viaja em requisição
// nenhuma. Não entra no log de acesso do Netlify, nem no cabeçalho Referer das
// fontes e imagens que a página carregar.
//
// Lido uma vez, sai da barra de endereço — não fica no histórico do navegador,
// nem num print da tela, nem no endereço que alguém copiar dali. Por isso a
// leitura guarda o valor: o React chama o inicializador do estado duas vezes em
// desenvolvimento, e a segunda chamada já não acharia o `#`.

let guardado: { caminho: string; token: string } | null = null

export function lerTokenDoLink(): string | null {
  if (typeof window === 'undefined') return null
  const caminho = window.location.pathname
  const achado = /(?:^#|&)t=([A-Za-z0-9_-]{43})(?:&|$)/.exec(window.location.hash)
  if (achado) {
    guardado = { caminho, token: achado[1]! }
    try {
      window.history.replaceState(window.history.state, '', caminho + window.location.search)
    } catch {
      /* navegador que não deixa: o token segue válido, só não sai da barra */
    }
  }
  return guardado?.caminho === caminho ? guardado.token : null
}

/** Link usado: esquece o token também da memória. */
export function esquecerTokenDoLink(): void {
  guardado = null
}
