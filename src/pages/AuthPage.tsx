import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { login, signup, useAuth } from '@/lib/auth'
import { passwordStrength } from '@/lib/passwordStrength'
import { ArrowRight, CheckIcon, EyeIcon, EyeOffIcon, ScaleIcon, SparkIcon } from '@/components/ui/icons'
import { caminhoDeVolta } from '@/components/ui/SubPage'

type Mode = 'login' | 'signup'

// Página de autenticação (rota própria — sem modal). Serve tanto para /entrar
// quanto para /criar-conta, alternando o modo internamente. Após entrar, volta
// para o `?next=` (ex.: /editor?plan=pro) ou para o painel.
//
// Layout em duas colunas no desktop: à esquerda o timbre e o que a conta serve,
// à direita o formulário. Uma tela de cadastro sozinha no meio do nada é onde
// mais gente desiste — ao lado do motivo, ela deixa de ser um pedágio.

const BENEFICIOS = [
  'Seu perfil guardado para editar quando quiser',
  'Conferência de conformidade antes de publicar',
  'Assinatura dos planos pagos ligada à sua conta',
]

export default function AuthPage({ mode: initialMode }: { mode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [touchedPw, setTouchedPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthed } = useAuth()
  // Sem ?next, cai no painel — que redireciona ao onboarding se ainda não há perfil.
  // Mesma trava do `?voltar=`: `next` vem da URL e é para onde a pessoa cai
  // JÁ LOGADA. Sem validar, um link `/entrar?next=https://site-falso` mandava o
  // advogado recém-autenticado direto para a página de quem montou o link.
  const next = caminhoDeVolta(params.get('next'), '/painel')
  const isSignup = mode === 'signup'

  const strength = useMemo(() => passwordStrength(password, email), [password, email])
  const mismatch = isSignup && confirm.length > 0 && confirm !== password
  const canSubmit =
    !busy &&
    email.trim().length > 0 &&
    password.length > 0 &&
    (!isSignup || (strength.acceptable && confirm === password))

  useEffect(() => {
    document.title = `${isSignup ? 'Criar conta' : 'Entrar'} · advoc.me`
  }, [isSignup])

  // Já logado? Não faz sentido ficar aqui — segue para o destino.
  useEffect(() => {
    if (isAuthed) navigate(next, { replace: true })
  }, [isAuthed, navigate, next])

  function swapMode() {
    setError(null)
    setConfirm('')
    setTouchedPw(false)
    setMode(isSignup ? 'login' : 'signup')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (isSignup) await signup(email, password, name, remember)
      else await login(email, password, remember)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.')
      setBusy(false)
    }
  }

  return (
    <div className="grain flex min-h-dvh flex-col bg-paper-deep">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold">
          <ScaleIcon width={22} height={22} className="text-burgundy" />
          advoc.me
        </Link>
        <Link to="/" className="-my-2 inline-block py-2 text-[13px] font-medium text-ink-faint hover:text-ink">
          ‹ Voltar ao site
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-6">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1fr_minmax(0,26rem)]">
          {/* Coluna editorial — só no desktop, onde há espaço de sobra */}
          <div className="hidden lg:block">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-[12.5px] font-semibold text-brass-deep">
              <CheckIcon width={14} height={14} />
              Dentro das regras da OAB
            </span>
            <h2 className="mt-5 max-w-sm font-display text-[38px] font-semibold leading-[1.06] tracking-tight text-ink">
              {isSignup ? (
                <>
                  Seu perfil começa
                  <br />
                  <span className="italic text-burgundy">com uma conta.</span>
                </>
              ) : (
                <>
                  Bom te ver
                  <br />
                  <span className="italic text-burgundy">de volta.</span>
                </>
              )}
            </h2>
            <div className="rule-brass mt-6 w-24" />
            <ul className="mt-6 space-y-3">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-soft">
                  <CheckIcon
                    width={15}
                    height={15}
                    strokeWidth={2.4}
                    className="mt-0.5 shrink-0 text-brass-deep"
                  />
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-7 flex items-center gap-2 text-[12.5px] text-ink-faint">
              <SparkIcon width={14} height={14} className="text-brass-deep" />
              Grátis no plano Free · sem cartão
            </p>
          </div>

          {/* Cartão do formulário */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full rounded-2xl border border-ink/10 bg-paper p-6 shadow-lift sm:p-7"
          >
            <h1 className="font-display text-[26px] font-semibold leading-tight text-ink">
              {isSignup ? 'Criar sua conta' : 'Entrar'}
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
              {isSignup
                ? 'Leva menos de um minuto e não pede cartão.'
                : 'Acesse para editar seu perfil e gerenciar sua assinatura.'}
            </p>

            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              {isSignup && (
                <Field label="Nome completo" hint="opcional" id="nome">
                  <input
                    id="nome"
                    type="text"
                    value={name}
                    autoComplete="name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como aparece na sua inscrição"
                    className={inputClass}
                  />
                </Field>
              )}

              <Field label="E-mail" id="email">
                <input
                  id="email"
                  type="email"
                  value={email}
                  required
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  autoCapitalize="none"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className={inputClass}
                />
              </Field>

              <Field label="Senha" id="senha">
                <PasswordInput
                  id="senha"
                  value={password}
                  onChange={(v) => setPassword(v)}
                  onBlur={() => setTouchedPw(true)}
                  visible={showPw}
                  onToggle={() => setShowPw((v) => !v)}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  invalid={isSignup && touchedPw && password.length > 0 && !strength.acceptable}
                />
              </Field>

              {/* A barra só existe no cadastro: no login ela seria um julgamento
                  inútil sobre uma senha que a pessoa já tem. */}
              {isSignup && password.length > 0 && <StrengthMeter strength={strength} />}

              {isSignup && (
                <Field label="Repetir a senha" id="confirmar">
                  <PasswordInput
                    id="confirmar"
                    value={confirm}
                    onChange={(v) => setConfirm(v)}
                    visible={showConfirm}
                    onToggle={() => setShowConfirm((v) => !v)}
                    autoComplete="new-password"
                    invalid={mismatch}
                    describedBy={mismatch ? 'confirm-erro' : undefined}
                  />
                  <p id="confirm-erro" aria-live="polite" className="mt-1.5 text-[12px]">
                    {mismatch && <span className="text-burgundy">As senhas não são iguais.</span>}
                    {!mismatch && confirm.length > 0 && (
                      <span className="inline-flex items-center gap-1 font-medium text-brass-deep">
                        <CheckIcon width={12} height={12} strokeWidth={2.6} />
                        Conferem.
                      </span>
                    )}
                  </p>
                </Field>
              )}

              <RememberMe checked={remember} onChange={setRemember} />

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-burgundy-deep"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Aguarde…' : isSignup ? 'Criar conta' : 'Entrar'}
                {!busy && <ArrowRight width={18} height={18} />}
              </button>
            </form>

            <p className="mt-5 text-center text-[13px] text-ink-soft">
              {isSignup ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
              <button
                type="button"
                onClick={swapMode}
                className="-my-1 inline-block px-1 py-2 font-semibold text-burgundy hover:underline"
              >
                {isSignup ? 'Entrar' : 'Criar conta'}
              </button>
            </p>

            <p className="mt-5 border-t border-ink/10 pt-4 text-center text-[11.5px] leading-relaxed text-ink-faint">
              Ao continuar você concorda com os{' '}
              <Link to="/legal" className="underline underline-offset-2 hover:text-ink">
                termos e a política de privacidade
              </Link>
              .
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  )
}

/**
 * "Continuar conectado" — marcado por padrão.
 *
 * Marcado, a sessão vive num cookie com prazo próprio e volta depois de fechar o
 * navegador; é o que se espera de uma ferramenta de trabalho, e evita a fricção
 * de logar toda manhã. Desmarcado, o cookie morre junto com a janela — que é o
 * comportamento certo num computador emprestado ou no lobby de um fórum.
 *
 * A frase abaixo do rótulo existe porque "lembrar de mim" não diz a ninguém o que
 * acontece de fato; "continua conectado neste aparelho" diz.
 */
function RememberMe({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ink/25 text-burgundy accent-burgundy focus:ring-2 focus:ring-burgundy/20"
      />
      <span className="text-[12.5px] leading-snug text-ink-soft">
        <span className="font-medium text-ink">Continuar conectado neste aparelho</span>
        <br />
        {checked
          ? 'Você segue logado ao fechar e reabrir o navegador.'
          : 'A sessão termina quando você fechar o navegador.'}
      </span>
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

/**
 * Campo de senha com o olho para revelar.
 *
 * O botão fica DENTRO do campo mas fora do <input>, com aria-label que muda de
 * "Mostrar" para "Ocultar": um ícone que troca de desenho sem trocar de nome
 * deixa quem usa leitor de tela sem saber em que estado está. `aria-pressed`
 * completa, dizendo se a senha está visível agora.
 */
function PasswordInput({
  id,
  value,
  onChange,
  onBlur,
  visible,
  onToggle,
  autoComplete,
  invalid = false,
  describedBy,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  visible: boolean
  onToggle: () => void
  autoComplete: string
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        spellCheck={false}
        autoCapitalize="none"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder="••••••••"
        className={`${inputClass} pr-12 ${invalid ? '!border-burgundy/60' : ''}`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
      >
        {visible ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
      </button>
    </div>
  )
}

/**
 * Barra de força + a PRÓXIMA coisa a corrigir.
 *
 * Mostrar só "fraca" não ajuda ninguém: a pessoa fica adivinhando o que falta.
 * Por isso a dica é uma frase específica ("Evite sequências como 1234"), vinda da
 * mesma função que decide se o cadastro passa (lib/passwordStrength.ts).
 */
function StrengthMeter({ strength }: { strength: ReturnType<typeof passwordStrength> }) {
  const cor =
    strength.score <= 1
      ? 'bg-burgundy'
      : strength.score === 2
        ? 'bg-brass'
        : 'bg-brass-deep'
  const dica = strength.problems[0]

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex h-1.5 flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={`h-full flex-1 rounded-full transition-colors duration-300 ${
                n <= strength.score ? cor : 'bg-ink/10'
              }`}
            />
          ))}
        </span>
        <span
          className={`shrink-0 text-[11.5px] font-semibold ${
            strength.score <= 1 ? 'text-burgundy' : 'text-brass-deep'
          }`}
        >
          {strength.label}
        </span>
      </div>
      {/* aria-live: quem não vê a barra ouve a dica mudar enquanto digita. */}
      <p aria-live="polite" className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
        {dica ?? 'Pode seguir — essa senha é difícil de adivinhar.'}
      </p>
    </div>
  )
}

function Field({
  label,
  hint,
  id,
  children,
}: {
  label: string
  hint?: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="block">
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-ink">{label}</span>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </label>
      {children}
    </div>
  )
}
