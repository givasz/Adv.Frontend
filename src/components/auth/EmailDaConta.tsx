import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { corrigirEmailDaConta, reenviarConfirmacaoDeEmail, revalidarSessao, useAuth } from '@/lib/auth'
import { TextInput } from '@/components/editor/fields'
import { MailIcon } from '@/components/ui/icons'

// O E-MAIL DA CONTA, NOS MOMENTOS EM QUE ELE PESA.
//
// Publicar NÃO pede e-mail confirmado (decisão de 14/09/2026). Travar ali poria o
// botão de publicar na dependência da cota diária do provedor de e-mail e da
// pasta de spam, no último passo de quem acabou de preencher cinco telas — e não
// protegeria contra perfil falso, que se cria com um e-mail que existe. Quem
// segura a responsabilidade é a declaração de veracidade e o registro de acesso.
//
// O risco real é outro: o e-mail DIGITADO ERRADO. É por ele que chegam os avisos
// com prazo (suspensão, contestação, cobrança), e o erro só aparece no dia em que
// o aviso não chega. Por isso três peças:
//
//   • ConferirEmailDaConta — na revisão, antes de publicar: mostra o endereço e
//     deixa corrigir. Pega o erro de digitação sem depender de e-mail sair.
//   • ConfirmarEmailCartao — logo depois de publicar (o momento de maior boa
//     vontade) e na assinatura, onde a confirmação É exigida pelo servidor:
//     cobrança presa a um endereço que não funciona é plano caindo em silêncio.
//   • CorrigirEmail — o formulário em linha que as duas usam, e a faixa do topo.
//
// Tudo some quando `emailPending` é falso: e-mail já confirmado, conta do Google
// (que chega confirmada) ou correio desligado — pedir um link que não sai seria
// um pedido que ninguém consegue cumprir.

/** Formulário em linha para corrigir o endereço. Pede a senha: o servidor confere. */
export function CorrigirEmail({
  atual,
  onPronto,
  onCancelar,
}: {
  atual: string
  onPronto: () => void
  onCancelar: () => void
}) {
  // Começa com o endereço de hoje: o erro típico é uma letra (gmial, hotmal), e
  // redigitar tudo é chance de errar outra.
  const [email, setEmail] = useState(atual)
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (salvando) return
    setSalvando(true)
    setErro(null)
    try {
      await corrigirEmailDaConta(email, senha)
      onPronto()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível corrigir agora.')
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="mt-3 space-y-2.5">
      <label className="block">
        <span className="text-[12px] font-medium text-ink-soft">E-mail certo</span>
        <TextInput
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1"
        />
      </label>
      <label className="block">
        <span className="text-[12px] font-medium text-ink-soft">Sua senha, para confirmar que é você</span>
        <TextInput
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1"
        />
      </label>
      {erro && (
        <p
          role="alert"
          className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] leading-relaxed text-burgundy-deep"
        >
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <button type="submit" disabled={salvando} className="btn-primary !py-2 text-[13px] disabled:opacity-60">
          {salvando ? 'Salvando…' : 'Corrigir e mandar o link'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="px-2 py-2 text-[13px] font-medium text-ink-faint hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// `break-words`, e não `break-all`: o endereço desce inteiro para a linha de baixo
// e só se parte quando não cabe nem assim ("marina@gma" / "il.com" confunde quem
// está justamente conferindo se digitou certo).
function Endereco({ children }: { children: ReactNode }) {
  return <strong className="break-words font-semibold text-ink">{children}</strong>
}

/** Na revisão, antes de publicar: "os avisos vão para X — está certo?". Não trava nada. */
export function ConferirEmailDaConta() {
  const { emailPending, user } = useAuth()
  const [corrigindo, setCorrigindo] = useState(false)
  const [corrigido, setCorrigido] = useState(false)

  if (!emailPending || !user) return null

  return (
    <div className="rounded-xl2 border border-ink/10 bg-paper px-3.5 py-3">
      <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-soft">
        <MailIcon width={15} height={15} className="mt-[2px] shrink-0 text-brass-deep" aria-hidden />
        <span className="min-w-0">
          {corrigido ? (
            <>
              Corrigido. O link de confirmação foi para <Endereco>{user.email}</Endereco>.
            </>
          ) : (
            <>
              Os avisos da sua conta vão para <Endereco>{user.email}</Endereco>. Está certo?{' '}
              {!corrigindo && (
                <button
                  type="button"
                  onClick={() => setCorrigindo(true)}
                  className="font-semibold text-burgundy underline underline-offset-2"
                >
                  Corrigir
                </button>
              )}
            </>
          )}
        </span>
      </p>
      {corrigindo && (
        <CorrigirEmail
          atual={user.email}
          onPronto={() => {
            setCorrigindo(false)
            setCorrigido(true)
          }}
          onCancelar={() => setCorrigindo(false)}
        />
      )}
    </div>
  )
}

const TOM_DA_CASA = {
  caixa: 'rounded-xl2 border border-brass/40 bg-brass/[0.08] p-4',
  titulo: 'flex items-center gap-2 font-display text-[15.5px] font-semibold text-ink',
  icone: 'shrink-0 text-brass-deep',
  texto: 'mt-1.5 text-[13px] leading-relaxed text-ink-soft',
  aviso: 'mt-2 text-[12.5px] font-medium leading-relaxed text-burgundy-deep',
  principal: 'btn-primary !py-2 text-[13px] disabled:opacity-60',
  link: 'px-2 py-2 text-[13px] font-semibold text-burgundy hover:underline disabled:opacity-60',
  discreto: 'px-2 py-2 text-[13px] font-medium text-ink-soft hover:text-ink',
}

const TOM_NEUTRO: typeof TOM_DA_CASA = {
  caixa: 'rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 font-ui',
  titulo: 'flex items-center gap-2 font-ui text-[14.5px] font-semibold text-[#0f172a]',
  icone: 'shrink-0 text-[#b45309]',
  texto: 'mt-1.5 text-[13px] leading-relaxed text-[#475569]',
  aviso: 'mt-2 text-[12.5px] font-medium leading-relaxed text-[#b91c1c]',
  principal:
    'h-9 rounded-lg bg-[#0f172a] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1e293b] disabled:opacity-60',
  link: 'px-2 py-2 text-[13px] font-semibold text-[#0f172a] hover:underline disabled:opacity-60',
  discreto: 'px-2 py-2 text-[13px] font-medium text-[#64748b] hover:text-[#0f172a]',
}

/**
 * Cartão "confirme seu e-mail" — na conclusão de /comecar e na assinatura.
 *
 * Na assinatura ele é o que está entre a pessoa e o botão: o servidor recusa
 * subir de plano com o e-mail pendente (ProfilesService.setPlan).
 */
export function ConfirmarEmailCartao({
  contexto,
  className = '',
  neutro = false,
}: {
  contexto: 'publicado' | 'assinar'
  className?: string
  /**
   * Sem o latão e o vinho da casa — para o checkout pago, que tem paleta própria
   * de ambiente financeiro (ver o cabeçalho de CheckoutPago.tsx).
   */
  neutro?: boolean
}) {
  const { emailPending, user } = useAuth()
  const [envio, setEnvio] = useState<'parado' | 'enviando' | 'enviado'>('parado')
  const [corrigindo, setCorrigindo] = useState(false)
  const [conferindo, setConferindo] = useState(false)
  const [aindaNao, setAindaNao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Quem foi abrir o e-mail volta para esta aba. Perguntar ao servidor na volta
  // faz o cartão sumir (e o botão de assinar destravar) sem recarregar a página.
  useEffect(() => {
    if (!emailPending) return
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void revalidarSessao()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [emailPending])

  if (!emailPending || !user) return null

  async function mandar() {
    if (envio === 'enviando') return
    setEnvio('enviando')
    setErro(null)
    setAindaNao(false)
    try {
      await reenviarConfirmacaoDeEmail()
      setEnvio('enviado')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar agora.')
      setEnvio('parado')
    }
  }

  async function jaConfirmei() {
    if (conferindo) return
    setConferindo(true)
    setAindaNao(false)
    setErro(null)
    const sessao = await revalidarSessao()
    setConferindo(false)
    if (sessao?.user?.emailPending) setAindaNao(true)
  }

  const c = neutro ? TOM_NEUTRO : TOM_DA_CASA

  return (
    <div className={`${c.caixa} ${className}`}>
      <p className={c.titulo}>
        <MailIcon width={17} height={17} className={c.icone} aria-hidden />
        {contexto === 'assinar' ? 'Confirme seu e-mail para assinar' : 'Falta confirmar seu e-mail'}
      </p>
      <p className={c.texto}>
        {envio === 'enviado' ? (
          <>
            Link enviado para <Endereco>{user.email}</Endereco>. Confira a caixa de entrada e o spam.
          </>
        ) : contexto === 'assinar' ? (
          <>
            A cobrança e os avisos do plano chegam em <Endereco>{user.email}</Endereco>. Abra o link que mandamos para
            esse endereço (veja também o spam) e volte aqui.
          </>
        ) : (
          <>
            Mandamos um link para <Endereco>{user.email}</Endereco>. É por esse endereço que chegam os avisos da
            conta — procure a mensagem na caixa de entrada ou no spam.
          </>
        )}
      </p>
      {aindaNao && (
        <p className={c.aviso}>
          Ainda não aparece como confirmado. Abra o link mais recente: cada pedido novo substitui o anterior.
        </p>
      )}
      {erro && (
        <p role="alert" className={c.aviso}>
          {erro}
        </p>
      )}
      {corrigindo ? (
        <CorrigirEmail
          atual={user.email}
          onPronto={() => {
            setCorrigindo(false)
            setEnvio('enviado')
          }}
          onCancelar={() => setCorrigindo(false)}
        />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5">
          <button
            type="button"
            onClick={() => void jaConfirmei()}
            disabled={conferindo}
            className={c.principal}
          >
            {conferindo ? 'Conferindo…' : 'Já confirmei'}
          </button>
          {envio !== 'enviado' && (
            <button
              type="button"
              onClick={() => void mandar()}
              disabled={envio === 'enviando'}
              className={c.link}
            >
              {envio === 'enviando' ? 'Enviando…' : 'Mandar outro link'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCorrigindo(true)}
            className={c.discreto}
          >
            Corrigir o e-mail
          </button>
        </div>
      )}
    </div>
  )
}
