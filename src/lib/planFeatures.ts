// O QUE UM PLANO ADICIONA ao perfil — fonte única do "o que abriu para mim".
//
// Antes, assinar um plano não dizia nada: o advogado voltava ao editor e tinha de
// caçar sozinho o que havia mudado (ou, pior, refazia o perfil inteiro pelo
// assistente de criação). Aqui cada recurso pago vira um item concreto com:
//   • o ganho em uma frase (nada de jargão de assinatura),
//   • para onde ir no editor (link direto para a seção, sem refazer nada),
//   • e um `done(profile)` que faz o item SUMIR quando já está configurado.
//
// É esse `done` que garante o comportamento pedido: depois da primeira vez, só
// sobra o que ainda é novo. O checklist encolhe sozinho conforme o perfil evolui.

import type { Plan, Profile } from './types'
import { AREA_LIMIT, CHAR_LIMITS, FAQ_LIMIT } from './plans'
import { resolveSchedulingMode } from './booking'
import { THEMES, isThemeUnlocked } from './themes'
import { parseVideoUrl } from './video'

export interface PlanFeature {
  key: string
  /** menor plano que inclui o recurso */
  plan: Exclude<Plan, 'free'>
  /** ganho, em forma de coisa que passa a existir no perfil */
  title: string
  /** uma linha explicando o que muda para quem visita */
  body: string
  /** seção do editor que configura o recurso (link direto) */
  to: string
  /** rótulo do botão do checklist */
  cta: string
  /**
   * true quando o recurso já está valendo sem o advogado fazer nada (endereço
   * limpo, marca d'água removida). Esses aparecem como "já aplicado", nunca como
   * tarefa pendente.
   */
  automatic?: boolean
  /** já aproveitado neste perfil? Item concluído sai do checklist. */
  done: (p: Profile) => boolean
}

const RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

const freeThemes = THEMES.filter((t) => isThemeUnlocked(t, 'free')).map((t) => t.id)
const filledAreas = (p: Profile) => p.areas.filter((a) => a.label.trim()).length

// ⚠️ Domínio próprio NÃO está aqui de propósito. O checklist é a lista do que dá
// para fazer AGORA; enquanto a plataforma não tem domínio no ar, o item seria uma
// tarefa impossível de concluir — e, pior, ele se marcava como feito só por haver
// texto no campo. Volta quando o recurso existir de verdade.
export const PLAN_FEATURES: PlanFeature[] = [
  // ---- Pro ----
  {
    key: 'agenda',
    plan: 'pro',
    title: 'Assistente virtual de agendamento',
    body: 'Uma conversa guiada no seu perfil oferece só os seus horários e manda o pedido pronto no seu WhatsApp.',
    to: '/editor?section=agenda',
    cta: 'Montar minha grade',
    done: (p) => resolveSchedulingMode(p) !== 'off',
  },
  {
    key: 'faq',
    plan: 'pro',
    title: `Até ${FAQ_LIMIT.pro} perguntas frequentes`,
    // O Free já responde UMA (mudou em 04/09/2026). O que o Pro acrescenta é a
    // segunda — e o `done` conta a partir da cota do Free, senão o item nasceria
    // concluído para quem já tinha respondido a primeira de graça.
    body: `Você tinha ${FAQ_LIMIT.free} no Free. Cada dúvida a mais respondida é uma pessoa que encontra a própria pergunta no seu perfil.`,
    to: '/editor?section=faq',
    cta: 'Responder mais uma',
    done: (p) => (p.faqs ?? []).length > FAQ_LIMIT.free,
  },
  {
    key: 'metricas',
    plan: 'pro',
    title: 'Relatório do que acontece no perfil',
    body: 'Quantas visitas, quais botões foram usados e em que horários você é mais procurado. Contamos acontecimentos, nunca pessoas.',
    to: '/editor?section=analytics',
    cta: 'Ver meu relatório',
    // Não há o que "concluir" aqui: o relatório passa a existir junto com o plano,
    // e quem o preenche é o movimento do perfil, não uma ação do advogado.
    automatic: true,
    done: () => true,
  },
  {
    key: 'endereco',
    plan: 'pro',
    title: 'Seu nome no endereço, sem número',
    body: 'O endereço do perfil deixa de ter o número aleatório do Free e passa a ser editável.',
    to: '/editor?section=identidade',
    cta: 'Ver meu endereço',
    automatic: true,
    done: (p) => !/-\d{4}$/.test(p.slug),
  },
  {
    key: 'areas',
    plan: 'pro',
    title: `Até ${AREA_LIMIT.pro} áreas de atuação`,
    body: `Você tinha ${AREA_LIMIT.free} no Free — a principal. Cada área a mais é uma porta a mais para quem procura por assunto.`,
    to: '/editor?section=identidade',
    cta: 'Adicionar áreas',
    done: (p) => filledAreas(p) > AREA_LIMIT.free,
  },
  {
    key: 'bio',
    plan: 'pro',
    title: `Bio de até ${CHAR_LIMITS.pro.bio} caracteres`,
    body: 'Espaço para contar a sua trajetória com calma — e a IA pode reescrever o texto para você.',
    to: '/editor?section=bio',
    cta: 'Ampliar minha bio',
    done: (p) => p.bio.length > CHAR_LIMITS.free.bio,
  },
  {
    key: 'temas',
    plan: 'pro',
    title: 'Temas visuais exclusivos',
    body: 'Identidades visuais que só os planos pagos têm — o perfil deixa de parecer um modelo.',
    to: '/editor?section=aparencia',
    cta: 'Escolher um tema',
    done: (p) => !freeThemes.includes(p.theme),
  },
  {
    key: 'qrcode',
    plan: 'pro',
    title: 'Cartão digital com QR Code',
    body: 'Baixe o QR do seu perfil e o seu contato (vCard) para usar em cartões, vitrines e assinaturas.',
    to: '/editor?section=qrcode',
    cta: 'Baixar meu QR',
    automatic: true,
    done: () => false,
  },

  // ---- Max ----
  {
    key: 'faq_max',
    plan: 'premium',
    title: `Até ${FAQ_LIMIT.premium} perguntas frequentes`,
    body: `Eram ${FAQ_LIMIT.pro} no Pro. Mais dúvidas respondidas é mais gente que encontra a própria pergunta no seu perfil.`,
    to: '/editor?section=faq',
    cta: 'Adicionar perguntas',
    done: (p) => (p.faqs ?? []).length > FAQ_LIMIT.pro,
  },
  {
    key: 'cartao',
    plan: 'premium',
    title: 'Cartão de visita pronto para a gráfica',
    body: 'A arte do seu cartão sai daqui em PDF, com frente, verso e o QR que abre o seu perfil. É só levar à gráfica.',
    to: '/editor?section=cartao',
    cta: 'Montar meu cartão',
    done: (p) => !!p.card,
  },
  {
    key: 'video',
    plan: 'premium',
    title: 'Vídeo de apresentação',
    body: 'Um vídeo curto seu no fim do perfil — ver e ouvir a pessoa aproxima mais que texto. Você envia ao YouTube (tem passo a passo) e cola o link aqui.',
    to: '/editor?section=video',
    cta: 'Colar meu link',
    done: (p) => !!parseVideoUrl(p.videoUrl),
  },
  {
    key: 'marca',
    plan: 'premium',
    title: 'Sua marca, sem a nossa',
    body: 'Cor de destaque própria e o rodapé “criado com advoc.me” some do seu perfil.',
    to: '/editor?section=marca',
    cta: 'Personalizar',
    done: (p) => !!(p.branding?.brandName || p.branding?.hideWatermark || p.branding?.accent),
  },
]

/** Tudo que o plano atual inclui (do plano e de todos abaixo dele). */
export function featuresIncluded(plan: Plan): PlanFeature[] {
  return PLAN_FEATURES.filter((f) => RANK[plan] >= RANK[f.plan])
}

/** O que o plano adiciona SOBRE o plano anterior — usado logo após assinar. */
export function featuresAddedBy(plan: Exclude<Plan, 'free'>): PlanFeature[] {
  return PLAN_FEATURES.filter((f) => f.plan === plan)
}

/**
 * O checklist que aparece ao advogado: recursos do plano dele que ainda não estão
 * aproveitados. Um perfil já montado só vê aqui o que é NOVO — nunca pede para
 * refazer o que já existe.
 */
export function featuresPending(profile: Profile): PlanFeature[] {
  return featuresIncluded(profile.plan).filter((f) => !f.automatic && !f.done(profile))
}

/** Quantos recursos do plano já estão em uso (para a barra de aproveitamento). */
export function featureProgress(profile: Profile): { done: number; total: number } {
  const list = featuresIncluded(profile.plan).filter((f) => !f.automatic)
  return { done: list.filter((f) => f.done(profile)).length, total: list.length }
}
