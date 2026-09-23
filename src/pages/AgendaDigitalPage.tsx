import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Profile } from '@/lib/types'
import { agendaDigital, type CalendarEntry, type MeetingRequest, type RequestCounts, type RequestFilter } from '@/lib/agendaDigital'
import { baixarIcs, linkGoogleAgenda, linkOutlook, type Compromisso } from '@/lib/ics'
import { whatsappHref, comoAbrirWhatsapp } from '@/lib/whatsapp'
import { CalendarIcon, CheckIcon, MailIcon, TrashIcon, WhatsappIcon } from '@/components/ui/icons'

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => dateKey(new Date())
const formatDate = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR', options)
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const monthLabel = (d: Date) => titleCase(d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
const eventTime = (entry: CalendarEntry) => entry.startsAt.slice(11, 16)
const statusLabel: Record<MeetingRequest['status'], string> = { pending: 'Aguardando', confirmed: 'Confirmada', declined: 'Cancelada' }
const requestViews: { id: RequestFilter; label: string; description: string; empty: string }[] = [
  { id: 'pending', label: 'Aguardando', description: 'Pedidos recebidos que ainda esperam sua resposta.', empty: 'Nenhum pedido aguardando resposta.' },
  { id: 'confirmed', label: 'Confirmadas', description: 'Reuniões confirmadas e seus contatos.', empty: 'Nenhuma reunião confirmada por enquanto.' },
  { id: 'declined', label: 'Canceladas', description: 'Pedidos que foram negados ou cancelados.', empty: 'Nenhuma solicitação cancelada.' },
  { id: 'all', label: 'Histórico', description: 'Todos os pedidos, do mais recente ao mais antigo.', empty: 'Ainda não há solicitações no histórico.' },
]

type Draft = { id?: string; title: string; date: string; time: string; durationMin: number }

export default function AgendaDigitalPage() {
  const [search, setSearch] = useSearchParams()
  const tab = search.get('tab') === 'solicitacoes' ? 'solicitacoes' : 'agenda'
  const requestView = requestViews.find((item) => item.id === search.get('view'))?.id ?? 'pending'
  const activeView = requestViews.find((item) => item.id === requestView)!
  const pageParam = Number(search.get('page') ?? 1)
  const requestPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1
  const [profile, setProfile] = useState<Profile | null>(null)
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [selected, setSelected] = useState(today)
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [requests, setRequests] = useState<MeetingRequest[]>([])
  const [totalRequests, setTotalRequests] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [requestCounts, setRequestCounts] = useState<RequestCounts>({ pending: 0, confirmed: 0, declined: 0, all: 0 })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const requestFetch = useRef(0)

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

  const loadRequests = useCallback(async (page: number, view: RequestFilter) => {
    const generation = ++requestFetch.current
    setLoadingRequests(true)
    try {
      const data = await agendaDigital.requests(page, view)
      if (generation !== requestFetch.current) return
      setRequests(data.items)
      setTotalRequests(data.total)
      setTotalPages(data.totalPages)
      setCurrentPage(data.page)
      setRequestCounts(data.counts)
      setError('')
    } catch (e) { if (generation === requestFetch.current) setError(e instanceof Error ? e.message : 'Falha ao carregar as solicitações.') }
    finally { if (generation === requestFetch.current) setLoadingRequests(false) }
  }, [])
  useEffect(() => { void loadRequests(tab === 'solicitacoes' ? requestPage : 1, tab === 'solicitacoes' ? requestView : 'pending') }, [tab, requestPage, requestView, loadRequests])

  const calendarDays = useMemo(() => {
    const offset = (month.getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1))
  }, [month])
  const selectedEntries = entries.filter((entry) => entry.startsAt.slice(0, 10) === selected)
  const pending = requestCounts.pending

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
    setBusy(true); setError('')
    try { await agendaDigital.deleteEntry(entry.id); await loadEntries(); if (draft?.id === entry.id) setDraft(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível apagar.') }
    finally { setBusy(false) }
  }

  function showCalendar(startsAt: string) {
    const date = startsAt.slice(0, 10)
    setMonth(new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1))
    setSelected(date)
    setDraft(null)
    setSearch({})
    if (date.slice(0, 7) === first.slice(0, 7)) void loadEntries()
  }

  async function decide(request: MeetingRequest, status: 'confirmed' | 'declined', appointment?: { startsAt: string; durationMin: number }) {
    setBusy(true); setError('')
    try {
      const result = await agendaDigital.decide(request.id, status, appointment)
      if (result.entry) showCalendar(result.entry.startsAt)
      else if (requestView === 'pending' && requests.length === 1 && currentPage > 1) setSearch({ tab: 'solicitacoes', view: requestView, page: String(currentPage - 1) })
      else await loadRequests(currentPage, requestView)
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar a solicitação.') }
    finally { setBusy(false) }
  }

  async function removeRequest(request: MeetingRequest) {
    setBusy(true); setError('')
    try {
      await agendaDigital.deleteRequest(request.id)
      if (requests.length === 1 && currentPage > 1) setSearch({ tab: 'solicitacoes', view: requestView, page: String(currentPage - 1) })
      else await loadRequests(currentPage, requestView)
    }
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
                  {loading ? <p className="text-[13px] text-ink-faint">Carregando…</p> : selectedEntries.length ? selectedEntries.map((entry) => <EventCard key={entry.id} entry={entry} editable={profile?.plan === 'premium'} busy={busy}
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
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brass-deep">CONTATOS DO MINI-SITE</p><h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">Solicitações de reunião</h2><p className="mt-2 text-[13px] text-ink-soft">Acompanhe cada pedido, combine o horário e consulte os registros anteriores.</p></div>{profile?.plan === 'premium' && !profile.meetingInboxEnabled && <Link to="/editor?section=agenda" className="text-[12px] font-semibold text-burgundy underline underline-offset-4">Ativar pedidos no perfil</Link>}</div>
            <nav aria-label="Estados das solicitações" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {requestViews.map((view) => <button key={view.id} type="button" aria-pressed={requestView === view.id}
                onClick={() => { if (view.id === requestView) return; requestFetch.current++; setLoadingRequests(true); setSearch({ tab: 'solicitacoes', view: view.id }) }}
                className={`flex min-h-[78px] items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left shadow-card transition-colors sm:min-h-[86px] sm:px-4 ${requestView === view.id ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-paper text-ink hover:border-brass/60 hover:bg-brass/[0.05]'}`}>
                <span className="text-[13px] font-semibold leading-tight sm:text-[14px]">{view.label}</span>
                <span className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-1.5 text-[12px] font-bold tabular-nums ${requestView === view.id ? 'bg-brass text-ink' : 'bg-paper-soft text-ink-soft'}`}>{requestCounts[view.id]}</span>
              </button>)}
            </nav>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div><h3 className="font-display text-xl font-semibold">{activeView.label}</h3><p className="mt-1 text-[12px] text-ink-soft">{activeView.description}</p></div>
              {!loadingRequests && totalRequests > 0 && <p className="text-[12px] font-medium tabular-nums text-ink-faint">{totalRequests} {totalRequests === 1 ? 'pedido' : 'pedidos'} · página {currentPage} de {totalPages}</p>}
            </div>
            <div className="space-y-4">{loadingRequests ? <p role="status" className="rounded-xl bg-paper p-5 text-[13px] text-ink-faint">Carregando solicitações…</p> : requests.length ? requests.map((request) => <RequestCard key={request.id} request={request} busy={busy} canSchedule={profile?.plan === 'premium'} defaultDuration={profile?.assistant?.durationMin ?? 45} onDecide={(status, appointment) => void decide(request, status, appointment)} onDelete={() => void removeRequest(request)} onViewCalendar={showCalendar} />) : <div className="rounded-2xl border border-ink/10 bg-paper p-8 text-center shadow-card"><CalendarIcon width={25} height={25} className="mx-auto text-brass-deep" /><h3 className="mt-3 font-display text-xl font-semibold">{activeView.empty}</h3><p className="mt-2 text-[13px] text-ink-soft">{requestView === 'pending' ? 'Novos pedidos aparecerão aqui assim que chegarem pelo mini-site.' : 'Você pode consultar os outros estados ou voltar à agenda.'}</p></div>}</div>
            {!loadingRequests && totalPages > 1 && <nav aria-label={`Páginas de ${activeView.label.toLowerCase()}`} className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-paper p-2 shadow-card">
              <button type="button" disabled={currentPage <= 1 || loadingRequests} onClick={() => setSearch({ tab: 'solicitacoes', view: requestView, page: String(currentPage - 1) })} className="min-h-11 rounded-lg px-3 text-[13px] font-semibold text-burgundy hover:bg-paper-soft disabled:opacity-40">← Anterior</button>
              <span className="text-center text-[12px] font-semibold tabular-nums text-ink-soft">{currentPage} / {totalPages}</span>
              <button type="button" disabled={currentPage >= totalPages || loadingRequests} onClick={() => setSearch({ tab: 'solicitacoes', view: requestView, page: String(currentPage + 1) })} className="min-h-11 rounded-lg px-3 text-[13px] font-semibold text-burgundy hover:bg-paper-soft disabled:opacity-40">Próxima →</button>
            </nav>}
          </section>
        )}
      </main>
    </div>
  )
}

function EventCard({ entry, editable, busy, onEdit, onDelete }: { entry: CalendarEntry; editable: boolean; busy: boolean; onEdit: () => void; onDelete: () => void }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const confirmationId = useId()
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const event: Compromisso = { inicio: entry.startsAt, duracaoMin: entry.durationMin, titulo: entry.title }
  return <article className="rounded-xl border border-ink/10 bg-paper-soft/60 p-4">
    <div className="flex gap-3"><span className="mt-1 h-9 w-1 shrink-0 rounded-full bg-burgundy" /><div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-wider text-brass-deep">{eventTime(entry)} · {entry.durationMin} min</p><h3 className="mt-1 break-words font-display text-[17px] font-semibold leading-tight">{entry.title}</h3></div></div>
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 border-t border-ink/10 pt-3 text-[11px] font-semibold">
      {editable && <><button type="button" onClick={onEdit} disabled={busy} className="min-h-10 rounded-lg px-2 text-burgundy hover:bg-burgundy/[0.05] disabled:opacity-50">Editar</button><button ref={deleteButtonRef} type="button" onClick={() => setConfirmingDelete((value) => !value)} disabled={busy} aria-expanded={confirmingDelete} aria-controls={confirmationId} className="min-h-10 rounded-lg px-2 text-ink-faint hover:bg-burgundy/[0.05] hover:text-burgundy disabled:opacity-50">Apagar</button></>}
      <details className="relative"><summary className="cursor-pointer text-burgundy hover:underline">Adicionar ao celular</summary><div className="absolute right-0 z-10 mt-2 flex min-w-48 flex-col gap-1 rounded-xl border border-ink/10 bg-paper p-2 shadow-lift"><a href={linkGoogleAgenda(event)} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-2 hover:bg-paper-soft">Google Agenda</a><a href={linkOutlook(event)} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2 py-2 hover:bg-paper-soft">Outlook</a><button type="button" onClick={() => baixarIcs([event], 'advoc.me')} className="rounded-lg px-2 py-2 text-left hover:bg-paper-soft">Calendário do celular (.ics)</button></div></details>
    </div>
    {confirmingDelete && <InlineDeleteConfirmation id={confirmationId} title="Apagar compromisso?" description={`“${entry.title}” sairá da sua agenda. Esta ação não pode ser desfeita.`} confirmLabel="Apagar da agenda" busy={busy} onCancel={() => { setConfirmingDelete(false); deleteButtonRef.current?.focus() }} onConfirm={onDelete} />}
  </article>
}

function RequestCard({ request, busy, canSchedule, defaultDuration, onDecide, onDelete, onViewCalendar }: {
  request: MeetingRequest
  busy: boolean
  canSchedule: boolean
  defaultDuration: number
  onDecide: (status: 'confirmed' | 'declined', appointment?: { startsAt: string; durationMin: number }) => void
  onDelete: () => void
  onViewCalendar: (startsAt: string) => void
}) {
  const [when, setWhen] = useState(request.preferredAt ?? '')
  const [durationMin, setDurationMin] = useState(defaultDuration)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const confirmationId = useId()
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const needsAppointment = request.status === 'pending' || (request.status === 'confirmed' && !request.calendarEntryId)
  const wa = whatsappHref(request.whatsapp, `Olá, ${request.name}. Recebi sua solicitação pelo meu perfil no advoc.me e gostaria de conversar sobre o horário.`)
  const email = request.email ? `mailto:${request.email}?subject=${encodeURIComponent('Sua solicitação de reunião')}` : undefined
  return <article className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-card">
    <div className="border-l-4 border-brass px-4 py-5 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-deep">RECEBIDA {new Date(request.createdAt).toLocaleDateString('pt-BR')}</p><h3 className="mt-1 font-display text-xl font-semibold">{request.name}</h3></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${request.status === 'pending' ? 'bg-brass/15 text-brass-deep' : request.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-ink/5 text-ink-faint'}`}>{statusLabel[request.status]}</span></div>
      {request.firmId && <p className="mt-2 inline-flex rounded-full bg-burgundy/[0.07] px-2.5 py-1 text-[11px] font-semibold text-burgundy">Veio pela página do escritório</p>}
      <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-soft">{request.subject}</p>
      {request.preferredAt && <p className="mt-2 text-[12px] font-semibold text-burgundy">Preferência: {formatDate(request.preferredAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })} às {request.preferredAt.slice(11, 16)}</p>}
      {request.triage.length > 0 && <details className="mt-3 rounded-xl bg-paper-soft p-3 text-[12px]"><summary className="cursor-pointer font-semibold">Ver respostas da triagem ({request.triage.length})</summary><dl className="mt-3 space-y-3">{request.triage.map((row, i) => <div key={row.id || i}><dt className="font-semibold text-ink">{row.pergunta}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-ink-soft">{row.resposta}</dd></div>)}</dl></details>}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {wa && <a href={wa} {...comoAbrirWhatsapp()} className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-[#1f7a55] px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#176143]"><WhatsappIcon width={19} height={19} aria-hidden />Chamar no WhatsApp</a>}
        {email && <a href={email} className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-ink/15 px-4 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-paper-soft"><MailIcon width={19} height={19} aria-hidden />Enviar e-mail</a>}
      </div>
      {needsAppointment && <div className="mt-5 rounded-xl border border-brass/30 bg-brass/[0.06] p-4">
        <p className="text-[12px] font-semibold text-ink">Horário combinado</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{request.status === 'confirmed'
          ? 'Escolha a data combinada para colocar este pedido antigo na agenda.'
          : request.preferredAt
            ? 'Confirme ou ajuste a data depois de conversar com a pessoa. Ao confirmar, o compromisso entra direto na sua agenda.'
            : 'Este pedido chegou sem horário. Converse com a pessoa pelo contato acima, escolha a data combinada aqui e confirme para colocar na sua agenda.'}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <label className="text-[12px] font-semibold">Data e hora<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="agenda-input" /></label>
          <label className="text-[12px] font-semibold">Duração<select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className="agenda-input">{[15, 30, 45, 60, 90, 120, 180, 240].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></label>
        </div>
        {!canSchedule && <p className="mt-2 text-[11px] text-burgundy">Ative o plano Max para confirmar e incluir o horário na agenda.</p>}
      </div>}
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 bg-paper-soft/45 px-4 py-3 sm:px-6">
      {request.status === 'pending' && <>
        <button type="button" disabled={busy || !canSchedule || !when} onClick={() => onDecide('confirmed', { startsAt: when, durationMin })} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-burgundy px-5 py-3 text-[14px] font-semibold text-paper transition-colors hover:bg-burgundy/90 disabled:opacity-50 sm:w-auto"><CheckIcon width={19} height={19} aria-hidden />Confirmar e colocar na agenda</button>
        <button type="button" disabled={busy} onClick={() => onDecide('declined')} className="min-h-12 rounded-xl border border-ink/15 px-5 py-3 text-[14px] font-semibold hover:bg-paper-soft disabled:opacity-50">Cancelar pedido</button>
      </>}
      {request.status === 'confirmed' && (request.calendarEntryId && request.calendarEntry ?
        <button type="button" onClick={() => onViewCalendar(request.calendarEntry!.startsAt)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brass/50 px-5 py-3 text-[14px] font-semibold text-burgundy hover:bg-brass/[0.08]"><CalendarIcon width={19} height={19} aria-hidden />Ver na agenda</button> :
        <button type="button" disabled={busy || !canSchedule || !when} onClick={() => onDecide('confirmed', { startsAt: when, durationMin })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brass/50 px-5 py-3 text-[14px] font-semibold text-burgundy hover:bg-brass/[0.08] disabled:opacity-50"><CalendarIcon width={19} height={19} aria-hidden />Colocar na agenda</button>)}
      {/* Pedido do escritório não se apaga daqui: ele aparece nas duas caixas, e
          sumir com ele tiraria também da de quem administra, que foi quem o
          encaminhou. O servidor recusa — o botão some para a recusa não virar
          surpresa. */}
      {request.firmId
        ? <p className="ml-auto text-right text-[12px] leading-snug text-ink-faint">Quem apaga este pedido é<br />quem administra o escritório.</p>
        : <button ref={deleteButtonRef} type="button" disabled={busy} onClick={() => setConfirmingDelete((value) => !value)} aria-expanded={confirmingDelete} aria-controls={confirmationId} className="ml-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-ink-faint hover:bg-paper-soft hover:text-burgundy disabled:opacity-50"><TrashIcon width={19} height={19} aria-hidden />Excluir dados</button>}
    </div>
    {confirmingDelete && <div className="px-4 pb-4 sm:px-6"><InlineDeleteConfirmation id={confirmationId} title="Excluir dados desta solicitação?" description={`Os dados de ${request.name} e as respostas da triagem serão excluídos do painel. Esta ação não pode ser desfeita.`} confirmLabel="Excluir dados" busy={busy} onCancel={() => { setConfirmingDelete(false); deleteButtonRef.current?.focus() }} onConfirm={onDelete} /></div>}
  </article>
}

function InlineDeleteConfirmation({ id, title, description, confirmLabel, busy, onCancel, onConfirm }: {
  id: string
  title: string
  description: string
  confirmLabel: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true })
    panelRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  return <div ref={panelRef} id={id} role="group" aria-label={title} tabIndex={-1} className="mt-3 rounded-xl border border-burgundy/25 bg-burgundy/[0.045] p-4 outline-none focus-visible:ring-2 focus-visible:ring-burgundy">
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-burgundy/10 text-burgundy"><TrashIcon width={17} height={17} aria-hidden /></span>
      <div className="min-w-0"><p className="font-display text-[16px] font-semibold leading-snug text-ink">{title}</p><p className="mt-1 break-words text-[12.5px] leading-relaxed text-ink-soft">{description}</p></div>
    </div>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 w-full rounded-xl border border-ink/15 bg-paper px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-paper-soft disabled:opacity-50 sm:w-auto">Manter</button>
      <button type="button" disabled={busy} onClick={onConfirm} className="min-h-11 w-full rounded-xl bg-burgundy px-4 py-2.5 text-[13px] font-semibold text-paper transition-colors hover:bg-burgundy-deep disabled:opacity-50 sm:w-auto">{busy ? 'Excluindo…' : confirmLabel}</button>
    </div>
  </div>
}
