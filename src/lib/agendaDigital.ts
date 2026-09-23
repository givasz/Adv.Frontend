import { apiFetch, TEM_BACKEND } from './http'
import type { RespostaDeTriagem } from './triagem'

export interface CalendarEntry {
  id: string
  title: string
  startsAt: string
  durationMin: number
}

export interface MeetingRequest {
  id: string
  /**
   * Só na caixa do ESCRITÓRIO: o advogado a quem o pedido já está endereçado.
   * `null` = ninguém foi escolhido e quem administra ainda vai encaminhar.
   */
  lawyer?: { id: string; name: string } | null
  /**
   * Preenchido quando o pedido entrou pela página de um ESCRITÓRIO. Muda duas
   * coisas na tela do advogado: a origem fica dita, e o botão de excluir sai —
   * o registro é da sociedade, e quem o apaga é quem administra (o advogado
   * responde, confirma e nega, mas não elimina o que não é dele).
   */
  firmId?: string | null
  /**
   * Só na caixa do ESCRITÓRIO: o advogado que o visitante pediu, quando é
   * diferente de quem vai responder. Perder essa escolha seria jogar fora a
   * única coisa que ele disse sobre com quem quer falar.
   */
  preferido?: { id: string; name: string } | null
  name: string
  whatsapp?: string | null
  email?: string | null
  subject: string
  preferredAt?: string | null
  calendarEntryId?: string | null
  calendarEntry?: Pick<CalendarEntry, 'id' | 'startsAt'> | null
  triage: RespostaDeTriagem[]
  status: 'pending' | 'confirmed' | 'declined'
  createdAt: string
}

export interface MeetingRequestInput {
  name: string
  whatsapp?: string
  email?: string
  subject: string
  preferredAt?: string
  triage?: RespostaDeTriagem[]
  consent: boolean
  /**
   * Só no pedido feito pela página do ESCRITÓRIO: o id do perfil do advogado que
   * o VISITANTE escolheu na conversa. Vai sempre que houve escolha — quem decide
   * se isso endereça o pedido a ele ou fica só como preferência é o servidor,
   * conforme o escritório delegar ou centralizar o atendimento. Ele também
   * confere que o id é mesmo de um membro ativo: o corpo é do visitante.
   */
  lawyerId?: string
}

/** A página que recebe o pedido: o perfil de um advogado ou a de um escritório. */
export type AlvoDoPedido = 'perfil' | 'escritorio'

export type RequestFilter = 'pending' | 'confirmed' | 'declined' | 'all'

/** Um advogado do escritório, como a caixa de solicitações precisa dele. */
export interface DestinoPossivel {
  id: string
  name: string
}
export type RequestCounts = Record<RequestFilter, number>

export interface RequestPage {
  items: MeetingRequest[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  pendingCount: number
  counts: RequestCounts
}

export interface DecisionResult {
  status: 'confirmed' | 'declined'
  entry: CalendarEntry | null
}

const ENTRIES_KEY = 'advocme:calendar:entries'
const REQUESTS_KEY = 'advocme:calendar:requests'

function read<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') as T[] } catch { return [] }
}
function write<T>(key: string, items: T[]) { localStorage.setItem(key, JSON.stringify(items)) }

async function result<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init)
  if (!response.ok) {
    let message = 'Não foi possível concluir. Tente novamente.'
    try {
      const data = await response.json() as { message?: string | string[] }
      message = Array.isArray(data.message) ? data.message[0] : data.message || message
    } catch { /* resposta vazia */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const id = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

export const agendaDigital = {
  async entries(from: string, to: string): Promise<CalendarEntry[]> {
    if (TEM_BACKEND) return result(`/api/agenda/entries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    return read<CalendarEntry>(ENTRIES_KEY).filter((e) => e.startsAt.slice(0, 10) >= from && e.startsAt.slice(0, 10) <= to).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  },
  async saveEntry(input: Omit<CalendarEntry, 'id'>, entryId?: string): Promise<CalendarEntry> {
    if (TEM_BACKEND) return result(`/api/agenda/entries${entryId ? `/${encodeURIComponent(entryId)}` : ''}`, json(entryId ? 'PUT' : 'POST', input))
    const entries = read<CalendarEntry>(ENTRIES_KEY)
    const entry = { ...input, id: entryId || id() }
    const next = entryId ? entries.map((e) => e.id === entryId ? entry : e) : [...entries, entry]
    write(ENTRIES_KEY, next)
    return entry
  },
  async deleteEntry(entryId: string): Promise<void> {
    if (TEM_BACKEND) { await result(`/api/agenda/entries/${encodeURIComponent(entryId)}`, { method: 'DELETE' }); return }
    write(ENTRIES_KEY, read<CalendarEntry>(ENTRIES_KEY).filter((e) => e.id !== entryId))
    write(REQUESTS_KEY, read<MeetingRequest>(REQUESTS_KEY).map((r) => r.calendarEntryId === entryId ? { ...r, calendarEntryId: null, calendarEntry: null } : r))
  },
  async submit(slug: string, input: MeetingRequestInput, alvo: AlvoDoPedido = 'perfil'): Promise<void> {
    const porta = alvo === 'escritorio' ? 'firms' : 'profiles'
    if (TEM_BACKEND) { await result(`/api/${porta}/${encodeURIComponent(slug)}/meeting-requests`, json('POST', input)); return }
    // Perfis demonstrativos não pertencem a alguém: o componente público os mantém em modo de exemplo.
    const request: MeetingRequest = { ...input, id: id(), triage: input.triage ?? [], status: 'pending', createdAt: new Date().toISOString() }
    write(REQUESTS_KEY, [request, ...read<MeetingRequest>(REQUESTS_KEY)])
  },
  async requests(page = 1, status: RequestFilter = 'all'): Promise<RequestPage> {
    if (TEM_BACKEND) return result(`/api/agenda/requests?page=${page}&status=${status}`)
    const all = read<MeetingRequest>(REQUESTS_KEY).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    const counts: RequestCounts = { pending: 0, confirmed: 0, declined: 0, all: all.length }
    for (const request of all) counts[request.status]++
    const filtered = status === 'all' ? all : all.filter((request) => request.status === status)
    const pageSize = 10
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const currentPage = Math.max(1, Math.min(page, totalPages))
    const entries = read<CalendarEntry>(ENTRIES_KEY)
    const items = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((r) => {
      const entry = entries.find((e) => e.id === r.calendarEntryId)
      return { ...r, calendarEntry: entry ? { id: entry.id, startsAt: entry.startsAt } : null }
    })
    return { items, page: currentPage, pageSize, total: filtered.length, totalPages, pendingCount: counts.pending, counts }
  },
  async decide(requestId: string, status: 'confirmed' | 'declined', appointment?: { startsAt: string; durationMin: number }): Promise<DecisionResult> {
    if (TEM_BACKEND) return result(`/api/agenda/requests/${encodeURIComponent(requestId)}`, json('PATCH', { status, ...appointment }))
    const requests = read<MeetingRequest>(REQUESTS_KEY)
    const request = requests.find((r) => r.id === requestId)
    if (!request) throw new Error('Solicitação não encontrada.')
    if (status === 'confirmed' && request.status === 'confirmed' && request.calendarEntryId) {
      return { status, entry: read<CalendarEntry>(ENTRIES_KEY).find((e) => e.id === request.calendarEntryId) ?? null }
    }
    if (request.status !== 'pending' && !(status === 'confirmed' && request.status === 'confirmed')) throw new Error('Esta solicitação já foi respondida.')
    let entry: CalendarEntry | null = null
    if (status === 'confirmed') {
      if (!appointment?.startsAt || !appointment.durationMin) throw new Error('Escolha uma data e hora para confirmar.')
      const existing = read<CalendarEntry>(ENTRIES_KEY)
      const start = new Date(appointment.startsAt).getTime()
      const end = start + appointment.durationMin * 60_000
      if (existing.some((e) => start < new Date(e.startsAt).getTime() + e.durationMin * 60_000 && new Date(e.startsAt).getTime() < end)) {
        throw new Error('Já existe um compromisso nesse horário.')
      }
      entry = { id: id(), title: `Reunião com ${request.name}`.slice(0, 100), ...appointment }
      write(ENTRIES_KEY, [...existing, entry])
    }
    write(REQUESTS_KEY, requests.map((r) => r.id === requestId ? { ...r, status, calendarEntryId: entry?.id ?? r.calendarEntryId ?? null, calendarEntry: entry ? { id: entry.id, startsAt: entry.startsAt } : r.calendarEntry ?? null } : r))
    return { status, entry }
  },
  async deleteRequest(requestId: string): Promise<void> {
    if (TEM_BACKEND) { await result(`/api/agenda/requests/${encodeURIComponent(requestId)}`, { method: 'DELETE' }); return }
    write(REQUESTS_KEY, read<MeetingRequest>(REQUESTS_KEY).filter((r) => r.id !== requestId))
  },
}

/**
 * A caixa de solicitações do ESCRITÓRIO — os pedidos que entraram pela página da
 * sociedade.
 *
 * Três verbos, e o que FALTA neles é a decisão: confirmar não está aqui. O
 * compromisso entra na agenda de uma pessoa, e marcar horário no calendário de
 * outra seria mexer na agenda dela. Quem administra encaminha; quem confirma é o
 * advogado, na agenda digital dele.
 */
export const solicitacoesDoEscritorio = {
  async listar(page = 1, status: RequestFilter = 'all'): Promise<RequestPage> {
    if (!TEM_BACKEND) {
      return { items: [], page: 1, pageSize: 10, total: 0, totalPages: 1, pendingCount: 0, counts: { pending: 0, confirmed: 0, declined: 0, all: 0 } }
    }
    return result(`/api/firms/me/requests?page=${page}&status=${status}`)
  },
  /** Endereça o pedido a um advogado do escritório: ele passa a vê-lo na agenda dele. */
  async encaminhar(requestId: string, lawyerId: string): Promise<void> {
    if (!TEM_BACKEND) return
    await result(`/api/firms/me/requests/${encodeURIComponent(requestId)}`, json('PATCH', { lawyerId }))
  },
  async negar(requestId: string): Promise<void> {
    if (!TEM_BACKEND) return
    await result(`/api/firms/me/requests/${encodeURIComponent(requestId)}`, json('PATCH', { status: 'declined' }))
  },
  async apagar(requestId: string): Promise<void> {
    if (!TEM_BACKEND) return
    await result(`/api/firms/me/requests/${encodeURIComponent(requestId)}`, { method: 'DELETE' })
  },
}
