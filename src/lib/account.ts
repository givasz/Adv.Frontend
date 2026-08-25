// Os dados da conta, do ponto de vista de quem é dono deles: ver, levar embora e
// apagar. O servidor é quem cumpre (backend/src/account); aqui é a ponte.
//
// Sem backend (modo mock), o que existe é o rascunho no próprio navegador — então
// exportar é montar o pacote a partir do localStorage e excluir é limpar a chave.
// Dizer "não dá" no mock seria mentir sobre um direito que, ali, é ainda mais
// simples de cumprir.

import { esquecerSessaoLocal, getSession } from './auth'
import { apiFetch } from './http'

import { TEM_BACKEND as useReal } from './http'

const STORAGE_KEY = 'advocme:profile:draft'
const ACCOUNTS_KEY = 'advocme:accounts'
const FIRM_KEY = 'advocme:firm:draft'
// Retrato de quem está logado (nome, e-mail, plano) — nunca credencial. A chave
// mudou de `advocme:session` para cá quando a sessão virou cookie HttpOnly.
const USER_KEY = 'advocme:user'

/** Pacote com tudo o que a plataforma guarda sobre a conta. */
export async function exportarDados(): Promise<unknown> {
  if (useReal && getSession()) {
    const res = await apiFetch('/api/account/data')
    if (!res.ok) throw new Error('Não foi possível reunir seus dados agora.')
    return res.json()
  }
  // Modo local: o que existe é o que está neste navegador.
  const ler = (k: string) => {
    try {
      const raw = localStorage.getItem(k)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  return {
    geradoEm: new Date().toISOString(),
    sobre: 'Seus dados neste navegador (o perfil ainda não foi enviado a uma conta).',
    perfil: ler(STORAGE_KEY),
    escritorio: ler(FIRM_KEY),
    conta: ler(USER_KEY),
  }
}

/**
 * Entrega o arquivo ao navegador. Objeto → Blob → link temporário: é o caminho
 * que não depende de o servidor montar um anexo, e o nome do arquivo já sai com
 * a data para quem baixar mais de uma vez.
 */
export function baixarComoArquivo(dados: unknown, nome = 'meus-dados-advocme') {
  const hoje = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(dados, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}-${hoje}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Sem revogar, o blob fica na memória da aba até ela ser fechada.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Exclui a conta e tudo que depende dela. A senha vai junto porque é
 * irreversível: uma sessão esquecida num computador emprestado não pode bastar.
 */
export async function excluirConta(senha: string): Promise<void> {
  if (useReal && getSession()) {
    const res = await apiFetch('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: senha }),
    })
    if (!res.ok) {
      const texto = await res.text().catch(() => '')
      let msg = 'Não foi possível excluir a conta.'
      try {
        const j = JSON.parse(texto) as { message?: string }
        if (j.message) msg = j.message
      } catch {
        /* resposta sem JSON — fica a mensagem padrão */
      }
      throw new Error(msg)
    }
  }
  // Local: apaga o rascunho e as contas do modo mock.
  for (const k of [STORAGE_KEY, FIRM_KEY, ACCOUNTS_KEY]) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* armazenamento indisponível */
    }
  }
  // E esquece quem estava logado. Pelo store, não pela chave: é ele que faz a
  // interface parar de mostrar uma pessoa que não existe mais.
  esquecerSessaoLocal()
}
