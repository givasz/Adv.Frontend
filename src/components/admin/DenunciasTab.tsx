// A fila de denúncias.
//
// Paginada por PERFIL: um perfil com quarenta denúncias é uma linha, com o
// número de abertas em vermelho. Clicar na linha abre a ficha de moderação
// logo abaixo, na própria tabela — a lista continua visível enquanto se decide.

import { useEffect, useState } from 'react'
import { listReports, type ReportGroup } from '@/lib/adminApi'
import type { ModerationStatus } from '@/lib/types'
import {
  Aviso,
  Botao,
  Cartao,
  Carregando,
  Chip,
  LinhaClicavel,
  Segmentos,
  Tabela,
  Td,
  Th,
  TituloDaPagina,
  Vazio,
  useTelaLarga,
  type Tom,
} from './pecas'
import { Rodape } from './Paginacao'
import FichaDoPerfil from './FichaDoPerfil'
import { usePaginado } from './usePaginado'
import { useContadores } from './contadores'
import { SECOES } from './Console'

export const STATUS_META: Record<ModerationStatus, { label: string; tom: Tom }> = {
  active: { label: 'Ativo', tom: 'neutro' },
  warned: { label: 'Avisado', tom: 'aviso' },
  partial: { label: 'Seções ocultas', tom: 'aviso' },
  restricted: { label: 'Fora do ar', tom: 'perigo' },
}

const FILTROS = [
  { id: 'open', label: 'Abertas' },
  { id: 'all', label: 'Todas' },
] as const

export default function DenunciasTab({
  podeDecidir,
  podeSancionar,
}: {
  podeDecidir: boolean
  podeSancionar: boolean
}) {
  const [status, setStatus] = useState<'open' | 'all'>('open')
  const [aberto, setAberto] = useState<string | null>(null)
  const { atualizar } = useContadores()
  const larga = useTelaLarga()
  const secao = SECOES.find((s) => s.id === 'denuncias')!

  const lista = usePaginado<ReportGroup>((offset) => listReports(status, offset), 'Falha ao carregar denúncias.')
  const { itens: grupos, erro, recomecar } = lista

  useEffect(() => {
    void recomecar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  function mudou() {
    void recomecar()
    atualizar()
  }

  return (
    <div>
      <TituloDaPagina
        titulo={secao.label}
        descricao={secao.descricao}
        acoes={
          <Botao tamanho="sm" onClick={() => void recomecar()}>
            Atualizar
          </Botao>
        }
      />

      <Cartao
        semPreenchimento
        titulo="Fila"
        acoes={
          <Segmentos
            rotulo="Recorte das denúncias"
            opcoes={FILTROS.map((f) => (f.id === 'open' ? { ...f, contagem: lista.total || undefined } : f))}
            valor={status}
            onChange={setStatus}
          />
        }
      >
        {erro && (
          <div className="px-4 pt-4">
            <Aviso>{erro}</Aviso>
          </div>
        )}

        {!grupos ? (
          !erro && (
            <div className="px-4">
              <Carregando />
            </div>
          )
        ) : grupos.length === 0 ? (
          <div className="p-4">
            <Vazio>Nenhuma denúncia {status === 'open' ? 'aberta' : 'registrada'}. A fila está limpa.</Vazio>
          </div>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Perfil</Th>
                <Th largura="9rem" oculta>
                  Situação
                </Th>
                <Th largura="7rem" className="text-right">
                  Abertas
                </Th>
                <Th largura="6rem" className="text-right" oculta>
                  Total
                </Th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => {
                const meta = STATUS_META[g.profile.moderationStatus]
                const estaAberto = aberto === g.profile.id
                return (
                  <FragmentoDeLinha key={g.profile.id}>
                    <LinhaClicavel
                      aberta={estaAberto}
                      onClick={() => setAberto(estaAberto ? null : g.profile.id)}
                    >
                      <Td>
                        <span className="block truncate font-medium text-adm-ink">{g.profile.name}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-adm-muted">
                          advoc.me/{g.profile.slug} · {g.profile.oabNumber}
                          {g.profile.city ? ` · ${g.profile.city}/${g.profile.state}` : ''}
                        </span>
                      </Td>
                      <Td oculta>
                        <Chip tom={meta.tom}>{meta.label}</Chip>
                        {!g.profile.published && (
                          <Chip className="ml-1" title="O perfil não está publicado">
                            rascunho
                          </Chip>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {g.openCount > 0 ? (
                          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded bg-adm-danger px-1.5 text-[12px] font-bold text-white">
                            {g.openCount}
                          </span>
                        ) : (
                          <span className="text-adm-faint">0</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums text-adm-soft" oculta>
                        {g.total}
                      </Td>
                    </LinhaClicavel>
                    {estaAberto && (
                      <tr>
                        <Td colSpan={larga ? 4 : 2} className="bg-adm-bg/60 p-0">
                          <FichaDoPerfil
                            profileId={g.profile.id}
                            podeDecidir={podeDecidir}
                            podeSancionar={podeSancionar}
                            onChanged={mudou}
                          />
                        </Td>
                      </tr>
                    )}
                  </FragmentoDeLinha>
                )
              })}
            </tbody>
          </Tabela>
        )}

        <Rodape
          mostrando={grupos?.length ?? 0}
          total={lista.total}
          temMais={lista.temMais}
          carregando={lista.carregando}
          onMais={() => void lista.mais()}
          nome="perfis na fila"
        />
      </Cartao>
    </div>
  )
}

/** Duas linhas (a da lista e a da ficha) sob a mesma chave. */
export function FragmentoDeLinha({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
