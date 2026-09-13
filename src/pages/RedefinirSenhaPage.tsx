// Criar a senha nova, a partir do link do e-mail.
//
// O link vale uma hora e funciona uma vez. Salvar derruba TODOS os aparelhos
// conectados — inclusive este, se havia sessão aberta — e a tela diz isso antes
// do botão: quem pede redefinição pode estar fugindo de alguém que está dentro
// da conta, e é bom saber que essa pessoa sai junto.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SubPage } from '@/components/ui/SubPage'
import { CampoSenha } from '@/components/ui/CampoSenha'
import { redefinirSenha } from '@/lib/auth'
import { esquecerTokenDoLink, lerTokenDoLink } from '@/lib/linkDeEmail'
import { passwordStrength } from '@/lib/passwordStrength'
import { CheckIcon, LockIcon } from '@/components/ui/icons'

export default function RedefinirSenhaPage() {
  const [token] = useState(() => lerTokenDoLink())
  const [nova, setNova] = useState('')
  const [repetir, setRepetir] = useState('')
  // Um olho por campo, como na tela de entrada (ver components/ui/CampoSenha).
  const [verNova, setVerNova] = useState(false)
  const [verRepetir, setVerRepetir] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  const forca = useMemo(() => passwordStrength(nova, ''), [nova])
  const diferentes = repetir.length > 0 && repetir !== nova
  const podeSalvar = !!token && !ocupado && forca.acceptable && nova === repetir

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar || !token) return
    setOcupado(true)
    setErro(null)
    try {
      await redefinirSenha(token, nova)
      esquecerTokenDoLink()
      setPronto(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar a senha nova.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <SubPage
      title="Criar senha nova"
      icon={<LockIcon width={20} height={20} />}
      backTo="/entrar"
      backLabel="Entrar"
      documentTitle="Senha nova"
    >
      {pronto ? (
        <div className="rounded-xl2 border border-brass/40 bg-brass/[0.08] px-4 py-4">
          <p className="flex items-center gap-2 font-display text-[16px] font-semibold text-brass-deep">
            <CheckIcon width={17} height={17} strokeWidth={2.6} />
            Senha nova salva.
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            Todos os aparelhos que estavam conectados saíram da conta. Mandamos um aviso da troca para o seu
            e-mail.
          </p>
          <Link to="/entrar" className="btn-primary mt-4 inline-flex">
            Entrar com a senha nova
          </Link>
        </div>
      ) : !token ? (
        <div className="rounded-xl2 border border-ink/15 bg-paper-soft px-4 py-4 text-[13.5px] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">Esta página abre pelo link do e-mail.</p>
          <p className="mt-1.5">
            Use o botão da mensagem que mandamos — ou peça um link novo, se aquele já venceu.
          </p>
          <Link to="/esqueci-senha" className="btn-primary mt-4 inline-flex !py-2 text-[13px]">
            Pedir um link novo
          </Link>
        </div>
      ) : (
        <form onSubmit={salvar} noValidate>
          <label htmlFor="n-senha" className="mb-1.5 block text-[13px] font-semibold text-ink">
            Senha nova
          </label>
          <CampoSenha
            id="n-senha"
            value={nova}
            onChange={setNova}
            visible={verNova}
            onToggle={() => setVerNova((v) => !v)}
            autoComplete="new-password"
            describedBy="n-dica"
          />
          <p id="n-dica" aria-live="polite" className="mt-1.5 min-h-[1.2em] text-[12px] leading-relaxed text-ink-faint">
            {nova.length > 0 &&
              (forca.problems[0] ?? (
                <span className="font-medium text-brass-deep">Pode seguir — essa senha é difícil de adivinhar.</span>
              ))}
          </p>

          <label htmlFor="n-repetir" className="mb-1.5 mt-3 block text-[13px] font-semibold text-ink">
            Repetir a senha nova
          </label>
          <CampoSenha
            id="n-repetir"
            value={repetir}
            onChange={setRepetir}
            visible={verRepetir}
            onToggle={() => setVerRepetir((v) => !v)}
            autoComplete="new-password"
            invalid={diferentes}
            describedBy="n-repetir-situacao"
          />
          <p id="n-repetir-situacao" aria-live="polite" className="mt-1.5 min-h-[1.2em] text-[12px]">
            {diferentes && <span className="text-burgundy">As senhas não são iguais.</span>}
            {!diferentes && repetir.length > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-brass-deep">
                <CheckIcon width={12} height={12} strokeWidth={2.6} />
                Conferem.
              </span>
            )}
          </p>

          <p className="mt-4 rounded-lg border border-ink/10 bg-paper-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
            Ao salvar, todos os aparelhos conectados saem da conta — inclusive o de quem estiver usando sem a sua
            autorização.
          </p>

          {erro && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] leading-relaxed text-burgundy-deep"
            >
              {erro}{' '}
              {/link/i.test(erro) && (
                <Link to="/esqueci-senha" className="font-semibold underline underline-offset-2">
                  Pedir um link novo
                </Link>
              )}
            </div>
          )}

          <button type="submit" disabled={!podeSalvar} className="btn-primary mt-4 w-full disabled:opacity-50">
            {ocupado ? 'Salvando…' : 'Salvar senha nova'}
          </button>
        </form>
      )}
    </SubPage>
  )
}
