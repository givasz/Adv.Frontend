import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { reenviarConfirmacaoDeEmail, useAuth } from '@/lib/auth'
import { CorrigirEmail } from '@/components/auth/EmailDaConta'
import { TELAS_DO_APP } from './AvisoDeTermos'
import { MailIcon } from './icons'

// "Falta confirmar o seu e-mail."
//
// É por esse endereço que chegam os avisos que têm prazo — suspensão, decisão de
// moderação, resposta a uma contestação. Um e-mail digitado errado no cadastro só
// aparece no dia em que o aviso não chega, e aí o prazo já correu. Por isso a
// faixa também deixa CORRIGIR o endereço, e não só reenviar o link para ele.
//
// O QUE ESTA FAIXA NÃO FAZ: não tranca nada. Confirmar é pedido, não pedágio — a
// pessoa monta e publica o perfil do mesmo jeito (a exigência existe só para
// assinar um plano pago; ver ProfilesService.setPlan). Por isso ela também sai da
// frente com "Depois" (até recarregar a página), e some por completo quando a
// faixa dos Termos está na tela: aquela sim trava publicar, e duas faixas
// empilhadas disputam uma atenção que só dá para dar a uma.
//
// Só aparece quando o servidor diz que pode mandar o link (`emailPending` já vem
// falso com o correio desligado): pedir confirmação de um e-mail que não sai
// seria uma faixa que ninguém consegue fazer sumir.

// Telas que tratam do e-mail em linha, no ponto certo do fluxo: a revisão e a
// conclusão de /comecar e o cartão de /assinar (ver auth/EmailDaConta). Com a
// faixa por cima, a mesma frase apareceria duas vezes na mesma tela — e, durante
// a criação do perfil, ela só disputaria atenção com a tarefa.
const TRATAM_EM_LINHA = ['/comecar', '/assinar']

export function AvisoDeEmail() {
  const { emailPending, termsPending, user } = useAuth()
  const { pathname } = useLocation()
  const [adiado, setAdiado] = useState(false)
  const [envio, setEnvio] = useState<'parado' | 'enviando' | 'enviado'>('parado')
  const [corrigindo, setCorrigindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const naRota = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  const naTela = TELAS_DO_APP.some(naRota)
  if (!emailPending || termsPending || adiado || !naTela || TRATAM_EM_LINHA.some(naRota)) return null

  async function mandar() {
    if (envio === 'enviando') return
    setEnvio('enviando')
    setErro(null)
    try {
      await reenviarConfirmacaoDeEmail()
      setEnvio('enviado')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar agora.')
      setEnvio('parado')
    }
  }

  return (
    <div className="border-b border-ink/10 bg-paper-soft">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-2.5">
        <p className="flex min-w-0 items-start gap-2 text-[13px] leading-snug text-ink">
          <MailIcon width={16} height={16} className="mt-px shrink-0 text-brass-deep" aria-hidden />
          {envio === 'enviado' ? (
            <span>
              Link enviado para <strong className="break-all font-semibold">{user?.email}</strong>. Confira a
              caixa de entrada e o spam.
            </span>
          ) : (
            <span>
              Falta confirmar o seu e-mail, <strong className="break-all font-semibold">{user?.email}</strong>{' '}
              <span className="text-ink-soft">— é por ele que chegam os avisos da conta.</span>
            </span>
          )}
        </p>
        {!corrigindo && (
          <div className="flex items-center gap-1">
            {envio !== 'enviado' && (
              <button
                type="button"
                onClick={() => void mandar()}
                disabled={envio === 'enviando'}
                className="-my-1 px-2 py-2 text-[13px] font-semibold text-burgundy hover:underline disabled:opacity-60"
              >
                {envio === 'enviando' ? 'Enviando…' : 'Mandar o link'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCorrigindo(true)}
              className="-my-1 px-2 py-2 text-[13px] font-medium text-ink-soft hover:text-ink"
            >
              Corrigir
            </button>
            <button
              type="button"
              onClick={() => setAdiado(true)}
              className="-my-1 px-2 py-2 text-[13px] font-medium text-ink-faint hover:text-ink"
            >
              Depois
            </button>
          </div>
        )}
      </div>
      {corrigindo && (
        <div className="mx-auto max-w-5xl px-5 pb-3">
          <div className="max-w-sm">
            <CorrigirEmail
              atual={user?.email ?? ''}
              onPronto={() => {
                setCorrigindo(false)
                setEnvio('enviado')
              }}
              onCancelar={() => setCorrigindo(false)}
            />
          </div>
        </div>
      )}
      {erro && (
        <p role="alert" className="mx-auto max-w-5xl px-5 pb-2.5 text-[12.5px] font-medium text-burgundy-deep">
          {erro}
        </p>
      )}
    </div>
  )
}
