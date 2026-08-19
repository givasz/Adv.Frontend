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
 * Marca comercial do endereço, para textos de VENDA ("Endereço advoc.me/seu-nome").
 * Nunca use para gerar link, QR ou vCard — para isso existe profileUrl().
 */
export const BRAND_HOST = 'advoc.me'
