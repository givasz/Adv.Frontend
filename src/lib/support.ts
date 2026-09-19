// Suporte ao cliente — canal exclusivo de quem tem conta.
//
// Diferente da denúncia (lib/reportReasons.ts), que é pública e trata do
// conteúdo de um terceiro: aqui é o próprio advogado falando com a plataforma
// sobre um problema dela. Por isso exige sessão — e por isso dá para responder.

import { useEffect, useState } from 'react'
import { API_BASE, apiFetch } from './http'

import { TEM_BACKEND as USE_REAL_API } from './http'

const MOCK_KEY = 'advocme:support:mock'

export type SupportKind = 'bug' | 'duvida' | 'conta' | 'sugestao' | 'outro'
export type SupportStatus = 'open' | 'in_progress' | 'resolved'

/** Imagem anexada. Os bytes nunca vêm na lista: saem por `anexoUrl`, uma de cada vez. */
export interface SupportAnexo {
  id: string
  contentType: string
  size: number
  /** Só no mock, que não tem servidor para servir a imagem. */
  dataUrl?: string
}

export interface SupportTicket {
  id: string
  kind: SupportKind
  subject: string
  message?: string
  status: SupportStatus
  adminNote?: string
  /** Quando a resposta foi escrita ou mudou pela última vez. */
  answeredAt?: string | null
  /** A resposta ainda não foi vista nesta conta. */
  novaResposta?: boolean
  anexos?: SupportAnexo[]
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

/** A mensagem que o Nest devolve vem embrulhada em JSON; o texto cru é o resto. */
function mensagemDe(bruto: string): string {
  try {
    const corpo = JSON.parse(bruto) as { message?: string | string[] }
    const m = corpo?.message
    return Array.isArray(m) ? m.join(' ') : (m ?? bruto)
  } catch {
    return bruto
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
  /** Data URIs já preparados por lib/anexoImagem.ts. */
  anexos?: string[]
}): Promise<SupportTicket> {
  if (USE_REAL_API) {
    const res = await apiFetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, ...contexto() }),
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => '')
      // 413 é o proxy recusando o tamanho antes de o servidor ler — a
      // mensagem dele é HTML, e ninguém entende "Request Entity Too Large".
      if (res.status === 413) throw new Error('As imagens ficaram grandes demais juntas. Tente enviar menos imagens.')
      throw new Error(mensagemDe(msg) || 'Não foi possível enviar. Tente de novo em instantes.')
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
    anexos: (input.anexos ?? []).map((dataUrl, i) => ({
      id: `an-${Date.now()}-${i}`,
      contentType: /^data:([^;]+);/.exec(dataUrl)?.[1] ?? 'image/jpeg',
      size: Math.round((dataUrl.length * 3) / 4),
      dataUrl,
    })),
    createdAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify([ticket, ...loadMock()].slice(0, 20)))
  } catch {
    // Cota do localStorage estourada pelas imagens: guarda o chamado sem elas.
    localStorage.setItem(MOCK_KEY, JSON.stringify([{ ...ticket, anexos: [] }, ...loadMock()].slice(0, 20)))
  }
  return ticket
}

export async function myTickets(): Promise<SupportTicket[]> {
  if (USE_REAL_API) {
    const res = await apiFetch('/api/support/mine')
    if (!res.ok) throw new Error('Não foi possível carregar seus chamados.')
    return res.json()
  }
  await new Promise((r) => setTimeout(r, 120))
  return loadMock()
}

/** Endereço de uma imagem anexada — rota autenticada, só o autor do chamado a abre. */
export function anexoUrl(ticketId: string, anexo: SupportAnexo): string {
  if (anexo.dataUrl) return anexo.dataUrl
  return `${API_BASE}/api/support/${encodeURIComponent(ticketId)}/anexos/${encodeURIComponent(anexo.id)}`
}

// ---- Respostas novas ----------------------------------------------------------
//
// O ponto no menu da conta e o aviso do painel pedem o mesmo número na mesma
// tela. Uma consulta só, guardada por um instante — e zerada quando a aba de
// respostas marca o que mostrou.

const GUARDA_MS = 30_000
let emCurso: Promise<number> | null = null
let guardado: { valor: number; em: number } | null = null
const ouvintes = new Set<(n: number) => void>()

function publicar(n: number) {
  guardado = { valor: n, em: Date.now() }
  for (const o of ouvintes) o(n)
}

/** Quantas respostas do suporte ainda não foram vistas. Falha vira zero: é aviso, não bloqueio. */
export function respostasNovas(): Promise<number> {
  if (!USE_REAL_API) return Promise.resolve(0)
  if (guardado && Date.now() - guardado.em < GUARDA_MS) return Promise.resolve(guardado.valor)
  emCurso ??= apiFetch('/api/support/mine/novas')
    .then(async (res) => (res.ok ? Number((await res.json())?.novas) || 0 : 0))
    .catch(() => 0)
    .then((n) => {
      publicar(n)
      return n
    })
    .finally(() => {
      emCurso = null
    })
  return emCurso
}

/** Avisa quem mostra o número quando ele muda (a aba marcou respostas como vistas). */
export function ouvirRespostasNovas(fn: (n: number) => void): () => void {
  ouvintes.add(fn)
  return () => {
    ouvintes.delete(fn)
  }
}

/** Marca como vistas as respostas que a tela mostrou. */
export async function marcarRespostasVistas(ids: string[]): Promise<void> {
  if (!USE_REAL_API || ids.length === 0) return
  try {
    const res = await apiFetch('/api/support/mine/vistas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) publicar(Math.max(0, (guardado?.valor ?? ids.length) - ids.length))
  } catch {
    /* fica como nova: aparece de novo na próxima visita, que é o erro certo */
  }
}

/**
 * O número de respostas novas, para quem mostra o aviso (menu da conta, painel).
 * `ativo` falso não consulta nada — o menu da home, sem item de suporte, não paga
 * uma chamada à API.
 */
export function useRespostasNovas(ativo = true): number {
  const [novas, setNovas] = useState(0)
  useEffect(() => {
    if (!ativo) return
    let vivo = true
    void respostasNovas().then((n) => {
      if (vivo) setNovas(n)
    })
    const parar = ouvirRespostasNovas((n) => {
      if (vivo) setNovas(n)
    })
    return () => {
      vivo = false
      parar()
    }
  }, [ativo])
  return novas
}
