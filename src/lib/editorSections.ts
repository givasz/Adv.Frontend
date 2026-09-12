// As SEÇÕES do editor — fonte única do que dá para mudar no perfil e de onde
// cada coisa mora.
//
// Três telas liam a mesma lista de lugares diferentes: o editor tinha os
// títulos, o painel tinha os destinos dos passos do índice e o onboarding tinha
// outra cópia desses destinos. Quando o "identidade" foi dividido em três, teria
// sido preciso acertar as três — e esquecer uma mandaria a pessoa para a seção
// errada sem erro nenhum.
//
// Juntar aqui é o que permite duas coisas que não existiam:
//   • o painel mostra, para cada seção, O QUE JÁ ESTÁ PREENCHIDO (`resumo`), em
//     vez de só listar recursos — é assim que se controla um perfil sem abrir
//     cada tela para conferir;
//   • o editor tem uma busca que leva ao CAMPO ("foto", "whatsapp", "cep"), não
//     à página inteira. Cada campo tem uma âncora (`#foto`) e palavras pelas
//     quais alguém o procuraria.

import type { Plan, Profile } from './types'
import {
  AREA_LIMIT,
  FAQ_LIMIT,
  canUseDigitalCard,
  canUsePrintCard,
  canUseScheduling,
  canUseVideo,
} from './plans'
import { resolveSchedulingMode } from './booking'
import { resolveAssistantConfig, weeklySlotCount } from './assistant'
import { getTheme, THEMES, isThemeUnlocked } from './themes'
import { parseVideoUrl } from './video'
import { enderecoVisivel, temEndereco } from './endereco'

export type SectionId =
  | 'identidade'
  | 'local'
  | 'areas'
  | 'bio'
  | 'redes'
  | 'agenda'
  | 'faq'
  | 'video'
  | 'aparencia'
  | 'marca'
  | 'analytics'
  | 'qrcode'
  | 'cartao'
  | 'conteudo'
  | 'plano'

/**
 * Como as seções se agrupam na navegação e no painel:
 *   perfil       → o que aparece na página pública (conteúdo)
 *   ferramentas  → o que se TIRA do perfil (relatório, QR, cartão, documentos)
 *   conta        → plano e cobrança
 */
export type SectionGroup = 'perfil' | 'ferramentas' | 'conta'

export const GROUP_LABEL: Record<SectionGroup, string> = {
  perfil: 'Seu perfil',
  ferramentas: 'Ferramentas',
  conta: 'Conta',
}

/** Um campo com âncora própria dentro da seção — é para ele que a busca leva. */
export interface Campo {
  /** id do elemento no DOM (`#foto`) */
  id: string
  label: string
  /** pelo que alguém procuraria este campo, além do próprio rótulo */
  keywords?: string[]
}

/** O que o painel diz sobre a seção sem abri-la. */
export interface Resumo {
  texto: string
  /** true quando falta algo que o plano atual já deixa preencher */
  pendente?: boolean
}

export interface SectionMeta {
  id: SectionId
  /** título da tela do editor */
  title: string
  /** rótulo curto — chip da navegação e cartão do painel */
  short: string
  subtitle: string
  group: SectionGroup
  /** pelo que alguém procuraria a seção inteira */
  keywords: string[]
  campos: Campo[]
  /** menor plano que abre a seção; ausente = todos os planos */
  plan?: Exclude<Plan, 'free'>
  resumo: (p: Profile) => Resumo
}

const SOCIAL_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  website: 'Site',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
}

const filledAreas = (p: Profile) => p.areas.filter((a) => a.label.trim())

/** Corta um texto na última palavra que cabe, com reticências. */
function recorte(texto: string, max: number): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= max) return limpo
  const corte = limpo.slice(0, max)
  const ultimoEspaco = corte.lastIndexOf(' ')
  return `${(ultimoEspaco > max * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trim()}…`
}

/** "3 de 5 respondidas" / "1 de 1 respondida". */
function contagem(n: number, total: number, singular: string, plural: string): string {
  return `${n} de ${total} ${n === 1 ? singular : plural}`
}

const RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

export const SECTIONS: Record<SectionId, SectionMeta> = {
  identidade: {
    id: 'identidade',
    title: 'Nome, OAB e foto',
    short: 'Dados e foto',
    subtitle: 'Como você aparece para quem chega: nome, inscrição, foto e a frase de abertura.',
    group: 'perfil',
    keywords: ['identidade', 'perfil', 'dados', 'cadastro'],
    campos: [
      { id: 'nome', label: 'Nome completo', keywords: ['nome'] },
      { id: 'oab', label: 'Número da OAB', keywords: ['oab', 'inscrição', 'registro'] },
      {
        id: 'endereco-perfil',
        label: 'Endereço do perfil',
        keywords: ['link', 'url', 'endereço do perfil', 'slug', 'nome no link'],
      },
      { id: 'foto', label: 'Foto de perfil', keywords: ['foto', 'imagem', 'avatar', 'retrato'] },
      {
        id: 'frase',
        label: 'Frase de apresentação',
        keywords: ['frase', 'título', 'headline', 'subtítulo'],
      },
    ],
    resumo: (p) => {
      const faltas = [
        !p.avatarUrl && 'foto',
        !p.headline.trim() && 'frase',
        !p.oabNumber.trim() && 'OAB',
      ].filter(Boolean) as string[]
      if (faltas.length) return { texto: `Falta: ${faltas.join(', ')}.`, pendente: true }
      return { texto: `${p.oabNumber} · com foto e frase.` }
    },
  },

  bio: {
    id: 'bio',
    title: 'Sua apresentação',
    short: 'Apresentação',
    subtitle: 'Poucas linhas sobre você. A IA pode começar.',
    group: 'perfil',
    keywords: ['bio', 'sobre', 'apresentação', 'texto', 'trajetória', 'descrição'],
    campos: [{ id: 'bio', label: 'Sobre você' }],
    resumo: (p) =>
      p.bio.trim()
        ? { texto: recorte(p.bio, 72) }
        : { texto: 'Ainda sem texto de apresentação.', pendente: true },
  },

  redes: {
    id: 'redes',
    title: 'Seus canais',
    short: 'Contato e redes',
    subtitle: 'Por onde os clientes falam com você.',
    group: 'perfil',
    keywords: ['contato', 'canais', 'redes', 'redes sociais'],
    campos: [
      {
        id: 'redes',
        label: 'Redes e site',
        keywords: ['instagram', 'linkedin', 'site', 'facebook', 'youtube', 'tiktok'],
      },
      { id: 'whatsapp', label: 'WhatsApp', keywords: ['whatsapp', 'zap', 'telefone', 'celular'] },
      { id: 'email', label: 'E-mail', keywords: ['e-mail', 'email'] },
    ],
    resumo: (p) => {
      const canais = [
        p.contact.whatsapp && 'WhatsApp',
        p.contact.email && 'E-mail',
        ...p.socials.map((s) => SOCIAL_LABEL[s.kind] ?? s.kind),
      ].filter(Boolean) as string[]
      if (!canais.length) return { texto: 'Nenhum canal de contato ainda.', pendente: true }
      return { texto: canais.join(' · '), pendente: !p.contact.whatsapp }
    },
  },

  areas: {
    id: 'areas',
    title: 'Áreas de atuação',
    short: 'Áreas',
    subtitle: 'Os assuntos em que você atua — cada um é uma porta para quem procura por tema.',
    group: 'perfil',
    keywords: ['área', 'áreas', 'atuação', 'especialidade', 'assunto', 'matéria'],
    campos: [{ id: 'areas', label: 'Áreas de atuação' }],
    resumo: (p) => {
      const areas = filledAreas(p)
      if (!areas.length) return { texto: 'Nenhuma área definida.', pendente: true }
      const nomes = recorte(areas.map((a) => a.label.trim()).join(', '), 60)
      return { texto: `${contagem(areas.length, AREA_LIMIT[p.plan], 'área', 'áreas')}: ${nomes}` }
    },
  },

  local: {
    id: 'local',
    title: 'Onde você atende',
    short: 'Local e endereço',
    subtitle: 'Cidade, forma de atendimento e o endereço do escritório.',
    group: 'perfil',
    keywords: ['local', 'localização', 'onde', 'atende'],
    campos: [
      { id: 'cidade', label: 'Cidade e estado', keywords: ['cidade', 'estado', 'uf', 'município'] },
      { id: 'regiao', label: 'Observação de região', keywords: ['região', 'observação'] },
      {
        id: 'atendimento',
        label: 'Presencial ou online',
        keywords: ['presencial', 'online', 'atendimento', 'remoto'],
      },
      {
        id: 'endereco',
        label: 'Endereço do escritório',
        keywords: ['endereço', 'cep', 'rua', 'escritório', 'mapa', 'número', 'bairro'],
      },
    ],
    resumo: (p) => {
      const cidade = [p.city, p.state].filter(Boolean).join('/')
      if (!cidade) return { texto: 'Cidade não informada.', pendente: true }
      const modo =
        p.serviceMode.inPerson && p.serviceMode.online
          ? 'presencial e online'
          : p.serviceMode.online
            ? 'só online'
            : p.serviceMode.inPerson
              ? 'só presencial'
              : ''
      const endereco = enderecoVisivel(p.address)
        ? 'endereço no mapa'
        : temEndereco(p.address)
          ? 'endereço guardado, não exibido'
          : 'sem endereço'
      return { texto: [cidade, modo, endereco].filter(Boolean).join(' · ') }
    },
  },

  agenda: {
    id: 'agenda',
    title: 'Sua agenda',
    short: 'Agenda',
    subtitle: 'Deixe que marquem um horário direto no perfil.',
    group: 'perfil',
    plan: 'pro',
    keywords: ['agenda', 'horário', 'horários', 'assistente', 'agendamento', 'dias', 'atendimento', 'marcar'],
    campos: [],
    resumo: (p) => {
      if (!canUseScheduling(p.plan)) return { texto: 'Assistente virtual e horários — a partir do Pro.' }
      const modo = resolveSchedulingMode(p)
      if (modo === 'assistant') {
        const n = weeklySlotCount(resolveAssistantConfig(p.assistant))
        return { texto: `Assistente ligado · ${n} ${n === 1 ? 'horário' : 'horários'} por semana.` }
      }
      if (modo === 'whatsapp') return { texto: 'Pedido de horário pelo WhatsApp.' }
      if (modo === 'external') return { texto: 'Link de agenda externa.' }
      return { texto: 'Desligada — ninguém marca horário pelo perfil.', pendente: true }
    },
  },

  faq: {
    id: 'faq',
    title: 'Perguntas frequentes',
    short: 'Perguntas',
    subtitle: 'As dúvidas que você mais ouve, respondidas por você no perfil.',
    group: 'perfil',
    keywords: ['faq', 'pergunta', 'perguntas', 'dúvida', 'dúvidas', 'respostas', 'frequentes'],
    campos: [],
    resumo: (p) => {
      const n = (p.faqs ?? []).filter((f) => f.question.trim()).length
      const total = FAQ_LIMIT[p.plan]
      return {
        texto: `${contagem(n, total, 'respondida', 'respondidas')}.`,
        pendente: n === 0,
      }
    },
  },

  aparencia: {
    id: 'aparencia',
    title: 'A cara do perfil',
    short: 'Tema',
    subtitle: 'Escolha um visual que combine com você.',
    group: 'perfil',
    keywords: ['tema', 'aparência', 'visual', 'cor', 'cores', 'estilo', 'fonte', 'escuro', 'claro', 'layout'],
    campos: [],
    resumo: (p) => {
      const livres = THEMES.filter((t) => isThemeUnlocked(t, p.plan)).length
      return { texto: `Tema ${getTheme(p.theme).name} · ${livres} de ${THEMES.length} liberados.` }
    },
  },

  video: {
    id: 'video',
    title: 'Seu vídeo',
    short: 'Vídeo',
    subtitle: 'Um vídeo curto de apresentação no fim do perfil — do YouTube ou do Vimeo.',
    group: 'perfil',
    plan: 'premium',
    keywords: ['vídeo', 'video', 'youtube', 'vimeo', 'filme'],
    campos: [],
    resumo: (p) => {
      if (!canUseVideo(p.plan)) return { texto: 'Vídeo de apresentação — no Max.' }
      return parseVideoUrl(p.videoUrl)
        ? { texto: 'Vídeo no fim do perfil.' }
        : { texto: 'Sem vídeo ainda.', pendente: true }
    },
  },

  marca: {
    id: 'marca',
    title: 'Sua marca',
    short: 'Marca',
    subtitle: 'Sua cor, o seu nome no rodapé e sem a marca advoc.me.',
    group: 'perfil',
    plan: 'premium',
    keywords: ['marca', 'rodapé', 'logo', 'cor de destaque', 'marca d’água', "marca d'agua", 'escritório', 'white label'],
    campos: [],
    resumo: (p) => {
      if (RANK[p.plan] < RANK.premium) return { texto: 'Cor própria e rodapé sem a advoc.me — no Max.' }
      const b = p.branding
      const partes = [
        b?.accent && 'cor própria',
        b?.brandName && 'nome no rodapé',
        b?.hideWatermark && 'sem marca advoc.me',
      ].filter(Boolean) as string[]
      return partes.length
        ? { texto: partes.join(' · ') }
        : { texto: 'Ainda com a marca advoc.me.', pendente: true }
    },
  },

  analytics: {
    id: 'analytics',
    title: 'Quem visita você',
    short: 'Visitas',
    subtitle: 'Descubra como as pessoas encontram seu perfil.',
    group: 'ferramentas',
    keywords: ['visitas', 'métricas', 'relatório', 'cliques', 'acessos', 'estatísticas', 'analytics', 'números'],
    campos: [],
    resumo: () => ({ texto: 'Visitas e cliques dos últimos 30 dias.' }),
  },

  qrcode: {
    id: 'qrcode',
    title: 'Seu cartão digital',
    short: 'QR Code',
    subtitle: 'Um QR Code para compartilhar onde quiser.',
    group: 'ferramentas',
    plan: 'pro',
    keywords: ['qr', 'qr code', 'qrcode', 'cartão digital', 'vcard', 'salvar contato', 'compartilhar'],
    campos: [],
    resumo: (p) =>
      canUseDigitalCard(p.plan)
        ? { texto: 'QR do perfil e contato (vCard) para baixar.' }
        : { texto: 'QR e vCard para baixar — a partir do Pro.' },
  },

  cartao: {
    id: 'cartao',
    title: 'Seu cartão de visita',
    short: 'Cartão impresso',
    subtitle: 'A arte do seu cartão, pronta para levar à gráfica.',
    group: 'ferramentas',
    plan: 'premium',
    keywords: ['cartão de visita', 'cartão', 'gráfica', 'impresso', 'imprimir', 'pdf', 'arte'],
    campos: [],
    resumo: (p) => {
      if (!canUsePrintCard(p.plan)) return { texto: 'Arte pronta para a gráfica — no Max.' }
      return p.card
        ? { texto: 'Arte montada · PDF pronto para a gráfica.' }
        : { texto: 'Ainda sem arte montada.', pendente: true }
    },
  },

  conteudo: {
    id: 'conteudo',
    title: 'Documentos',
    short: 'Documentos',
    subtitle: 'Reúna seus termos legais e a política de privacidade.',
    group: 'ferramentas',
    keywords: ['documentos', 'privacidade', 'termos', 'política', 'lgpd', 'conformidade', 'comprovante', 'auditoria'],
    campos: [],
    resumo: () => ({ texto: 'Política de privacidade e comprovante de conformidade.' }),
  },

  plano: {
    id: 'plano',
    title: 'Seu plano',
    short: 'Plano',
    subtitle: 'Troque quando quiser. Mais recursos, mais alcance.',
    group: 'conta',
    keywords: ['plano', 'assinatura', 'pro', 'max', 'free', 'pagamento', 'cobrança', 'cancelar', 'fatura', 'preço', 'upgrade'],
    campos: [],
    resumo: (p) => ({ texto: p.plan === 'free' ? 'Free' : p.plan === 'pro' ? 'Pro' : 'Max' }),
  },
}

export const SECTION_IDS = Object.keys(SECTIONS) as SectionId[]

/** Ordem de exibição dentro de cada grupo — do mais mexido para o menos. */
export const SECTIONS_BY_GROUP: Record<SectionGroup, SectionId[]> = {
  perfil: ['identidade', 'bio', 'redes', 'areas', 'local', 'agenda', 'faq', 'aparencia', 'video', 'marca'],
  ferramentas: ['analytics', 'qrcode', 'cartao', 'conteudo'],
  conta: ['plano'],
}

export function isSectionId(v: string | null | undefined): v is SectionId {
  return !!v && v in SECTIONS
}

/** A seção está aberta neste plano? (sem plano exigido = sempre) */
export function sectionUnlocked(id: SectionId, plan: Plan): boolean {
  const need = SECTIONS[id].plan
  return !need || RANK[plan] >= RANK[need]
}

/** Endereço de uma seção (e, opcionalmente, de um campo dentro dela). */
export function editorPath(section: SectionId, campo?: string): string {
  return `/editor?section=${section}${campo ? `#${campo}` : ''}`
}

/**
 * Para onde cada fator do Índice de Confiança leva. Era uma tabela no painel e
 * outra no onboarding — a mesma, copiada.
 */
export const DESTINO_DO_FATOR: Record<string, string> = {
  nome: editorPath('identidade', 'nome'),
  cidade: editorPath('local', 'cidade'),
  oab: editorPath('identidade', 'oab'),
  bio: editorPath('bio', 'bio'),
  whatsapp: editorPath('redes', 'whatsapp'),
  area1: editorPath('areas', 'areas'),
  area2: editorPath('areas', 'areas'),
  foto: editorPath('identidade', 'foto'),
  frase: editorPath('identidade', 'frase'),
  redes: editorPath('redes', 'redes'),
  email: editorPath('redes', 'email'),
  faq: editorPath('faq'),
  agenda: editorPath('agenda'),
  marca: editorPath('marca'),
}

// ---- Busca -----------------------------------------------------------------

/** Um resultado da busca: uma seção ou um campo dentro dela. */
export interface AlvoDoEditor {
  section: SectionId
  campo?: string
  /** o que aparece na lista ("Foto de perfil") */
  label: string
  /** onde fica ("em Dados e foto") — vazio quando o alvo é a própria seção */
  onde: string
  to: string
}

/** Sem acento, sem caixa, sem espaço sobrando — para comparar o que se digita. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .trim()
}

/**
 * Pontua o quanto `termos` batem com o que se digitou: 4 quando algum termo É
 * o texto ("endereço" acha o endereço do escritório antes do "endereço do
 * perfil"), 3 quando algum termo COMEÇA pelo texto, 2 quando alguma palavra do
 * termo começa por ele, 1 quando só contém. Zero é "não bate".
 */
function pontuar(q: string, termos: string[]): number {
  let melhor = 0
  for (const t of termos) {
    const termo = normalizar(t)
    if (!termo) continue
    if (termo === q) return 4
    if (termo.startsWith(q)) melhor = Math.max(melhor, 3)
    else if (termo.split(/\s+/).some((w) => w.startsWith(q))) melhor = Math.max(melhor, 2)
    else if (termo.includes(q)) melhor = Math.max(melhor, 1)
  }
  return melhor
}
/**
 * Procura seções e campos pelo que a pessoa digitou. Campos vêm antes de
 * seções com a mesma pontuação: são o destino mais preciso. Tolerante a acento
 * ("endereco" acha "endereço") e a começo de palavra ("whats" acha WhatsApp).
 */
export function buscarNoEditor(texto: string, max = 6): AlvoDoEditor[] {
  const q = normalizar(texto)
  if (q.length < 2) return []
  const achados: { alvo: AlvoDoEditor; peso: number; ordem: number }[] = []
  let ordem = 0
  for (const id of SECTION_IDS) {
    const s = SECTIONS[id]
    for (const c of s.campos) {
      const peso = pontuar(q, [c.label, ...(c.keywords ?? [])])
      if (peso)
        achados.push({
          alvo: { section: id, campo: c.id, label: c.label, onde: s.short, to: editorPath(id, c.id) },
          peso: peso + 0.5,
          ordem: ordem++,
        })
    }
    const peso = pontuar(q, [s.title, s.short, ...s.keywords])
    if (peso)
      achados.push({
        alvo: { section: id, label: s.title, onde: '', to: editorPath(id) },
        peso,
        ordem: ordem++,
      })
  }
  return achados
    .sort((a, b) => b.peso - a.peso || a.ordem - b.ordem)
    .slice(0, max)
    .map((a) => a.alvo)
}
