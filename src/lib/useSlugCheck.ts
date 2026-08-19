import { useEffect, useState } from 'react'
import { api, type SlugCheck } from './api'

// Consulta de endereço com atraso, para o editor e para o painel.
//
// Duas garantias que fazem a diferença entre informar e mentir:
//
//  • Enquanto a resposta não chega, o estado é `null` — a interface mostra
//    "conferindo", nunca "disponível". A afirmação otimista era justamente o
//    problema: o painel prometia um endereço sem ter perguntado a ninguém.
//  • Resposta de uma consulta antiga não sobrescreve uma nova. Sem isso, digitar
//    rápido faz a resposta do "givanildo-barbos" chegar depois da do
//    "givanildo-barbosa" e o rótulo passa a descrever outro endereço.

export interface SlugState {
  /** null enquanto consulta (ou quando a rede falhou) */
  available: boolean | null
  suggested: string
  checking: boolean
}

export function useSlugCheck(slug: string, name?: string, enabled = true): SlugState {
  const [state, setState] = useState<SlugState>({
    available: null,
    suggested: slug,
    checking: false,
  })

  useEffect(() => {
    if (!enabled || !slug.trim()) {
      setState({ available: null, suggested: slug, checking: false })
      return
    }
    let alive = true
    setState((s) => ({ ...s, checking: true }))
    const t = setTimeout(() => {
      api
        .checkSlug(slug, name)
        .then((r: SlugCheck) => {
          if (!alive) return // chegou tarde: já há uma consulta mais nova
          setState({ available: r.available, suggested: r.suggested, checking: false })
        })
        .catch(() => {
          if (alive) setState({ available: null, suggested: slug, checking: false })
        })
    }, 450)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [slug, name, enabled])

  return state
}
