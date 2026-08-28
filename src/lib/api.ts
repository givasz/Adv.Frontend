// Camada de acesso a dados — trocável por chamadas reais ao NestJS.
//
// Hoje: mock em memória + localStorage, com latência simulada.
// Amanhã: basta implementar as mesmas assinaturas apontando para `/api/...`
// (o proxy do Vite já encaminha para o NestJS na porta 3333).

import { aguardarSessao, esquecerSessaoLocal, isAuthenticated, revalidarSessao } from './auth'
import { API_BASE, apiFetch, TEM_BACKEND } from './http'
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
import { DEFAULT_BOOKING_CONFIG } from './booking'
import { canUseScheduling, FAQ_LIMIT } from './plans'
import { getTheme, isThemeUnlocked } from './themes'
import { DEFAULT_ASSISTANT_CONFIG } from './assistant'
import type {
  DirectoryResult,
  GenerateRequest,
  GenerateResult,
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
// Onde a API vive e se ela existe — as duas respostas vêm de `http.ts`, fonte
// única. `API_BASE` é vazia: tudo sai como `/api/...`, no mesmo endereço do site
// (é isso que faz o cookie da sessão valer no Safari — ver o comentário lá).
const USE_REAL_API = TEM_BACKEND

// O perfil no servidor é SEMPRE de uma conta. Sem sessão, o rascunho vive só
// neste navegador: a API rejeita escrita anônima (401) porque, antes, todo mundo
// sem conta escrevia na MESMA linha do banco — quem preenchia nome, WhatsApp e
// e-mail no editor deixava esses dados à vista do próximo visitante anônimo.
const contaAtiva = () => USE_REAL_API && isAuthenticated()

/**
 * Como `contaAtiva`, mas ESPERA a conferência inicial da sessão.
 *
 * A versão síncrona responde "não" durante o primeiro instante do app — a
 * resposta de /auth/me ainda está no ar. Quem perguntava naquele instante
 * (o painel, o editor, o assistente de criação, todos carregam no primeiro
 * render) concluía que não havia conta: mostrava o rascunho local em vez do
 * perfil da pessoa e, pior, passava a GRAVAR no navegador em vez de na conta.
 * Era o "criei a conta e caí num perfil genérico".
 */
async function contaAtivaConferida(): Promise<boolean> {
  if (!USE_REAL_API) return false
  await aguardarSessao()
  return isAuthenticated()
}

/**
 * A sessão acabou (ou nunca chegou ao servidor).
 *
 * Não basta avisar quem chamou: o retrato local também tem de cair, senão a
 * interface segue mostrando a pessoa como logada enquanto todas as chamadas
 * voltam 401. Ao esquecer o retrato, as telas protegidas (ver RequireAuth em
 * App.tsx) devolvem a pessoa ao login sozinhas — em vez de desenharem um perfil
 * vazio com o nome dela no cabeçalho.
 */
export class SessaoExpirada extends Error {
  constructor(mensagem = 'Sua sessão expirou. Entre de novo para continuar.') {
    super(mensagem)
    this.name = 'SessaoExpirada'
  }
}

function sessaoCaiu(mensagem?: string): SessaoExpirada {
  esquecerSessaoLocal()
  return new SessaoExpirada(mensagem)
}

/**
 * Uma escrita autenticada, com uma segunda chance.
 *
 * O 403 aqui quase sempre é o token anti-CSRF fora de data: ele é derivado da
 * sessão, e a sessão pode ter sido renovada noutra aba, ou o processo do servidor
 * pode ter reiniciado. Buscar um token novo custa uma chamada e resolve na hora.
 * Sem isso, o advogado só descobria o problema pelo texto que não salvava — e a
 * única saída era recarregar a página no meio do que estava escrevendo.
 *
 * A segunda tentativa é UMA. Se o 403 persistir, ele é de verdade (perfil
 * restrito pela moderação, origem não autorizada) e a mensagem do servidor tem de
 * chegar a quem está na tela.
 */
async function escrever(path: string, init: RequestInit): Promise<Response> {
  const res = await apiFetch(path, init)
  if (res.status !== 403) return res
  const sessao = await revalidarSessao()
  if (!sessao) return res
  return apiFetch(path, init)
}

// Chamada autenticada às rotas de gestão do escritório. Todas devolvem o escritório
// inteiro e todas falham do mesmo jeito — daí um único caminho de erro.
async function firmFetch(path: string, init: RequestInit = {}): Promise<Firm> {
  const res = init.method && init.method !== 'GET' ? await escrever(path, init) : await apiFetch(path, init)
  // Sessão caída derruba o retrato junto (ver sessaoCaiu): sem isso a tela do
  // escritório mostrava "sua sessão expirou" e continuava desenhando a pessoa
  // como logada, sem caminho de volta a não ser recarregar na mão.
  if (res.status === 401) throw sessaoCaiu(firmErrorMessage(res.status, ''))
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

/** Ordem dos planos — o mock precisa saber o que é SUBIR para reescrever o slug. */
const RANK_DO_PLANO: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

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
  // Free: o endereço que JÁ existe é preservado, qualquer que seja ele. Só
  // sorteia quando não há endereço nenhum. Espelha resolveSlug do backend — e é
  // o que impede que rebaixar de plano (ou corrigir um typo no nome) mate um
  // endereço que já está impresso em cartão de visita e indexado no Google.
  if (p.slug) return p.slug
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
    if (await contaAtivaConferida()) {
      let res: Response
      try {
        res = await apiFetch('/api/firms/me')
      } catch {
        return loadFirmDraft() // rede fora
      }
      if (res.status === 401 || res.status === 403) throw sessaoCaiu()
      const text = res.ok ? await res.text().catch(() => '') : ''
      try {
        return text ? (JSON.parse(text) as Firm) : null
      } catch {
        return null
      }
    }
    if (USE_REAL_API) return null
    await wait(120)
    return loadFirmDraft()
  },

  async saveFirm(firm: Firm): Promise<Firm> {
    if (USE_REAL_API) {
      if (!(await contaAtivaConferida())) throw sessaoCaiu(firmErrorMessage(401, ''))
      // Erro do servidor (401 sem sessão, 400 de conformidade) não pode virar
      // "Tudo salvo": o corpo de erro não é um Firm.
      return firmFetch('/api/firms/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firm),
      })
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
        const res = await apiFetch('/api/firms/me/invites')
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
    const res = await apiFetch(`/api/firms/me/invites/${id}/${resposta}`, { method: 'POST' })
    if (!res.ok) {
      throw new Error(firmErrorMessage(res.status, await res.text().catch(() => '')))
    }
  },

  /**
   * O perfil de quem está logado.
   *
   * Com conta, a fonte é o SERVIDOR e só ele: misturar o rascunho local por baixo
   * (`{...loadDraft(), ...data}`) fazia campos de outra conta — a de quem usou o
   * mesmo computador antes — reaparecerem no editor de quem acabou de se
   * cadastrar. O rascunho local volta a ser o que sempre foi: o perfil de quem
   * ainda não tem conta, e uma rede de segurança quando a rede cai.
   */
  async getDraft(): Promise<Profile> {
    if (await contaAtivaConferida()) {
      let res: Response
      try {
        res = await apiFetch('/api/profiles/me')
      } catch {
        return loadDraft() // rede fora: melhor o que há aqui do que uma tela travada
      }
      // 401/403 = o cookie não vale mais (venceu, ou o navegador o descartou).
      // Isto PRECISA ser distinguido de "conta sem perfil": tratar os dois como a
      // mesma coisa é o que jogava a pessoa num assistente de criação em branco,
      // com o nome dela ainda no cabeçalho.
      if (res.status === 401) throw sessaoCaiu()
      if (!res.ok) throw new Error('Não foi possível carregar seu perfil agora.')
      const text = await res.text().catch(() => '')
      let data: Partial<Profile> | null = null
      try {
        data = text ? (JSON.parse(text) as Partial<Profile>) : null
      } catch {
        data = null
      }
      // Conta sem perfil (200 com corpo vazio) começa um rascunho NOVO — o do
      // servidor é a verdade, e ele diz que não há nada ainda.
      return { ...emptyDraft(), ...(data ?? {}) } as Profile
    }
    await wait(120)
    return loadDraft()
  },

  async saveDraft(profile: Profile): Promise<Profile> {
    // Modo real SEM sessão: recusa em vez de gravar no navegador. O silêncio era
    // pior que o erro — o editor dizia "Tudo salvo", nada chegava à conta, e o
    // trabalho sumia no próximo aparelho (ou na próxima limpeza do navegador).
    if (USE_REAL_API && !(await contaAtivaConferida())) {
      throw sessaoCaiu('Entre na sua conta para salvar o perfil.')
    }
    if (contaAtiva()) {
      const res = await escrever('/api/profiles/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      // Sem esta checagem, uma recusa do servidor (texto fora das normas, limite de
      // caracteres, sessão expirada) virava um objeto de erro tratado como perfil
      // salvo: o editor dizia "Tudo salvo" e o texto simplesmente não existia.
      if (res.status === 401) {
        throw sessaoCaiu('Sua sessão expirou. Entre de novo para salvar o que faltou.')
      }
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
    const withPlan: Profile = {
      ...profile,
      plan: stored.plan,
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
        const res = await apiFetch(`/api/profiles/slug-available?${params}`)
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
    if (USE_REAL_API && !(await contaAtivaConferida())) {
      throw sessaoCaiu('Entre na sua conta para ativar o plano.')
    }
    if (contaAtiva()) {
      const res = await escrever('/api/profiles/me/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (res.status === 401) {
        throw sessaoCaiu('Sua sessão expirou. Entre de novo para ativar o plano.')
      }
      if (!res.ok) throw new Error(parseApiMessage(await res.text().catch(() => '')) || 'Não foi possível ativar o plano.')
      return res.json()
    }
    await wait(220)
    // Mock: espelha a reconciliação do servidor. Agendamento e tema caem com o
    // plano; o ENDEREÇO só é reescrito ao SUBIR (para tirar o número automático do
    // Free), nunca ao descer. Conteúdo (vídeo, marca, perguntas) fica intacto no
    // rascunho — some da tela pelos portões de plano e volta se o plano voltar.
    const draft = loadDraft()
    const subiu = RANK_DO_PLANO[plan] > RANK_DO_PLANO[draft.plan]
    const next: Profile = {
      ...draft,
      plan,
      schedulingMode: canUseScheduling(plan) ? draft.schedulingMode : 'off',
      theme: isThemeUnlocked(getTheme(draft.theme), plan) ? draft.theme : 'papel',
    }
    const resolved = subiu ? { ...next, slug: resolveMockSlug(next, true) } : next
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved))
    return resolved
  },

  // Denúncia de um perfil — qualquer visitante pode. Sem backend real (dev),
  // apenas simula o envio (a denúncia não é persistida no mock em memória).
  async reportProfile(
    slug: string,
    input: { reason: ReportReason; details: string; reporterEmail?: string },
  ): Promise<{ ok: boolean }> {
    if (USE_REAL_API) {
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
    if (USE_REAL_API) {
      try {
        const res = await apiFetch('/api/ai/generate', {
          method: 'POST',
          // A sessão (cookie) vai junto porque é ela que prova o plano: o backend
          // decide o que cada plano gera a partir da assinatura no banco, nunca do
          // `plan` que vier no corpo (ver backend/src/ai/ai.controller.ts).
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
