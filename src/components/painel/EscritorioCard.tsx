import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Firm, FirmInvite } from '@/lib/escritorio'
import { ScaleIcon } from '@/components/ui/icons'

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
    <div className="mt-3 rounded-xl2 border border-ink/10 bg-paper p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-lg bg-burgundy/[0.07] p-2 text-burgundy">
          <ScaleIcon width={18} height={18} />
        </span>
        <div className="min-w-0 flex-1">
          {invites.length > 0 ? (
            <>
              <p className="text-[14px] font-medium text-ink">
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
              <p className="text-[14px] font-medium text-ink">{firm.name}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                {firm.seats
                  ? `${firm.seats.used} de ${firm.seats.purchased} assentos em uso.`
                  : 'Sua sociedade de advogados.'}{' '}
                Convide advogados e cuide da página institucional.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/escritorio/editar" className="btn-primary !py-1.5 !px-3 text-[12.5px]">
                  Gerenciar escritório
                </Link>
                {firm.slug && (
                  <Link
                    to={`/escritorio/${firm.slug}`}
                    className="rounded-lg border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-faint transition-colors hover:border-burgundy/40 hover:text-burgundy"
                  >
                    Ver página
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-[14px] font-medium text-ink">Tem uma sociedade de advogados?</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                Crie a página institucional do escritório e convide os advogados pelo e-mail deles.
                Cada um mantém o próprio perfil.
              </p>
              <Link
                to="/escritorio/editar"
                className="mt-3 inline-block rounded-lg border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-burgundy/40 hover:text-burgundy"
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
