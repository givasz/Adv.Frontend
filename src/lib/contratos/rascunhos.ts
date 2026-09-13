// Os rascunhos de documento — guardados SÓ neste aparelho.
//
// Um contrato tem CPF, endereço, valores e o assunto do caso de alguém que nunca
// teve conta aqui. Nada disso vai para o servidor (ver RegistroDocumento no
// backend). A consequência, dita na tela e não escondida: o rascunho mora no
// navegador em que foi feito. Outro aparelho vê o REGISTRO (código, data,
// impressão digital), nunca o texto.
//
// Não é "salvar no localStorage às escondidas" (ver lib/auth.ts): a página diz
// onde está, oferece apagar, e a chave é por conta — outra pessoa que entre no
// mesmo navegador com outra conta não vê os rascunhos desta.

import { useCallback, useEffect, useState } from 'react'
import type { Dados, DocumentoMontado, ModeloId } from './modelos'
import type { CopiaDeModeloProprio } from './proprio'

export type EtapaDoRascunho = 'dados' | 'revisao' | 'registro' | 'assinatura'

export interface RegistroLocal {
  id?: string
  codigo: string
  hash: string
  tamanho: number
  /** data impressa nos metadados do PDF — fixa, para refazer o arquivo idêntico */
  emitidoEm: string
  registradoEm: string
  autor: string
  enderecoDeConferencia: string
}

export interface AssinadaLocal {
  hash: string
  tamanho: number
  registradoEm: string
  nomeDoArquivo: string
}

export interface Rascunho {
  id: string
  modelo: ModeloId | 'proprio'
  modeloVersao: string
  /**
   * Com modelo 'proprio': uma CÓPIA do modelo, tirada ao começar. Editar ou
   * excluir o modelo depois não muda — nem quebra — documento já começado.
   */
  proprio?: CopiaDeModeloProprio
  dados: Dados
  /** existe a partir da revisão; é o texto que o advogado edita */
  documento: DocumentoMontado | null
  etapa: EtapaDoRascunho
  criadoEm: string
  atualizadoEm: string
  registro?: RegistroLocal
  assinadas?: AssinadaLocal[]
}

interface Cofre {
  versao: 1
  rascunhos: Rascunho[]
}

const PREFIXO = 'advocme:contratos:'
const EVENTO = 'advocme:contratos-mudou'
const LIMITE = 200

const chave = (userId: string) => `${PREFIXO}${userId || 'local'}`

function ler(userId: string): Cofre {
  try {
    const bruto = localStorage.getItem(chave(userId))
    const c = bruto ? (JSON.parse(bruto) as Cofre) : null
    if (c && c.versao === 1 && Array.isArray(c.rascunhos)) return c
  } catch {
    /* armazenamento indisponível ou corrompido — começa vazio */
  }
  return { versao: 1, rascunhos: [] }
}

function gravar(userId: string, cofre: Cofre): boolean {
  try {
    localStorage.setItem(chave(userId), JSON.stringify(cofre))
    window.dispatchEvent(new CustomEvent(EVENTO))
    return true
  } catch {
    return false
  }
}

export function listarRascunhos(userId: string): Rascunho[] {
  return [...ler(userId).rascunhos].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
}

export function obterRascunho(userId: string, id: string): Rascunho | null {
  return ler(userId).rascunhos.find((r) => r.id === id) ?? null
}

/** Grava (cria ou substitui). Devolve false quando o navegador recusou guardar. */
export function salvarRascunho(userId: string, r: Rascunho): boolean {
  const cofre = ler(userId)
  const atualizado = { ...r, atualizadoEm: new Date().toISOString() }
  const resto = cofre.rascunhos.filter((x) => x.id !== r.id)
  return gravar(userId, { versao: 1, rascunhos: [atualizado, ...resto].slice(0, LIMITE) })
}

export function apagarRascunho(userId: string, id: string): void {
  const cofre = ler(userId)
  gravar(userId, { versao: 1, rascunhos: cofre.rascunhos.filter((r) => r.id !== id) })
}

export function apagarTodosOsRascunhos(userId: string): void {
  try {
    localStorage.removeItem(chave(userId))
    window.dispatchEvent(new CustomEvent(EVENTO))
  } catch {
    /* nada a apagar */
  }
}

export function novoId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** A lista de rascunhos, sempre atual — inclusive entre abas. */
export function useRascunhos(userId: string): Rascunho[] {
  const [lista, setLista] = useState<Rascunho[]>(() => listarRascunhos(userId))
  const recarregar = useCallback(() => setLista(listarRascunhos(userId)), [userId])
  useEffect(() => {
    recarregar()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === chave(userId)) recarregar()
    }
    window.addEventListener(EVENTO, recarregar)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENTO, recarregar)
      window.removeEventListener('storage', onStorage)
    }
  }, [recarregar, userId])
  return lista
}
