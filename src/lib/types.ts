// Modelo de domínio — espelha o schema Prisma do backend (backend/prisma/schema.prisma)

import type { ThemeId } from './themes'
import type { CardConfig } from './cardArt'
import type { VideoOrientation } from './video'
import type { Subscription } from './assinatura'
import type { Endereco } from './endereco'

export type Plan = 'free' | 'pro' | 'premium'

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

/**
 * Pergunta frequente respondida pelo advogado no perfil (seção "Perguntas
 * frequentes"). Recurso dos planos pagos: 2 no Pro, 5 no Max.
 *
 * Prov. 205/2021: responder dúvidas de forma EDUCATIVA e geral é informação
 * permitida — a resposta não pode virar captação, promessa de resultado, oferta
 * de honorários nem consulta sobre um caso concreto. Textos curtos de propósito.
 */
export interface Faq {
  id: string
  /** a dúvida, na forma como o cliente pergunta */
  question: string
  /** resposta curta, educativa e geral — passa pelo checkCompliance */
  answer: string
}

export interface ContactChannels {
  whatsapp?: string // apenas dígitos, formato internacional: 5511999999999
  email?: string
  /** link de agendamento externo (Calendly, Google Agenda, etc.) — usado no modo "external" */
  scheduling?: string
}

/**
 * Como o botão "Agendar" se comporta no perfil:
 *   'off'      → sem botão de agendamento
 *   'external' → abre um link externo (Calendly/Google) — usa contact.scheduling
 *   'native'   → agenda própria do advoc.me (o cliente marca dia/hora e o advogado confirma)
 */
// 'whatsapp': o cliente preenche assunto + preferência de horário e a mensagem
// vai pelo WhatsApp do advogado (sem calendário/slots). 'external': link Calendly/Google.
// 'assistant': assistente virtual — uma conversa guiada (dia, horário, assunto) que
// termina no WhatsApp do advogado. Ver lib/assistant.ts.
export type SchedulingMode = 'off' | 'external' | 'whatsapp' | 'assistant'

/** Um dia da semana atendido pelo assistente virtual, com os horários oferecidos. */
export interface AssistantDay {
  /** 0=domingo … 6=sábado */
  weekday: number
  /** horários oferecidos nesse dia, em "HH:MM" (ordenados, sem repetição) */
  times: string[]
}

/**
 * Configuração do assistente virtual de agendamento. O assistente NÃO presta
 * orientação jurídica nem negocia contratação: ele apenas coleta dia, horário e
 * assunto e monta uma mensagem para o WhatsApp do advogado (Prov. 205/2021 —
 * contato informativo, sem captação).
 */
export interface AssistantConfig {
  /** dias/horários da semana que o assistente oferece ao visitante */
  days: AssistantDay[]
  /** duração indicativa da conversa, em minutos (só informativa) */
  durationMin: number
  /** antecedência mínima entre o pedido e o horário oferecido, em horas */
  leadHours: number
  /** até quantos dias à frente sugerir datas */
  horizonDays: number
  /** frase de abertura personalizada (opcional) — passa pela checagem de conformidade */
  greeting?: string
  /**
   * Balão no canto da página pública, que segue a rolagem e abre a conversa.
   *
   * Desligado por padrão, e é o advogado quem liga. Um elemento que persegue o
   * visitante é o oposto da sobriedade que o Prov. 205/2021 pede — ele cabe em
   * quem atende muito pelo perfil, e não cabe em quem prefere uma página
   * discreta. Perk de plano pago (Pro e Max): a trava vale no servidor.
   */
  floating?: boolean
}

/**
 * Configuração da grade de atendimento. Nasceu para a agenda-calendário, que foi
 * REMOVIDA — ela guardava nome, WhatsApp e o assunto do visitante no nosso banco,
 * sem tela que a usasse e sem aviso de privacidade. O que sobrou aqui é só a
 * preferência do advogado, ainda lida pelo assistente.
 */
export interface BookingConfig {
  /** dias da semana atendidos — 0=domingo … 6=sábado */
  weekdays: number[]
  /** início do expediente em minutos desde a meia-noite (ex.: 540 = 09:00) */
  startMin: number
  /** fim do expediente em minutos (ex.: 1080 = 18:00) */
  endMin: number
  /** duração de cada horário, em minutos */
  slotMin: number
  /** antecedência mínima para marcar, em horas */
  leadHours: number
  /** até quantos dias à frente é possível marcar */
  horizonDays: number
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
  /**
   * Domínio que o advogado PRETENDE usar (ex.: "silva.adv.br"). Hoje é só uma
   * intenção guardada — lista de espera do recurso, sem DNS e sem efeito no
   * perfil. Ver BrandingCard: a interface diz isso com todas as letras.
   */
  customDomain?: string
}

export interface Profile {
  slug: string
  /** true quando o usuário editou o endereço à mão — aí o slug para de seguir o
   *  nome automaticamente. Sem isso, o endereço acompanha o nome (estilo linktree). */
  slugCustom?: boolean
  name: string
  // Número informado pelo PRÓPRIO advogado — a plataforma não confere nem valida.
  // O perfil público expõe, ao lado dele, um link para a consulta do CNA (base
  // oficial da OAB), igual para todos os planos. Ver components/ui/CnaLink.
  oabNumber: string // ex: "OAB/SP 123.456"
  headline: string // frase curta sob o nome
  bio: string
  avatarUrl?: string
  city: string
  state: string
  /**
   * Endereço do escritório — rua, número, bairro e CEP. Opcional e com
   * interruptor próprio (`publico`): quem atende de casa preenche para o
   * cartão de contato sem publicar. Ver lib/endereco.ts.
   */
  address?: Endereco
  regionNote?: string // ex: "Atendimento em toda a Grande SP"
  serviceMode: ServiceMode
  areas: PracticeArea[]
  /** perguntas frequentes respondidas pelo advogado — informativo, não promocional */
  faqs?: Faq[]
  /**
   * Vídeo de apresentação (plano Max). Guardamos só o LINK de YouTube/Vimeo —
   * sem upload. Ver lib/video.ts para as formas aceitas e o porquê.
   */
  videoUrl?: string
  /** legenda curta sob o vídeo — passa pela checagem de conformidade */
  videoCaption?: string
  /**
   * Enquadramento: deitado (16:9) ou em pé (9:16). Ausente ou `auto` deixa o
   * sistema deduzir — ver `orientacaoDoVideo` em lib/video.ts.
   */
  videoOrientation?: VideoOrientation
  socials: SocialLink[]
  contact: ContactChannels
  /** comportamento do botão "Agendar" (ver SchedulingMode). Ausente = derivar de contact.scheduling. */
  schedulingMode?: SchedulingMode
  /** config da agenda nativa (só relevante no modo 'native') */
  booking?: BookingConfig
  /** config do assistente virtual (só relevante no modo 'assistant') */
  assistant?: AssistantConfig
  /**
   * O plano que VALE AGORA. Não é necessariamente o que foi contratado: quando a
   * cobrança falha e a carência acaba, o servidor devolve `free` aqui mesmo com o
   * Max gravado no banco. É de propósito — assim todo portão do produto continua
   * lendo um campo só, sem precisar saber que cobrança existe.
   *
   * O que foi contratado, e por que está ou não valendo, vem em `subscription`.
   */
  plan: Plan
  /**
   * Situação da assinatura — presente só no perfil do próprio dono (getMine). O
   * visitante não tem nada a ver com a cobrança de quem ele está lendo.
   * Ver lib/assinatura.ts.
   */
  subscription?: Subscription
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
   * Cartão de visita para impressão (plano Max). Guarda só a ESCOLHA do advogado
   * — modelo e o que aparece; o conteúdo continua vindo do perfil, para o cartão
   * nunca dizer um telefone que o perfil já corrigiu. Ver lib/cardArt.ts.
   */
  card?: CardConfig
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
    'slug' | 'name' | 'oabNumber' | 'headline' | 'city' | 'state' | 'avatarUrl'
  > {
  areas: string[]
}

// ---- Geração de conteúdo por IA ----

export type GenerateKind = 'bio' | 'area' | 'headline' | 'improve' | 'faq'

export interface GenerateRequest {
  kind: GenerateKind
  keywords: string[]
  /** rótulo da área quando kind === 'area' */
  areaLabel?: string
  name?: string
  /** cidade/UF do advogado — dá contexto e naturalidade ao texto */
  city?: string
  /** rótulos das áreas de atuação do perfil — enriquecem a bio */
  areas?: string[]
  /** texto atual a revisar quando kind === 'improve' */
  currentText?: string
  /** plano do perfil — controla profundidade/enriquecimento no backend */
  plan?: Plan
  /**
   * Teto de caracteres do campo de destino. Vai no prompt E é aplicado ao texto
   * devolvido: gerar acima do limite deixava o perfil impossível de salvar.
   */
  maxChars?: number
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
