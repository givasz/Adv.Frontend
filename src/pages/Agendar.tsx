import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { buildDaySlots, formatSlotLong, type DaySlots } from '@/lib/booking'
import { downloadIcs, googleCalendarUrl } from '@/lib/calendar'
import type { Booking } from '@/lib/types'
import {
  CalendarIcon,
  CheckIcon,
  ChevronDown,
  ExternalLinkIcon,
  ScaleIcon,
} from '@/components/ui/icons'

const MONTHS_FULL = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const WEEK_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const pad2 = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

// Máscara de telefone BR (parte local): "(11) 99887-7665".
function maskBrLocal(local: string): string {
  const d = local.replace(/\D/g, '').slice(0, 11)
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  if (!ddd) return ''
  let out = `(${ddd}`
  if (d.length >= 2) out += ') '
  if (rest) {
    const split = rest.length > 8 ? 5 : 4
    out += rest.length > 4 ? `${rest.slice(0, split)}-${rest.slice(split)}` : rest
  }
  return out
}

// Células do mês (com vazias no começo para alinhar a primeira semana).
function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null)
  const total = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

type Status = 'loading' | 'unavailable' | 'ready' | 'sending' | 'done' | 'notfound'

export default function Agendar() {
  const { slug = '' } = useParams()
  const [status, setStatus] = useState<Status>('loading')
  const [name, setName] = useState('')
  const [days, setDays] = useState<DaySlots[]>([])
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const n = new Date()
    return { y: n.getFullYear(), m: n.getMonth() }
  })
  const [selKey, setSelKey] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [booked, setBooked] = useState<Booking | null>(null)

  useEffect(() => {
    document.title = 'Agendar consulta · advoc.me'
    let alive = true
    Promise.all([api.getProfile(slug), api.getAvailability(slug)])
      .then(([profile, avail]) => {
        if (!alive) return
        if (!profile) return setStatus('notfound')
        setName(profile.name)
        if (avail.mode !== 'native') return setStatus('unavailable')
        const d = buildDaySlots(avail.config, avail.busy)
        setDays(d)
        if (!d.length) return setStatus('unavailable')
        // Abre o mês do primeiro dia disponível.
        setView({ y: d[0].date.getFullYear(), m: d[0].date.getMonth() })
        setStatus('ready')
      })
      .catch(() => alive && setStatus('notfound'))
    return () => {
      alive = false
    }
  }, [slug])

  const byKey = useMemo(() => new Map(days.map((d) => [d.key, d])), [days])
  const selDay = selKey ? byKey.get(selKey) : undefined

  // Limites de navegação de mês (só onde há disponibilidade).
  const bounds = useMemo(() => {
    if (!days.length) return null
    const f = days[0].date
    const l = days[days.length - 1].date
    return { min: f.getFullYear() * 12 + f.getMonth(), max: l.getFullYear() * 12 + l.getMonth() }
  }, [days])
  const viewIndex = view.y * 12 + view.m
  const canPrev = bounds ? viewIndex > bounds.min : false
  const canNext = bounds ? viewIndex < bounds.max : false
  const shiftMonth = (delta: number) => {
    const idx = viewIndex + delta
    setView({ y: Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 })
  }

  const phoneDigits = phone.replace(/\D/g, '')
  const canSubmit = !!slot && clientName.trim().length >= 2 && phoneDigits.length >= 10

  const calendarEvent = useMemo(() => {
    if (!booked) return null
    return {
      title: `Consulta com ${name}`,
      start: booked.startAt,
      end: booked.endAt,
      details: 'Consulta jurídica agendada via advoc.me. Aguardando confirmação do advogado.',
    }
  }, [booked, name])

  async function submit() {
    if (!slot || !canSubmit) return
    setStatus('sending')
    setError(null)
    try {
      const b = await api.createBooking(slug, {
        clientName: clientName.trim(),
        clientWhats: phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`,
        note: note.trim() || undefined,
        startAt: slot,
      })
      setBooked(b)
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar a solicitação.')
      setStatus('ready')
    }
  }

  const cells = monthCells(view.y, view.m)

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper-deep">
      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            advoc.me
          </Link>
          <Link to={`/${slug}`} className="btn-ghost !py-2 !px-4 text-[13px]">
            Voltar ao perfil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {status === 'loading' && (
          <div className="flex justify-center py-24">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
          </div>
        )}

        {status === 'notfound' && (
          <Empty
            title="Perfil não encontrado"
            text="Este endereço não existe ou o perfil não está publicado."
            slug={slug}
          />
        )}

        {status === 'unavailable' && (
          <Empty
            title="Sem horários no momento"
            text="Este advogado não tem horários livres para os próximos dias. Tente novamente mais tarde ou use os outros canais do perfil."
            slug={slug}
          />
        )}

        {status === 'done' && booked && calendarEvent && (
          <div className="mx-auto max-w-md rounded-xl2 border border-ink/10 bg-paper p-8 text-center shadow-card">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brass/15 text-brass-deep">
              <CheckIcon width={26} height={26} strokeWidth={2.4} />
            </span>
            <h1 className="mt-3 font-display text-xl font-semibold text-ink">Solicitação enviada</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-faint">
              Você pediu <span className="font-medium capitalize text-ink">{formatSlotLong(booked.startAt)}</span> com{' '}
              {name}. O advogado vai <span className="font-medium">confirmar ou responder pelo WhatsApp</span>. Guarde
              o horário na sua agenda:
            </p>
            <div className="mx-auto mt-4 grid max-w-xs gap-2">
              <a
                href={googleCalendarUrl(calendarEvent)}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-center gap-2 rounded-lg border border-ink/15 bg-paper-soft py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:border-burgundy/50"
              >
                <ExternalLinkIcon width={16} height={16} />
                Adicionar ao Google Agenda
              </a>
              <button
                type="button"
                onClick={() => downloadIcs(calendarEvent)}
                className="flex items-center justify-center gap-2 rounded-lg border border-ink/15 bg-paper-soft py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:border-burgundy/50"
              >
                <CalendarIcon width={16} height={16} />
                Baixar .ics (iPhone / Outlook)
              </button>
            </div>
            <Link to={`/${slug}`} className="btn-primary mt-5 inline-block !py-2.5">
              Voltar ao perfil
            </Link>
          </div>
        )}

        {(status === 'ready' || status === 'sending') && (
          <>
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
                <CalendarIcon width={20} height={20} />
              </span>
              <div>
                <h1 className="font-display text-xl font-semibold text-ink">Agendar consulta</h1>
                <p className="text-[12.5px] text-ink-faint">com {name}</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Calendário — escolha a data */}
              <section className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    disabled={!canPrev}
                    aria-label="Mês anterior"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronDown width={18} height={18} className="rotate-90" />
                  </button>
                  <span className="font-display text-[15px] font-semibold capitalize text-ink">
                    {MONTHS_FULL[view.m]} {view.y}
                  </span>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    disabled={!canNext}
                    aria-label="Próximo mês"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
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
                    const key = dateKey(d)
                    const available = byKey.has(key)
                    const selected = key === selKey
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!available}
                        onClick={() => {
                          setSelKey(key)
                          setSlot(null)
                        }}
                        className={`relative aspect-square rounded-lg text-[13.5px] font-medium tabular-nums transition-colors ${
                          selected
                            ? 'bg-burgundy text-paper-soft'
                            : available
                              ? 'bg-paper-soft text-ink hover:bg-burgundy/[0.08] ring-1 ring-burgundy/20'
                              : 'text-ink-faint/40'
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-faint">
                  <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-paper-soft ring-1 ring-burgundy/30" />
                  dias com horário livre
                </p>
              </section>

              {/* Horários + dados */}
              <section className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card">
                {!selDay ? (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-center">
                    <CalendarIcon width={30} height={30} className="text-ink-faint/40" />
                    <p className="max-w-[220px] text-[13px] leading-relaxed text-ink-faint">
                      Escolha uma data no calendário para ver os horários disponíveis.
                    </p>
                  </div>
                ) : (
                  <div className={status === 'sending' ? 'pointer-events-none opacity-70' : ''}>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                      Horários · <span className="capitalize text-ink-soft">{selDay.longLabel}</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {selDay.slots.map((sopt) => {
                        const active = slot === sopt.iso
                        return (
                          <button
                            key={sopt.iso}
                            type="button"
                            onClick={() => setSlot(sopt.iso)}
                            className={`rounded-lg border py-2.5 text-[14px] font-medium tabular-nums transition-colors ${
                              active
                                ? 'border-burgundy bg-burgundy text-paper-soft'
                                : 'border-ink/15 bg-paper-soft text-ink hover:border-burgundy/50'
                            }`}
                          >
                            {sopt.label}
                          </button>
                        )
                      })}
                    </div>

                    {slot && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-4 border-t border-ink/10 pt-4"
                      >
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="bk-name" className="mb-1.5 block text-[12.5px] font-medium text-ink">
                              Seu nome
                            </label>
                            <input
                              id="bk-name"
                              value={clientName}
                              onChange={(e) => setClientName(e.target.value)}
                              placeholder="Nome completo"
                              className="w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
                            />
                          </div>
                          <div>
                            <label htmlFor="bk-phone" className="mb-1.5 block text-[12.5px] font-medium text-ink">
                              WhatsApp
                            </label>
                            <input
                              id="bk-phone"
                              inputMode="numeric"
                              value={phone}
                              onChange={(e) => setPhone(maskBrLocal(e.target.value))}
                              placeholder="(11) 99999-8888"
                              className="w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
                            />
                          </div>
                          <div>
                            <label htmlFor="bk-note" className="mb-1.5 block text-[12.5px] font-medium text-ink">
                              Assunto <span className="text-ink-faint">(opcional)</span>
                            </label>
                            <textarea
                              id="bk-note"
                              rows={2}
                              value={note}
                              maxLength={500}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Um resumo curto do que você precisa."
                              className="w-full resize-none rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
                            />
                          </div>
                        </div>

                        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                          Ao enviar, você concorda que seu nome e WhatsApp sejam compartilhados com o advogado
                          apenas para o retorno desta consulta (LGPD).
                        </p>

                        {error && (
                          <p className="mt-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
                            {error}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={submit}
                          disabled={!canSubmit || status === 'sending'}
                          className="btn-primary mt-4 w-full justify-center disabled:cursor-not-allowed"
                        >
                          {status === 'sending' ? 'Enviando…' : 'Solicitar horário'}
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Empty({ title, text, slug }: { title: string; text: string; slug: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl2 border border-ink/10 bg-paper p-10 text-center shadow-card">
      <CalendarIcon width={34} height={34} className="mx-auto text-ink-faint/50" />
      <h1 className="mt-3 font-display text-lg font-semibold text-ink">{title}</h1>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-ink-faint">{text}</p>
      <Link to={`/${slug}`} className="btn-primary mt-4 inline-block !py-2.5">
        Voltar ao perfil
      </Link>
    </div>
  )
}
