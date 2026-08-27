// Os degraus que alcançam a CONTA, não só a página.
//
// Até esta fase o painel parava no perfil: dava para tirar a página do ar e não
// dava para impedir que a mesma pessoa publicasse outra no dia seguinte com a
// inscrição de um terceiro. Estes são os degraus 4 e 5 de
// docs/politica-de-sancoes.md.
//
// A zona é visualmente separada do resto de propósito. Restringir uma página é
// reversível e cotidiano; suspender uma conta impede alguém de entrar, e
// encerrá-la destrói o endereço que o advogado divulgou no Instagram e imprimiu
// num cartão. A tela precisa dizer isso antes do clique, não depois.

import { useState } from 'react'
import { encerrarConta, reativarConta, suspenderConta, type ContaFicha } from '@/lib/adminApi'
import { entrada, fmtData } from './pecas'
import { LockIcon } from '@/components/ui/icons'

export default function AcoesDaConta({
  conta,
  motivo,
  onMudou,
  onErro,
}: {
  conta: ContaFicha
  /** O mesmo motivo escrito na coluna da decisão — um texto só para tudo. */
  motivo: string
  onMudou: () => void
  onErro: (m: string) => void
}) {
  const [dias, setDias] = useState('30')
  const [confirmacao, setConfirmacao] = useState('')
  const [encerrando, setEncerrando] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const semMotivo = motivo.trim().length < 5
  const suspensa = !!conta.suspendedUntil && new Date(conta.suspendedUntil).getTime() > Date.now()
  const encerrada = !!conta.closedAt

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true)
    try {
      await fn()
      setConfirmacao('')
      setEncerrando(false)
      onMudou()
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Não deu para aplicar.')
    } finally {
      setOcupado(false)
    }
  }

  if (encerrada) {
    return (
      <div className="mb-4 rounded-xl2 border border-burgundy/40 bg-burgundy/[0.07] px-3 py-3">
        <p className="text-[13px] font-semibold text-burgundy-deep">
          Conta encerrada em {fmtData(conta.closedAt)}
        </p>
        {conta.closedReason && (
          <p className="mt-1 text-[12.5px] text-ink-soft">“{conta.closedReason}”</p>
        )}
        <p className="mt-2 text-[11.5px] text-ink-faint">
          O endereço público foi liberado. Reabrir uma conta encerrada não é feito
          por aqui — o caminho é o suporte, com registro do pedido.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-xl2 border border-ink/15 bg-paper px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        <LockIcon width={13} height={13} className="text-ink-faint" />
        <span className="font-mono text-ink-soft">{conta.email}</span>
        <span className="text-ink-faint">· conta desde {fmtData(conta.createdAt)}</span>
        {conta.sessoes > 0 && (
          <span className="text-ink-faint">· {conta.sessoes} sessão(ões) aberta(s)</span>
        )}
      </div>

      {suspensa ? (
        <>
          <p className="mb-2 rounded-lg border border-brass/40 bg-brass/10 px-2.5 py-2 text-[12.5px] text-brass-deep">
            <strong>Suspensa até {fmtData(conta.suspendedUntil)}.</strong> O login
            não funciona e o perfil está fora do ar.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void acao(() => reativarConta(conta.id, motivo.trim()))}
              disabled={ocupado || semMotivo}
              className="rounded-full border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-ink/[0.06] disabled:text-ink-faint"
            >
              Reativar a conta
            </button>
            <button
              onClick={() => setEncerrando((v) => !v)}
              className="rounded-full border border-burgundy/40 px-3 py-1.5 text-[12.5px] font-medium text-burgundy-deep transition-colors hover:bg-burgundy/10"
            >
              {encerrando ? 'Cancelar' : 'Encerrar definitivamente…'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[9rem] flex-1">
              <label
                htmlFor={`susp-${conta.id}`}
                className="mb-1 block text-[11.5px] font-medium text-ink"
              >
                Suspender por
              </label>
              <select
                id={`susp-${conta.id}`}
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                className={`${entrada} py-1.5 text-[12.5px]`}
              >
                <option value="7">7 dias</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias (padrão)</option>
                <option value="90">90 dias</option>
              </select>
            </div>
            <button
              onClick={() => void acao(() => suspenderConta(conta.id, motivo.trim(), Number(dias)))}
              disabled={ocupado || semMotivo}
              className="rounded-full bg-burgundy px-4 py-2 text-[12.5px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep disabled:cursor-not-allowed disabled:bg-ink/[0.06] disabled:text-ink-faint"
            >
              Suspender a conta
            </button>
          </div>
          <p className="text-[11.5px] leading-snug text-ink-faint">
            O login para de funcionar e o perfil sai do ar. Se o plano for pago, a
            cobrança é suspensa junto. Cabe em fraude de identidade, burla
            reiterada ou uso para fim ilícito.
          </p>
        </>
      )}

      {encerrando && (
        <div className="mt-3 rounded-lg border border-burgundy/40 bg-burgundy/[0.06] px-3 py-3">
          <p className="mb-2 text-[12.5px] leading-relaxed text-burgundy-deep">
            <strong>Isto é definitivo.</strong> A conta é encerrada, o perfil sai
            do ar e o endereço <span className="font-mono">advoc.me/{conta.perfil?.slug}</span>{' '}
            é liberado para outra pessoa. O registro da decisão permanece.
          </p>
          <label
            htmlFor={`conf-${conta.id}`}
            className="mb-1 block text-[11.5px] font-medium text-ink"
          >
            Digite <span className="font-mono">{conta.email}</span> para confirmar
          </label>
          <input
            id={`conf-${conta.id}`}
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={`${entrada} mb-2 py-1.5 text-[12.5px]`}
          />
          <button
            onClick={() =>
              void acao(() => encerrarConta(conta.id, motivo.trim(), confirmacao.trim()))
            }
            disabled={ocupado || semMotivo || confirmacao.trim().toLowerCase() !== conta.email.toLowerCase()}
            className="w-full rounded-full bg-burgundy px-4 py-2 text-[12.5px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep disabled:cursor-not-allowed disabled:bg-ink/[0.06] disabled:text-ink-faint"
          >
            Encerrar a conta
          </button>
        </div>
      )}

      {semMotivo && (
        <p className="mt-2 text-[11.5px] text-ink-faint">
          Escreva o motivo na coluna da decisão para liberar estes botões.
        </p>
      )}
    </div>
  )
}
