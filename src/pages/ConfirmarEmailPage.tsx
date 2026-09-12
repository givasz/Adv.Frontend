// Confirmar o e-mail, pelo link da mensagem.
//
// Não exige sessão: o link costuma ser aberto no celular, e a conta foi criada
// no computador. A confirmação sai sozinha ao abrir a página — pedir mais um
// clique para dizer "sim, sou eu" depois de a pessoa já ter clicado no e-mail
// seria um passo que só existe para ser pulado.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SubPage } from '@/components/ui/SubPage'
import { confirmarEmail, reenviarConfirmacaoDeEmail, useAuth } from '@/lib/auth'
import { esquecerTokenDoLink, lerTokenDoLink } from '@/lib/linkDeEmail'
import { CheckIcon, MailIcon } from '@/components/ui/icons'

export default function ConfirmarEmailPage() {
  const { isAuthed } = useAuth()
  const [token] = useState(() => lerTokenDoLink())
  const [estado, setEstado] = useState<'confirmando' | 'pronto' | 'falhou'>(token ? 'confirmando' : 'falhou')
  const [erro, setErro] = useState<string | null>(
    token ? null : 'Esta página abre pelo link da mensagem que mandamos para o seu e-mail.',
  )
  const [reenvio, setReenvio] = useState<'parado' | 'enviando' | 'enviado'>('parado')
  // O modo estrito do React roda o efeito duas vezes em desenvolvimento, e o link
  // é de uso único: a segunda chamada responderia "já foi usado" por cima do
  // "confirmado" da primeira.
  const pedido = useRef(false)

  useEffect(() => {
    if (!token || pedido.current) return
    pedido.current = true
    confirmarEmail(token)
      .then(() => {
        esquecerTokenDoLink()
        setEstado('pronto')
      })
      .catch((e: unknown) => {
        setErro(e instanceof Error ? e.message : 'Não foi possível confirmar agora.')
        setEstado('falhou')
      })
  }, [token])

  async function mandarOutro() {
    setReenvio('enviando')
    try {
      const { jaConfirmado } = await reenviarConfirmacaoDeEmail()
      if (jaConfirmado) setEstado('pronto')
      else setReenvio('enviado')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar agora.')
      setReenvio('parado')
    }
  }

  return (
    <SubPage
      title="Confirmar e-mail"
      icon={<MailIcon width={20} height={20} />}
      backTo={isAuthed ? '/painel' : '/entrar'}
      backLabel={isAuthed ? 'Painel' : 'Entrar'}
    >
      {estado === 'confirmando' ? (
        <p role="status" className="flex items-center gap-2.5 text-[14px] text-ink-soft">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" aria-hidden />
          Confirmando…
        </p>
      ) : estado === 'pronto' ? (
        <div className="rounded-xl2 border border-brass/40 bg-brass/[0.08] px-4 py-4">
          <p className="flex items-center gap-2 font-display text-[16px] font-semibold text-brass-deep">
            <CheckIcon width={17} height={17} strokeWidth={2.6} />
            E-mail confirmado.
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            É por ele que chegam os avisos da sua conta: troca de senha, decisões sobre o seu perfil e mudanças
            nos Termos.
          </p>
          <Link to={isAuthed ? '/painel' : '/entrar'} className="btn-primary mt-4 inline-flex">
            {isAuthed ? 'Ir para o painel' : 'Entrar na minha conta'}
          </Link>
        </div>
      ) : (
        <div className="rounded-xl2 border border-ink/15 bg-paper-soft px-4 py-4 text-[13.5px] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">Não deu para confirmar com este link.</p>
          {erro && <p className="mt-1.5">{erro}</p>}
          {isAuthed ? (
            reenvio === 'enviado' ? (
              <p className="mt-3 font-medium text-brass-deep">
                Link novo enviado. Confira a caixa de entrada e o spam.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void mandarOutro()}
                disabled={reenvio === 'enviando'}
                className="btn-primary mt-4 !py-2 text-[13px] disabled:opacity-60"
              >
                {reenvio === 'enviando' ? 'Enviando…' : 'Mandar outro link'}
              </button>
            )
          ) : (
            <p className="mt-3">
              Para receber outro link,{' '}
              <Link to="/entrar?next=%2Fpainel" className="font-semibold text-burgundy underline underline-offset-2">
                entre na sua conta
              </Link>{' '}
              — o pedido fica no topo do painel.
            </p>
          )}
        </div>
      )}
    </SubPage>
  )
}
