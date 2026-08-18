import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { login, signup, useAuth } from '@/lib/auth'
import { ArrowRight, ScaleIcon } from '@/components/ui/icons'

type Mode = 'login' | 'signup'

// Página de autenticação (rota própria — sem modal). Serve tanto para /entrar
// quanto para /criar-conta, alternando o modo internamente. Após entrar, volta
// para o `?next=` (ex.: /editor?plan=pro) ou para a home.
export default function AuthPage({ mode: initialMode }: { mode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthed } = useAuth()
  // Sem ?next, cai no painel — que redireciona ao onboarding se ainda não há perfil.
  const next = params.get('next') || '/painel'
  const isSignup = mode === 'signup'

  useEffect(() => {
    document.title = `${isSignup ? 'Criar conta' : 'Entrar'} · advoc.me`
  }, [isSignup])

  // Já logado? Não faz sentido ficar aqui — segue para o destino.
  useEffect(() => {
    if (isAuthed) navigate(next, { replace: true })
  }, [isAuthed, navigate, next])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (isSignup) await signup(email, password, name)
      else await login(email, password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.')
      setBusy(false)
    }
  }

  return (
    <div className="grain flex min-h-dvh flex-col bg-paper-deep">
      {/* Topo */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold">
          <ScaleIcon width={22} height={22} className="text-burgundy" />
          advoc.me
        </Link>
      </header>

      {/* Cartão central */}
      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-2xl border border-ink/10 bg-paper p-7 shadow-lift sm:p-8"
        >
          <h1 className="font-display text-2xl font-semibold text-ink">
            {isSignup ? 'Criar sua conta' : 'Entrar'}
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            {isSignup
              ? 'Crie sua conta para montar, publicar e editar seu perfil. É grátis no plano Free e leva menos de um minuto.'
              : 'Acesse sua conta para editar seu perfil e gerenciar sua assinatura.'}
          </p>

          <form className="mt-6 space-y-3.5" onSubmit={submit}>
            {isSignup && (
              <Field label="Nome completo" hint="opcional">
                <input
                  type="text"
                  value={name}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como aparece na sua inscrição"
                  className={inputClass}
                />
              </Field>
            )}
            <Field label="E-mail">
              <input
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className={inputClass}
              />
            </Field>
            <Field label="Senha" hint="mínimo 6 caracteres">
              <input
                type="password"
                value={password}
                required
                minLength={6}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </Field>

            {error && (
              <p className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Aguarde…' : isSignup ? 'Criar conta' : 'Entrar'}
              {!busy && <ArrowRight width={18} height={18} />}
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-ink-soft">
            {isSignup ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
            <button
              type="button"
              onClick={() => {
                setError(null)
                setMode(isSignup ? 'login' : 'signup')
              }}
              className="font-semibold text-burgundy hover:underline"
            >
              {isSignup ? 'Entrar' : 'Criar conta'}
            </button>
          </p>

          <p className="mt-5 border-t border-ink/10 pt-4 text-center text-[11.5px] leading-relaxed text-ink-faint">
            A conta é necessária para criar e gerenciar seu perfil — <span className="font-medium">grátis</span>{' '}
            no plano Free. Ela guarda seu perfil para você editar depois e assinar os planos pagos.
          </p>
        </motion.div>
      </main>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-ink">{label}</span>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
