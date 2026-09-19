// A fila de chamados abertos pelos advogados.
//
// Cada linha traz DE QUEM é (nome, e-mail, plano) e a situação; a ficha traz o
// contexto técnico que veio junto (página, navegador) — sem isso o admin lê
// "não funciona" e não tem como reproduzir nada.
//
// A resposta é obrigatória para mudar a situação: é o que o advogado lê em
// /suporte. Fechar um chamado sem uma linha é fechá-lo na cara de quem escreveu.
//
// Desde 16/09/2026 o chamado pode trazer até 3 imagens (miniaturas na ficha,
// abrem inteiras em outra aba) e a ficha diz se o advogado já leu a resposta.
// Texto novo na resposta manda um e-mail a ele; repetir a mesma nota ao mudar a
// situação, não.

import { useEffect, useState } from 'react'
import { anexoDoChamadoUrl, listTickets, setTicketStatus, type AdminTicket } from '@/lib/adminApi'
import { CheckIcon } from '@/components/ui/icons'
import {
  Aviso,
  Botao,
  Cartao,
  Carregando,
  Chip,
  LinhaClicavel,
  Rotulo,
  Segmentos,
  Tabela,
  Td,
  Th,
  TituloDaPagina,
  Vazio,
  entrada,
  fmtData,
  fmtRelativo,
  useTelaLarga,
  type Tom,
} from './pecas'
import { Rodape } from './Paginacao'
import { usePaginado } from './usePaginado'
import { useContadores } from './contadores'
import { SECOES } from './Console'
import { FragmentoDeLinha } from './DenunciasTab'

const TIPO: Record<string, { label: string; tom: Tom }> = {
  bug: { label: 'Algo quebrado', tom: 'perigo' },
  duvida: { label: 'Dúvida', tom: 'info' },
  conta: { label: 'Conta ou plano', tom: 'acento' },
  sugestao: { label: 'Sugestão', tom: 'ok' },
  outro: { label: 'Outro', tom: 'neutro' },
}
const SITUACAO: Record<string, { label: string; tom: Tom }> = {
  open: { label: 'Aberto', tom: 'aviso' },
  in_progress: { label: 'Em análise', tom: 'info' },
  resolved: { label: 'Resolvido', tom: 'ok' },
}
const PLANO: Record<string, string> = { free: 'Free', pro: 'Pro', premium: 'Max' }

const FILTROS = [
  { id: 'open', label: 'Abertos' },
  { id: 'in_progress', label: 'Em análise' },
  { id: 'resolved', label: 'Resolvidos' },
  { id: '', label: 'Todos' },
] as const

export default function SuporteTab({ podeResponder }: { podeResponder: boolean }) {
  const [filtro, setFiltro] = useState<string>('open')
  const [aberto, setAberto] = useState<string | null>(null)
  const { contadores, atualizar } = useContadores()
  const larga = useTelaLarga()
  const secao = SECOES.find((s) => s.id === 'suporte')!

  const lista = usePaginado<AdminTicket>(
    (offset) => listTickets(filtro || undefined, offset),
    'Falha ao carregar os chamados.',
  )
  const { itens, erro, setErro, recomecar } = lista

  useEffect(() => {
    void recomecar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  const opcoes = FILTROS.map((f) =>
    f.id === 'open'
      ? { ...f, contagem: contadores.chamados }
      : f.id === 'in_progress'
        ? { ...f, contagem: contadores.chamadosEmAnalise }
        : f,
  )

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
        titulo="Chamados"
        acoes={<Segmentos rotulo="Situação dos chamados" opcoes={opcoes} valor={filtro} onChange={setFiltro} />}
      >
        {erro && (
          <div className="px-4 pt-4">
            <Aviso>{erro}</Aviso>
          </div>
        )}
        {!itens && !erro && (
          <div className="px-4">
            <Carregando />
          </div>
        )}
        {itens?.length === 0 && (
          <div className="p-4">
            <Vazio>Nenhum chamado nesta situação.</Vazio>
          </div>
        )}

        {itens && itens.length > 0 && (
          <Tabela minima="md:min-w-[720px]">
            <thead>
              <tr>
                <Th>Assunto</Th>
                <Th largura="15rem" oculta>
                  De quem
                </Th>
                <Th largura="8rem" oculta>
                  Tipo
                </Th>
                <Th largura="7.5rem">Situação</Th>
                <Th largura="6.5rem" className="text-right">
                  Aberto
                </Th>
              </tr>
            </thead>
            <tbody>
              {itens.map((t) => {
                const estaAberto = aberto === t.id
                const tipo = TIPO[t.kind] ?? { label: t.kind, tom: 'neutro' as Tom }
                const sit = SITUACAO[t.status] ?? { label: t.status, tom: 'neutro' as Tom }
                return (
                  <FragmentoDeLinha key={t.id}>
                    <LinhaClicavel aberta={estaAberto} onClick={() => setAberto(estaAberto ? null : t.id)}>
                      <Td>
                        <span className="block truncate font-medium text-adm-ink">{t.subject}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-adm-muted">
                          {t.anexos?.length
                            ? `${t.anexos.length} ${t.anexos.length === 1 ? 'imagem' : 'imagens'} · `
                            : ''}
                          {t.message}
                        </span>
                      </Td>
                      <Td oculta>
                        <span className="block truncate text-adm-ink">{t.user.profile?.name || 'Sem perfil'}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-adm-muted">
                          {t.user.email}
                          {t.user.profile ? ` · ${PLANO[t.user.profile.plan] ?? t.user.profile.plan}` : ''}
                        </span>
                      </Td>
                      <Td oculta>
                        <Chip tom={tipo.tom}>{tipo.label}</Chip>
                      </Td>
                      <Td>
                        <Chip tom={sit.tom}>{sit.label}</Chip>
                      </Td>
                      <Td className="whitespace-nowrap text-right text-[12.5px] tabular-nums text-adm-muted">
                        <span title={fmtData(t.createdAt)}>{fmtRelativo(t.createdAt)}</span>
                      </Td>
                    </LinhaClicavel>
                    {estaAberto && (
                      <tr>
                        <Td colSpan={larga ? 5 : 3} className="bg-adm-bg/60 p-0">
                          <Chamado
                            chamado={t}
                            podeResponder={podeResponder}
                            onMudou={() => {
                              setAberto(null)
                              void recomecar()
                              atualizar()
                            }}
                            onErro={setErro}
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
          mostrando={itens?.length ?? 0}
          total={lista.total}
          temMais={lista.temMais}
          carregando={lista.carregando}
          onMais={() => void lista.mais()}
          nome="chamados"
        />
      </Cartao>
    </div>
  )
}

function Chamado({
  chamado: t,
  podeResponder,
  onMudou,
  onErro,
}: {
  chamado: AdminTicket
  podeResponder: boolean
  onMudou: () => void
  onErro: (m: string | null) => void
}) {
  const [nota, setNota] = useState(t.adminNote ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const semResposta = nota.trim().length < 5

  async function mudar(status: 'open' | 'in_progress' | 'resolved') {
    if (semResposta) {
      setAviso('Escreva a resposta antes de mudar a situação — é o que o advogado vai ler.')
      return
    }
    setOcupado(true)
    setAviso(null)
    onErro(null)
    try {
      await setTicketStatus(t.id, status, nota.trim())
      onMudou()
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Falha ao atualizar o chamado.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="grid gap-px border-t border-adm-border bg-adm-border lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      {/* ─── o que a pessoa escreveu ─── */}
      <section className="bg-white px-4 py-4">
        <Rotulo>Mensagem</Rotulo>
        <p className="whitespace-pre-wrap rounded-md border-l-2 border-adm-accent/60 bg-adm-raised px-3 py-2.5 text-[13px] leading-relaxed text-adm-ink">
          {t.message}
        </p>

        {t.anexos && t.anexos.length > 0 && (
          <>
            <Rotulo className="mt-4">Imagens</Rotulo>
            <ul className="flex flex-wrap gap-2">
              {t.anexos.map((a, i) => {
                const src = anexoDoChamadoUrl(t.id, a.id)
                return (
                  <li key={a.id}>
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer noopener"
                      title={`Abrir a imagem ${i + 1} inteira (${Math.max(1, Math.round(a.size / 1024))} KB)`}
                      className="block overflow-hidden rounded-md border border-adm-border bg-adm-raised transition-colors hover:border-adm-accent"
                    >
                      <img
                        src={src}
                        alt={`Imagem ${i + 1} anexada ao chamado`}
                        loading="lazy"
                        className="h-28 w-28 object-cover"
                      />
                    </a>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <Rotulo className="mt-4">Contexto</Rotulo>
        <dl className="grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
          <Par rotulo="Quem">
            {t.user.profile?.name || 'Sem perfil'} · {t.user.email}
          </Par>
          <Par rotulo="Perfil">
            {t.user.profile ? (
              <a
                href={`/${t.user.profile.slug}`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-adm-accent-deep hover:underline"
              >
                advoc.me/{t.user.profile.slug}
              </a>
            ) : (
              '—'
            )}
          </Par>
          <Par rotulo="Aberto em">{fmtData(t.createdAt)}</Par>
          <Par rotulo="Última mudança">{fmtData(t.handledAt)}</Par>
          <Par rotulo="Página" mono>
            {t.pageUrl || '—'}
          </Par>
          <Par rotulo="Navegador" mono>
            {t.userAgent || '—'}
          </Par>
        </dl>
      </section>

      {/* ─── a resposta ─── */}
      <section className="bg-white px-4 py-4">
        <Rotulo>Resposta ao advogado</Rotulo>
        {!podeResponder && <Aviso tom="ok">Seu papel lê os chamados, mas não responde.</Aviso>}
        <textarea
          rows={5}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          disabled={!podeResponder}
          placeholder="O que o advogado vai ler no chamado dele…"
          aria-label="Resposta ao advogado"
          className={`${entrada} resize-y leading-relaxed`}
        />
        <p className="mt-1 text-[11.5px] text-adm-muted">
          Obrigatória para mudar a situação. Mínimo de 5 caracteres. Texto novo avisa o advogado por e-mail.
        </p>
        {t.answeredAt && (
          <p className="mt-1.5 text-[11.5px] text-adm-soft">
            Respondido em {fmtData(t.answeredAt)} ·{' '}
            {t.seenAt && new Date(t.seenAt).getTime() >= new Date(t.answeredAt).getTime()
              ? `lido pelo advogado em ${fmtData(t.seenAt)}`
              : 'o advogado ainda não abriu a resposta'}
          </p>
        )}
        {aviso && <Aviso tom="nota" className="mt-2">{aviso}</Aviso>}

        <div className="mt-3 flex flex-wrap gap-2">
          {t.status !== 'resolved' ? (
            <Botao
              variante="sucesso"
              disabled={ocupado || !podeResponder || semResposta}
              onClick={() => void mudar('resolved')}
            >
              <CheckIcon width={13} height={13} strokeWidth={2.6} /> Marcar resolvido
            </Botao>
          ) : (
            <Botao disabled={ocupado || !podeResponder || semResposta} onClick={() => void mudar('open')}>
              Reabrir
            </Botao>
          )}
          {t.status !== 'in_progress' && (
            <Botao disabled={ocupado || !podeResponder || semResposta} onClick={() => void mudar('in_progress')}>
              Pôr em análise
            </Botao>
          )}
          {t.status === 'in_progress' && (
            <Botao disabled={ocupado || !podeResponder || semResposta} onClick={() => void mudar('in_progress')}>
              Salvar resposta
            </Botao>
          )}
        </div>
      </section>
    </div>
  )
}

function Par({ rotulo, children, mono = false }: { rotulo: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-adm-faint">{rotulo}</dt>
      <dd className={`break-all text-adm-soft ${mono ? 'font-mono text-[11.5px]' : ''}`}>{children}</dd>
    </div>
  )
}
