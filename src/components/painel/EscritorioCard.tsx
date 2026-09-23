import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { solicitacoesDoEscritorio } from '@/lib/agendaDigital'
import type { Firm, FirmInvite } from '@/lib/escritorio'
import { ScaleIcon } from '@/components/ui/icons'
import { Plaqueta } from './pecas'

// Entrada do escritório no painel. Antes a sociedade só existia pelo card do plano
// na landing: quem já estava logado não tinha caminho nenhum até ela.
//
// A mesma caixa cobre os três estados de quem chega aqui:
//   • foi convidado  → decide o convite ali mesmo, sem sair da página
//   • já tem/administra → atalho para o editor e para a página institucional
//   • nenhum dos dois  → convite para criar
//
// Componente separado com hooks próprios de propósito: o painel tem uma saída
// antecipada enquanto o perfil carrega, e hook depois de saída antecipada foi o que
// já deixou essa tela em branco uma vez (React #310).
export function EscritorioCard() {
  const [firm, setFirm] = useState<Firm | null>(null)
  const [invites, setInvites] = useState<FirmInvite[]>([])
  const [carregando, setCarregando] = useState(true)
  // Pedidos da página do escritório ainda sem resposta. É a única coisa aqui que
  // é TAREFA, e por isso vira destaque — o resto do cartão é navegação.
  const [pendentes, setPendentes] = useState(0)
  const [respondendo, setRespondendo] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const [meu, convites] = await Promise.all([
      api.getMyFirm().catch(() => null),
      api.getFirmInvites().catch(() => [] as FirmInvite[]),
    ])
    setFirm(meu && meu.name ? meu : null)
    setInvites(convites)
    setCarregando(false)
    // Só faz sentido perguntar a quem administra um escritório com a caixa
    // ligada: nos outros casos a rota devolveria 404 ou zero, e uma chamada a
    // mais em todo carregamento do painel não se paga.
    if (meu?.meetingInboxEnabled) {
      const dados = await solicitacoesDoEscritorio.listar(1, 'pending').catch(() => null)
      setPendentes(dados?.pendingCount ?? 0)
    } else {
      setPendentes(0)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const responder = async (id: string, resposta: 'accept' | 'decline') => {
    setRespondendo(id)
    setErro('')
    try {
      await api.answerFirmInvite(id, resposta)
      await carregar()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não foi possível responder agora.')
    } finally {
      setRespondendo('')
    }
  }

  if (carregando) return null

  return (
    <div className="card-paper p-4 sm:p-5">
      <div className="flex items-start gap-3.5 sm:gap-4">
        <Plaqueta Icone={ScaleIcon} />
        <div className="min-w-0 flex-1">
          {invites.length > 0 ? (
            <>
              <p className="font-display text-[17px] font-semibold leading-tight text-ink">
                {invites.length === 1
                  ? 'Você foi convidado para um escritório'
                  : `Você tem ${invites.length} convites de escritório`}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                Aceitando, seu perfil passa a aparecer na página da sociedade. Ele continua sendo seu:
                se sair depois, nada é apagado.
              </p>
              <ul className="mt-3 grid gap-2">
                {invites.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-brass/25 bg-brass/[0.06] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-ink">{c.firm.name}</p>
                      {(c.firm.city || c.firm.state) && (
                        <p className="truncate text-[12px] text-ink-faint">
                          {[c.firm.city, c.firm.state].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={respondendo === c.id}
                        onClick={() => void responder(c.id, 'accept')}
                        className="btn-primary !py-1.5 !px-3 text-[12.5px] disabled:opacity-50"
                      >
                        Aceitar
                      </button>
                      <button
                        type="button"
                        disabled={respondendo === c.id}
                        onClick={() => void responder(c.id, 'decline')}
                        className="rounded-lg border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-faint transition-colors hover:border-burgundy/40 hover:text-burgundy disabled:opacity-50"
                      >
                        Recusar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : firm ? (
            <>
              <p className="font-display text-[17px] font-semibold leading-tight text-ink">{firm.name}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                {firm.seats
                  ? `${firm.seats.used} de ${firm.seats.purchased} assentos em uso.`
                  : 'Sua sociedade de advogados.'}{' '}
                Convide advogados e cuide da página institucional.
              </p>
              {pendentes > 0 && (
                <Link
                  to="/escritorio/solicitacoes"
                  className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-burgundy/25 bg-burgundy/[0.06] px-3 py-2.5 transition-colors hover:border-burgundy/50"
                >
                  <span className="text-[13px] font-medium text-ink">
                    {pendentes === 1
                      ? '1 pedido esperando resposta'
                      : `${pendentes} pedidos esperando resposta`}
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold text-burgundy">Ver</span>
                </Link>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/escritorio/editar" className="btn-primary !py-2 !px-4 text-[13px]">
                  Gerenciar escritório
                </Link>
                {firm.slug && (
                  <Link
                    to={`/escritorio/${firm.slug}`}
                    className="btn-ghost !px-4 !py-2 text-[13px]"
                  >
                    Ver página
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-[17px] font-semibold leading-tight text-ink">Tem uma sociedade de advogados?</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                Crie a página institucional do escritório e convide os advogados pelo e-mail deles.
                Cada um mantém o próprio perfil.
              </p>
              <Link
                to="/escritorio/editar"
                className="btn-ghost mt-3 !px-4 !py-2 text-[13px]"
              >
                Criar escritório
              </Link>
            </>
          )}
          {erro && (
            <p role="alert" className="mt-2 text-[12.5px] font-medium text-burgundy">
              {erro}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
