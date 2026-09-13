// Conversa com o servidor sobre os modelos próprios: listar, criar, editar, excluir.
//
// Mesmo desenho de registros.ts: modo real pelo `apiFetch` (cookie + CSRF) e um
// modo local para o app rodar sem backend — lá o modelo fica no navegador,
// passando pelas MESMAS travas (problemasDoModelo), e é o que o smoke percorre.

import { apiFetch, TEM_BACKEND } from '../http'
import { MODELOS_PROPRIOS_LIMITE } from '../plans'
import { mensagemDeErro } from './registros'
import {
  problemasDoModelo,
  type ConteudoDoModeloProprio,
  type ModeloProprioSalvo,
} from './proprio'

const MOCK = 'advocme:contratos:modelos-mock'

function lerMock(): ModeloProprioSalvo[] {
  try {
    const l = JSON.parse(localStorage.getItem(MOCK) ?? '[]')
    return Array.isArray(l) ? l : []
  } catch {
    return []
  }
}

const gravarMock = (l: ModeloProprioSalvo[]) => localStorage.setItem(MOCK, JSON.stringify(l))

function limpo(c: ConteudoDoModeloProprio): ConteudoDoModeloProprio {
  return {
    nome: c.nome.trim(),
    quemAssina: c.quemAssina,
    titulo: c.titulo.trim(),
    clausulas: c.clausulas
      .map((x) => ({ titulo: x.titulo.trim(), texto: x.texto.trim() }))
      .filter((x) => x.titulo || x.texto),
  }
}

export async function listarModelosProprios(): Promise<{ modelos: ModeloProprioSalvo[]; limite: number }> {
  if (TEM_BACKEND) {
    const res = await apiFetch('/api/contratos/modelos')
    if (!res.ok) throw new Error(await mensagemDeErro(res, 'Não foi possível carregar seus modelos.'))
    const corpo = await res.json()
    return {
      modelos: Array.isArray(corpo?.modelos) ? corpo.modelos : [],
      limite: typeof corpo?.limite === 'number' ? corpo.limite : MODELOS_PROPRIOS_LIMITE,
    }
  }
  return { modelos: lerMock(), limite: MODELOS_PROPRIOS_LIMITE }
}

async function enviar(caminho: string, metodo: 'POST' | 'PUT', c: ConteudoDoModeloProprio) {
  const res = await apiFetch(caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(limpo(c)),
  })
  if (!res.ok) throw new Error(await mensagemDeErro(res, 'Não foi possível salvar o modelo. Tente de novo.'))
  return (await res.json()) as ModeloProprioSalvo
}

function recusarNoMock(c: ConteudoDoModeloProprio) {
  const [primeiro] = problemasDoModelo(c)
  if (primeiro) throw new Error(primeiro.mensagem)
}

export async function criarModeloProprio(c: ConteudoDoModeloProprio): Promise<ModeloProprioSalvo> {
  if (TEM_BACKEND) return enviar('/api/contratos/modelos', 'POST', c)
  await new Promise((ok) => setTimeout(ok, 250))
  recusarNoMock(c)
  const lista = lerMock()
  if (lista.length >= MODELOS_PROPRIOS_LIMITE) {
    throw new Error(`Você já tem ${MODELOS_PROPRIOS_LIMITE} modelos. Exclua um para criar outro.`)
  }
  const agora = new Date().toISOString()
  const novo: ModeloProprioSalvo = { ...limpo(c), id: `mp-${Date.now()}`, revisao: 1, criadoEm: agora, atualizadoEm: agora }
  gravarMock([...lista, novo])
  return novo
}

export async function atualizarModeloProprio(id: string, c: ConteudoDoModeloProprio): Promise<ModeloProprioSalvo> {
  if (TEM_BACKEND) return enviar(`/api/contratos/modelos/${encodeURIComponent(id)}`, 'PUT', c)
  await new Promise((ok) => setTimeout(ok, 250))
  recusarNoMock(c)
  const lista = lerMock()
  const atual = lista.find((m) => m.id === id)
  if (!atual) throw new Error('Modelo não encontrado.')
  const salvo = { ...atual, ...limpo(c), revisao: atual.revisao + 1, atualizadoEm: new Date().toISOString() }
  gravarMock(lista.map((m) => (m.id === id ? salvo : m)))
  return salvo
}

export async function excluirModeloProprio(id: string): Promise<void> {
  if (TEM_BACKEND) {
    const res = await apiFetch(`/api/contratos/modelos/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await mensagemDeErro(res, 'Não foi possível excluir o modelo. Tente de novo.'))
    return
  }
  gravarMock(lerMock().filter((m) => m.id !== id))
}
