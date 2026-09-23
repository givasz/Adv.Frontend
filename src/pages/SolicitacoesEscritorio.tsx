import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Firm } from '@/lib/escritorio'
import {
  solicitacoesDoEscritorio,
  type MeetingRequest,
  type RequestCounts,
  type RequestFilter,
} from '@/lib/agendaDigital'
import { whatsappHref, comoAbrirWhatsapp } from '@/lib/whatsapp'
import { SubPage } from '@/components/ui/SubPage'
import { CalendarIcon, MailIcon, TrashIcon, WhatsappIcon } from '@/components/ui/icons'

// A CAIXA DE SOLICITAÇÕES DO ESCRITÓRIO.
//
// Os pedidos que entraram pela página da sociedade. Duas naturezas na mesma
// lista, e a diferença é se já têm dono:
//
//   • sem advogado → ninguém foi escolhido na conversa. Quem administra
//     encaminha a um membro, e só a partir daí existe agenda onde marcar;
//   • com advogado → o visitante escolheu alguém que recebe pedidos no painel.
//     O pedido já está na caixa dele; aparece aqui porque quem administra
//     precisa saber o que entrou pela porta do escritório.
//
// O que esta tela NÃO faz: confirmar. O compromisso entra no calendário de uma
// pessoa, e marcar horário na agenda de outra seria mexer na agenda dela. Depois
// de encaminhado, quem confirma é o advogado, na agenda digital dele.

const FILTROS: { id: RequestFilter; label: string; descricao: string; vazio: string }[] = [
  {
    id: 'pending',
    label: 'Aguardando',
    descricao: 'Pedidos recebidos pela página do escritório que ainda esperam resposta.',
    vazio: 'Nenhum pedido aguardando.',
  },
  {
    id: 'confirmed',
    label: 'Confirmadas',
    descricao: 'Pedidos que o advogado responsável já confirmou na agenda dele.',
    vazio: 'Nenhum pedido confirmado por enquanto.',
  },
  {
    id: 'declined',
    label: 'Negadas',
    descricao: 'Pedidos negados pelo escritório ou pelo advogado.',
    vazio: 'Nenhum pedido negado.',
  },
  {
    id: 'all',
    label: 'Histórico',
    descricao: 'Todos os pedidos, do mais recente ao mais antigo.',
    vazio: 'Ainda não chegou nenhum pedido pela página do escritório.',
  },
]

const SITUACAO: Record<MeetingRequest['status'], string> = {
  pending: 'Aguardando',
  confirmed: 'Confirmada',
  declined: 'Negada',
}

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function SolicitacoesEscritorio() {
  const [busca, setBusca] = useSearchParams()
  const filtro = FILTROS.find((f) => f.id === busca.get('estado'))?.id ?? 'pending'
  const ativo = FILTROS.find((f) => f.id === filtro)!
  const paginaPedida = Number(busca.get('pagina') ?? 1)
  const pagina = Number.isSafeInteger(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1

  const [firm, setFirm] = useState<Firm | null>(null)
  const [itens, setItens] = useState<MeetingRequest[]>([])
  const [total, setTotal] = useState(0)
  const [paginas, setPaginas] = useState(1)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [contagem, setContagem] = useState<RequestCounts>({
    pending: 0,
    confirmed: 0,
    declined: 0,
    all: 0,
  })
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    void api
      .getMyFirm()
      .then(setFirm)
      .catch(() => setFirm(null))
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const dados = await solicitacoesDoEscritorio.listar(pagina, filtro)
      setItens(dados.items)
      setTotal(dados.total)
      setPaginas(dados.totalPages)
      setPaginaAtual(dados.page)
      setContagem(dados.counts)
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar as solicitações.')
    } finally {
      setCarregando(false)
    }
  }, [pagina, filtro])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /** Quem pode receber um encaminhamento: membro do escritório com perfil. */
  const destinos = useMemo(
    () =>
      (firm?.lawyers ?? [])
        // Advogado listado à mão não tem conta, e sem conta não há painel onde o
        // pedido possa cair. `slug` vazio é como a página marca esse caso.
        .filter((l) => l.slug)
        .map((l) => ({ id: l.id, name: l.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [firm],
  )

  function trocar(patch: Record<string, string | undefined>) {
    const p = new URLSearchParams(busca)
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    setBusca(p, { replace: true })
  }

  async function agir(id: string, acao: () => Promise<void>) {
    setOcupado(id)
    setErro('')
    try {
      await acao()
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.')
    } finally {
      setOcupado('')
    }
  }

  return (
    <SubPage
      title="Solicitações do escritório"
      subtitle="Pedidos que chegaram pela página da sociedade."
      icon={<CalendarIcon width={18} height={18} />}
      backTo="/escritorio/painel"
      backLabel="Painel do escritório"
      documentTitle="Solicitações do escritório · advoc.me"
    >
      {firm && !firm.meetingInboxEnabled && (
        <p className="mb-4 rounded-xl border border-brass/25 bg-brass/[0.07] px-3.5 py-3 text-[13px] leading-relaxed text-brass-deep">
          A caixa de solicitações está desligada: hoje a conversa da página termina no WhatsApp e
          nada chega aqui. Ligue em Escritório → Assistente virtual → Como o escritório recebe.
        </p>
      )}

      {/* Filtros com a contagem — nenhuma lista corta em silêncio. */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const n = contagem[f.id]
          const atual = f.id === filtro
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => trocar({ estado: f.id === 'pending' ? undefined : f.id, pagina: undefined })}
              aria-pressed={atual}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                atual
                  ? 'border-burgundy bg-burgundy text-paper'
                  : 'border-ink/12 bg-paper-soft text-ink-soft hover:border-burgundy/40'
              }`}
            >
              {f.label}
              {n > 0 && <span className="ml-1.5 opacity-70">{n}</span>}
            </button>
          )
        })}
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">{ativo.descricao}</p>

      {erro && (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-burgundy">
          {erro}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {carregando && <p className="text-[13px] text-ink-faint">Carregando…</p>}
        {!carregando && itens.length === 0 && (
          <p className="rounded-xl border border-ink/10 bg-paper-soft px-4 py-6 text-center text-[13px] text-ink-faint">
            {ativo.vazio}
          </p>
        )}
        {itens.map((p) => (
          <Pedido
            key={p.id}
            pedido={p}
            destinos={destinos}
            ocupado={ocupado === p.id}
            onEncaminhar={(lawyerId) =>
              agir(p.id, () => solicitacoesDoEscritorio.encaminhar(p.id, lawyerId))
            }
            onNegar={() => agir(p.id, () => solicitacoesDoEscritorio.negar(p.id))}
            onApagar={() => agir(p.id, () => solicitacoesDoEscritorio.apagar(p.id))}
          />
        ))}
      </div>

      {paginas > 1 && (
        <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Páginas">
          <button
            type="button"
            disabled={paginaAtual <= 1}
            onClick={() => trocar({ pagina: String(paginaAtual - 1) })}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-[13px] font-medium text-ink disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-[12.5px] text-ink-faint">
            Página {paginaAtual} de {paginas} · {total}{' '}
            {total === 1 ? 'solicitação' : 'solicitações'}
          </span>
          <button
            type="button"
            disabled={paginaAtual >= paginas}
            onClick={() => trocar({ pagina: String(paginaAtual + 1) })}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-[13px] font-medium text-ink disabled:opacity-40"
          >
            Próxima
          </button>
        </nav>
      )}
    </SubPage>
  )
}

function Pedido({
  pedido,
  destinos,
  ocupado,
  onEncaminhar,
  onNegar,
  onApagar,
}: {
  pedido: MeetingRequest
  destinos: { id: string; name: string }[]
  ocupado: boolean
  onEncaminhar: (lawyerId: string) => void
  onNegar: () => void
  onApagar: () => void
}) {
  // A escolha do visitante já vem selecionada: quem administra confirma em vez
  // de procurar o nome na lista.
  const [destino, setDestino] = useState(pedido.preferido?.id ?? '')
  const zap = whatsappHref(pedido.whatsapp ?? undefined)
  const pendente = pedido.status === 'pending'

  return (
    <article className="rounded-xl border border-ink/10 bg-paper p-4">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-semibold text-ink">{pedido.name}</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-faint">
            {quando(pedido.createdAt)}
            {pedido.lawyer ? ` · para ${pedido.lawyer.name}` : ' · sem advogado definido'}
          </p>
          {pedido.preferido && (
            <p className="mt-0.5 text-[12.5px] text-burgundy">
              Pediu falar com {pedido.preferido.name}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
            pedido.status === 'confirmed'
              ? 'bg-brass/15 text-brass-deep'
              : pedido.status === 'declined'
                ? 'bg-ink/[0.07] text-ink-faint'
                : 'bg-burgundy/10 text-burgundy'
          }`}
        >
          {SITUACAO[pedido.status]}
        </span>
      </header>

      <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{pedido.subject}</p>

      {pedido.preferredAt && (
        <p className="mt-1 text-[12.5px] text-ink-soft">
          Preferência: <strong>{quando(pedido.preferredAt)}</strong>
        </p>
      )}
      {pedido.calendarEntry && (
        <p className="mt-1 text-[12.5px] text-ink-soft">
          Confirmada para <strong>{quando(pedido.calendarEntry.startsAt)}</strong>
        </p>
      )}

      {/* As respostas da triagem do advogado, quando o visitante passou por ela. */}
      {pedido.triage.length > 0 && (
        <dl className="mt-2.5 space-y-1.5 rounded-lg border border-ink/10 bg-paper-soft p-3">
          {pedido.triage.map((r) => (
            <div key={r.id}>
              <dt className="text-[11.5px] font-semibold text-ink-faint">{r.pergunta}</dt>
              <dd className="text-[13px] text-ink">{r.resposta || '—'}</dd>
            </div>
          ))}
          <p className="pt-1 text-[11px] leading-relaxed text-ink-faint">
            Escrito por quem visitou a página, na triagem inicial. Não é análise jurídica.
          </p>
        </dl>
      )}

      {/* Contato: o pedido só vale se alguém responder, então os canais ficam à mão. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {zap && (
          <a
            href={zap}
            {...comoAbrirWhatsapp()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-burgundy/40"
          >
            <WhatsappIcon width={15} height={15} />
            {pedido.whatsapp}
          </a>
        )}
        {pedido.email && (
          <a
            href={`mailto:${pedido.email}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-burgundy/40"
          >
            <MailIcon width={15} height={15} />
            {pedido.email}
          </a>
        )}
      </div>

      {/* Encaminhar só faz sentido enquanto o pedido está de pé. Depois de
          respondido, o que resta é apagar — e quem apaga é o escritório, porque o
          registro é dele (o advogado responde, mas não o elimina). */}
      {pendente && destinos.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/[0.07] pt-3">
          <label className="sr-only" htmlFor={`destino-${pedido.id}`}>
            Encaminhar para
          </label>
          <select
            id={`destino-${pedido.id}`}
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="min-w-[180px] flex-1 rounded-lg border border-ink/15 bg-paper-soft px-3 py-2 text-[13px] text-ink"
          >
            <option value="">
              {pedido.lawyer ? `Trocar de advogado (hoje: ${pedido.lawyer.name})` : 'Encaminhar para…'}
            </option>
            {destinos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!destino || ocupado}
            onClick={() => onEncaminhar(destino)}
            className="rounded-lg bg-burgundy px-3.5 py-2 text-[13px] font-semibold text-paper disabled:opacity-40"
          >
            Encaminhar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={onNegar}
            className="rounded-lg border border-ink/15 px-3 py-2 text-[13px] font-medium text-ink disabled:opacity-40"
          >
            Negar
          </button>
        </div>
      )}
      {pendente && destinos.length === 0 && (
        <p className="mt-3 border-t border-ink/[0.07] pt-3 text-[12.5px] leading-relaxed text-ink-faint">
          Nenhum advogado com conta no escritório para receber o pedido. Convide alguém em
          Escritório → Advogados da sociedade, ou responda pelo contato acima.
        </p>
      )}

      <div className="mt-3 flex justify-end border-t border-ink/[0.07] pt-3">
        <button
          type="button"
          disabled={ocupado}
          onClick={onApagar}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-faint transition-colors hover:text-burgundy disabled:opacity-40"
        >
          <TrashIcon width={14} height={14} />
          Apagar este pedido
        </button>
      </div>
    </article>
  )
}
