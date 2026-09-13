// Conversa com o servidor sobre documentos: registrar, listar e conferir.
//
// O que viaja é só impressão digital, código e declaração. Mesmo desenho de
// lib/support.ts: modo real pelo `apiFetch` (cookie + CSRF), e um modo local
// para o app rodar sem backend — lá o registro fica no navegador, e é o que o
// smoke percorre.

import { apiFetch, TEM_BACKEND } from '../http'
import { DECLARACAO_DE_REVISAO_VERSAO } from './versoes'
import type { ModeloId } from './modelos'

export type EtapaDeRegistro = 'revisado' | 'assinado'

export interface RegistroDoServidor {
  id?: string
  codigo: string
  hash: string
  tamanho: number
  etapa: EtapaDeRegistro
  modelo: string
  modeloVersao?: string
  origemId?: string | null
  advogado: { nome: string; oab: string }
  registradoEm: string
}

/** O servidor recusou o código porque ele já existe — sorteie outro. */
export class CodigoEmUso extends Error {}

const MOCK = 'advocme:contratos:registros-mock'

function lerMock(): RegistroDoServidor[] {
  try {
    const l = JSON.parse(localStorage.getItem(MOCK) ?? '[]')
    return Array.isArray(l) ? l : []
  } catch {
    return []
  }
}

export async function mensagemDeErro(res: Response, padrao: string): Promise<string> {
  try {
    const corpo = await res.json()
    const m = Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message
    return typeof m === 'string' && m ? m : padrao
  } catch {
    return padrao
  }
}

export async function listarRegistros(): Promise<RegistroDoServidor[]> {
  if (TEM_BACKEND) {
    const res = await apiFetch('/api/contratos/registros')
    if (!res.ok) throw new Error(await mensagemDeErro(res, 'Não foi possível carregar os registros.'))
    const corpo = await res.json()
    return Array.isArray(corpo?.registros) ? corpo.registros : []
  }
  return lerMock().slice().reverse()
}

interface NovoRevisado {
  modelo: ModeloId | 'proprio'
  modeloVersao: string
  codigo: string
  hash: string
  tamanho: number
}

export async function registrarRevisado(r: NovoRevisado): Promise<RegistroDoServidor> {
  const corpo = {
    etapa: 'revisado',
    ...r,
    declaracaoVersao: DECLARACAO_DE_REVISAO_VERSAO,
    // Só `true` de verdade vale no servidor; quem chega aqui já marcou as duas.
    declaracoes: { revisei: true, responsabilidade: true },
  }
  if (TEM_BACKEND) {
    const res = await apiFetch('/api/contratos/registros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    if (res.status === 409) throw new CodigoEmUso()
    if (!res.ok) throw new Error(await mensagemDeErro(res, 'Não foi possível registrar. Tente de novo.'))
    return res.json()
  }
  await new Promise((ok) => setTimeout(ok, 300))
  const lista = lerMock()
  const existente = lista.find((x) => x.hash === r.hash && x.etapa === 'revisado')
  if (existente) return existente
  if (lista.some((x) => x.codigo === r.codigo && x.etapa === 'revisado')) throw new CodigoEmUso()
  const novo: RegistroDoServidor = {
    id: `mock-${Date.now()}`,
    codigo: r.codigo,
    hash: r.hash,
    tamanho: r.tamanho,
    etapa: 'revisado',
    modelo: r.modelo,
    modeloVersao: r.modeloVersao,
    advogado: { nome: 'Advogada de exemplo', oab: 'OAB/MG 000.000' },
    registradoEm: new Date().toISOString(),
  }
  localStorage.setItem(MOCK, JSON.stringify([...lista, novo]))
  return novo
}

export async function registrarAssinado(r: {
  origemCodigo: string
  hash: string
  tamanho: number
}): Promise<RegistroDoServidor> {
  if (TEM_BACKEND) {
    const res = await apiFetch('/api/contratos/registros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa: 'assinado', ...r }),
    })
    if (!res.ok) throw new Error(await mensagemDeErro(res, 'Não foi possível registrar. Tente de novo.'))
    return res.json()
  }
  await new Promise((ok) => setTimeout(ok, 300))
  const lista = lerMock()
  const origem = lista.find((x) => x.codigo === r.origemCodigo && x.etapa === 'revisado')
  if (!origem) throw new Error('Não encontramos esse documento entre os registros da sua conta.')
  if (origem.hash === r.hash) {
    throw new Error('Este é o mesmo arquivo registrado na revisão — nenhuma assinatura foi acrescentada a ele.')
  }
  const existente = lista.find((x) => x.hash === r.hash && x.etapa === 'assinado')
  if (existente) return existente
  const novo: RegistroDoServidor = {
    ...origem,
    id: `mock-${Date.now()}`,
    hash: r.hash,
    tamanho: r.tamanho,
    etapa: 'assinado',
    origemId: origem.id,
    registradoEm: new Date().toISOString(),
  }
  localStorage.setItem(MOCK, JSON.stringify([...lista, novo]))
  return novo
}

/** Conferência pública: devolve os registros que batem com alguma das impressões. */
export async function conferirImpressoes(hashes: string[]): Promise<RegistroDoServidor[]> {
  if (TEM_BACKEND) {
    const res = await apiFetch(`/api/contratos/conferir?h=${hashes.map(encodeURIComponent).join(',')}`)
    if (!res.ok) throw new Error(await mensagemDeErro(res, 'Não foi possível conferir agora. Tente de novo.'))
    const corpo = await res.json()
    return Array.isArray(corpo?.registros) ? corpo.registros : []
  }
  await new Promise((ok) => setTimeout(ok, 250))
  return lerMock().filter((x) => hashes.includes(x.hash))
}
