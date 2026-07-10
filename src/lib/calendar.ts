// "Adicionar à agenda" sem biblioteca: link do Google Agenda (evento pré-preenchido)
// e arquivo .ics (padrão iCalendar) que cobre Apple Calendar/iPhone/Safari/Outlook.

export interface CalendarEvent {
  title: string
  /** ISO do início */
  start: string
  /** ISO do fim */
  end: string
  details?: string
  location?: string
}

// Date → "YYYYMMDDTHHMMSSZ" (UTC), formato exigido pelo Google e pelo iCalendar.
function toUtcStamp(iso: string): string {
  const d = new Date(iso)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** URL que abre o Google Agenda com um novo evento já preenchido. */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${toUtcStamp(ev.start)}/${toUtcStamp(ev.end)}`,
  })
  if (ev.details) params.set('details', ev.details)
  if (ev.location) params.set('location', ev.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Escapa vírgula, ponto-e-vírgula, barra e quebras de linha conforme o RFC 5545.
function icsEscape(s: string): string {
  return s.replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

/** Conteúdo de um arquivo .ics de um evento único. */
export function buildIcs(ev: CalendarEvent): string {
  const uid = `${toUtcStamp(ev.start)}-${Math.abs(hash(ev.title))}@advoc.me`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//advoc.me//agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(ev.start)}`,
    `DTSTART:${toUtcStamp(ev.start)}`,
    `DTEND:${toUtcStamp(ev.end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
  ]
  if (ev.details) lines.push(`DESCRIPTION:${icsEscape(ev.details)}`)
  if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

// Dispara o download do .ics — no iPhone/Safari abre a importação no Apple Calendar.
export function downloadIcs(ev: CalendarEvent, filename = 'consulta.ics'): void {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Hash simples e determinístico (para compor um UID estável sem depender de random).
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
