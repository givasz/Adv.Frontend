// Suporte ao cliente — canal exclusivo de quem tem conta.
//
// Diferente da denúncia (lib/reportReasons.ts), que é pública e trata do
// conteúdo de um terceiro: aqui é o próprio advogado falando com a plataforma
// sobre um problema dela. Por isso exige sessão — e por isso dá para responder.

import { authHeader } from './auth'

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true' || !!API_BASE

const MOCK_KEY = 'advocme:support:mock'

export type SupportKind = 'bug' | 'duvida' | 'conta' | 'sugestao' | 'outro'
export type SupportStatus = 'open' | 'in_progress' | 'resolved'

export interface SupportTicket {
  id: string
  kind: SupportKind
  subject: string
  message?: string
  status: SupportStatus
  adminNote?: string
  createdAt: string
  handledAt?: string | null
}

export const SUPPORT_KINDS: { value: SupportKind; label: string; hint: string }[] = [
  { value: 'bug', label: 'Algo quebrado', hint: 'Uma tela, um botão ou um recurso que não funciona.' },
  { value: 'duvida', label: 'Dúvida', hint: 'Não achei como fazer alguma coisa.' },
  { value: 'conta', label: 'Conta ou plano', hint: 'Acesso, assinatura, cobrança, e-mail.' },
  { value: 'sugestao', label: 'Sugestão', hint: 'Uma ideia do que faltou no produto.' },
  { value: 'outro', label: 'Outro assunto', hint: 'Qualquer coisa que não se encaixe acima.' },
]

export const SUPPORT_KIND_LABEL: Record<SupportKind, string> = Object.fromEntries(
  SUPPORT_KINDS.map((k) => [k.value, k.label]),
) as Record<SupportKind, string>

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em análise',
  resolved: 'Resolvido',
}

function loadMock(): SupportTicket[] {
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Contexto técnico coletado sozinho. É exatamente o que o advogado não sabe
 * informar e o que resolve metade dos bugs — e pedir isso num formulário faria
 * o chamado nunca ser aberto.
 */
function contexto() {
  return {
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  }
}

export async function openTicket(input: {
  kind: SupportKind
  subject: string
  message: string
}): Promise<SupportTicket> {
  if (USE_REAL_API) {
    const res = await fetch(`${API_BASE}/api/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ ...input, ...contexto() }),
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => '')
      throw new Error(msg || 'Não foi possível enviar. Tente de novo em instantes.')
    }
    return res.json()
  }

  // Mock: o chamado fica no navegador. Serve para o fluxo ser testável sem
  // backend; nenhum admin vai vê-lo, e o histórico deixa isso claro na UI.
  await new Promise((r) => setTimeout(r, 260))
  const ticket: SupportTicket = {
    id: `tk-${Date.now()}`,
    kind: input.kind,
    subject: input.subject.trim(),
    message: input.message.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(MOCK_KEY, JSON.stringify([ticket, ...loadMock()].slice(0, 50)))
  return ticket
}

export async function myTickets(): Promise<SupportTicket[]> {
  if (USE_REAL_API) {
    try {
      const res = await fetch(`${API_BASE}/api/support/mine`, { headers: { ...authHeader() } })
      return res.ok ? res.json() : []
    } catch {
      return []
    }
  }
  await new Promise((r) => setTimeout(r, 120))
  return loadMock()
}
