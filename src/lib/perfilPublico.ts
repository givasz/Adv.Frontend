// O caminho de dados do MINISITE — a única ida à rede que o visitante anônimo
// de um perfil precisa.
//
// Fica fora de lib/api.ts de propósito: aquele módulo importa o motor de
// conformidade OAB (oab.rules), a IA local, os mocks do editor e o escritório
// inteiro, e um import estático dele colocava tudo isso no pacote inicial de
// quem só veio ver um perfil pelo link. Aqui mora só o fetch; os caminhos que
// dependem do resto (fixtures de exemplo e o modo mock sem backend) delegam ao
// api.ts por import dinâmico — o visitante de um perfil real nunca o baixa.
import { API_BASE, TEM_BACKEND } from './http'
import type { Profile } from './types'

// Os SLUGS dos perfis-modelo do produto (fixtures de lib/mockData.ts). Só os
// slugs moram aqui: reconhecê-los é barato; os perfis em si (11KB de conteúdo)
// chegam por import dinâmico apenas quando um deles é aberto. A paridade com o
// mockData tem teste (perfilPublico.spec.ts) — divergir quebraria o "Ver um
// exemplo" da home em silêncio.
export const EXAMPLE_SLUGS = ['marina-sales', 'guilherme-sales23'] as const

export function isExampleSlug(slug: string): boolean {
  return (EXAMPLE_SLUGS as readonly string[]).includes(slug)
}

// O alfabeto de um slug NOSSO (o slugify do backend só emite isto). O que vem em
// `useParams` já chegou DECODIFICADO pelo router — um `/%2e%2e%2fx` vira `../x`
// aqui dentro, e sem a recusa + o encode a barra remontava o caminho da chamada.
const SLUG_RE = /^[a-z0-9-]{1,80}$/

export async function getPublicProfile(slug: string): Promise<Profile | null> {
  // O que não tem cara de slug não existe — decidido aqui, sem gastar rede.
  if (!SLUG_RE.test(slug)) return null
  if (!TEM_BACKEND || isExampleSlug(slug)) {
    const { api } = await import('./api')
    return api.getProfile(slug)
  }
  try {
    const res = await fetch(`${API_BASE}/api/profiles/${encodeURIComponent(slug)}`)
    return res.ok ? ((await res.json()) as Profile) : null
  } catch {
    return null // rede fora: o minisite mostra "não encontrado", não uma tela quebrada
  }
}
