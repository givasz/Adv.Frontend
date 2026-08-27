// Contestação de uma medida de moderação.
//
// Duas portas, e a diferença entre elas é o problema que a página resolve: a
// sanção mais grave tira o canal de recorrer dela. Conta suspensa não loga, e
// sem logar não há como escrever — então `contestarSemSessao` confere e-mail e
// senha e **não abre sessão**. A pessoa é ouvida sem ganhar acesso a nada.
//
// Ver docs/politica-de-sancoes.md § 5 e backend/src/moderation/appeals.service.ts.

import { apiFetch, csrfToken, CSRF_HEADER, TEM_BACKEND } from './http'

export interface Contestacao {
  id: string
  alvo: 'profile' | 'account'
  medida: string
  texto: string
  respondeAte: string
  status: 'open' | 'accepted' | 'rejected' | 'expired'
  resposta: string
  decidedAt: string | null
  createdAt: string
}

export interface MinhasContestacoes {
  podeContestar: boolean
  medida: string | null
  alvo: 'profile' | 'account' | null
  respostaEmDias: number
  contestacoes: Contestacao[]
}

async function ler<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const bruto = await res.text().catch(() => '')
    // A mensagem do servidor é a que explica o "não" — "você já tem uma
    // contestação em aberto", "o prazo já passou". Trocá-la por um código faria
    // a tela mentir sobre o que aconteceu.
    try {
      const corpo = JSON.parse(bruto) as { message?: string | string[] }
      const m = corpo?.message
      throw new Error((Array.isArray(m) ? m.join(' ') : m) || `Erro ${res.status}`)
    } catch (e) {
      if (e instanceof Error && e.message && !e.message.startsWith('Unexpected')) throw e
      throw new Error(bruto || `Erro ${res.status}`)
    }
  }
  return res.json() as Promise<T>
}

/** Espelho vazio para o ambiente de desenvolvimento sem backend: a tela
 *  desenha, e nada é inventado sobre o estado de moderação de ninguém. */
const NADA: MinhasContestacoes = {
  podeContestar: false,
  medida: null,
  alvo: null,
  respostaEmDias: 10,
  contestacoes: [],
}

export async function minhasContestacoes(): Promise<MinhasContestacoes> {
  if (!TEM_BACKEND) return NADA
  return ler(await apiFetch('/api/appeals/mine'))
}

export async function abrirContestacao(texto: string): Promise<{ respondeAte: string }> {
  return ler(
    await apiFetch('/api/appeals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    }),
  )
}

/**
 * Para quem a sanção impediu de entrar.
 *
 * Não passa pelo `apiFetch` de escrita autenticada: não há sessão, e portanto
 * não há token anti-CSRF de sessão para enviar. O que protege esta porta é o
 * teto de tentativas do servidor e o fato de ela não devolver acesso nenhum.
 */
export async function contestarSemSessao(
  email: string,
  senha: string,
  texto: string,
): Promise<{ respondeAte: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = csrfToken()
  if (t) headers[CSRF_HEADER] = t
  return ler(
    await apiFetch('/api/appeals/contestar', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, senha, texto }),
    }),
  )
}
