// Modelo de domínio — espelha o schema Prisma do backend (backend/prisma/schema.prisma)

import type { ThemeId } from './themes'

export type Plan = 'free' | 'pro' | 'premium'

/** Estado da conferência de OAB (workflow). A marca "OAB conferida" só quando 'verified'. */
export type OabStatus = 'none' | 'pending' | 'verified' | 'rejected'

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
  socials: SocialLink[]
  contact: ContactChannels
  plan: Plan
  /** tema visual escolhido pelo advogado — desbloqueado por plano (ver lib/themes.ts) */
  theme: ThemeId
  views?: number
  /** perfil publicado (visível no diretório/público). Espelha Profile.published no backend. */
  published?: boolean
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
