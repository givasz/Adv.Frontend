import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Booking } from '@/lib/types'
import { formatSlotLong } from '@/lib/booking'
import { downloadIcs, googleCalendarUrl } from '@/lib/calendar'
import {
  CalendarIcon,
  CheckIcon,
  ChevronDown,
  ExternalLinkIcon,
  ScaleIcon,
  WhatsappIcon,
  XIcon,
} from '@/components/ui/icons'

const MONTHS_FULL = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const WEEK_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const pad2 = (n: number) => String(n).padStart(2, '0')
const dayKey = (iso: string | Date) => {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null)
  const total = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// digits "5511998877665" → "(11) 99887-7665" para exibição.
function displayPhone(digits: string): string {
  const local = digits.startsWith('55') ? digits.slice(2) : digits
  const ddd = local.slice(0, 2)
  const rest = local.slice(2)
  if (!ddd) return digits
  const split = rest.length > 8 ? 5 : 4
  const num = rest.length > 4 ? `${rest.slice(0, split)}-${rest.slice(split)}` : rest
  return `(${ddd}) ${num}`
}

function whatsappHref(digits: string, clientName: string, iso: string): string {
  const text = `Olá, ${clientName.split(' ')[0]}! Sobre sua consulta pedida para ${formatSlotLong(iso)} pelo advoc.me…`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

function calendarEventFor(b: Booking) {
  return {
    title: `Consulta — ${b.clientName}`,
    start: b.startAt,
    end: b.endAt,
    details: `Cliente: ${b.clientName}\nWhatsApp: ${displayPhone(b.clientWhats)}${
      b.note ? `\nAssunto: ${b.note}` : ''
    }\n\nAgendado via advoc.me.`,
  }
}

const STATUS_LABEL: Record<Booking['status'], string> = {
  pending: 'Aguardando',
  confirmed: 'Confirmada',
  declined: 'Recusada',
  cancelled: 'Cancelada',
}

export default function Agenda() {
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Agenda · advoc.me'
    api.getMyBookings().then(setBookings).catch(() => setBookings([]))
  }, [])

  const now = Date.now()
  const { pending, upcoming, history } = useMemo(() => {
    let list = bookings ?? []
    if (selectedDay) list = list.filter((b) => dayKey(b.startAt) === selectedDay)
    const isFuture = (b: Booking) => new Date(b.startAt).getTime() >= now
    return {
      pending: list.filter((b) => b.status === 'pending' && isFuture(b)),
      upcoming: list.filter((b) => b.status === 'confirmed' && isFuture(b)),
      history: list
        .filter((b) => !((b.status === 'pending' || b.status === 'confirmed') && isFuture(b)))
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    }
  }, [bookings, now, selectedDay])

  async function decide(id: string, decision: 'confirm' | 'decline' | 'cancel') {
    setBusyId(id)
    try {
      const updated = await api.decideBooking(id, decision)
      setBookings((prev) => (prev ? prev.map((b) => (b.id === id ? updated : b)) : prev))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper-deep">
      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            advoc.me
          </Link>
          <Link to="/editor" className="btn-ghost !py-2 !px-4 text-[13px]">
            Voltar ao editor
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
            <CalendarIcon width={20} height={20} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Sua agenda</h1>
            <p className="text-[12.5px] text-ink-faint">
              Solicitações de consulta feitas pelo seu perfil.
            </p>
          </div>
        </div>

        {bookings === null ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-xl2 border border-ink/10 bg-paper p-10 text-center shadow-card">
            <CalendarIcon width={34} height={34} className="mx-auto text-ink-faint/50" />
            <h2 className="mt-3 font-display text-lg font-semibold text-ink">Nenhuma solicitação ainda</h2>
            <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-ink-faint">
              Quando alguém marcar um horário pelo seu perfil, a solicitação aparece aqui para você
              aceitar ou recusar. Ative a “Agenda no advoc.me” no editor, passo Contato.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <AgendaCalendar
              bookings={bookings}
              selected={selectedDay}
              onSelect={(k) => setSelectedDay((cur) => (cur === k ? null : k))}
            />

            {selectedDay && (
              <div className="flex items-center justify-between rounded-lg border border-burgundy/25 bg-burgundy/[0.05] px-3.5 py-2.5">
                <span className="text-[13px] font-medium capitalize text-ink">
                  {formatSlotLong(`${selectedDay}T00:00:00`).replace(/ às.*/, '')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="text-[12.5px] font-medium text-burgundy underline-offset-2 hover:underline"
                >
                  Ver todos os dias
                </button>
              </div>
            )}

            {selectedDay && pending.length === 0 && upcoming.length === 0 && history.length === 0 && (
              <Empty text="Nenhuma consulta nesse dia." />
            )}

            {/* Pendentes */}
            {(!selectedDay || pending.length > 0) && (
            <Section title="Solicitações" count={pending.length}>
              {pending.length === 0 ? (
                <Empty text="Nenhuma solicitação aguardando resposta." />
              ) : (
                pending.map((b) => (
                  <BookingCard key={b.id} b={b} tone="pending">
                    <a
                      href={whatsappHref(b.clientWhats, b.clientName, b.startAt)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-burgundy/50"
                    >
                      <WhatsappIcon width={16} height={16} />
                      WhatsApp
                    </a>
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => decide(b.id, 'decline')}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 text-[13px] font-medium text-ink-faint transition-colors hover:border-burgundy/40 hover:text-burgundy disabled:opacity-50"
                    >
                      <XIcon width={15} height={15} />
                      Recusar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => decide(b.id, 'confirm')}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-burgundy px-3 py-2 text-[13px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep disabled:opacity-50"
                    >
                      <CheckIcon width={15} height={15} strokeWidth={2.4} />
                      Aceitar
                    </button>
                  </BookingCard>
                ))
              )}
            </Section>
            )}

            {/* Confirmadas futuras */}
            {upcoming.length > 0 && (
              <Section title="Próximas consultas" count={upcoming.length}>
                {upcoming.map((b) => (
                  <BookingCard key={b.id} b={b} tone="confirmed">
                    <a
                      href={whatsappHref(b.clientWhats, b.clientName, b.startAt)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-burgundy/50"
                    >
                      <WhatsappIcon width={16} height={16} />
                      WhatsApp
                    </a>
                    <a
                      href={googleCalendarUrl(calendarEventFor(b))}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-burgundy/50"
                    >
                      <ExternalLinkIcon width={15} height={15} />
                      Google
                    </a>
                    <button
                      type="button"
                      onClick={() => downloadIcs(calendarEventFor(b))}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-burgundy/50"
                    >
                      <CalendarIcon width={15} height={15} />
                      .ics
                    </button>
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => decide(b.id, 'cancel')}
                      className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-faint transition-colors hover:text-burgundy disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </BookingCard>
                ))}
              </Section>
            )}

            {/* Histórico */}
            {history.length > 0 && (
              <Section title="Histórico" count={history.length}>
                {history.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-paper px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">{b.clientName}</p>
                      <p className="truncate text-[11.5px] capitalize text-ink-faint">
                        {formatSlotLong(b.startAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-medium text-ink-faint">
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>
                ))}
              </Section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
        {title}
        <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-bold text-ink-soft">
          {count}
        </span>
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-ink/15 px-4 py-6 text-center text-[13px] text-ink-faint">
      {text}
    </p>
  )
}

function BookingCard({
  b,
  tone,
  children,
}: {
  b: Booking
  tone: 'pending' | 'confirmed'
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl2 border bg-paper p-4 shadow-card ${
        tone === 'pending' ? 'border-burgundy/25' : 'border-ink/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold text-ink">{b.clientName}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-faint">{displayPhone(b.clientWhats)}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-burgundy/[0.06] px-2.5 py-1 text-[12px] font-semibold capitalize text-burgundy">
          {formatSlotLong(b.startAt)}
        </span>
      </div>
      {b.note && (
        <p className="mt-2.5 rounded-lg bg-paper-soft px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
          {b.note}
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">{children}</div>
    </div>
  )
}

// Mini calendário do mês: marca os dias com consulta e filtra a lista ao clicar.
function AgendaCalendar({
  bookings,
  selected,
  onSelect,
}: {
  bookings: Booking[]
  selected: string | null
  onSelect: (dayKey: string) => void
}) {
  const today = new Date()
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    // Abre no mês da próxima consulta futura, se houver; senão no mês atual.
    const future = bookings
      .map((b) => new Date(b.startAt))
      .filter((d) => d.getTime() >= today.setHours(0, 0, 0, 0))
      .sort((a, b) => a.getTime() - b.getTime())[0]
    const base = future ?? new Date()
    return { y: base.getFullYear(), m: base.getMonth() }
  })

  const marks = useMemo(() => {
    const map = new Map<string, { pending: number; confirmed: number }>()
    for (const b of bookings) {
      if (b.status !== 'pending' && b.status !== 'confirmed') continue
      const k = dayKey(b.startAt)
      const e = map.get(k) ?? { pending: 0, confirmed: 0 }
      if (b.status === 'pending') e.pending++
      else e.confirmed++
      map.set(k, e)
    }
    return map
  }, [bookings])

  const cells = monthCells(view.y, view.m)
  const todayKey = dayKey(new Date())
  const shift = (delta: number) => {
    const idx = view.y * 12 + view.m + delta
    setView({ y: Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 })
  }

  return (
    <section className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Mês anterior"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink"
        >
          <ChevronDown width={18} height={18} className="rotate-90" />
        </button>
        <span className="font-display text-[15px] font-semibold capitalize text-ink">
          {MONTHS_FULL[view.m]} {view.y}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Próximo mês"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink"
        >
          <ChevronDown width={18} height={18} className="-rotate-90" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEK_INITIALS.map((w, i) => (
          <span key={i} className="py-1 text-center text-[11px] font-semibold text-ink-faint">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const key = dayKey(d)
          const mark = marks.get(key)
          const isSelected = key === selected
          const isToday = key === todayKey
          const hasMark = !!mark
          return (
            <button
              key={key}
              type="button"
              onClick={() => hasMark && onSelect(key)}
              disabled={!hasMark}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[13.5px] font-medium tabular-nums transition-colors ${
                isSelected
                  ? 'bg-burgundy text-paper-soft'
                  : hasMark
                    ? 'bg-paper-soft text-ink hover:bg-burgundy/[0.08]'
                    : 'text-ink-faint/40'
              } ${isToday && !isSelected ? 'ring-1 ring-burgundy/40' : ''}`}
            >
              {d.getDate()}
              {hasMark && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {mark!.confirmed > 0 && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-paper-soft' : 'bg-brass-deep'}`}
                    />
                  )}
                  {mark!.pending > 0 && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-paper-soft/80' : 'bg-burgundy'}`}
                    />
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-burgundy" /> a confirmar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brass-deep" /> confirmada
        </span>
        <span className="ml-auto">clique num dia para filtrar</span>
      </div>
    </section>
  )
}
