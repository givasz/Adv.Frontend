// O rodapé de uma lista paginada do console.
//
// Uma peça só, e não três variações, porque a informação é sempre a mesma e é
// ela que o painel devia ter desde o começo: **quantos você está vendo, de
// quantos existem**. As listas cortavam em silêncio — 50 advogados, 200
// chamados —, e uma lista truncada sem aviso lê-se como "é só isso que existe".

import type { ReactNode } from 'react'
import { Botao } from './pecas'

/** Rodapé de lista contada (busca, denúncias, chamados). */
export function Rodape({
  mostrando,
  total,
  temMais,
  carregando,
  onMais,
  nome,
}: {
  mostrando: number
  total: number
  temMais: boolean
  carregando?: boolean
  onMais: () => void
  /** Como se chama o que está na lista, no plural. Ex.: "advogados". */
  nome: string
}) {
  if (!total) return null
  return (
    <Barra>
      <span className="tabular-nums">
        Mostrando <strong className="font-semibold text-adm-ink">{mostrando}</strong> de{' '}
        <strong className="font-semibold text-adm-ink">{total}</strong> {nome}
      </span>
      {temMais && (
        <Botao tamanho="sm" onClick={onMais} disabled={carregando}>
          {carregando ? 'Carregando…' : 'Carregar mais'}
        </Botao>
      )}
    </Barra>
  )
}

/**
 * Rodapé da trilha, que não tem total.
 *
 * O histórico é paginado por cursor e de propósito não conta: `COUNT(*)` numa
 * tabela que só cresce é caro para uma informação que ninguém lê. Então aqui se
 * diz quantos estão na tela, e só.
 */
export function RodapeTrilha({
  mostrando,
  temMais,
  carregando,
  onMais,
}: {
  mostrando: number
  temMais: boolean
  carregando?: boolean
  onMais: () => void
}) {
  if (!mostrando) return null
  return (
    <Barra>
      <span className="tabular-nums">
        {mostrando} {mostrando === 1 ? 'registro' : 'registros'}
        {temMais ? '' : ' · início da trilha'}
      </span>
      {temMais && (
        <Botao tamanho="sm" onClick={onMais} disabled={carregando}>
          {carregando ? 'Carregando…' : 'Carregar mais'}
        </Botao>
      )}
    </Barra>
  )
}

function Barra({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-line bg-adm-raised px-4 py-2.5 text-[12.5px] text-adm-muted">
      {children}
    </div>
  )
}
