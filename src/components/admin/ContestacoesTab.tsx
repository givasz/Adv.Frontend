// A fila de contestações.
//
// É uma fila com relógio, não um mural: o que vence primeiro vem na frente, e o
// que está perto de vencer aparece em bordô. O motivo é duro — **se a plataforma
// não responder no prazo, a medida cai sozinha**. Não é ameaça de tela; é como o
// prazo foi implementado (o `moderationUntil` da medida foi encurtado na
// abertura da contestação), e é o que torna o contraditório real em vez de
// decorativo. Ver docs/politica-de-sancoes.md § 5.

import { useEffect, useState } from 'react'
import {
  decidirContestacao,
  listarContestacoes,
  type AdminAppeal,
} from '@/lib/adminApi'
import { Aviso, Motivo, fmtData } from './pecas'
import { Rodape } from './Paginacao'
import { usePaginado } from './usePaginado'
import { CheckIcon, XIcon } from '@/components/ui/icons'

const MEDIDA: Record<string, string> = {
  warn: 'aviso',
  partial: 'ocultação parcial',
  restrict: 'perfil fora do ar',
  suspend: 'conta suspensa',
  close: 'conta encerrada',
}

const SITUACAO: Record<string, { label: string; cls: string }> = {
  open: { label: 'aguardando', cls: 'bg-burgundy/10 text-burgundy-deep' },
  accepted: { label: 'medida derrubada', cls: 'bg-brass/20 text-brass-deep' },
  rejected: { label: 'medida mantida', cls: 'bg-ink/[0.07] text-ink-soft' },
  expired: { label: 'venceu sem resposta', cls: 'bg-burgundy/15 text-burgundy-deep' },
}

const FILTROS = [
  { id: 'open', label: 'Aguardando' },
  { id: 'all', label: 'Todas' },
] as const

/** Quanto falta, em dias. Negativo = já venceu. */
function faltam(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

export default function ContestacoesTab({ podeDecidir }: { podeDecidir: boolean }) {
  const [filtro, setFiltro] = useState<string>('open')
  const [aberta, setAberta] = useState<string | null>(null)

  const lista = usePaginado<AdminAppeal>(
    (offset) => listarContestacoes(filtro, offset),
    'Falha ao carregar as contestações.',
  )
  const { itens, erro } = lista
  const recarregar = lista.recomecar

  useEffect(() => {
    void recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              filtro === f.id
                ? 'bg-burgundy text-paper-soft'
                : 'border border-ink/15 text-ink-faint hover:border-ink/40 hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {!itens && !erro && <p className="py-10 text-center text-[13px] text-ink-faint">Carregando…</p>}
      {itens?.length === 0 && (
        <p className="rounded-xl2 border border-dashed border-ink/15 px-4 py-10 text-center text-[13px] text-ink-faint">
          Nenhuma contestação {filtro === 'open' ? 'aguardando resposta' : 'registrada'}.
        </p>
      )}

      <ul className="space-y-2.5">
        {(itens ?? []).map((c) => {
          const dias = faltam(c.respondeAte)
          const urgente = c.status === 'open' && dias <= 2
          return (
            <li
              key={c.id}
              className={`overflow-hidden rounded-xl2 border bg-paper ${
                urgente ? 'border-burgundy/50' : 'border-ink/10'
              }`}
            >
              <button
                onClick={() => setAberta((v) => (v === c.id ? null : c.id))}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-paper-soft"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">
                    {c.user.profile?.name || c.user.email}
                  </span>
                  <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-ink-faint">
                    {MEDIDA[c.medida] ?? c.medida}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${SITUACAO[c.status]?.cls ?? ''}`}
                  >
                    {SITUACAO[c.status]?.label ?? c.status}
                  </span>
                  {c.status === 'open' && (
                    <span
                      className={`ml-auto shrink-0 font-mono text-[11.5px] ${
                        urgente ? 'font-semibold text-burgundy-deep' : 'text-ink-faint'
                      }`}
                    >
                      {dias < 0
                        ? `venceu há ${Math.abs(dias)}d`
                        : dias === 0
                          ? 'vence hoje'
                          : `${dias}d para responder`}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-ink-faint">
                  {c.user.profile ? `advoc.me/${c.user.profile.slug} · ` : ''}
                  {c.user.email} · contestou em {fmtData(c.createdAt)}
                </span>
              </button>

              {aberta === c.id && (
                <Detalhe
                  contestacao={c}
                  podeDecidir={podeDecidir}
                  onDecidiu={() => {
                    setAberta(null)
                    void recarregar()
                  }}
                  onErro={lista.setErro}
                />
              )}
            </li>
          )
        })}
      </ul>

      <Rodape
        mostrando={itens?.length ?? 0}
        total={lista.total}
        temMais={lista.temMais}
        carregando={lista.carregando}
        onMais={() => void lista.mais()}
        nome="contestações"
      />
    </div>
  )
}

function Detalhe({
  contestacao: c,
  podeDecidir,
  onDecidiu,
  onErro,
}: {
  contestacao: AdminAppeal
  podeDecidir: boolean
  onDecidiu: () => void
  onErro: (m: string) => void
}) {
  const [resposta, setResposta] = useState(c.resposta ?? '')
  const [ocupado, setOcupado] = useState(false)
  const semResposta = resposta.trim().length < 5
  const decidida = c.status !== 'open'

  async function decidir(aceita: boolean) {
    setOcupado(true)
    try {
      await decidirContestacao(c.id, aceita, resposta.trim())
      onDecidiu()
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Não deu para responder.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="grid gap-px border-t border-ink/10 bg-ink/10 lg:grid-cols-2">
      <div className="bg-paper-soft/60 px-4 py-4">
        <p className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-brass-deep">
          O que motivou a medida
        </p>
        <p className="mb-4 rounded-lg border-l-2 border-ink/20 bg-paper px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
          {c.user.profile?.moderationNote || '(o motivo não está mais no perfil)'}
        </p>

        <p className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-brass-deep">
          O que o advogado respondeu
        </p>
        <p className="whitespace-pre-wrap rounded-lg border-l-2 border-burgundy/50 bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-ink">
          {c.texto}
        </p>
      </div>

      <div className="bg-paper px-4 py-4">
        {decidida ? (
          <>
            <p className="mb-2 text-[13px] font-semibold text-ink">
              {c.status === 'expired'
                ? 'Venceu sem resposta — a medida caiu sozinha.'
                : c.status === 'accepted'
                  ? 'Contestação aceita: a medida foi derrubada.'
                  : 'Contestação recusada: a medida foi mantida.'}
            </p>
            {c.resposta && (
              <p className="whitespace-pre-wrap rounded-lg bg-paper-soft px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
                {c.resposta}
              </p>
            )}
            <p className="mt-2 font-mono text-[11.5px] text-ink-faint">
              {fmtData(c.decidedAt)}
            </p>
          </>
        ) : (
          <>
            <Motivo
              id={`resp-${c.id}`}
              valor={resposta}
              onChange={setResposta}
              label="Sua resposta (obrigatória)"
              dica="É o que o advogado vai ler. Se recusar, diga o que continua irregular; se aceitar, diga o que mudou."
              linhas={5}
            />
            {!podeDecidir && (
              <Aviso tom="ok">Seu papel lê a fila, mas não decide contestação.</Aviso>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void decidir(true)}
                disabled={ocupado || !podeDecidir || semResposta}
                className="inline-flex items-center gap-1.5 rounded-full bg-brass/20 px-4 py-2 text-[13px] font-semibold text-brass-deep transition-colors hover:bg-brass/30 disabled:cursor-not-allowed disabled:bg-ink/[0.06] disabled:text-ink-faint"
              >
                <CheckIcon width={14} height={14} /> Aceitar e derrubar a medida
              </button>
              <button
                onClick={() => void decidir(false)}
                disabled={ocupado || !podeDecidir || semResposta}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-burgundy/40 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-ink/[0.06] disabled:text-ink-faint"
              >
                <XIcon width={14} height={14} /> Manter a medida
              </button>
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-ink-faint">
              Aceitar derruba tudo o que veio com a medida — inclusive a suspensão
              da conta e a pausa da cobrança. Manter devolve o prazo que a medida
              tinha antes da contestação.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
