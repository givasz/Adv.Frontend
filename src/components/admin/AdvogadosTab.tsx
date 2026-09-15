// Busca de advogados — a ferramenta de consulta.
//
// Procura por nome, OAB, cidade ou endereço, inclusive perfis não publicados.
// A linha abre a mesma ficha de moderação da fila de denúncias: quem chega aqui
// por uma denúncia por fora (e-mail, WhatsApp) decide no mesmo lugar.

import { useEffect, useState } from 'react'
import { searchProfiles, type AdminProfile } from '@/lib/adminApi'
import { cnaSearchUrl } from '@/components/ui/CnaLink'
import { ExternalLinkIcon, SearchIcon } from '@/components/ui/icons'
import {
  Aviso,
  Cartao,
  Carregando,
  Chip,
  LinhaClicavel,
  LinkExterno,
  Tabela,
  Td,
  Th,
  TituloDaPagina,
  Vazio,
  useTelaLarga,
} from './pecas'
import { Rodape } from './Paginacao'
import FichaDoPerfil from './FichaDoPerfil'
import { usePaginado } from './usePaginado'
import { useContadores } from './contadores'
import { SECOES } from './Console'
import { FragmentoDeLinha, STATUS_META } from './DenunciasTab'

const PLANO_NOME: Record<AdminProfile['plan'], string> = { free: 'Free', pro: 'Pro', premium: 'Max' }

export default function AdvogadosTab({
  podeDecidir,
  podeSancionar,
}: {
  podeDecidir: boolean
  podeSancionar: boolean
}) {
  const [q, setQ] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [tick, setTick] = useState(0) // bump para re-buscar após moderar
  const { atualizar } = useContadores()
  const larga = useTelaLarga()
  const secao = SECOES.find((s) => s.id === 'advogados')!

  // A busca devolvia 50 e calava sobre o resto: quem procurasse um nome comum
  // via meia lista sem nada dizendo que havia mais.
  const lista = usePaginado<AdminProfile>((offset) => searchProfiles(q.trim(), offset), 'Falha na busca.')
  const { itens: resultados, carregando, erro } = lista

  useEffect(() => {
    const termo = q.trim()
    if (termo.length < 2) {
      lista.esvaziar()
      return
    }
    // O atraso é o que impede uma consulta por tecla digitada. A troca de termo
    // no meio do caminho já é tratada pelo hook: só a resposta do pedido atual
    // chega à tela.
    const t = setTimeout(() => void lista.recomecar(), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tick])

  return (
    <div>
      <TituloDaPagina titulo={secao.label} descricao={secao.descricao} />

      <Cartao semPreenchimento>
        <div className="flex items-center gap-2 border-b border-adm-line px-4 py-3">
          <SearchIcon width={16} height={16} className="shrink-0 text-adm-faint" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, número da OAB, cidade ou endereço…"
            aria-label="Buscar advogados"
            autoFocus
            spellCheck={false}
            className="w-full bg-transparent py-1 text-[14px] text-adm-ink placeholder:text-adm-faint focus:outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="shrink-0 text-[12px] font-medium text-adm-muted hover:text-adm-ink"
            >
              Limpar
            </button>
          )}
        </div>

        {erro && (
          <div className="px-4 pt-4">
            <Aviso>{erro}</Aviso>
          </div>
        )}

        {q.trim().length < 2 ? (
          <div className="p-4">
            <Vazio>Digite ao menos 2 caracteres para buscar.</Vazio>
          </div>
        ) : carregando && !resultados ? (
          <div className="px-4">
            <Carregando texto="Buscando…" />
          </div>
        ) : resultados && resultados.length === 0 ? (
          <div className="p-4">
            <Vazio>Nenhum advogado encontrado para “{q.trim()}”.</Vazio>
          </div>
        ) : (
          <Tabela minima="md:min-w-[760px]">
            <thead>
              <tr>
                <Th>Advogado</Th>
                <Th largura="9rem" oculta>
                  Cidade
                </Th>
                <Th largura="5rem" oculta>
                  Plano
                </Th>
                <Th largura="9rem">Situação</Th>
                <Th largura="14rem" className="text-right" oculta>
                  Abrir
                </Th>
              </tr>
            </thead>
            <tbody>
              {(resultados ?? []).map((p) => {
                const meta = STATUS_META[p.moderationStatus]
                const estaAberto = aberto === p.id
                return (
                  <FragmentoDeLinha key={p.id}>
                    <LinhaClicavel aberta={estaAberto} onClick={() => setAberto(estaAberto ? null : p.id)}>
                      <Td>
                        <span className="block truncate font-medium text-adm-ink">{p.name}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-adm-muted">
                          advoc.me/{p.slug} · {p.oabNumber}
                        </span>
                      </Td>
                      <Td className="text-adm-soft" oculta>
                        {p.city ? `${p.city}/${p.state}` : <span className="text-adm-faint">—</span>}
                      </Td>
                      <Td oculta>
                        <Chip tom={p.plan === 'premium' ? 'acento' : p.plan === 'pro' ? 'info' : 'neutro'}>
                          {PLANO_NOME[p.plan]}
                        </Chip>
                      </Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          <Chip tom={meta.tom}>{meta.label}</Chip>
                          {!p.published && <Chip title="O perfil não está publicado">rascunho</Chip>}
                        </span>
                      </Td>
                      <Td className="text-right" oculta>
                        <span className="inline-flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <LinkExterno href={`/${p.slug}`}>
                            Perfil <ExternalLinkIcon width={11} height={11} strokeWidth={1.8} />
                          </LinkExterno>
                          {/* Ferramenta de MODERAÇÃO, não de selo: é como se julga
                              uma denúncia de registro falso (motivo `oab_invalid`). */}
                          <LinkExterno href={cnaSearchUrl(p.name)}>
                            CNA <ExternalLinkIcon width={11} height={11} strokeWidth={1.8} />
                          </LinkExterno>
                        </span>
                      </Td>
                    </LinhaClicavel>
                    {estaAberto && (
                      <tr>
                        <Td colSpan={larga ? 5 : 2} className="bg-adm-bg/60 p-0">
                          <FichaDoPerfil
                            profileId={p.id}
                            podeDecidir={podeDecidir}
                            podeSancionar={podeSancionar}
                            onChanged={() => {
                              setTick((n) => n + 1)
                              atualizar()
                            }}
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
          mostrando={resultados?.length ?? 0}
          total={lista.total}
          temMais={lista.temMais}
          carregando={lista.carregando}
          onMais={() => void lista.mais()}
          nome="advogados"
        />
      </Cartao>
    </div>
  )
}
