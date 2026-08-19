// Camada de acesso a dados — trocável por chamadas reais ao NestJS.
//
// Hoje: mock em memória + localStorage, com latência simulada.
// Amanhã: basta implementar as mesmas assinaturas apontando para `/api/...`
// (o proxy do Vite já encaminha para o NestJS na porta 3333).

import { authHeader } from './auth'
import { checkCompliance, hasBlockingIssue, POLICY_VERSION } from './oab'
import { generateWithOllama } from './localAi'
import { directorySeed, exampleProfiles, sampleProfile } from './mockData'
import { getFirm as getMockFirm, slugifyFirm, type Firm } from './escritorio'
import { DEFAULT_BOOKING_CONFIG, resolveSchedulingMode } from './booking'
import { DEFAULT_ASSISTANT_CONFIG } from './assistant'
import type {
  Availability,
  Booking,
  DirectoryResult,
  GenerateRequest,
  GenerateResult,
  OabStatus,
  Profile,
  ReportReason,
} from './types'

const STORAGE_KEY = 'advocme:profile:draft'
const FIRM_KEY = 'advocme:firm:draft'
const BOOKINGS_KEY = 'advocme:bookings'

// ---- Mock de agenda (localStorage) — espelha o backend BookingsService ----
type StoredBooking = Booking & { profileSlug: string }

function loadBookings(): StoredBooking[] {
  try {
    const raw = localStorage.getItem(BOOKINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function saveBookings(list: StoredBooking[]) {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list))
}
// Resolve o perfil (rascunho ou modelo) por slug para ler a config da agenda.
function profileForSlug(slug: string): Profile | null {
  const draft = loadDraft()
  if (draft.slug === slug) return draft
  return exampleProfiles.find((p) => p.slug === slug) ?? null
}

function loadFirmDraft(): Firm | null {
  try {
    const raw = localStorage.getItem(FIRM_KEY)
    return raw ? (JSON.parse(raw) as Firm) : null
  } catch {
    return null
  }
}
// URL absoluta do backend (Render) em produção. Vazio em dev → usa caminho relativo
// `/api` que o proxy do Vite encaminha para localhost:3333. No Netlify, defina
// VITE_API_URL=https://<seu-backend>.onrender.com.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
// Modo real (backend) quando explicitamente ligado OU quando há um backend
// configurado (VITE_API_URL) — assim o deploy no Netlify usa o Render de ponta a
// ponta (perfis, conta, IA), sem localStorage. Em dev sem VITE_API_URL, segue mock.
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true' || !!API_BASE

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Rascunho novo nasce VAZIO — o perfil só mostra o que o advogado preencher.
// Nunca clonar o perfil-modelo (Marina): isso vazava áreas/experiência/contato dela.
function emptyDraft(): Profile {
  return {
    slug: '',
    name: '',
    oabNumber: '',
    oabVerified: false,
    oabStatus: 'none',
    headline: '',
    bio: '',
    city: '',
    state: '',
    serviceMode: { inPerson: true, online: true },
    areas: [],
    highlights: [],
    articles: [],
    socials: [],
    contact: {},
    schedulingMode: 'off',
    booking: { ...DEFAULT_BOOKING_CONFIG },
    assistant: structuredClone(DEFAULT_ASSISTANT_CONFIG),
    plan: 'free',
    theme: 'papel',
    views: 0,
    published: false,
  }
}

// IDs/valores fixos do perfil-modelo — usados só para reconhecer e remover resíduos
// da Marina em rascunhos antigos (dado real do usuário tem id "id-…", nunca "a1"/"h1").
const SAMPLE_AREA_IDS = new Set(sampleProfile.areas.map((a) => a.id))
const SAMPLE_HL_IDS = new Set(sampleProfile.highlights.map((h) => h.id))
const SAMPLE_ART_IDS = new Set((sampleProfile.articles ?? []).map((a) => a.id))

// Remove APENAS o que casa exatamente com o modelo — idempotente e seguro:
// um usuário real jamais teria a área "a1" ou o avatar/e-mail literais da Marina.
function stripSampleLeftovers(d: Profile): Profile {
  const contact = { ...d.contact }
  if (contact.email === sampleProfile.contact.email) delete contact.email
  if (contact.whatsapp === sampleProfile.contact.whatsapp) delete contact.whatsapp
  if (contact.scheduling === sampleProfile.contact.scheduling) delete contact.scheduling
  return {
    ...d,
    areas: d.areas.filter((a) => !SAMPLE_AREA_IDS.has(a.id)),
    highlights: d.highlights.filter((h) => !SAMPLE_HL_IDS.has(h.id)),
    articles: (d.articles ?? []).filter((a) => !SAMPLE_ART_IDS.has(a.id)),
    socials: d.socials.filter((s) => !/marinasales/i.test(s.url)),
    headline: d.headline === sampleProfile.headline ? '' : d.headline,
    bio: d.bio === sampleProfile.bio ? '' : d.bio,
    avatarUrl: d.avatarUrl === sampleProfile.avatarUrl ? undefined : d.avatarUrl,
    regionNote: d.regionNote === sampleProfile.regionNote ? undefined : d.regionNote,
    contact,
  }
}

function loadDraft(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const draft = JSON.parse(raw) as Profile
      // backfill de campos novos em rascunhos antigos
      if (!draft.theme) draft.theme = 'papel'
      if (!draft.schedulingMode) draft.schedulingMode = draft.contact?.scheduling ? 'external' : 'off'
      if (!draft.booking) draft.booking = { ...DEFAULT_BOOKING_CONFIG }
      if (!draft.assistant) draft.assistant = structuredClone(DEFAULT_ASSISTANT_CONFIG)
      return stripSampleLeftovers(draft)
    }
  } catch {
    /* ignora storage corrompido */
  }
  return emptyDraft()
}

function slugifyName(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'perfil'
  )
}

// Espelha resolveSlug do backend para o modo mock (usuário único, sem colisão real):
//  • Free → SEMPRE nome + número aleatório (ex.: vitor-martins-4827), mesmo sem homônimo.
//    Mantém o número atual se o slug já for "nome-<dígitos>" do nome vigente (estável).
//  • Pro/Max → usa o endereço editável como está (limpo).
function resolveMockSlug(p: Profile): string {
  const base = slugifyName(p.name)
  if (p.plan === 'pro' || p.plan === 'premium') {
    return slugifyName(p.slug || p.name)
  }
  if (p.slug && new RegExp(`^${base}-\\d+$`).test(p.slug)) return p.slug
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`
}

export const api = {
  async getProfile(slug: string): Promise<Profile | null> {
    // O rascunho do próprio usuário (modo mock) responde primeiro pelo slug dele.
    if (!USE_REAL_API) {
      const draft = loadDraft()
      if (draft.slug === slug) return draft
    }
    // Os perfis-modelo (marina-sales, guilherme-sales23) são fixtures do produto e
    // resolvem no cliente, antes de qualquer rede: o "Ver um exemplo" da home
    // funciona com o backend fora do ar — ou sem backend nenhum.
    const example = exampleProfiles.find((p) => p.slug === slug)
    if (example) return example

    if (USE_REAL_API) {
      try {
        const res = await fetch(`${API_BASE}/api/profiles/${slug}`)
        return res.ok ? res.json() : null
      } catch {
        return null // rede fora: perfil real indisponível (o exemplo já saiu acima)
      }
    }
    await wait(280)
    return null
  },

  // Página institucional do escritório (sociedade). Mesmo padrão do getProfile:
  // API real quando habilitada; senão, mock em memória (escritorio.ts).
  async getFirm(slug: string): Promise<Firm | null> {
    // Mesmo raciocínio do getProfile: o escritório-modelo é fixture e não depende
    // do backend (é o "Ver exemplo" do plano Escritório na home).
    const mock = getMockFirm(slug)
    if (mock) return mock

    if (USE_REAL_API) {
      try {
        const res = await fetch(`${API_BASE}/api/firms/${slug}`)
        return res.ok ? res.json() : null
      } catch {
        return null
      }
    }
    await wait(280)
    // No mock, o escritório criado pelo usuário (localStorage) responde pelo slug dele.
    const mine = loadFirmDraft()
    return mine && mine.slug === slug ? mine : null
  },

  // Escritório do usuário (dono) — para o editor. Mock: localStorage; real: /firms/me.
  async getMyFirm(): Promise<Firm | null> {
    if (USE_REAL_API) {
      try {
        const res = await fetch(`${API_BASE}/api/firms/me`, { headers: { ...authHeader() } })
        const text = res.ok ? await res.text() : ''
        return text ? (JSON.parse(text) as Firm) : null
      } catch {
        return loadFirmDraft()
      }
    }
    await wait(120)
    return loadFirmDraft()
  },

  async saveFirm(firm: Firm): Promise<Firm> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/firms/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(firm),
      })
      return res.json()
    }
    await wait(200)
    const resolved: Firm = { ...firm, slug: firm.name ? slugifyFirm(firm.name) : '' }
    localStorage.setItem(FIRM_KEY, JSON.stringify(resolved))
    return resolved
  },

  async getDraft(): Promise<Profile> {
    if (USE_REAL_API) {
      // Blindagem: banco vazio / resposta vazia não pode travar o editor.
      // Se o backend não devolver um perfil válido, começa com um rascunho local.
      try {
        const res = await fetch(`${API_BASE}/api/profiles/me`, { headers: { ...authHeader() } })
        const text = res.ok ? await res.text() : ''
        const data = text ? (JSON.parse(text) as Partial<Profile>) : null
        if (data && data.slug) return { ...loadDraft(), ...data } as Profile
      } catch {
        /* rede/JSON inválido → cai no rascunho local */
      }
      return loadDraft()
    }
    await wait(120)
    return loadDraft()
  },

  async saveDraft(profile: Profile): Promise<Profile> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/profiles/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(profile),
      })
      return res.json()
    }
    await wait(200)
    // Resolve o endereço com a mesma regra do backend (Free sempre numerado).
    const resolved = { ...profile, slug: resolveMockSlug(profile) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved))
    return resolved
  },

  // Solicita a conferência da OAB (não concede a marca — só a plataforma promove a 'verified').
  async requestOabCheck(): Promise<{ oabStatus: OabStatus }> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/profiles/me/oab/request`, {
        method: 'POST',
        headers: { ...authHeader() },
      })
      return res.json()
    }
    await wait(300)
    return { oabStatus: 'pending' }
  },

  // Denúncia de um perfil — qualquer visitante pode. Sem backend real (dev),
  // apenas simula o envio (a denúncia não é persistida no mock em memória).
  async reportProfile(
    slug: string,
    input: { reason: ReportReason; details: string; reporterEmail?: string },
  ): Promise<{ ok: boolean }> {
    if (USE_REAL_API || API_BASE) {
      const res = await fetch(`${API_BASE}/api/profiles/${slug}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || 'Falha ao enviar a denúncia.')
      }
      return res.json()
    }
    await wait(300)
    return { ok: true }
  },

  // ---- Agenda nativa ----

  // Disponibilidade pública (config + horários ocupados) para o slug.
  async getAvailability(slug: string): Promise<Availability> {
    if (USE_REAL_API || API_BASE) {
      const res = await fetch(`${API_BASE}/api/profiles/${slug}/availability`)
      if (!res.ok) throw new Error('Não foi possível carregar a agenda.')
      return res.json()
    }
    await wait(200)
    const profile = profileForSlug(slug)
    const mode = profile ? resolveSchedulingMode(profile) : 'off'
    const config = profile?.booking ?? DEFAULT_BOOKING_CONFIG
    const now = Date.now()
    const busy = loadBookings()
      .filter(
        (b) =>
          b.profileSlug === slug &&
          (b.status === 'pending' || b.status === 'confirmed') &&
          new Date(b.startAt).getTime() >= now,
      )
      .map((b) => b.startAt)
    return { mode, config, busy }
  },

  // Cliente cria uma solicitação (status pending).
  async createBooking(
    slug: string,
    input: { clientName: string; clientWhats: string; note?: string; startAt: string },
  ): Promise<Booking> {
    if (USE_REAL_API || API_BASE) {
      const res = await fetch(`${API_BASE}/api/profiles/${slug}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || 'Não foi possível enviar a solicitação.')
      }
      return res.json()
    }
    await wait(320)
    const profile = profileForSlug(slug)
    const slotMin = profile?.booking?.slotMin ?? DEFAULT_BOOKING_CONFIG.slotMin
    const list = loadBookings()
    const start = new Date(input.startAt).getTime()
    const clash = list.some(
      (b) =>
        b.profileSlug === slug &&
        (b.status === 'pending' || b.status === 'confirmed') &&
        new Date(b.startAt).getTime() === start,
    )
    if (clash) throw new Error('Esse horário acabou de ser reservado. Escolha outro.')
    const booking: StoredBooking = {
      id: `bk-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      profileSlug: slug,
      clientName: input.clientName.trim(),
      clientWhats: input.clientWhats.replace(/\D/g, ''),
      note: (input.note ?? '').trim(),
      startAt: input.startAt,
      endAt: new Date(start + slotMin * 60_000).toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    saveBookings([...list, booking])
    const { profileSlug: _drop, ...pub } = booking
    return pub
  },

  // Solicitações do advogado dono (mock: todas; real: as do DEMO_USER).
  async getMyBookings(): Promise<Booking[]> {
    if (USE_REAL_API || API_BASE) {
      const res = await fetch(`${API_BASE}/api/profiles/me/bookings`, { headers: { ...authHeader() } })
      return res.ok ? res.json() : []
    }
    await wait(160)
    return loadBookings()
      .slice()
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .map(({ profileSlug: _drop, ...b }) => b)
  },

  // Decisão do advogado: aceitar / recusar / cancelar.
  async decideBooking(id: string, decision: 'confirm' | 'decline' | 'cancel'): Promise<Booking> {
    if (USE_REAL_API || API_BASE) {
      const res = await fetch(`${API_BASE}/api/profiles/me/bookings/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) throw new Error('Não foi possível atualizar a solicitação.')
      return res.json()
    }
    await wait(160)
    const status =
      decision === 'confirm' ? 'confirmed' : decision === 'decline' ? 'declined' : 'cancelled'
    const list = loadBookings()
    const next = list.map((b) =>
      b.id === id ? { ...b, status: status as Booking['status'] } : b,
    )
    saveBookings(next)
    const found = next.find((b) => b.id === id)
    if (!found) throw new Error('Solicitação não encontrada.')
    const { profileSlug: _drop, ...pub } = found
    return pub
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
  // Sanitiza as palavras-chave: o fallback nunca pode despejar comparações a
  // terceiros ("como saul goodman") nem "especialista" crus do usuário.
  const kw = req.keywords
    .map((k) =>
      k
        .replace(/\b(como|igual a|tipo|feito)\b.*/i, '')
        .replace(/\bespecialist\w*\b/gi, '')
        .replace(/\bexpert\w*\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter(Boolean)
  const list =
    kw.length > 1
      ? `${kw.slice(0, -1).join(', ')} e ${kw[kw.length - 1]}`
      : kw[0] ?? 'sua área de atuação'

  if (req.kind === 'area') {
    const area = req.areaLabel ?? 'esta área'
    return `Atuo em ${area} com foco em ${list}. Ofereço orientação clara sobre direitos e alternativas em cada etapa, buscando o caminho mais adequado a cada situação. O objetivo é que você compreenda o processo e tome decisões bem informadas.`
  }

  if (req.kind === 'headline') {
    const area = req.areaLabel || req.areas?.filter(Boolean)[0] || req.keywords.filter(Boolean)[0] || 'Direito'
    return `Advogado(a) · ${area}`
  }

  if (req.kind === 'improve') {
    return (
      req.currentText?.trim() ||
      `Advogado(a) inscrito(a) na OAB, com atuação em ${list}. O trabalho é conduzido de forma técnica e informativa, orientando cada pessoa sobre seus direitos e os caminhos possíveis.`
    )
  }

  if (req.kind === 'article') {
    const area = req.areaLabel || req.areas?.filter(Boolean)[0] || 'o tema'
    return `Entenda melhor: ${area}\n\nEste texto explica, de forma geral e informativa, conceitos e direitos relacionados a ${area}. O objetivo é orientar o leitor sobre como o tema funciona e quais caminhos existem, sem substituir a análise de um caso concreto.`
  }

  const name = req.name?.split(' ')[0]
  const opening = name ? `Sou ${name}, advogad(a) dedicad(a) a` : 'Dedico minha atuação a'
  return `${opening} ${list}. Meu trabalho une técnica e escuta para orientar cada pessoa sobre seus direitos e os caminhos possíveis, com informação transparente do início ao fim. Acredito em uma advocacia próxima, que reduz a insegurança de quem precisa de apoio jurídico.`
}
