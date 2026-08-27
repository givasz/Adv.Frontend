// Configurar o segundo fator do painel — três passos numa faixa em linha.
//
// Não é uma tela sobreposta: quem precisa configurar precisa ver a fila atrás,
// e o painel inteiro deixou de usar modal. A faixa fica no topo enquanto o
// segundo fator estiver pendente e some quando ele existir.
//
// O QR é desenhado aqui mesmo, a partir do endereço `otpauth://` que o servidor
// devolveu: nada de imagem vinda de fora — o segredo do segundo fator do painel
// não pode passear por um gerador de QR de terceiros.

import { useState } from 'react'
import { create as createQr } from 'qrcode'
import { totpIniciar, totpLigar } from '@/lib/adminApi'
import { Aviso, Campo, entrada } from './pecas'
import { CheckIcon, LockIcon } from '@/components/ui/icons'

/** QR desenhado como um caminho só — o mesmo truque do cartão impresso. */
function Qr({ texto, lado = 168 }: { texto: string; lado?: number }) {
  let d = ''
  let n = 0
  try {
    const qr = createQr(texto, { errorCorrectionLevel: 'M' })
    n = qr.modules.size
    const data = qr.modules.data
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (data[r * n + c]) d += `M${c} ${r}h1v1h-1z`
      }
    }
  } catch {
    return null
  }
  return (
    <svg
      width={lado}
      height={lado}
      viewBox={`-1 -1 ${n + 2} ${n + 2}`}
      className="rounded-lg bg-white p-1"
      role="img"
      aria-label="Código QR para o aplicativo de autenticação"
    >
      <path d={d} fill="#211c17" shapeRendering="crispEdges" />
    </svg>
  )
}

export default function SegundoFator({ onPronto }: { onPronto: () => void }) {
  const [dados, setDados] = useState<{ segredo: string; otpauth: string } | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function comecar() {
    setOcupado(true)
    setErro(null)
    try {
      setDados(await totpIniciar())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para começar.')
    } finally {
      setOcupado(false)
    }
  }

  async function ligar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    try {
      await totpLigar(codigo)
      onPronto()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Código incorreto.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="mb-5 rounded-xl2 border border-brass/40 bg-brass/[0.07] p-4">
      <div className="mb-2 flex items-center gap-2">
        <LockIcon width={16} height={16} className="text-brass-deep" />
        <h2 className="font-display text-[15px] font-semibold text-ink">
          Configure o segundo fator
        </h2>
      </div>
      <p className="mb-3 max-w-prose text-[13px] text-ink-soft">
        Seu papel decide o que sai do ar. Até o código de 6 dígitos existir, você
        consegue consultar a fila e os chamados — mas nenhuma decisão é aplicada.
      </p>

      {erro && <Aviso>{erro}</Aviso>}

      {!dados ? (
        <button onClick={comecar} disabled={ocupado} className="btn-primary">
          {ocupado ? 'Preparando…' : 'Começar'}
        </button>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Qr texto={dados.otpauth} />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[12.5px] text-ink-soft">
              Leia o código no aplicativo de autenticação do celular (Google
              Authenticator, Authy, ou o gerenciador de senhas que você já usa).
            </p>
            <p className="mb-3 text-[12px] text-ink-faint">
              Sem câmera? Digite este segredo:{' '}
              <code className="select-all break-all font-mono text-[12px] text-ink">
                {dados.segredo}
              </code>
            </p>
            <form onSubmit={ligar} className="max-w-[220px]">
              <Campo id="totp-codigo" label="Código de 6 dígitos">
                <input
                  id="totp-codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`${entrada} font-mono tracking-[0.3em]`}
                />
              </Campo>
              <button
                type="submit"
                disabled={ocupado || codigo.length !== 6}
                className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckIcon width={15} height={15} />
                {ocupado ? 'Conferindo…' : 'Ligar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
