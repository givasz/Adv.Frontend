// Camada de acesso a dados — trocável por chamadas reais ao NestJS.
//
// Hoje: mock em memória + localStorage, com latência simulada.
// Amanhã: basta implementar as mesmas assinaturas apontando para `/api/...`
// (o proxy do Vite já encaminha para o NestJS na porta 3333).

import { checkCompliance, hasBlockingIssue, POLICY_VERSION } from './oab'
import { generateWithOllama } from './localAi'
import { directorySeed, sampleProfile } from './mockData'
import type {
  DirectoryResult,
  GenerateRequest,
  GenerateResult,
  OabStatus,
  Profile,
} from './types'

const STORAGE_KEY = 'advocme:profile:draft'
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true'
// URL absoluta do backend (Render) em produção. Vazio em dev → usa caminho relativo
// `/api` que o proxy do Vite encaminha para localhost:3333. No Netlify, defina
// VITE_API_URL=https://<seu-backend>.onrender.com.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function loadDraft(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const draft = JSON.parse(raw) as Profile
      // backfill de campos novos em rascunhos antigos
      if (!draft.theme) draft.theme = 'papel'
      return draft
    }
  } catch {
    /* ignora storage corrompido */
  }
  return structuredClone(sampleProfile)
}

export const api = {
  async getProfile(slug: string): Promise<Profile | null> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/profiles/${slug}`)
      return res.ok ? res.json() : null
    }
    await wait(280)
    const draft = loadDraft()
    if (draft.slug === slug) return draft
    if (slug === sampleProfile.slug) return sampleProfile
    return null
  },

  async getDraft(): Promise<Profile> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/profiles/me`)
      return res.json()
    }
    await wait(120)
    return loadDraft()
  },

  async saveDraft(profile: Profile): Promise<Profile> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/profiles/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      return res.json()
    }
    await wait(200)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    return profile
  },

  // Solicita a conferência da OAB (não concede a marca — só a plataforma promove a 'verified').
  async requestOabCheck(): Promise<{ oabStatus: OabStatus }> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/profiles/me/oab/request`, { method: 'POST' })
      return res.json()
    }
    await wait(300)
    return { oabStatus: 'pending' }
  },

  async searchDirectory(query: string, area: string | null): Promise<DirectoryResult[]> {
    if (USE_REAL_API) {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (area) params.set('area', area)
      const res = await fetch(`${API_BASE}/api/directory?${params}`)
      return res.json()
    }
    await wait(240)
    const q = query.trim().toLowerCase()
    return directorySeed
      .filter((r) => {
        const matchesArea = !area || r.areas.includes(area)
        const matchesQuery =
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.areas.some((a) => a.toLowerCase().includes(q))
        return matchesArea && matchesQuery
      })
      // Critério objetivo e não-comercial (alfabético) — sem prioridade por plano.
      // Prov. 205/2021 Art.5º §1º veda destaque pago em rankings. Ver REGRAS.md §3.
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  },

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    // Usa a IA do backend quando (a) estamos em modo real, ou (b) há um backend
    // configurado (VITE_API_URL) — assim o front no Netlify usa o Claude via Render
    // mesmo com os perfis em localStorage. Sem backend (dev), cai no Ollama/template.
    if (USE_REAL_API || API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/api/ai/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        })
        if (res.ok) return res.json()
      } catch {
        /* backend indisponível → cai para Ollama/template abaixo */
      }
    }
    // ---- IA local (Ollama) com fallback para o gerador por template ----
    let text: string
    let usedFallback = false
    try {
      text = await generateWithOllama(req)
    } catch {
      // Ollama fora do ar / modelo ainda baixando → degrada para o template local
      await wait(600)
      text = draftText(req)
      usedFallback = true
    }
    // Guarda-corpo pós-geração: se o modelo escorregar e produzir termo bloqueante,
    // NÃO devolvemos esse texto — caímos no template seguro (Prov. 205/2021). Ver REGRAS.md.
    if (hasBlockingIssue(text)) {
      text = draftText(req)
      usedFallback = true
    }
    const issues = checkCompliance(text)
    return {
      text,
      complianceNotes: issues.map((i) => i.reason),
      usedFallback,
      policyVersion: POLICY_VERSION,
    }
  },
}

// Composição de rascunho OAB-safe a partir de palavras-chave.
// No backend, isto vira um prompt para o Claude com guardrails do Prov. 205/2021.
function draftText(req: GenerateRequest): string {
  const kw = req.keywords.map((k) => k.trim()).filter(Boolean)
  const list =
    kw.length > 1
      ? `${kw.slice(0, -1).join(', ')} e ${kw[kw.length - 1]}`
      : kw[0] ?? 'sua área de atuação'

  if (req.kind === 'area') {
    const area = req.areaLabel ?? 'esta área'
    return `Atuo em ${area} com foco em ${list}. Ofereço orientação clara sobre direitos e alternativas em cada etapa, buscando o caminho mais adequado a cada situação. O objetivo é que você compreenda o processo e tome decisões bem informadas.`
  }

  const name = req.name?.split(' ')[0]
  const opening = name ? `Sou ${name}, advogad(a) dedicad(a) a` : 'Dedico minha atuação a'
  return `${opening} ${list}. Meu trabalho une técnica e escuta para orientar cada pessoa sobre seus direitos e os caminhos possíveis, com informação transparente do início ao fim. Acredito em uma advocacia próxima, que reduz a insegurança de quem precisa de apoio jurídico.`
}
