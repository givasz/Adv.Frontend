// Endereço PÚBLICO de um perfil — o que é impresso no QR Code, copiado no botão
// de compartilhar e gravado no vCard.
//
// `advoc.me` é o NOME do produto, não um domínio no ar. O cartão digital gerava o
// QR apontando para `https://advoc.me/<slug>`, e escanear não abria nada: o
// código levava a um site que não existe. Aqui a verdade é a origem em que o app
// está sendo servido (advocme.netlify.app hoje, o domínio próprio amanhã).
//
// Quando o domínio existir, basta definir VITE_PUBLIC_ORIGIN=https://advoc.me no
// painel do Netlify — nenhuma linha de código muda.

const CONFIGURED = (import.meta.env.VITE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '')

/** Origem real do perfil público (sem barra final). */
export function publicOrigin(): string {
  if (CONFIGURED) return CONFIGURED
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** URL completa e CLICÁVEL do perfil — é esta que vai para o QR e para o vCard. */
export function profileUrl(slug: string): string {
  return `${publicOrigin()}/${slug}`
}

/**
 * A mesma URL sem o esquema, para exibir. Mostrar exatamente o que o QR carrega
 * evita a pior versão do bug: o rótulo dizer um endereço e o código levar a outro.
 */
export function profileUrlLabel(slug: string): string {
  return profileUrl(slug).replace(/^https?:\/\//, '')
}

/**
 * O HOST em que os perfis realmente vivem — para telas que mostram o endereço da
 * pessoa ("seu endereço é ___/joao-silva") e para o prefixo do campo de endereço.
 *
 * Existia aqui um `BRAND_HOST = 'advoc.me'` "para textos de venda". Ele vazou
 * para três telas do editor, que passaram a dizer ao advogado que o endereço
 * dele era `advoc.me/joao-silva` — um endereço que não abre. Quem copiasse dali
 * compartilharia um link morto com um cliente. A marca é `advoc.me`; o ENDEREÇO
 * é o que este arquivo devolve, e são coisas diferentes até o domínio existir.
 */
export function hostLabel(): string {
  return publicOrigin().replace(/^https?:\/\//, '')
}
