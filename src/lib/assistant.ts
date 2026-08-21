// Assistente virtual de agendamento — a lógica por trás da conversa guiada do perfil.
//
// O assistente NÃO é uma IA nem presta qualquer orientação jurídica: é um roteiro
// fechado (dia → horário → assunto → nome) montado a partir da disponibilidade que o
// próprio advogado marcou. No fim, tudo vira UMA mensagem no WhatsApp dele.
//
// Conformidade (Prov. 205/2021 + CED): a Cartilha do CFOAB veda usar chats para
// captar clientela de forma disfarçada. Por isso o roteiro é estritamente operacional
// — nada de triagem de mérito, promessa de resultado, preço, urgência ou "consultoria"
// automática. O texto de abertura escrito pelo advogado passa pela mesma checagem de
// conformidade das demais peças (ver lib/oab.ts).

import { MONTHS_SHORT, WEEKDAYS_FULL, WEEKDAYS_SHORT } from './booking'
import type { AssistantConfig, AssistantDay, Profile } from './types'

/** Grade de horários oferecida no editor: 08:00 → 20:00, de 30 em 30 minutos. */
export const TIME_PRESETS: string[] = (() => {
  const out: string[] = []
  for (let m = 8 * 60; m <= 20 * 60; m += 30) out.push(minToTime(m))
  return out
})()

const WEEKDAY_TIMES_DEFAULT = ['09:00', '10:00', '14:00', '15:00', '16:00']

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  days: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, times: [...WEEKDAY_TIMES_DEFAULT] })),
  durationMin: 45,
  leadHours: 12,
  horizonDays: 14,
  greeting: '',
}

/** Quantos dias/horários o assistente pode oferecer, no máximo, em cada tela. */
export const MAX_DAY_CHIPS = 6

// ---- Conversão e ordenação de horários ----

export function minToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "14:30" → 870. Retorna NaN para entradas inválidas. */
export function timeToMin(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return NaN
  return h * 60 + min
}

/** Descarta lixo, remove repetidos e ordena cronologicamente. */
export function normalizeTimes(times: string[]): string[] {
  const valid = times.filter((t) => Number.isFinite(timeToMin(t)))
  return [...new Set(valid.map((t) => minToTime(timeToMin(t))))].sort(
    (a, b) => timeToMin(a) - timeToMin(b),
  )
}

/** Config sempre utilizável: preenche o que faltar e sanea dias/horários. */
export function resolveAssistantConfig(config?: AssistantConfig | null): AssistantConfig {
  const base = config ?? DEFAULT_ASSISTANT_CONFIG
  const byWeekday = new Map<number, string[]>()
  for (const d of base.days ?? []) {
    if (!Number.isInteger(d?.weekday) || d.weekday < 0 || d.weekday > 6) continue
    const times = normalizeTimes(d.times ?? [])
    if (!times.length) continue
    byWeekday.set(d.weekday, times)
  }
  const days: AssistantDay[] = [...byWeekday.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, times]) => ({ weekday, times }))
  return {
    days,
    durationMin: clamp(base.durationMin, 15, 180, DEFAULT_ASSISTANT_CONFIG.durationMin),
    leadHours: clamp(base.leadHours, 0, 168, DEFAULT_ASSISTANT_CONFIG.leadHours),
    horizonDays: clamp(base.horizonDays, 1, 90, DEFAULT_ASSISTANT_CONFIG.horizonDays),
    greeting: base.greeting ?? '',
  }
}

function clamp(v: unknown, min: number, max: number, dflt: number): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}

/** Total de horários marcados na semana — usado no resumo do editor. */
export function weeklySlotCount(config: AssistantConfig): number {
  return config.days.reduce((sum, d) => sum + d.times.length, 0)
}

// ---- Datas oferecidas na conversa ----

export interface AssistantDayOption {
  /** chave estável YYYY-MM-DD (hora local) */
  key: string
  date: Date
  weekday: number
  /** "Seg, 25 ago" — texto do chip */
  label: string
  /** "segunda-feira, 25 de agosto" — leitores de tela e resumo */
  longLabel: string
  /** "hoje" / "amanhã" quando aplicável, senão vazio */
  relative: string
  times: string[]
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Nome do dia por extenso, em minúsculas ("segunda-feira", "sábado"). */
export function weekdayLong(weekday: number): string {
  const name = WEEKDAYS_FULL[weekday] ?? ''
  const util = weekday >= 1 && weekday <= 5
  return `${name.toLowerCase()}${util ? '-feira' : ''}`
}

/**
 * Datas concretas que o assistente pode oferecer: percorre os próximos
 * `horizonDays` dias, mantém só os dias da semana configurados e, dentro deles, só
 * os horários que ainda respeitam a antecedência mínima. Dias sem horário livre
 * simplesmente não aparecem.
 */
export function buildAssistantDays(
  config: AssistantConfig,
  now: Date = new Date(),
): AssistantDayOption[] {
  const cfg = resolveAssistantConfig(config)
  const byWeekday = new Map(cfg.days.map((d) => [d.weekday, d.times]))
  const minTime = now.getTime() + cfg.leadHours * 3600_000
  const out: AssistantDayOption[] = []

  for (let i = 0; i <= cfg.horizonDays; i++) {
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() + i)
    const times = byWeekday.get(day.getDay())
    if (!times?.length) continue

    const free = times.filter((t) => {
      const slot = new Date(day)
      slot.setMinutes(timeToMin(t))
      return slot.getTime() >= minTime
    })
    if (!free.length) continue

    const wd = day.getDay()
    out.push({
      key: `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`,
      date: day,
      weekday: wd,
      label: `${WEEKDAYS_SHORT[wd]}, ${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`,
      longLabel: `${weekdayLong(wd)}, ${day.getDate()} de ${MONTHS_FULL[day.getMonth()]}`,
      relative: i === 0 ? 'hoje' : i === 1 ? 'amanhã' : '',
      times: free,
    })
  }
  return out
}

const MONTHS_FULL = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

// ---- Identidade do assistente ----

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

/** "Assistente virtual de Pedro" — sempre explícito de que não é a pessoa. */
export function assistantTitle(profile: Pick<Profile, 'name'>): string {
  const first = firstName(profile.name)
  return first ? `Assistente virtual de ${first}` : 'Assistente virtual'
}

// ---- Mensagem final (WhatsApp) ----

export interface AssistantAnswers {
  day?: AssistantDayOption
  time?: string
  /** 'presencial' | 'online' — só perguntado quando o perfil atende dos dois jeitos */
  format?: string
  subject?: string
  detail?: string
  name?: string
}

/** Resumo humano do horário escolhido: "segunda-feira, 25 de agosto às 14:00". */
export function formatChoice(answers: AssistantAnswers): string {
  if (!answers.day || !answers.time) return ''
  return `${answers.day.longLabel} às ${answers.time}`
}

/**
 * Monta a mensagem que o visitante envia ao advogado. Texto sóbrio e factual:
 * sem promessa, sem preço, sem apelo — só os dados do pedido.
 */
export function buildAssistantMessage(
  profile: Pick<Profile, 'name'>,
  answers: AssistantAnswers,
  durationMin?: number,
): string {
  const first = firstName(profile.name)
  const fields: (string | null)[] = [
    answers.name?.trim() ? `Nome: ${answers.name.trim()}` : null,
    formatChoice(answers) ? `Dia e horário: ${formatChoice(answers)}` : null,
    durationMin ? `Duração prevista: ${durationMin} min` : null,
    answers.format ? `Formato: ${cap(answers.format)}` : null,
    answers.subject?.trim() ? `Assunto: ${answers.subject.trim()}` : null,
    answers.detail?.trim() ? `Detalhe: ${answers.detail.trim()}` : null,
  ]
  return [
    `Olá${first ? `, ${first}` : ''}! Falei com seu assistente virtual no advoc.me e gostaria de marcar uma conversa.`,
    '',
    ...fields.filter((l): l is string => !!l),
    '',
    'Fico no aguardo da sua confirmação.',
  ].join('\n')
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Link wa.me com a mensagem pronta — undefined se o perfil não tem WhatsApp. */
export function assistantWhatsappHref(
  profile: Pick<Profile, 'name' | 'contact'>,
  answers: AssistantAnswers,
  durationMin?: number,
): string | undefined {
  const wa = profile.contact?.whatsapp
  if (!wa) return undefined
  return `https://wa.me/${wa}?text=${encodeURIComponent(
    buildAssistantMessage(profile, answers, durationMin),
  )}`
}

// ---- Assistente do ESCRITÓRIO ---------------------------------------------
//
// A sociedade não tem agenda por advogado: perguntar horário exato seria prometer
// o que ninguém pode confirmar. Então o roteiro troca a grade por uma PREFERÊNCIA
// de dia/período — o que uma secretária perguntaria — e o escritório confirma.
//
// Duas travas de conformidade que valem aqui e não valem no perfil individual:
//   • a lista de advogados é sempre alfabética e nunca vem com recomendação
//     ("o mais indicado para o seu caso" é ranking, e ranking é vedado);
//   • escolher advogado é opcional — "tanto faz" é a primeira opção.

/** Preferência de horário oferecida pelo assistente do escritório. */
export interface FirmPeriodOption {
  id: string
  /** texto do chip */
  label: string
}

export const FIRM_PERIODS: FirmPeriodOption[] = [
  { id: 'esta-manha', label: 'Esta semana, de manhã' },
  { id: 'esta-tarde', label: 'Esta semana, à tarde' },
  { id: 'proxima-manha', label: 'Próxima semana, de manhã' },
  { id: 'proxima-tarde', label: 'Próxima semana, à tarde' },
  { id: 'tanto-faz', label: 'Tanto faz' },
]

/** "Sem preferência" na escolha de advogado — nunca uma sugestão da plataforma. */
export const FIRM_ANY_LAWYER = 'Tanto faz'

export interface FirmAssistantAnswers {
  area?: string
  /** nome do advogado escolhido; ausente = sem preferência */
  lawyer?: string
  /** 'presencial' | 'online' */
  format?: string
  /** rótulo da preferência de horário (ver FIRM_PERIODS) */
  period?: string
  name?: string
}

/**
 * Mensagem que o visitante envia ao escritório. Mesmo espírito da do perfil:
 * factual, sem promessa, sem preço, sem urgência — só o pedido organizado.
 */
export function buildFirmAssistantMessage(
  firmName: string,
  answers: FirmAssistantAnswers,
): string {
  const fields: (string | null)[] = [
    answers.name?.trim() ? `Nome: ${answers.name.trim()}` : null,
    answers.area ? `Assunto: ${answers.area}` : null,
    `Advogado(a): ${answers.lawyer?.trim() || 'sem preferência'}`,
    answers.format ? `Formato: ${capitalize(answers.format)}` : null,
    answers.period ? `Preferência de horário: ${answers.period}` : null,
  ]
  return [
    `Olá! Vim pela página do ${firmName} no advoc.me e gostaria de marcar uma conversa.`,
    '',
    ...fields.filter((l): l is string => !!l),
    '',
    'Fico no aguardo da confirmação.',
  ].join('\n')
}

/**
 * Para onde o pedido vai. O padrão é o WhatsApp INSTITUCIONAL: mantém o controle do
 * atendimento com o escritório, que é o que a maioria quer. Com `assistantRoute`
 * em 'lawyer', o pedido vai direto para o advogado escolhido — e cai no
 * institucional quando o visitante não escolheu ninguém ou o advogado não informou
 * WhatsApp.
 */
export interface FirmAssistantDestination {
  /** número que vai receber; ausente = ninguém informou WhatsApp */
  whatsapp?: string
  /** para quem o pedido vai, em palavras — a conversa mostra isso ao visitante */
  label: string
  /** true quando o pedido vai direto ao advogado escolhido */
  direct: boolean
}

/** Para quem o pedido vai, com o nome — o visitante precisa saber antes de enviar. */
export function firmAssistantDestination(
  firm: {
    contact: { whatsapp?: string }
    lawyers: { name: string; whatsapp?: string }[]
    assistantRoute?: string
  },
  answers: FirmAssistantAnswers,
): FirmAssistantDestination {
  if (firm.assistantRoute === 'lawyer' && answers.lawyer) {
    const escolhido = firm.lawyers.find((l) => l.name === answers.lawyer)
    if (escolhido?.whatsapp) {
      return { whatsapp: escolhido.whatsapp, label: escolhido.name, direct: true }
    }
  }
  return { whatsapp: firm.contact.whatsapp, label: 'o escritório', direct: false }
}

/** Só o número do destino (ver firmAssistantDestination). */
export function firmAssistantWhatsapp(
  firm: {
    contact: { whatsapp?: string }
    lawyers: { name: string; whatsapp?: string }[]
    assistantRoute?: string
  },
  answers: FirmAssistantAnswers,
): string | undefined {
  return firmAssistantDestination(firm, answers).whatsapp
}

/** Link wa.me pronto — undefined quando não há número para receber o pedido. */
export function firmAssistantWhatsappHref(
  firm: {
    name: string
    contact: { whatsapp?: string }
    lawyers: { name: string; whatsapp?: string }[]
    assistantRoute?: string
  },
  answers: FirmAssistantAnswers,
): string | undefined {
  const wa = firmAssistantWhatsapp(firm, answers)
  if (!wa) return undefined
  return `https://wa.me/${wa}?text=${encodeURIComponent(buildFirmAssistantMessage(firm.name, answers))}`
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
