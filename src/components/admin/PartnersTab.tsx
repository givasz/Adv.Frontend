// Programa Advocme Parceiros — a seção do console.
//
// Ferramenta de consulta e de decisão, não CRM: quem participa, até quando vale o
// benefício, o que cada indicação virou. As decisões (convidar, suspender,
// reativar, encerrar, ajustar dias, corrigir indicação, revogar recompensa) pedem
// `parceiros:gerir`, motivo escrito e uma segunda confirmação — e cada uma vira
// linha no Histórico. Quem só lê vê tudo e não encontra botão nenhum.
//
// ⚠️ Os textos e regras do programa aguardam revisão jurídica (backend
// partners/partner-terms.ts). O aviso fica no topo da seção até lá.

import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  acoesDoParceiro,
  cancelarConvitePorEmail,
  convidarParceiroPorEmail,
  fichaDoParceiro,
  listarConvitesPorEmail,
  listarParceiros,
  type ConvitePorEmail,
  type FichaDoParceiro,
  type ParceiroNaLista,
  type StatusDoParceiroAdmin,
} from '@/lib/adminApi'
import { SearchIcon } from '@/components/ui/icons'
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Carregando,
  Chip,
  Dado,
  entrada,
  fmtData,
  LinhaClicavel,
  Motivo,
  Rotulo,
  Segmentos,
  Tabela,
  Td,
  Th,
  TituloDaPagina,
  Vazio,
  useTelaLarga,
  type Tom,
} from './pecas'
import { RodapeTrilha } from './Paginacao'
import { SECOES } from './Console'
import { NOME_ACAO } from './HistoricoTab'

export const STATUS_DO_PARCEIRO: Record<StatusDoParceiroAdmin, { label: string; tom: Tom }> = {
  invited: { label: 'Convidado', tom: 'info' },
  active: { label: 'Ativo', tom: 'ok' },
  suspended: { label: 'Suspenso', tom: 'aviso' },
  ended: { label: 'Encerrado', tom: 'neutro' },
}

const FILTROS = [
  { id: '', label: 'Todos' },
  { id: 'invited', label: 'Convidados' },
  { id: 'active', label: 'Ativos' },
  { id: 'suspended', label: 'Suspensos' },
  { id: 'ended', label: 'Encerrados' },
] as const

const PLANO: Record<string, string> = { free: 'Free', pro: 'Pro', premium: 'Max' }

const RECOMPENSA: Record<string, string> = { initial: 'Inicial', referral: 'Indicação', manual: 'Ajuste' }
const SITUACAO_DA_RECOMPENSA: Record<string, { label: string; tom: Tom }> = {
  pending: { label: 'em validação', tom: 'aviso' },
  confirmed: { label: 'confirmada', tom: 'ok' },
  revoked: { label: 'revogada', tom: 'neutro' },
}

export default function PartnersTab({ podeGerir }: { podeGerir: boolean }) {
  const secao = SECOES.find((s) => s.id === 'parceiros')!
  const larga = useTelaLarga()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [itens, setItens] = useState<ParceiroNaLista[] | null>(null)
  const [proximo, setProximo] = useState<string | null>(null)
  const [temMais, setTemMais] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let vivo = true
    setItens(null)
    setErro(null)
    const t = setTimeout(() => {
      void listarParceiros({ status: status || undefined, q: q.trim() || undefined, limite: 25 })
        .then((r) => {
          if (!vivo) return
          setItens(r.itens)
          setProximo(r.proximo)
          setTemMais(r.temMais)
        })
        .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : 'Falha ao carregar.'))
    }, q ? 300 : 0)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [status, q, tick])

  async function mais() {
    if (!proximo || carregando) return
    setCarregando(true)
    try {
      const r = await listarParceiros({ status: status || undefined, q: q.trim() || undefined, limite: 25, cursor: proximo })
      setItens((a) => [...(a ?? []), ...r.itens])
      setProximo(r.proximo)
      setTemMais(r.temMais)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar mais.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div>
      <TituloDaPagina titulo={secao.label} descricao={secao.descricao} />
      <Aviso tom="nota">
        Regras e textos do programa aguardam revisão jurídica final. O programa recompensa só a indicação do
        software a outros profissionais — nunca cliente, causa, consulta ou contato.
      </Aviso>

      {podeGerir && <ConvidarConta onConvidou={() => setTick((n) => n + 1)} />}

      <Cartao
        semPreenchimento
        titulo="Participações"
        acoes={<Segmentos rotulo="Situação da participação" opcoes={FILTROS} valor={status} onChange={setStatus} />}
      >
        <div className="flex items-center gap-2 border-b border-adm-line px-4 py-3">
          <SearchIcon width={16} height={16} className="shrink-0 text-adm-faint" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, endereço ou código exato…"
            aria-label="Buscar participações"
            spellCheck={false}
            className="w-full bg-transparent py-1 text-[14px] text-adm-ink placeholder:text-adm-faint focus:outline-none"
          />
        </div>
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
            <Vazio>Nenhuma participação neste recorte.</Vazio>
          </div>
        )}
        {itens && itens.length > 0 && (
          <Tabela minima="md:min-w-[760px]">
            <thead>
              <tr>
                <Th>Parceiro</Th>
                <Th largura="8rem">Situação</Th>
                <Th largura="9rem" oculta>
                  Benefício até
                </Th>
                <Th largura="6rem" oculta>
                  Cadastros
                </Th>
                <Th largura="7rem" oculta>
                  Confirmadas
                </Th>
              </tr>
            </thead>
            <tbody>
              {itens.map((p) => {
                const meta = STATUS_DO_PARCEIRO[p.status]
                const estaAberto = aberto === p.id
                return (
                  <Fragment key={p.id}>
                    <LinhaClicavel aberta={estaAberto} onClick={() => setAberto(estaAberto ? null : p.id)}>
                      <Td>
                        <span className="block truncate font-medium text-adm-ink">{p.nome || '—'}</span>
                        <span className="mt-0.5 block truncate font-mono text-[11.5px] text-adm-muted">
                          advoc.me/{p.slug} · {p.codigo}
                        </span>
                      </Td>
                      <Td>
                        <Chip tom={meta.tom}>{meta.label}</Chip>
                      </Td>
                      <Td className="whitespace-nowrap text-[12px] tabular-nums text-adm-soft" oculta>
                        {fmtData(p.benefitUntil)}
                      </Td>
                      <Td className="tabular-nums" oculta>
                        {p.cadastrados}
                      </Td>
                      <Td className="tabular-nums" oculta>
                        {p.conversoes}
                      </Td>
                    </LinhaClicavel>
                    {estaAberto && (
                      <tr>
                        <Td colSpan={larga ? 5 : 2} className="bg-adm-bg/60 p-0">
                          <FichaParceiro id={p.id} podeGerir={podeGerir} onMudou={() => setTick((n) => n + 1)} />
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </Tabela>
        )}
        <RodapeTrilha mostrando={itens?.length ?? 0} temMais={temMais} carregando={carregando} onMais={() => void mais()} />
      </Cartao>
    </div>
  )
}

// ---- Convidar --------------------------------------------------------------

function ConvidarConta({ onConvidou }: { onConvidou: () => void }) {
  const [email, setEmail] = useState('')
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [pendentes, setPendentes] = useState<ConvitePorEmail[] | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let vivo = true
    void listarConvitesPorEmail()
      .then((r) => vivo && setPendentes(r.itens))
      .catch(() => vivo && setPendentes([]))
    return () => {
      vivo = false
    }
  }, [tick])

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function convidar() {
    setOcupado(true)
    setErro(null)
    setOk(null)
    try {
      const r = await convidarParceiroPorEmail(email.trim(), motivo)
      setOk(
        r.resultado === 'conta'
          ? `${r.email} já tem conta: o convite está no painel da pessoa, e ela recebeu o aviso por e-mail.`
          : `${r.email} ainda não tem conta: enviamos o convite por e-mail. Quando a pessoa se cadastrar com este e-mail, o convite aparece no painel dela.`,
      )
      setEmail('')
      setMotivo('')
      setTick((n) => n + 1)
      onConvidou()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para convidar.')
    } finally {
      setOcupado(false)
    }
  }

  async function cancelar(id: string) {
    if (motivo.trim().length < 5) {
      setErro('Escreva o motivo na caixa acima antes de cancelar um convite.')
      return
    }
    setOcupado(true)
    setErro(null)
    try {
      await cancelarConvitePorEmail(id, motivo)
      setTick((n) => n + 1)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para cancelar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Cartao
      titulo="Convidar por e-mail"
      descricao="Com conta, o convite aparece no painel da pessoa. Sem conta, ela recebe um e-mail para se cadastrar com este endereço. Nada é ativado antes do aceite dela."
      className="mb-4"
    >
      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tom="ok">{ok}</Aviso>}
      <Campo id="email-convite" label="E-mail da pessoa">
        <input
          id="email-convite"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@exemplo.com.br"
          autoComplete="off"
          spellCheck={false}
          className={entrada}
        />
      </Campo>
      <Motivo id="motivo-convite" valor={motivo} onChange={setMotivo} dica="Fica no histórico do console. Mínimo de 5 caracteres." />
      <Botao variante="primario" disabled={ocupado || !emailValido || motivo.trim().length < 5} onClick={() => void convidar()}>
        {ocupado ? 'Enviando…' : 'Enviar convite'}
      </Botao>

      {pendentes && pendentes.length > 0 && (
        <div className="mt-4">
          <Rotulo>Convites por e-mail aguardando cadastro</Rotulo>
          <ul className="divide-y divide-adm-line rounded-md border border-adm-border">
            {pendentes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                <span className="min-w-0">
                  <span className="font-medium text-adm-ink">{c.email}</span>{' '}
                  <span className="text-adm-muted">
                    enviado {fmtData(c.createdAt)} · {c.vencido ? 'vencido' : `vale até ${fmtData(c.expiraEm)}`}
                  </span>
                </span>
                <Botao tamanho="sm" variante="fantasma" disabled={ocupado} onClick={() => void cancelar(c.id)}>
                  Cancelar convite
                </Botao>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Cartao>
  )
}

// ---- Ficha -----------------------------------------------------------------

function FichaParceiro({ id, podeGerir, onMudou }: { id: string; podeGerir: boolean; onMudou: () => void }) {
  const [ficha, setFicha] = useState<FichaDoParceiro | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      setFicha(await fichaDoParceiro(id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao abrir a ficha.')
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  if (erro) return <div className="p-4"><Aviso>{erro}</Aviso></div>
  if (!ficha) return <div className="px-4"><Carregando /></div>
  return (
    <FichaDoParceiroView
      ficha={ficha}
      podeGerir={podeGerir}
      executar={async (fn) => {
        await fn()
        await carregar()
        onMudou()
      }}
    />
  )
}

type Decisao = 'suspender' | 'reativar' | 'encerrar' | 'ajustar'

const DECISOES: Record<Decisao, { rotulo: string; confirmar: string; variante: 'aviso' | 'sucesso' | 'perigo' | 'secundario' }> = {
  suspender: { rotulo: 'Suspender', confirmar: 'Confirmar suspensão', variante: 'aviso' },
  reativar: { rotulo: 'Reativar', confirmar: 'Confirmar reativação', variante: 'sucesso' },
  encerrar: { rotulo: 'Encerrar', confirmar: 'Confirmar encerramento definitivo', variante: 'perigo' },
  ajustar: { rotulo: 'Ajustar dias', confirmar: 'Confirmar ajuste', variante: 'secundario' },
}

/** As decisões que a situação atual permite. */
export function decisoesPossiveis(status: StatusDoParceiroAdmin): Decisao[] {
  if (status === 'active') return ['suspender', 'ajustar', 'encerrar']
  if (status === 'suspended') return ['reativar', 'ajustar', 'encerrar']
  if (status === 'invited') return ['encerrar']
  return []
}

/** A ficha desenhada — separada da busca para o teste conferir permissão e confirmação. */
export function FichaDoParceiroView({
  ficha,
  podeGerir,
  executar,
}: {
  ficha: FichaDoParceiro
  podeGerir: boolean
  executar: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const [motivo, setMotivo] = useState('')
  const [pedida, setPedida] = useState<Decisao | null>(null)
  const [dias, setDias] = useState('30')
  const [destino, setDestino] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const semMotivo = motivo.trim().length < 5

  async function rodar(fn: () => Promise<unknown>) {
    setOcupado(true)
    setErro(null)
    try {
      await executar(fn)
      setPedida(null)
      setMotivo('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para aplicar.')
    } finally {
      setOcupado(false)
    }
  }

  const aplicar = (d: Decisao) =>
    rodar(() =>
      d === 'ajustar'
        ? acoesDoParceiro.ajustar(ficha.id, Number(dias), motivo)
        : d === 'suspender'
          ? acoesDoParceiro.suspender(ficha.id, motivo)
          : d === 'reativar'
            ? acoesDoParceiro.reativar(ficha.id, motivo)
            : acoesDoParceiro.encerrar(ficha.id, motivo),
    )

  const meta = STATUS_DO_PARCEIRO[ficha.status]
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <Rotulo>Participação</Rotulo>
        <dl className="divide-y divide-adm-line">
          <Dado rotulo="Situação">
            <Chip tom={meta.tom}>{meta.label}</Chip>
          </Dado>
          <Dado rotulo="Código">{ficha.codigo}</Dado>
          <Dado rotulo="Benefício até">
            {fmtData(ficha.benefitUntil)} {ficha.beneficioAtivo ? '(valendo)' : ''}
          </Dado>
          <Dado rotulo="Regras aceitas">{ficha.termsAcceptedAt ? `${fmtData(ficha.termsAcceptedAt)} · v${ficha.termsVersion}` : '—'}</Dado>
          <Dado rotulo="Convidado em">{fmtData(ficha.invitedAt)}</Dado>
          {ficha.conta && (
            <>
              <Dado rotulo="Conta">{ficha.conta.nome} · advoc.me/{ficha.conta.slug}</Dado>
              <Dado rotulo="Plano financeiro">
                {PLANO[ficha.conta.planoFinanceiro] ?? ficha.conta.planoFinanceiro} ({ficha.conta.situacaoCobranca})
              </Dado>
              <Dado rotulo="Plano efetivo">{PLANO[ficha.conta.planoEfetivo] ?? ficha.conta.planoEfetivo}</Dado>
            </>
          )}
        </dl>

        {podeGerir && decisoesPossiveis(ficha.status).length > 0 && (
          <div className="mt-4 rounded-md border border-adm-border bg-white p-3">
            <Rotulo>Decisão</Rotulo>
            {erro && <Aviso>{erro}</Aviso>}
            <Motivo id={`motivo-${ficha.id}`} valor={motivo} onChange={setMotivo} dica="Vai para o histórico e, na suspensão e no encerramento, para o e-mail do parceiro." />
            {pedida === 'ajustar' && (
              <label className="mb-3 block text-[12.5px] text-adm-soft">
                Dias (negativo tira dias ainda não usados)
                <input type="number" value={dias} onChange={(e) => setDias(e.target.value)} className={`${entrada} mt-1 w-32`} />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {pedida ? (
                <>
                  <Botao variante={DECISOES[pedida].variante} disabled={ocupado || semMotivo} onClick={() => void aplicar(pedida)}>
                    {ocupado ? 'Aplicando…' : DECISOES[pedida].confirmar}
                  </Botao>
                  <Botao variante="fantasma" onClick={() => setPedida(null)}>
                    Cancelar
                  </Botao>
                </>
              ) : (
                decisoesPossiveis(ficha.status).map((d) => (
                  <Botao key={d} variante={DECISOES[d].variante} tamanho="sm" onClick={() => setPedida(d)}>
                    {DECISOES[d].rotulo}
                  </Botao>
                ))
              )}
            </div>
            {pedida === 'encerrar' && (
              <p className="mt-2 text-[11.5px] text-adm-danger">
                Definitivo: o código deixa de valer, o benefício termina e as indicações em validação são revogadas. O histórico fica.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Rotulo>Indicações</Rotulo>
          {ficha.indicacoes.itens.length === 0 ? (
            <Vazio>Nenhuma indicação.</Vazio>
          ) : (
            <ul className="divide-y divide-adm-line rounded-md border border-adm-border bg-white">
              {ficha.indicacoes.itens.map((r) => (
                <li key={r.id} className="px-3 py-2 text-[12.5px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-adm-ink">{r.indicado ? r.indicado.nome : 'conta excluída'}</span>
                    {r.indicado && <span className="text-adm-muted">advoc.me/{r.indicado.slug}</span>}
                    {r.recompensa && <Chip tom={SITUACAO_DA_RECOMPENSA[r.recompensa.status]?.tom ?? 'neutro'}>{SITUACAO_DA_RECOMPENSA[r.recompensa.status]?.label}</Chip>}
                    {r.disqualifiedAt && <Chip title={r.disqualificationReason}>não elegível</Chip>}
                    {r.revisarOab && <Chip tom="aviso" title="OAB igual à do parceiro — a OAB é autodeclarada; isto só pede revisão">revisar OAB</Chip>}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-adm-muted">
                    cadastro {fmtData(r.attributedAt)}
                    {r.convertedAt ? ` · 1º pagamento ${fmtData(r.convertedAt)}` : ''}
                  </div>
                  {podeGerir && !r.convertedAt && !r.recompensa && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <input
                        value={destino[r.id] ?? ''}
                        onChange={(e) => setDestino((d) => ({ ...d, [r.id]: e.target.value }))}
                        placeholder="id da participação de destino"
                        aria-label="Participação de destino"
                        className={`${entrada} !py-1 font-mono !text-[11.5px] sm:w-64`}
                      />
                      <Botao
                        tamanho="sm"
                        disabled={ocupado || semMotivo || !(destino[r.id] ?? '').trim()}
                        onClick={() => void rodar(() => acoesDoParceiro.reatribuir(r.id, (destino[r.id] ?? '').trim(), motivo))}
                      >
                        Corrigir parceiro
                      </Botao>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <Rotulo>Recompensas</Rotulo>
          <ul className="divide-y divide-adm-line rounded-md border border-adm-border bg-white">
            {ficha.recompensas.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                <span>
                  <span className="font-medium text-adm-ink">{RECOMPENSA[w.type]}</span>{' '}
                  <span className="tabular-nums text-adm-soft">{w.days > 0 ? `+${w.days}` : w.days} dias</span>{' '}
                  <Chip tom={SITUACAO_DA_RECOMPENSA[w.status]?.tom ?? 'neutro'}>{SITUACAO_DA_RECOMPENSA[w.status]?.label}</Chip>
                  {w.sourcePaymentId && <span className="ml-1 font-mono text-[11px] text-adm-muted">pagamento {w.sourcePaymentId}</span>}
                  {w.reason && <span className="mt-0.5 block text-[11.5px] text-adm-muted">“{w.reason}”</span>}
                </span>
                {podeGerir && w.type === 'referral' && w.status !== 'revoked' && (
                  <Botao tamanho="sm" variante="aviso" disabled={ocupado || semMotivo} onClick={() => void rodar(() => acoesDoParceiro.revogarRecompensa(w.id, motivo))}>
                    Revogar
                  </Botao>
                )}
              </li>
            ))}
          </ul>
          {podeGerir && <p className="mt-1 text-[11.5px] text-adm-muted">Corrigir e revogar usam o motivo escrito na caixa de decisão.</p>}
        </div>

        {ficha.historico.length > 0 && (
          <div>
            <Rotulo>Histórico</Rotulo>
            <ul className="space-y-1 text-[12px] text-adm-soft">
              {ficha.historico.map((h) => (
                <li key={h.id}>
                  {fmtData(h.createdAt)} — <span className="font-medium text-adm-ink">{h.adminLabel}</span>{' '}
                  {NOME_ACAO[h.action] ?? h.action}
                  {h.reason ? `: “${h.reason}”` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
