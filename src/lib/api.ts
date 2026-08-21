// Camada de acesso a dados — trocável por chamadas reais ao NestJS.
//
// Hoje: mock em memória + localStorage, com latência simulada.
// Amanhã: basta implementar as mesmas assinaturas apontando para `/api/...`
// (o proxy do Vite já encaminha para o NestJS na porta 3333).

import { authHeader } from './auth'
import { checkCompliance, hasBlockingIssue, POLICY_VERSION } from './oab'
import { fitToLimit } from './textLimit'
import { generateWithOllama } from './localAi'
import { directorySeed, exampleProfiles, sampleProfile } from './mockData'
import {
  blankFirm,
  getFirm as getMockFirm,
  slugifyFirm,
  type Firm,
  type FirmInvite,
  type FirmMember,
} from './escritorio'
import { DEFAULT_BOOKING_CONFIG, resolveSchedulingMode } from './booking'
import { canUseScheduling, FAQ_LIMIT } from './plans'
import { DEFAULT_ASSISTANT_CONFIG } from './assistant'
import type {
  Availability,
  Booking,
  DirectoryResult,
  GenerateRequest,
  GenerateResult,
  OabStatus,
  Plan,
  Profile,
  ReportReason,
} from './types'

/**
 * Resultado da consulta de endereço. `available: null` significa NÃO SEI (rede
 * fora): a interface mostra incerteza em vez de prometer disponibilidade.
 */
export interface SlugCheck {
  slug: string
  available: boolean | null
  suggested: string
  reason: 'free' | 'taken' | 'empty' | 'unknown'
}

const STORAGE_KEY = 'advocme:profile:draft'
const FIRM_KEY = 'advocme:firm:draft'

// Traduz a falha do PUT /firms/me para uma frase que o dono entende. O corpo do
// Nest ({ message }) é útil no 400 de conformidade; nos demais casos é ruído.
function firmErrorMessage(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'Sua sessão expirou. Entre de novo para continuar editando o escritório.'
  }
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] }
    const msg = Array.isArray(parsed.message) ? parsed.message[0] : parsed.message
    if (msg) return msg
  } catch {
    /* corpo não-JSON → mensagem genérica */
  }
  return 'Não foi possível salvar o escritório agora. Tente de novo em instantes.'
}
const BOOKINGS_KEY = 'advocme:bookings'
// Histórico local da conferência de OAB (espelha OabVerificationEvent no backend).
const OAB_EVENTS_KEY = 'advocme:oab:events'

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

function saveFirmDraft(firm: Firm): Firm {
  try {
    localStorage.setItem(FIRM_KEY, JSON.stringify(firm))
  } catch {
    /* storage indisponível — segue com o valor em memória */
  }
  return firm
}

// Ordem NEUTRA também na gestão: quem administra não vê ranking nenhum, nem por
// data de entrada. Prov. 205/2021 veda destaque entre advogados.
function sortMembers(members: FirmMember[]): FirmMember[] {
  return [...members].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
// URL absoluta do backend (Render) em produção. Vazio em dev → usa caminho relativo
// `/api` que o proxy do Vite encaminha para localhost:3333. No Netlify, defina
// VITE_API_URL=https://<seu-backend>.onrender.com.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
// Modo real (backend) quando explicitamente ligado OU quando há um backend
// configurado (VITE_API_URL) — assim o deploy no Netlify usa o Render de ponta a
// ponta (perfis, conta, IA), sem localStorage. Em dev sem VITE_API_URL, segue mock.
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true' || !!API_BASE

// Chamada autenticada às rotas de gestão do escritório. Todas devolvem o escritório
// inteiro e todas falham do mesmo jeito — daí um único caminho de erro.
async function firmFetch(path: string, init: RequestInit = {}): Promise<Firm> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...init.headers, ...authHeader() } })
  if (!res.ok) throw new Error(firmErrorMessage(res.status, await res.text().catch(() => '')))
  return (await res.json()) as Firm
}

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
    faqs: [],
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
const SAMPLE_FAQ_IDS = new Set((sampleProfile.faqs ?? []).map((f) => f.id))

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
    faqs: (d.faqs ?? []).filter((f) => !SAMPLE_FAQ_IDS.has(f.id)),
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

/**
 * Corta o FAQ no limite do plano — espelha `faqRows` do backend. O que passa do
 * teto NÃO é apagado do que o advogado digitou na tela; simplesmente não é
 * gravado, do mesmo jeito que o servidor faz depois de um downgrade.
 */
function trimFaqs(raw: Profile['faqs'], plan: Plan): Profile['faqs'] {
  const max = FAQ_LIMIT[plan]
  if (!max) return []
  return (raw ?? []).slice(0, max)
}

// ---- Conferência de OAB ----------------------------------------------------
//
// O estado da conferência pertence À PLATAFORMA: o advogado só PEDE. Aqui ficam o
// recorte devolvido pelo pedido, a paridade do mock com as regras do backend e a
// fila local que permite exercitar o ciclo pedido → decisão sem subir o NestJS.

/** Estado do pedido de conferência devolvido pelo servidor (ou pelo mock). */
export interface OabCheckState {
  oabStatus: OabStatus
  oabVerified?: boolean
  oabRequestedAt?: string | null
  oabDecidedAt?: string | null
  oabReason?: string | null
}

/** Lê o estado da conferência de um perfil. */
export function oabStateOf(p: Profile): OabCheckState {
  return {
    oabStatus: p.oabStatus ?? (p.oabVerified ? 'verified' : 'none'),
    oabVerified: !!p.oabVerified,
    oabRequestedAt: p.oabRequestedAt ?? null,
    oabDecidedAt: p.oabDecidedAt ?? null,
    oabReason: p.oabReason ?? null,
  }
}

/** Mensagem de erro legível a partir da resposta do Nest ({"message": "..."}). */
function parseApiMessage(raw: string): string {
  try {
    const data = JSON.parse(raw) as { message?: string | string[] }
    const msg = Array.isArray(data.message) ? data.message[0] : data.message
    return msg ?? ''
  } catch {
    return raw
  }
}

/**
 * Colunas de conferência que o mock preserva no save (o cliente não as escreve),
 * espelhando o backend — inclusive a queda da conferência quando o número muda:
 * o que foi conferido foi AQUELE número.
 */
function mockOabColumns(stored: Profile, incoming: Profile): Partial<Profile> {
  const status = stored.oabStatus ?? (stored.oabVerified ? 'verified' : 'none')
  const changed = (incoming.oabNumber ?? '').trim() !== (stored.oabNumber ?? '').trim()
  if (changed && status !== 'none') {
    pushMockOabEvent({
      profileId: stored.slug,
      fromStatus: status,
      toStatus: 'none',
      reviewer: '',
      reason: 'Número de inscrição alterado pelo advogado — conferência reiniciada.',
    })
    return {
      oabStatus: 'none',
      oabVerified: false,
      oabRequestedAt: undefined,
      oabDecidedAt: undefined,
      oabReason: undefined,
    }
  }
  return {
    oabStatus: status,
    oabVerified: !!stored.oabVerified,
    oabRequestedAt: stored.oabRequestedAt,
    oabDecidedAt: stored.oabDecidedAt,
    oabReason: stored.oabReason,
  }
}

export interface MockOabEvent {
  id: string
  profileId: string
  fromStatus: OabStatus
  toStatus: OabStatus
  method: string
  reviewer: string
  reason: string
  createdAt: string
}

function loadMockOabEvents(): MockOabEvent[] {
  try {
    const raw = localStorage.getItem(OAB_EVENTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as MockOabEvent[]) : []
  } catch {
    return []
  }
}

function pushMockOabEvent(e: Omit<MockOabEvent, 'id' | 'createdAt' | 'method'>) {
  const list = loadMockOabEvents()
  list.push({
    ...e,
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    method: 'manual',
    createdAt: new Date().toISOString(),
  })
  localStorage.setItem(OAB_EVENTS_KEY, JSON.stringify(list))
}

/**
 * Fila de conferência do MOCK (sem backend). Existe para o ciclo completo —
 * pedido → análise → decisão com motivo — poder ser exercitado em desenvolvimento;
 * com backend configurado, o painel usa os endpoints reais e isto não é chamado.
 */
export const mockOabQueue = {
  pending() {
    const draft = loadDraft()
    const status = draft.oabStatus ?? (draft.oabVerified ? 'verified' : 'none')
    if (status !== 'pending') return []
    return [
      {
        id: draft.slug,
        name: draft.name,
        oabNumber: draft.oabNumber,
        city: draft.city,
        state: draft.state,
        slug: draft.slug,
        updatedAt: draft.oabRequestedAt ?? new Date().toISOString(),
        oabRequestedAt: draft.oabRequestedAt ?? null,
      },
    ]
  },

  decide(id: string, decision: 'verify' | 'reject', reason?: string) {
    const draft = loadDraft()
    if (draft.slug !== id) throw new Error('Perfil não encontrado.')
    if (decision === 'reject' && !reason?.trim()) {
      throw new Error('Informe o motivo da rejeição — ele é devolvido ao advogado.')
    }
    const from = draft.oabStatus ?? (draft.oabVerified ? 'verified' : 'none')
    const verified = decision === 'verify'
    const next: Profile = {
      ...draft,
      oabStatus: verified ? 'verified' : 'rejected',
      oabVerified: verified,
      oabDecidedAt: new Date().toISOString(),
      oabReason: verified ? undefined : reason?.trim(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    pushMockOabEvent({
      profileId: id,
      fromStatus: from,
      toStatus: next.oabStatus!,
      reviewer: 'admin (local)',
      reason: reason?.trim() ?? '',
    })
    return oabStateOf(next)
  },

  history(id: string) {
    return loadMockOabEvents()
      .filter((e) => e.profileId === id)
      .reverse()
  },
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
function resolveMockSlug(p: Profile, stripAutoNumber = false): string {
  const base = slugifyName(p.name)
  if (p.plan === 'pro' || p.plan === 'premium') {
    // Só na TROCA de plano: o número do Free é imposto pela plataforma, não
    // escolhido, então cai fora ao assinar (perk "seu nome sem número"). Num save
    // comum fica como está, senão um endereço personalizado terminado em número
    // seria alterado sem o usuário pedir. Espelha resolveSlug do backend.
    const desired = (p.slug || '').trim()
    const autoNumbered = stripAutoNumber && !!base && new RegExp(`^${base}-\\d+$`).test(desired)
    return slugifyName(!desired || autoNumbered ? p.name : desired)
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
      // Erro do servidor (401 sem sessão, 400 de conformidade) não pode virar
      // "Tudo salvo": o corpo de erro não é um Firm.
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(firmErrorMessage(res.status, detail))
      }
      return res.json()
    }
    await wait(200)
    const anterior = loadFirmDraft()
    const resolved: Firm = {
      ...firm,
      slug: firm.name ? slugifyFirm(firm.name) : '',
      // O editor manda só o institucional; os membros vivem no rascunho.
      members: firm.members ?? anterior?.members ?? [],
    }
    return saveFirmDraft(resolved)
  },

  // ---- Membros do escritório -------------------------------------------------
  //
  // Advogado do escritório é uma CONTA convidada, não uma linha digitada pelo dono.
  // Todas as rotas devolvem o escritório inteiro já atualizado, para o editor não
  // precisar remontar a lista na mão.

  async inviteFirmMember(email: string, role: 'member' | 'admin' = 'member'): Promise<Firm> {
    if (USE_REAL_API) {
      return firmFetch('/api/firms/me/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
    }
    await wait(160)
    const firm = loadFirmDraft() ?? blankFirm()
    const jaTem = (firm.members ?? []).some((m) => m.email?.toLowerCase() === email.toLowerCase())
    if (jaTem) throw new Error('Esse advogado já faz parte do seu escritório.')
    const convite: FirmMember = {
      id: `mock-${Date.now()}`,
      kind: 'invite',
      name: email,
      email,
      role,
      status: 'invited',
    }
    return saveFirmDraft({ ...firm, members: sortMembers([...(firm.members ?? []), convite]) })
  },

  async removeFirmMember(member: FirmMember): Promise<Firm> {
    if (USE_REAL_API) {
      return firmFetch(`/api/firms/me/members/${member.kind}/${member.id}`, { method: 'DELETE' })
    }
    await wait(160)
    const firm = loadFirmDraft() ?? blankFirm()
    return saveFirmDraft({
      ...firm,
      members: (firm.members ?? []).filter((m) => m.id !== member.id),
    })
  },

  /** Convites pendentes dirigidos a quem está logado (mostrados no painel). */
  async getFirmInvites(): Promise<FirmInvite[]> {
    if (USE_REAL_API) {
      try {
        const res = await fetch(`${API_BASE}/api/firms/me/invites`, { headers: { ...authHeader() } })
        return res.ok ? ((await res.json()) as FirmInvite[]) : []
      } catch {
        return [] // rede fora: melhor não mostrar convite nenhum do que inventar um
      }
    }
    await wait(120)
    return []
  },

  async answerFirmInvite(id: string, resposta: 'accept' | 'decline'): Promise<void> {
    if (!USE_REAL_API) {
      await wait(120)
      return
    }
    const res = await fetch(`${API_BASE}/api/firms/me/invites/${id}/${resposta}`, {
      method: 'POST',
      headers: { ...authHeader() },
    })
    if (!res.ok) {
      throw new Error(firmErrorMessage(res.status, await res.text().catch(() => '')))
    }
  },

  async getDraft(): Promise<Profile> {
    if (USE_REAL_API) {
      // Blindagem: banco vazio / resposta vazia não pode travar o editor.
      // Se o backend não devolver um perfil válido, começa com um rascunho local.
      try {
        const res = await fetch(`${API_BASE}/api/profiles/me`, { headers: { ...authHeader() } })
        const text = res.ok ? await res.text() : ''
        const data = text ? (JSON.parse(text) as Partial<Profile>) : null
        // Os campos da conferência são zerados ANTES do spread: eles só existem
        // enquanto o servidor os manda, e um motivo de rejeição antigo guardado no
        // rascunho local continuaria aparecendo depois de um novo pedido.
        if (data && data.slug) {
          return {
            ...loadDraft(),
            oabRequestedAt: undefined,
            oabDecidedAt: undefined,
            oabReason: undefined,
            ...data,
          } as Profile
        }
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
      // Sem esta checagem, uma recusa do servidor (texto fora das normas, limite de
      // caracteres, sessão expirada) virava um objeto de erro tratado como perfil
      // salvo: o editor dizia "Tudo salvo" e o texto simplesmente não existia.
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(parseApiMessage(msg) || 'Não foi possível salvar as alterações.')
      }
      return res.json()
    }
    await wait(200)
    // O PLANO É DO SERVIDOR (ver setPlan): o mock também ignora o `plan` recebido e
    // mantém o da assinatura vigente. Sem isso, mock e API real divergiriam — e um
    // plano "ativado" só na tela voltaria a travar tudo no próximo carregamento.
    const stored = loadDraft()
    // A CONFERÊNCIA TAMBÉM É DO SERVIDOR: o editor manda o perfil inteiro a cada
    // tecla e sobrescreveria o estado da fila (uma aprovação do admin evaporava no
    // autosave seguinte). Aqui o mock repete a regra do backend.
    const withPlan: Profile = {
      ...profile,
      plan: stored.plan,
      ...mockOabColumns(stored, profile),
      // FAQ segue o limite do plano vigente, como no backend (faqRows).
      faqs: trimFaqs(profile.faqs, stored.plan),
    }
    // Resolve o endereço com a mesma regra do backend (Free sempre numerado).
    const resolved = { ...withPlan, slug: resolveMockSlug(withPlan) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved))
    return resolved
  },

  /**
   * O endereço desejado está livre? O painel afirmava "disponível" sem ter
   * perguntado a ninguém — com dois "joão-silva" no país a promessa quebrava no
   * primeiro save, e o advogado descobria pelo número grudado no fim.
   *
   * `suggested` é o que o servidor realmente gravaria, para a interface oferecer
   * a alternativa em vez de só dizer não.
   */
  async checkSlug(slug: string, name?: string): Promise<SlugCheck> {
    const desired = slugifyName(slug || '')
    if (!desired) return { slug: '', available: false, suggested: '', reason: 'empty' }

    if (USE_REAL_API) {
      const params = new URLSearchParams({ slug: desired })
      if (name) params.set('name', name)
      try {
        const res = await fetch(`${API_BASE}/api/profiles/slug-available?${params}`, {
          headers: { ...authHeader() },
        })
        if (res.ok) return res.json()
      } catch {
        /* rede fora → devolve indefinido abaixo em vez de mentir "disponível" */
      }
      return { slug: desired, available: null, suggested: desired, reason: 'unknown' }
    }

    await wait(180)
    // Mock: os perfis-modelo (Marina, Guilherme) são de OUTROS advogados — sempre
    // ocupados, mesmo que o rascunho local esteja com o mesmo slug. Deixar o
    // rascunho "liberar" o endereço faria o mock dizer disponível para um
    // endereço que o backend recusaria.
    const taken = exampleProfiles.some((p) => p.slug === desired)
    return {
      slug: desired,
      available: !taken,
      suggested: taken ? `${desired}-${Math.floor(1000 + Math.random() * 9000)}` : desired,
      reason: taken ? 'taken' : 'free',
    }
  },

  /**
   * Ativa um plano (assinatura). É a ÚNICA forma de mudar de plano: o `plan`
   * enviado no saveDraft é ignorado pelo servidor, senão a "assinatura" evaporava
   * no recarregar (era exatamente o bug do assistente virtual que continuava
   * travado depois de assinar). Devolve o perfil já reconciliado pelo servidor —
   * quem chama deve adotar essa resposta como novo estado, não o objeto local.
   *
   * Hoje a cobrança é simulada (plataforma em teste). Com o billing real, o
   * checkout confirma no provedor e o backend recebe o webhook — a assinatura
   * desta função não muda.
   */
  async setPlan(plan: Plan): Promise<Profile> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/profiles/me/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) throw new Error('Não foi possível ativar o plano.')
      return res.json()
    }
    await wait(220)
    // Mock: espelha a reconciliação do servidor (agendamento é recurso pago; o
    // endereço segue a escada de plano).
    const draft = loadDraft()
    const next: Profile = {
      ...draft,
      plan,
      schedulingMode: canUseScheduling(plan) ? draft.schedulingMode : 'off',
    }
    const resolved = { ...next, slug: resolveMockSlug(next, true) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved))
    return resolved
  },

  /**
   * Lê só o estado da conferência (sem baixar o perfil inteiro, que sobrescreveria
   * o texto que o advogado está digitando). É como o editor descobre que a
   * plataforma decidiu enquanto ele esperava.
   */
  async oabState(): Promise<OabCheckState> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/profiles/me/oab`, { headers: { ...authHeader() } })
      if (!res.ok) throw new Error('Não foi possível consultar o estado da conferência.')
      return res.json()
    }
    return oabStateOf(loadDraft())
  },

  /**
   * Solicita a conferência da OAB. NÃO concede a marca: o pedido entra na fila em
   * 'pending' e só o admin promove a 'verified' (ou rejeita, com motivo). O retorno
   * é o estado do pedido — quem chama adota esta resposta, nunca um palpite local.
   */
  async requestOabCheck(): Promise<OabCheckState> {
    if (USE_REAL_API) {
      const res = await fetch(`${API_BASE}/api/profiles/me/oab/request`, {
        method: 'POST',
        headers: { ...authHeader() },
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(parseApiMessage(msg) || 'Não foi possível enviar o pedido de conferência.')
      }
      return res.json()
    }
    await wait(300)
    // Mock: mesmas travas do backend (plano pago, número preenchido, um pedido só).
    const draft = loadDraft()
    if (draft.plan === 'free') {
      throw new Error('A conferência de OAB está disponível apenas nos planos pagos.')
    }
    if (!draft.oabNumber.trim()) {
      throw new Error('Informe seu número de inscrição na OAB antes de pedir a conferência.')
    }
    const status = draft.oabStatus ?? (draft.oabVerified ? 'verified' : 'none')
    if (status === 'pending' || status === 'verified') return oabStateOf(draft)

    const now = new Date().toISOString()
    const next: Profile = {
      ...draft,
      oabStatus: 'pending',
      oabVerified: false,
      oabRequestedAt: now,
      oabDecidedAt: undefined,
      oabReason: undefined,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    pushMockOabEvent({
      profileId: next.slug,
      fromStatus: status,
      toStatus: 'pending',
      reviewer: '',
      reason: '',
    })
    return oabStateOf(next)
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
        if (res.ok) {
          // O teto é reaplicado aqui: o backend já corta, mas o texto que chega ao
          // editor NUNCA pode estourar o limite do campo — é isso que trava o save.
          const data = (await res.json()) as GenerateResult
          return { ...data, text: fitToLimit(data.text, req.maxChars ?? 0) }
        }
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
    text = fitToLimit(text, req.maxChars ?? 0)
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

  if (req.kind === 'faq') {
    // Resposta de reserva: genérica e curta de propósito — serve para o advogado ter
    // por onde começar quando a IA não está disponível, não para publicar como está.
    const tema = req.areaLabel || req.areas?.filter(Boolean)[0] || 'esse tema'
    return `De forma geral, ${tema} segue requisitos e prazos previstos em lei, que mudam conforme a situação de cada pessoa. O caminho costuma começar por reunir os documentos e verificar qual regra se aplica. Cada caso exige análise própria.`
  }

  const name = req.name?.split(' ')[0]
  const opening = name ? `Sou ${name}, advogad(a) dedicad(a) a` : 'Dedico minha atuação a'
  return `${opening} ${list}. Meu trabalho une técnica e escuta para orientar cada pessoa sobre seus direitos e os caminhos possíveis, com informação transparente do início ao fim. Acredito em uma advocacia próxima, que reduz a insegurança de quem precisa de apoio jurídico.`
}
