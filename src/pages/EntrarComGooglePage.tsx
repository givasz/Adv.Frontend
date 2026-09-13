// A volta do "Continuar com o Google" — /entrar/google.
//
// Quando a pessoa chega aqui, o servidor já conferiu com o Google quem ela é e
// guardou isso num cookie selado (backend src/auth/google.controller.ts). Esta
// tela só pede a sessão e decide o que mostrar:
//
//   • conta que já existe → entra e segue para o destino, sem parar aqui;
//   • conta nova          → pede o aceite dos Termos, com a MESMA caixa do
//                           cadastro — o servidor não cria conta sem ela;
//   • ?erro=…             → diz em português o que houve e mostra o caminho.

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SubPage, caminhoDeVolta } from '@/components/ui/SubPage'
import { AceiteDosTermos } from '@/components/auth/AceiteDosTermos'
import { ArrowRight, LockIcon } from '@/components/ui/icons'
import { concluirGoogle, urlEntrarComGoogle } from '@/lib/auth'

/** Os códigos que o servidor manda na URL (ver `Recusa` no google.controller.ts). */
const ERROS: Record<string, string> = {
  cancelado: 'Você saiu da tela do Google antes de escolher a conta. Nada foi feito.',
  expirou:
    'O pedido de entrada venceu ou foi aberto em outra aba. Tente de novo por aqui — leva poucos segundos.',
  falhou: 'O Google não confirmou a entrada agora. Tente de novo em instantes.',
  email:
    'O Google ainda não confirmou o e-mail dessa conta. Confirme por lá, ou entre com e-mail e senha.',
  desligado: 'A entrada com o Google está desligada no momento. Entre com e-mail e senha.',
  muitas: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
}

type Estado = 'conferindo' | 'aceite' | 'senha-desligada' | 'erro'

export default function EntrarComGooglePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const codigo = params.get('erro')

  const [estado, setEstado] = useState<Estado>(codigo ? 'erro' : 'conferindo')
  const [erro, setErro] = useState<string | null>(codigo ? (ERROS[codigo] ?? ERROS.falhou) : null)
  const [conta, setConta] = useState<{ email: string; nome: string } | null>(null)
  const [aceitou, setAceitou] = useState(false)
  const [criando, setCriando] = useState(false)
  const [destino, setDestino] = useState('/painel')
  // O modo estrito roda o efeito duas vezes em desenvolvimento; a segunda
  // chamada chegaria depois de o selo ter sido gasto e responderia "venceu".
  const pedido = useRef(false)

  async function concluir(aceitouTermos: boolean) {
    const r = await concluirGoogle(aceitouTermos)
    if (r.etapa === 'aceite') {
      setConta({ email: r.email, nome: r.nome })
      setEstado('aceite')
      return
    }
    // Mesma trava do `?next=` da tela de entrada: o destino atravessou o Google
    // e volta do servidor, mas quem decide se é interno é esta função.
    const next = caminhoDeVolta(r.next, '/painel')
    if (r.senhaDesligada) {
      setDestino(next)
      setEstado('senha-desligada')
      return
    }
    navigate(next, { replace: true })
  }

  useEffect(() => {
    if (codigo || pedido.current) return
    pedido.current = true
    concluir(false).catch((e: unknown) => {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar com o Google.')
      setEstado('erro')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo])

  async function criarConta(e: React.FormEvent) {
    e.preventDefault()
    if (!aceitou || criando) return
    setCriando(true)
    setErro(null)
    try {
      await concluir(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
      setCriando(false)
    }
  }

  return (
    <SubPage
      title="Entrar com o Google"
      icon={<LockIcon width={18} height={18} />}
      backTo="/entrar"
      backLabel="Entrar"
    >
      {estado === 'conferindo' && (
        <p role="status" className="flex items-center gap-2.5 text-[14px] text-ink-soft">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" aria-hidden />
          Entrando…
        </p>
      )}

      {estado === 'aceite' && conta && (
        <form onSubmit={criarConta} className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-5" noValidate>
          <h2 className="font-display text-[18px] font-semibold text-ink">
            {conta.nome ? `${conta.nome.split(' ')[0]}, falta um passo` : 'Falta um passo'}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            Ainda não existe conta no advoc.me com <strong className="font-semibold text-ink">{conta.email}</strong>.
            Para criar, confirme abaixo — é o mesmo aceite de quem se cadastra com e-mail e senha.
          </p>
          <div className="mt-4">
            <AceiteDosTermos checked={aceitou} onChange={setAceitou} />
          </div>
          {erro && (
            <p role="alert" className="mt-3 text-[12.5px] font-medium text-burgundy-deep">
              {erro}
            </p>
          )}
          <button
            type="submit"
            disabled={!aceitou || criando}
            className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {criando ? 'Criando…' : 'Criar minha conta'}
            {!criando && <ArrowRight width={18} height={18} />}
          </button>
          <p className="mt-4 text-center text-[12.5px] text-ink-faint">
            Não era esta conta?{' '}
            <a href={urlEntrarComGoogle('/painel', true)} className="font-semibold text-burgundy hover:underline">
              Escolher outra conta Google
            </a>
          </p>
        </form>
      )}

      {estado === 'senha-desligada' && (
        <div className="rounded-xl2 border border-brass/40 bg-brass/[0.08] px-4 py-4">
          <p className="font-display text-[16px] font-semibold text-ink">Você entrou com o Google.</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            Esta conta tinha senha, mas o e-mail dela nunca tinha sido confirmado. Como o Google acabou de confirmar
            que o e-mail é seu, desligamos a senha antiga e encerramos as outras sessões — assim, se alguém tinha
            criado a conta com o seu e-mail, perdeu o acesso. Se quiser uma senha, crie em{' '}
            <Link to="/esqueci-senha" className="font-semibold text-burgundy underline underline-offset-2">
              Esqueci minha senha
            </Link>
            .
          </p>
          <button type="button" onClick={() => navigate(destino, { replace: true })} className="btn-primary mt-4">
            Continuar
            <ArrowRight width={18} height={18} />
          </button>
        </div>
      )}

      {estado === 'erro' && (
        <div className="rounded-xl2 border border-ink/15 bg-paper-soft px-4 py-4 text-[13.5px] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">Não deu para entrar com o Google.</p>
          {erro && <p className="mt-1.5">{erro}</p>}
          <Link to="/entrar" className="btn-primary mt-4 inline-flex !py-2 text-[13px]">
            Voltar para a entrada
          </Link>
        </div>
      )}
    </SubPage>
  )
}
