import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Profile } from '@/lib/types'
import { agendaDigital, type CalendarEntry, type MeetingRequest } from '@/lib/agendaDigital'
import { baixarIcs, linkGoogleAgenda, linkOutlook, type Compromisso } from '@/lib/ics'
import { whatsappHref, comoAbrirWhatsapp } from '@/lib/whatsapp'
import { CalendarIcon } from '@/components/ui/icons'

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => dateKey(new Date())
const formatDate = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR', options)
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const monthLabel = (d: Date) => titleCase(d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
const eventTime = (entry: CalendarEntry) => entry.startsAt.slice(11, 16)
const statusLabel: Record<MeetingRequest['status'], string> = { pending: 'Aguardando', confirmed: 'Confirmado', declined: 'Negado' }

type Draft = { id?: string; title: string; date: string; time: string; durationMin: number }

export default function AgendaDigitalPage() {
  const [search, setSearch] = useSearchParams()
  const tab = search.get('tab') === 'solicitacoes' ? 'solicitacoes' : 'agenda'
  const [profile, setProfile] = useState<Profile | null>(null)
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [selected, setSelected] = useState(today)
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [requests, setRequests] = useState<MeetingRequest[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(false)

  const first = dateKey(new Date(month.getFullYear(), month.getMonth(), 1))
  const last = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0))

  useEffect(() => {
    document.title = 'Agenda digital · advoc.me'
    api.getDraft().then(setProfile).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Falha ao carregar o perfil.'))
  }, [])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try { setEntries(await agendaDigital.entries(first, last)); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar a agenda.') }
    finally { setLoading(false) }
  }, [first, last])
  useEffect(() => { void loadEntries() }, [loadEntries])

  const loadRequests = useCallback(async (offset = 0) => {
    setLoadingRequests(true)
    try {
      const data = await agendaDigital.requests(offset)
      setRequests((current) => offset ? [...current, ...data.items] : data.items)
      setNextOffset(data.nextOffset)
      setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar as solicitações.') }
    finally { setLoadingRequests(false) }
  }, [])
  useEffect(() => { if (tab === 'solicitacoes') void loadRequests() }, [tab, loadRequests])

  const calendarDays = useMemo(() => {
    const offset = (month.getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1))
  }, [month])
  const selectedEntries = entries.filter((entry) => entry.startsAt.slice(0, 10) === selected)
  const pending = requests.filter((r) => r.status === 'pending').length

  function changeMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1)
    setMonth(next)
    setSelected(dateKey(next))
    setDraft(null)
  }

  function openNew(date = selected, title = '') {
    setDraft({ title, date, time: '09:00', durationMin: profile?.assistant?.durationMin ?? 45 })
    setError('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || busy) return
    setBusy(true); setError('')
    try {
      const entry = await agendaDigital.saveEntry({ title: draft.title.trim(), startsAt: `${draft.date}T${draft.time}`, durationMin: Number(draft.durationMin) }, draft.id)
      setDraft(null)
      if (entry.startsAt.slice(0, 7) !== first.slice(0, 7)) setMonth(new Date(Number(entry.startsAt.slice(0, 4)), Number(entry.startsAt.slice(5, 7)) - 1, 1))
      setSelected(entry.startsAt.slice(0, 10))
      await loadEntries()
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.') }
    finally { setBusy(false) }
  }

  async function remove(entry: CalendarEntry) {
    if (!window.confirm(`Apagar “${entry.title}” da agenda?`)) return
    setBusy(true); setError('')
    try { await agendaDigital.deleteEntry(entry.id); await loadEntries(); if (draft?.id === entry.id) setDraft(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível apagar.') }
    finally { setBusy(false) }
  }

  async function decide(request: MeetingRequest, status: 'confirmed' | 'declined') {
    setBusy(true); setError('')
    try { await agendaDigital.decide(request.id, status); setRequests((items) => items.map((r) => r.id === request.id ? { ...r, status } : r)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar a solicitação.') }
    finally { setBusy(false) }
  }

  async function removeRequest(request: MeetingRequest) {
    if (!window.confirm(`Excluir os dados de ${request.name} desta solicitação?`)) return
    setBusy(true); setError('')
    try { await agendaDigital.deleteRequest(request.id); setRequests((items) => items.filter((r) => r.id !== request.id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível excluir.') }
    finally { setBusy(false) }
  }

  if (!profile && !error) return <div className="flex min-h-dvh items-center justify-center bg-paper-deep"><span role="status">Carregando agenda…</span></div>

  return (
    <div className="grain min-h-dvh bg-paper-deep text-ink">
      <header className="relative overflow-hidden bg-ink text-paper">
        <div className="absolute -right-20 -top-36 h-80 w-80 rounded-full border border-brass/20" aria-hidden="true" />
        <div className="absolute -right-10 -top-28 h-64 w-64 rounded-full border border-brass/20" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-5 sm:px-8 sm:pb-10">
          <Link to="/painel" className="inline-flex min-h-11 items-center gap-2 text-[13px] text-paper/75 transition-colors hover:text-paper">← Voltar ao painel</Link>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-brass">SEU TEMPO, EM ORDEM</p>
              <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-none">Agenda digital</h1>
              <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-paper/70">Compromissos organizados e solicitações de reunião em um só lugar.</p>
            </div>
            {profile?.plan === 'premium' && <button type="button" onClick={() => { setSearch({}); openNew() }} className="btn-primary !bg-brass !text-ink hover:!bg-paper">+ Novo compromisso</button>}
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-burgundy via-brass to-burgundy" />
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-8">
        <div className="mb-6 flex w-full gap-1 rounded-xl border border-ink/10 bg-paper p-1 shadow-card sm:w-fit" role="tablist" aria-label="Agenda digital">
          <button type="button" role="tab" aria-selected={tab === 'agenda'} onClick={() => setSearch({})}
            className={`min-h-11 flex-1 rounded-lg px-4 text-[13px] font-semibold transition-colors sm:flex-none ${tab === 'agenda' ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-soft'}`}>Agenda</button>
          <button type="button" role="tab" aria-selected={tab === 'solicitacoes'} onClick={() => setSearch({ tab: 'solicitacoes' })}
            className={`min-h-11 flex-1 rounded-lg px-4 text-[13px] font-semibold transition-colors sm:flex-none ${tab === 'solicitacoes' ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-soft'}`}>
            Solicitações {pending > 0 && <span className="ml-1.5 rounded-full bg-burgundy px-1.5 py-0.5 text-[10px] text-paper">{pending}</span>}
          </button>
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border border-burgundy/30 bg-burgundy/[0.06] p-3 text-[13px] text-burgundy">{error}</div>}

        {profile && profile.plan !== 'premium' && (
          <div className="mb-5 rounded-xl border border-brass/30 bg-brass/[0.08] p-4 text-[13px] leading-relaxed">
            Seus compromissos e pedidos anteriores continuam visíveis. Para adicionar compromissos e receber novas solicitações, ative o plano Max.
          </div>
        )}

        {tab === 'agenda' ? (
          <div role="tabpanel" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.85fr)]">
            <section className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-card" aria-label="Calendário mensal">
              <div className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-4 sm:px-6">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-deep">CALENDÁRIO</p><h2 className="mt-1 whitespace-nowrap font-display text-[18px] font-semibold sm:text-2xl">{monthLabel(month)}</h2></div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); setSelected(today()) }} className="min-h-10 rounded-lg px-2 text-[12px] font-semibold text-ink-soft hover:bg-paper-soft">Hoje</button>
                  <button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior" className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink/10 text-xl hover:bg-paper-soft">‹</button>
                  <button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês" className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink/10 text-xl hover:bg-paper-soft">›</button>
                </div>
              </div>
              <div className="grid grid-cols-7 border-b border-ink/10 bg-paper-soft/60 text-center text-[10px] font-bold uppercase tracking-wider text-ink-faint sm:text-[11px]">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <span key={day} className="py-3">{day}</span>)}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const key = dateKey(day)
                  const count = entries.filter((e) => e.startsAt.slice(0, 10) === key).length
                  const inMonth = day.getMonth() === month.getMonth()
                  return <button key={key} type="button" aria-pressed={selected === key} aria-current={key === today() ? 'date' : undefined}
                    aria-label={`${formatDate(key, { weekday: 'long', day: 'numeric', month: 'long' })}${count ? `, ${count} compromisso${count > 1 ? 's' : ''}` : ''}`}
                    onClick={() => { if (!inMonth) setMonth(new Date(day.getFullYear(), day.getMonth(), 1)); setSelected(key); setDraft(null) }}
                    className={`relative flex min-h-[52px] flex-col items-center justify-start border-b border-r border-ink/[0.06] pt-2 transition-colors hover:bg-brass/[0.08] sm:min-h-[86px] sm:items-start sm:p-2.5 ${selected === key ? 'bg-burgundy/[0.07] ring-2 ring-inset ring-burgundy/60' : ''} ${inMonth ? '' : 'text-ink-faint/40'}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums ${key === today() ? 'bg-burgundy text-paper' : ''}`}>{day.getDate()}</span>
                    {count > 0 && <span className="mt-1 flex items-center gap-1 sm:w-full"><span className="h-1.5 w-1.5 rounded-full bg-brass-deep" /><span className="hidden truncate text-[10px] font-medium text-ink-soft sm:inline">{count} compromisso{count > 1 ? 's' : ''}</span></span>}
                  </button>
                })}
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-card sm:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-deep">DIA SELECIONADO</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">{titleCase(formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
                <div className="mt-5 space-y-3">
                  {loading ? <p className="text-[13px] text-ink-faint">Carregando…</p> : selectedEntries.length ? selectedEntries.map((entry) => <EventCard key={entry.id} entry={entry} editable={profile?.plan === 'premium'}
                    onEdit={() => setDraft({ id: entry.id, title: entry.title, date: entry.startsAt.slice(0, 10), time: eventTime(entry), durationMin: entry.durationMin })}
                    onDelete={() => void remove(entry)} />) : <p className="rounded-xl bg-paper-soft p-4 text-[13px] leading-relaxed text-ink-faint">Dia livre. Adicione um compromisso quando quiser.</p>}
                </div>
                {profile?.plan === 'premium' && <button type="button" onClick={() => openNew()} className="mt-5 w-full rounded-xl border border-dashed border-brass/60 px-4 py-3 text-[13px] font-semibold text-burgundy transition-colors hover:bg-brass/[0.09]">+ Adicionar neste dia</button>}
              </section>
              {draft && profile?.plan === 'premium' && <form onSubmit={save} className="rounded-2xl border border-brass/35 bg-paper p-5 shadow-card sm:p-6" aria-label={draft.id ? 'Editar compromisso' : 'Novo compromisso'}>
                <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-deep">COMPROMISSO</p><h2 className="mt-1 font-display text-xl font-semibold">{draft.id ? 'Editar horário' : 'Novo horário'}</h2></div><button type="button" onClick={() => setDraft(null)} aria-label="Fechar formulário" className="rounded-full px-2 py-1 text-xl text-ink-faint hover:bg-paper-soft">×</button></div>
                <div className="mt-4 space-y-3">
                  <label className="block text-[12px] font-semibold">Nome do compromisso<input required minLength={2} maxLength={100} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex.: Reunião com Ana" className="agenda-input" /></label>
                  <div className="grid grid-cols-2 gap-3"><label className="block text-[12px] font-semibold">Data<input required type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="agenda-input" /></label><label className="block text-[12px] font-semibold">Hora<input required type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className="agenda-input" /></label></div>
                  <label className="block text-[12px] font-semibold">Duração<select value={draft.durationMin} onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })} className="agenda-input">{[15, 30, 45, 60, 90, 120, 180, 240].map((v) => <option key={v} value={v}>{v} minutos</option>)}</select></label>
                </div>
                <button type="submit" disabled={busy} className="btn-primary mt-5 w-full !py-3 disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar compromisso'}</button>
                <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">O nome fica privado. O assistente só deixa de oferecer horários que coincidam com o compromisso.</p>
              </form>}
            </aside>
          </div>
        ) : (
          <section role="tabpanel" className="mx-auto max-w-4xl">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-deep">CONTATOS DO MINI-SITE</p><h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Solicitações de reunião</h2><p className="mt-2 text-[13px] text-ink-soft">Entre em contato e registre sua decisão. A solicitação não reserva o horário.</p></div>{profile?.plan === 'premium' && !profile.meetingInboxEnabled && <Link to="/editor?section=agenda" className="text-[12px] font-semibold text-burgundy underline underline-offset-4">Ativar pedidos no perfil</Link>}</div>
            <div className="space-y-4">{loadingRequests && requests.length === 0 ? <p role="status" className="rounded-xl bg-paper p-5 text-[13px] text-ink-faint">Carregando solicitações…</p> : requests.length ? requests.map((request) => <RequestCard key={request.id} request={request} busy={busy} onDecide={(status) => void decide(request, status)} onDelete={() => void removeRequest(request)} onCalendar={() => { setSearch({}); const date = request.preferredAt?.slice(0, 10) || today(); setMonth(new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1)); setSelected(date); setDraft({ title: `Reunião com ${request.name}`, date, time: request.preferredAt?.slice(11, 16) || '09:00', durationMin: profile?.assistant?.durationMin ?? 45 }) }} />) : <div className="rounded-2xl border border-ink/10 bg-paper p-8 text-center shadow-card"><CalendarIcon width={25} height={25} className="mx-auto text-brass-deep" /><h3 className="mt-3 font-display text-xl font-semibold">Nenhuma solicitação por aqui</h3><p className="mt-2 text-[13px] text-ink-soft">Quando alguém pedir uma reunião no seu mini-site, o contato aparecerá nesta aba.</p></div>}</div>
            {nextOffset !== null && <button type="button" onClick={() => void loadRequests(nextOffset)} className="mt-5 w-full rounded-xl border border-ink/15 bg-paper px-4 py-3 text-[13px] font-semibold hover:bg-paper-soft">Carregar mais solicitações</button>}
          </section>
        )}
      </main>
    </div>
  )
}

function EventCard({ entry, editable, onEdit, onDelete }: { entry: CalendarEntry; editable: boolean; onEdit: () => void; onDelete: () => void }) {
  const event: Compromisso = { inicio: entry.startsAt, duracaoMin: entry.durationMin, titulo: entry.title }
  return <article className="rounded-xl border border-ink/10 bg-paper-soft/60 p-4">
    <div className="flex gap-3"><span className="mt-1 h-9 w-1 shrink-0 rounded-full bg-burgundy" /><div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-wider text-brass-deep">{eventTime(entry)} · {entry.durationMin} min</p><h3 className="mt-1 break-words font-display text-[17px] font-semibold leading-tight">{entry.title}</h3></div></div>
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 border-t border-ink/10 pt-3 text-[11px] font-semibold">
      {editable && <><button type="button" onClick={onEdit} className="text-burgundy hover:underline">Editar</button><button type="button" onClick={onDelete} className="text-ink-faint hover:text-burgundy hover:underline">Apagar</button></>}
      <details className="relative"><summary className="cursor-pointer text-burgundy hover:underline">Adicionar ao celular</summary><div className="absolute right-0 z-10 mt-2 flex min-w-48 flex-col gap-1 rounded-xl border border-ink/10 bg-paper p-2 shadow-lift"><a href={linkGoogleAgenda(event)} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-2 hover:bg-paper-soft">Google Agenda</a><a href={linkOutlook(event)} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-2 hover:bg-paper-soft">Outlook</a><button type="button" onClick={() => baixarIcs([event], 'advoc.me')} className="rounded-lg px-2 py-2 text-left hover:bg-paper-soft">Calendário do celular (.ics)</button></div></details>
    </div>
  </article>
}

function RequestCard({ request, busy, onDecide, onDelete, onCalendar }: { request: MeetingRequest; busy: boolean; onDecide: (status: 'confirmed' | 'declined') => void; onDelete: () => void; onCalendar: () => void }) {
  const wa = whatsappHref(request.whatsapp, `Olá, ${request.name}. Recebi sua solicitação pelo meu perfil no advoc.me e gostaria de conversar sobre o horário.`)
  const email = request.email ? `mailto:${request.email}?subject=${encodeURIComponent('Sua solicitação de reunião')}` : undefined
  return <article className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-card">
    <div className="border-l-4 border-brass px-4 py-5 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-deep">RECEBIDA {new Date(request.createdAt).toLocaleDateString('pt-BR')}</p><h3 className="mt-1 font-display text-xl font-semibold">{request.name}</h3></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${request.status === 'pending' ? 'bg-brass/15 text-brass-deep' : request.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-ink/5 text-ink-faint'}`}>{statusLabel[request.status]}</span></div>
      <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-soft">{request.subject}</p>
      {request.preferredAt && <p className="mt-2 text-[12px] font-semibold text-burgundy">Preferência: {formatDate(request.preferredAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })} às {request.preferredAt.slice(11, 16)}</p>}
      {request.triage.length > 0 && <details className="mt-3 rounded-xl bg-paper-soft p-3 text-[12px]"><summary className="cursor-pointer font-semibold">Ver respostas da triagem ({request.triage.length})</summary><dl className="mt-3 space-y-3">{request.triage.map((row, i) => <div key={row.id || i}><dt className="font-semibold text-ink">{row.pergunta}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-ink-soft">{row.resposta}</dd></div>)}</dl></details>}
      <div className="mt-4 flex flex-wrap gap-2">{wa && <a href={wa} {...comoAbrirWhatsapp()} className="rounded-lg bg-[#1f7a55] px-3 py-2.5 text-[12px] font-semibold text-white hover:bg-[#176143]">Chamar no WhatsApp</a>}{email && <a href={email} className="rounded-lg border border-ink/15 px-3 py-2.5 text-[12px] font-semibold hover:bg-paper-soft">Enviar e-mail</a>}</div>
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 bg-paper-soft/45 px-4 py-3 sm:px-6">{request.status === 'pending' && <><button type="button" disabled={busy} onClick={() => onDecide('confirmed')} className="rounded-lg bg-burgundy px-3 py-2 text-[12px] font-semibold text-paper disabled:opacity-50">Confirmei o horário</button><button type="button" disabled={busy} onClick={() => onDecide('declined')} className="rounded-lg border border-ink/15 px-3 py-2 text-[12px] font-semibold disabled:opacity-50">Neguei</button></>}{request.status === 'confirmed' && <button type="button" onClick={onCalendar} className="rounded-lg border border-brass/50 px-3 py-2 text-[12px] font-semibold text-burgundy">Colocar na agenda</button>}<button type="button" disabled={busy} onClick={onDelete} className="ml-auto px-2 py-2 text-[11px] text-ink-faint underline underline-offset-2 hover:text-burgundy">Excluir dados</button></div>
  </article>
}
