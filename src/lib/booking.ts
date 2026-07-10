// Lógica da agenda nativa no cliente: defaults, resolução de modo, geração de
// horários livres e formatação em pt-BR. O servidor é a fonte da verdade para
// anti-conflito; aqui geramos os candidatos e escondemos os já ocupados.

import { canUseScheduling } from './plans'
import type { BookingConfig, Profile, SchedulingMode } from './types'

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  weekdays: [1, 2, 3, 4, 5],
  startMin: 540, // 09:00
  endMin: 1080, // 18:00
  slotMin: 30,
  leadHours: 12,
  horizonDays: 30,
}

export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const WEEKDAYS_FULL = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Minutos desde a meia-noite → "09:30". */
export function minToLabel(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
}

/**
 * Modo efetivo do botão "Agendar". Perfis antigos derivam do link externo.
 * Agendamento (link externo ou agenda nativa) exige plano pago: no Free, sempre 'off'.
 */
export function resolveSchedulingMode(
  p: Pick<Profile, 'schedulingMode' | 'contact' | 'plan'>,
): SchedulingMode {
  const mode = p.schedulingMode ?? (p.contact?.scheduling ? 'external' : 'off')
  if (mode !== 'off' && !canUseScheduling(p.plan)) return 'off'
  return mode
}

export interface SlotOption {
  /** ISO do início do horário */
  iso: string
  /** "09:00" */
  label: string
}

export interface DaySlots {
  /** chave estável (YYYY-MM-DD, hora local) */
  key: string
  /** Date do início do dia (local) */
  date: Date
  /** "Seg, 14 jul" */
  label: string
  /** "Segunda-feira, 14 de julho" (acessibilidade) */
  longLabel: string
  slots: SlotOption[]
}

/**
 * Gera os horários livres a partir da config, no fuso do próprio navegador do
 * visitante, escondendo os ocupados (`busy`) e os que já passaram da antecedência
 * mínima. Retorna apenas os dias que têm ao menos um horário livre.
 */
export function buildDaySlots(
  config: BookingConfig,
  busy: string[] = [],
  now: Date = new Date(),
): DaySlots[] {
  const busySet = new Set(busy.map((iso) => new Date(iso).getTime()))
  const minTime = now.getTime() + config.leadHours * 3600_000
  const weekdays = new Set(config.weekdays)
  const days: DaySlots[] = []

  for (let d = 0; d <= config.horizonDays; d++) {
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() + d)
    if (!weekdays.has(day.getDay())) continue

    const slots: SlotOption[] = []
    for (let m = config.startMin; m + config.slotMin <= config.endMin; m += config.slotMin) {
      const slot = new Date(day)
      slot.setMinutes(m)
      const t = slot.getTime()
      if (t < minTime || busySet.has(t)) continue
      slots.push({ iso: slot.toISOString(), label: minToLabel(m) })
    }
    if (!slots.length) continue

    const wd = day.getDay()
    days.push({
      key: `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`,
      date: day,
      label: `${WEEKDAYS_SHORT[wd]}, ${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`,
      longLabel: `${WEEKDAYS_FULL[wd]}-feira, ${day.getDate()} de ${MONTHS_SHORT[day.getMonth()]}`,
      slots,
    })
  }
  return days
}

/** "Seg, 14 jul · 09:00" a partir de um ISO — para exibir um horário marcado. */
export function formatSlot(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} · ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`
}

/** Data por extenso + hora — "Segunda, 14 de julho às 09:00". */
export function formatSlotLong(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]} às ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`
}
