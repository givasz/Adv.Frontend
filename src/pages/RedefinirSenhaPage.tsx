// Criar a senha nova, a partir do link do e-mail.
//
// O link vale uma hora e funciona uma vez. Salvar derruba TODOS os aparelhos
// conectados — inclusive este, se havia sessão aberta — e a tela diz isso antes
// do botão: quem pede redefinição pode estar fugindo de alguém que está dentro
// da conta, e é bom saber que essa pessoa sai junto.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SubPage } from '@/components/ui/SubPage'
import { redefinirSenha } from '@/lib/auth'
import { esquecerTokenDoLink, lerTokenDoLink } from '@/lib/linkDeEmail'
import { passwordStrength } from '@/lib/passwordStrength'
import { CheckIcon, LockIcon } from '@/components/ui/icons'

const campo =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

export default function RedefinirSenhaPage() {
  const [token] = useState(() => lerTokenDoLink())
  const [nova, setNova] = useState('')
  const [repetir, setRepetir] = useState('')
  const [mostrar, setMostrar] = useState(false)
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
          <input
            id="n-senha"
            type={mostrar ? 'text' : 'password'}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="none"
            aria-describedby="n-dica"
            className={campo}
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
          <input
            id="n-repetir"
            type={mostrar ? 'text' : 'password'}
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="none"
            aria-invalid={diferentes}
            className={`${campo} ${diferentes ? '!border-burgundy/60' : ''}`}
          />
          <p aria-live="polite" className="mt-1.5 min-h-[1.2em] text-[12px]">
            {diferentes && <span className="text-burgundy">As senhas não são iguais.</span>}
          </p>

          <label className="mt-1 flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-soft">
            <input
              type="checkbox"
              checked={mostrar}
              onChange={(e) => setMostrar(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-burgundy"
            />
            Mostrar as senhas
          </label>

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
