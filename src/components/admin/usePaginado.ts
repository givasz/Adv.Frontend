// O estado de uma lista paginada do painel.
//
// Existe porque as três listas contadas (denúncias, advogados, chamados) fazem a
// mesma coisa e erravam do mesmo jeito: **nenhuma delas guardava qual pedido
// estava no ar**. Trocar de filtro enquanto uma busca voltava deixava a resposta
// velha vencer, e a tela mostrava o resultado do filtro anterior sem nada
// indicando o engano. Aqui isso é uma linha — um contador de geração — e ela
// vale para as três de uma vez.

import { useCallback, useRef, useState } from 'react'
import type { Pagina } from '@/lib/adminApi'

export interface ListaPaginada<T> {
  /** `null` = ainda não buscou (ou o filtro foi limpo). */
  itens: T[] | null
  total: number
  temMais: boolean
  carregando: boolean
  erro: string | null
  setErro: (m: string | null) => void
  /** Busca do zero. Descarta qualquer resposta anterior que ainda esteja no ar. */
  recomecar: () => Promise<void>
  /** Acrescenta a próxima fatia ao que já está na tela. */
  mais: () => Promise<void>
  /** Esvazia sem buscar (termo curto demais, por exemplo). */
  esvaziar: () => void
}

export function usePaginado<T>(
  carregar: (offset: number) => Promise<Pagina<T>>,
  aoFalhar = 'Falha ao carregar a lista.',
): ListaPaginada<T> {
  // A função muda de identidade a cada render (fecha sobre o filtro atual).
  // Guardá-la numa ref deixa `recomecar`/`mais` estáveis sem congelar o filtro.
  const fn = useRef(carregar)
  fn.current = carregar

  const [itens, setItens] = useState<T[] | null>(null)
  const [total, setTotal] = useState(0)
  const [temMais, setTemMais] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Quantos itens já estão na tela — é o deslocamento da próxima fatia. Numa ref
  // porque `mais` precisa do valor no momento do clique, não no do render.
  const quantos = useRef(0)
  // Qual pedido é o válido. Só a resposta da geração atual pode escrever na tela.
  const geracao = useRef(0)

  const recomecar = useCallback(async () => {
    const minha = ++geracao.current
    setItens(null)
    setTotal(0)
    setTemMais(false)
    setErro(null)
    setCarregando(true)
    quantos.current = 0
    try {
      const r = await fn.current(0)
      if (minha !== geracao.current) return // chegou tarde: outro filtro assumiu
      quantos.current = r.itens.length
      setItens(r.itens)
      setTotal(r.total)
      setTemMais(r.temMais)
    } catch (e) {
      if (minha === geracao.current) setErro(e instanceof Error ? e.message : aoFalhar)
    } finally {
      if (minha === geracao.current) setCarregando(false)
    }
  }, [aoFalhar])

  const mais = useCallback(async () => {
    const minha = geracao.current
    setCarregando(true)
    try {
      const r = await fn.current(quantos.current)
      if (minha !== geracao.current) return
      quantos.current += r.itens.length
      setItens((atual) => [...(atual ?? []), ...r.itens])
      setTotal(r.total)
      setTemMais(r.temMais)
    } catch (e) {
      if (minha === geracao.current) setErro(e instanceof Error ? e.message : aoFalhar)
    } finally {
      if (minha === geracao.current) setCarregando(false)
    }
  }, [aoFalhar])

  const esvaziar = useCallback(() => {
    geracao.current++ // invalida o que estiver voltando
    quantos.current = 0
    setItens(null)
    setTotal(0)
    setTemMais(false)
    setErro(null)
    setCarregando(false)
  }, [])

  return { itens, total, temMais, carregando, erro, setErro, recomecar, mais, esvaziar }
}
