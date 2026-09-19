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
  name: string
  whatsapp?: string | null
  email?: string | null
  subject: string
  preferredAt?: string | null
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
  },
  async submit(slug: string, input: MeetingRequestInput): Promise<void> {
    if (TEM_BACKEND) { await result(`/api/profiles/${encodeURIComponent(slug)}/meeting-requests`, json('POST', input)); return }
    // Perfis demonstrativos não pertencem a alguém: o componente público os mantém em modo de exemplo.
    const request: MeetingRequest = { ...input, id: id(), triage: input.triage ?? [], status: 'pending', createdAt: new Date().toISOString() }
    write(REQUESTS_KEY, [request, ...read<MeetingRequest>(REQUESTS_KEY)])
  },
  async requests(offset = 0): Promise<{ items: MeetingRequest[]; nextOffset: number | null }> {
    if (TEM_BACKEND) return result(`/api/agenda/requests?offset=${offset}`)
    const all = read<MeetingRequest>(REQUESTS_KEY)
    return { items: all.slice(offset, offset + 50), nextOffset: all.length > offset + 50 ? offset + 50 : null }
  },
  async decide(requestId: string, status: 'confirmed' | 'declined'): Promise<void> {
    if (TEM_BACKEND) { await result(`/api/agenda/requests/${encodeURIComponent(requestId)}`, json('PATCH', { status })); return }
    write(REQUESTS_KEY, read<MeetingRequest>(REQUESTS_KEY).map((r) => r.id === requestId ? { ...r, status } : r))
  },
  async deleteRequest(requestId: string): Promise<void> {
    if (TEM_BACKEND) { await result(`/api/agenda/requests/${encodeURIComponent(requestId)}`, { method: 'DELETE' }); return }
    write(REQUESTS_KEY, read<MeetingRequest>(REQUESTS_KEY).filter((r) => r.id !== requestId))
  },
}
