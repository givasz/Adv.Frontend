// SEO local automático — gera título, meta description, Open Graph e JSON-LD
// (schema.org/Attorney) a partir do perfil, sem o advogado precisar entender de SEO.
//
// O texto gerado é FACTUAL e informativo ("Advogada de Direito de Família em São
// Paulo/SP") — descrição geográfica/de área é permitida pelo Prov. 205/2021. Não
// injetamos superlativos, promessas nem CTA.

import type { Profile } from './types'

const MANAGED = 'data-advocme-seo'

/** Frase de SEO factual: "Advogado(a) de [áreas] em [cidade]/[UF]". */
export function seoTitle(p: Profile): string {
  const areas = p.areas.map((a) => a.label).filter(Boolean)
  const areaPart = areas.length ? ` de ${areas.slice(0, 2).join(' e ')}` : ''
  const local = [p.city, p.state].filter(Boolean).join('/')
  const localPart = local ? ` em ${local}` : ''
  return `${p.name} — Advogado(a)${areaPart}${localPart}`
}

export function seoDescription(p: Profile): string {
  const areas = p.areas.map((a) => a.label).filter(Boolean)
  const local = [p.city, p.state].filter(Boolean).join('/')
  const areaPart = areas.length ? `Atuação em ${areas.slice(0, 3).join(', ')}. ` : ''
  const localPart = local ? `Atendimento em ${local}. ` : ''
  const base = `${areaPart}${localPart}${p.oabNumber}.`.trim()
  // fallback para a headline/bio se faltar dado estruturado
  return base.length > 12 ? base : p.headline || p.bio.slice(0, 150)
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    el.setAttribute(MANAGED, '')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function attorneyJsonLd(p: Profile, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Attorney',
    name: p.name,
    description: seoDescription(p),
    url,
    ...(p.avatarUrl ? { image: p.avatarUrl } : {}),
    areaServed: [p.city, p.state].filter(Boolean).join(', ') || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: p.city || undefined,
      addressRegion: p.state || undefined,
      addressCountry: 'BR',
    },
    knowsAbout: p.areas.map((a) => a.label).filter(Boolean),
    ...(p.contact.email ? { email: p.contact.email } : {}),
  }
}

/**
 * Aplica o SEO do perfil ao <head> e devolve uma função de limpeza (para o
 * useEffect do React remover ao trocar de perfil).
 */
export function applyProfileSeo(p: Profile, url = window.location.href): () => void {
  const title = seoTitle(p)
  const description = seoDescription(p)
  document.title = `${title} · advoc.me`

  upsertMeta('name', 'description', description)
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:type', 'profile')
  upsertMeta('property', 'og:url', url)
  if (p.avatarUrl) upsertMeta('property', 'og:image', p.avatarUrl)
  upsertMeta('name', 'twitter:card', 'summary')

  const ld = document.createElement('script')
  ld.type = 'application/ld+json'
  ld.setAttribute(MANAGED, '')
  ld.textContent = JSON.stringify(attorneyJsonLd(p, url))
  document.head.appendChild(ld)

  return () => {
    document.head.querySelectorAll(`[${MANAGED}]`).forEach((n) => n.remove())
  }
}
