import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { login, signup } from '@/lib/auth'
import { ScaleIcon, XIcon } from '@/components/ui/icons'

type Mode = 'signup' | 'login'

interface AuthModalProps {
  /** modo inicial do formulário */
  initialMode?: Mode
  /** motivo do gate (ex.: assinar um plano pago) — mostrado no topo */
  reason?: string
  onClose: () => void
  /** chamado após cadastro/login bem-sucedido */
  onSuccess: () => void
}

export function AuthModal({ initialMode = 'signup', reason, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signup') await signup(email, password, name)
      else await login(email, password)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.')
      setBusy(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isSignup ? 'Criar conta' : 'Entrar'}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-paper shadow-xl sm:rounded-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
              <ScaleIcon width={18} height={18} />
            </span>
            <div>
              <h2 className="font-display text-[16px] font-semibold text-ink">
                {isSignup ? 'Criar sua conta' : 'Entrar'}
              </h2>
              <p className="text-[12px] text-ink-faint">advoc.me</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink"
          >
            <XIcon width={18} height={18} />
          </button>
        </div>

        <form
          className="flex-1 overflow-y-auto px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          {reason && (
            <div className="mb-4 rounded-xl2 border border-brass/25 bg-brass/[0.06] px-3.5 py-3">
              <p className="text-[12.5px] leading-relaxed text-brass-deep">{reason}</p>
            </div>
          )}

          <div className="space-y-3">
            {isSignup && (
              <Field label="Nome completo (opcional)">
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
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Aguarde…' : isSignup ? 'Criar conta' : 'Entrar'}
          </button>

          <p className="mt-3 text-center text-[12.5px] text-ink-faint">
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

          <p className="mt-3 border-t border-ink/10 pt-3 text-center text-[11px] leading-relaxed text-ink-faint">
            No plano <span className="font-medium">Free</span> a conta é opcional — serve para você
            recuperar e editar seu perfil depois. Nos planos pagos, a conta é necessária para a
            assinatura.
          </p>
        </form>
      </motion.div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

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
