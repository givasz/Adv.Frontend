// "Esqueci minha senha" — o pedido do link.
//
// A tela responde a MESMA coisa exista a conta ou não ("se houver uma conta com
// este e-mail…"). É a regra do servidor, repetida aqui: nem o texto nem o tempo
// dizem a um curioso quais e-mails têm conta na plataforma.
//
// Com o correio desligado no servidor, a tela diz isso em vez de fingir que
// mandou. Um "enviamos o link" que nunca chega faz a pessoa esperar à toa — e
// depois desconfiar de todo e-mail que vier com o nosso nome.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { correioAtivo, pedirRedefinicaoDeSenha } from '@/lib/auth'
import { LockIcon } from '@/components/ui/icons'

const campo =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

export default function EsqueciSenhaPage() {
  const voltar = useVoltar('/entrar')
  const [ativo, setAtivo] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [pedidoPara, setPedidoPara] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    void correioAtivo().then((a) => {
      if (vivo) setAtivo(a)
    })
    return () => {
      vivo = false
    }
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    try {
      await pedirRedefinicaoDeSenha(email)
      setPedidoPara(email.trim().toLowerCase())
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível pedir agora. Tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <SubPage
      title="Esqueci minha senha"
      subtitle="Mandamos um link para o seu e-mail, e por ele você cria uma senha nova."
      icon={<LockIcon width={20} height={20} />}
      backTo={voltar}
    >
      {ativo === false ? (
        <div className="rounded-xl2 border border-ink/15 bg-paper-soft px-4 py-4 text-[13.5px] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">A recuperação por e-mail ainda não está disponível.</p>
          <p className="mt-1.5">
            Se você lembra da senha atual, entre e troque-a em <strong className="text-ink">Seus dados</strong>.
          </p>
          <Link to="/entrar" className="btn-primary mt-4 inline-flex !py-2 text-[13px]">
            Entrar
          </Link>
        </div>
      ) : pedidoPara ? (
        <div className="rounded-xl2 border border-brass/40 bg-brass/[0.08] px-4 py-4">
          <p className="font-display text-[16px] font-semibold text-brass-deep">Pedido recebido.</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            Se houver uma conta com <strong className="break-all text-ink">{pedidoPara}</strong>, o link chega
            em alguns minutos. Ele vale por 1 hora e funciona uma vez só.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">
            Não chegou em alguns minutos? Confira o spam antes de pedir de novo. Vale sempre o link mais
            recente, e dá para pedir até cinco por dia.
          </p>
          <button type="button" onClick={() => setPedidoPara(null)} className="btn-ghost mt-4 !py-2 text-[13px]">
            Pedir de novo
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate>
          <label htmlFor="r-email" className="mb-1.5 block text-[13px] font-semibold text-ink">
            E-mail da conta
          </label>
          <input
            id="r-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            autoCapitalize="none"
            placeholder="voce@exemplo.com"
            className={campo}
          />
          {erro && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep"
            >
              {erro}
            </p>
          )}
          <button
            type="submit"
            disabled={ocupado || ativo === null || !email.trim()}
            className="btn-primary mt-4 w-full disabled:opacity-50"
          >
            {ocupado ? 'Enviando…' : 'Mandar o link'}
          </button>
        </form>
      )}
    </SubPage>
  )
}
