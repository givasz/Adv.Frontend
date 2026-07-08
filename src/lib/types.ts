// Modelo de domínio — espelha o schema Prisma do backend (backend/prisma/schema.prisma)

import type { ThemeId } from './themes'

export type Plan = 'free' | 'pro' | 'premium'

/** Estado da conferência de OAB (workflow). A marca "OAB conferida" só quando 'verified'. */
export type OabStatus = 'none' | 'pending' | 'verified' | 'rejected'

/** Estado de moderação do perfil (resultado de denúncias avaliadas pelo admin). */
export type ModerationStatus = 'active' | 'warned' | 'partial' | 'restricted'

/** Situação de uma denúncia na fila do admin. */
export type ReportStatus = 'open' | 'resolved' | 'dismissed'

/** Motivos de denúncia pré-prontos (ver lib/reportReasons.ts). */
export type ReportReason =
  | 'oab_invalid'
  | 'result_promise'
  | 'pricing'
  | 'self_aggrandizement'
  | 'solicitation'
  | 'client_exposure'
  | 'impersonation'
  | 'offensive'
  | 'other'

export interface Report {
  id: string
  profileId: string
  reason: ReportReason
  details: string
  reporterEmail?: string | null
  status: ReportStatus
  resolution?: string | null
  createdAt: string
  handledAt?: string | null
}

export type SocialKind =
  | 'instagram'
  | 'linkedin'
  | 'website'
  | 'facebook'
  | 'youtube'
  | 'tiktok'

export interface SocialLink {
  kind: SocialKind
  url: string
}

export interface PracticeArea {
  id: string
  /** rótulo curto exibido como tag, ex: "Direito de Família" */
  label: string
  /** descrição gerada/aprovada — o que o advogado faz nessa área */
  description: string
}

export interface Highlight {
  id: string
  /** experiência genérica, sem identificar clientes (sigilo profissional) */
  title: string
  detail: string
}

/**
 * Artigo educativo exibido na seção "Conteúdo" do perfil. Caráter INFORMATIVO
 * (Prov. 205/2021 admite conteúdo jurídico educativo): título neutro, resumo
 * curto e tempo de leitura — nunca captação, promessa de resultado ou "case".
 */
export interface Article {
  id: string
  title: string
  /** resumo curto e sóbrio — o que o leitor aprende, sem tom promocional */
  summary: string
  /** tempo de leitura estimado em minutos */
  readingMinutes: number
  /** link externo opcional (blog, Jusbrasil, LinkedIn Artigos, etc.) */
  url?: string
}

export interface ContactChannels {
  whatsapp?: string // apenas dígitos, formato internacional: 5511999999999
  email?: string
  /** link de agendamento externo (Calendly, Google Agenda, etc.) */
  scheduling?: string
}

export interface ServiceMode {
  inPerson: boolean
  online: boolean
}

/**
 * Identidade visual própria (white-label) — recurso do plano Premium/Escritório.
 * Permite domínio próprio, cor de destaque e ocultar a marca "advoc.me". Não afeta
 * regras de conformidade: o conteúdo continua sujeito ao Prov. 205/2021.
 */
export interface Branding {
  /** nome do escritório exibido no rodapé no lugar de "advoc.me" */
  brandName?: string
  /** cor de destaque personalizada (hex, ex.: "#8a5a2b") */
  accent?: string
  /** ocultar o selo "criado com advoc.me" (só Premium) */
  hideWatermark?: boolean
  /** domínio próprio (ex.: "silva.adv.br") — informativo no protótipo (sem DNS real) */
  customDomain?: string
}

export interface Profile {
  slug: string
  name: string
  oabNumber: string // ex: "OAB/SP 123.456"
  oabVerified: boolean // espelha (oabStatus === 'verified') — controlado pela plataforma
  /** estado da conferência de OAB (só a plataforma promove a 'verified') */
  oabStatus?: OabStatus
  headline: string // frase curta sob o nome
  bio: string
  avatarUrl?: string
  city: string
  state: string
  regionNote?: string // ex: "Atendimento em toda a Grande SP"
  serviceMode: ServiceMode
  areas: PracticeArea[]
  highlights: Highlight[]
  /** artigos educativos (seção "Conteúdo") — informativo, não promocional */
  articles?: Article[]
  socials: SocialLink[]
  contact: ContactChannels
  plan: Plan
  /** tema visual escolhido pelo advogado — desbloqueado por plano (ver lib/themes.ts) */
  theme: ThemeId
  views?: number
  /** perfil publicado (visível no diretório/público). Espelha Profile.published no backend. */
  published?: boolean
  /** estado de moderação — presente no perfil do próprio dono (getMine). */
  moderationStatus?: ModerationStatus
  /** aviso do admin visível ao dono (motivo do aviso/restrição). */
  moderationNote?: string
  /** true no perfil PÚBLICO quando alguma seção foi ocultada pela moderação. */
  contentModerated?: boolean
  /** identidade visual própria (white-label) — Premium/Escritório. */
  branding?: Branding
  /**
   * Revisão do conjunto de regras (RULESET_REV) conferida na última edição.
   * Usada pelo monitor de mudanças normativas: se a revisão vigente for maior,
   * o perfil é reavaliado e o advogado é avisado. Ver lib/oab.ts.
   */
  policyRevChecked?: number
}

export interface DirectoryResult
  extends Pick<
    Profile,
    'slug' | 'name' | 'oabNumber' | 'oabVerified' | 'headline' | 'city' | 'state' | 'avatarUrl'
  > {
  areas: string[]
}

// ---- Geração de conteúdo por IA ----

export type GenerateKind = 'bio' | 'area'

export interface GenerateRequest {
  kind: GenerateKind
  keywords: string[]
  /** rótulo da área quando kind === 'area' */
  areaLabel?: string
  name?: string
}

export interface GenerateResult {
  text: string
  /** avisos de conformidade OAB detectados no rascunho */
  complianceNotes: string[]
  /** true se o texto veio do template seguro (IA indisponível ou reprovada no check) */
  usedFallback?: boolean
  /** versão da política de publicidade aplicada na verificação (ex.: "Prov. 205/2021") */
  policyVersion?: string
}
