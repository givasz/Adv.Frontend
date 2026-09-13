import { EyeIcon, EyeOffIcon } from './icons'

// Campo de senha com o olho para revelar — o mesmo na entrada, no cadastro e na
// senha nova pelo link do e-mail.
//
// Um olho por campo, e não uma caixa "mostrar as senhas" valendo para todos: é o
// gesto que as pessoas já conhecem de todo aplicativo, e revela só o campo que a
// pessoa quer conferir.
//
// O botão fica DENTRO do campo mas fora do <input>, com aria-label que muda de
// "Mostrar" para "Ocultar": um ícone que troca de desenho sem trocar de nome
// deixa quem usa leitor de tela sem saber em que estado está. `aria-pressed`
// completa, dizendo se a senha está visível agora.

const CAMPO =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

export function CampoSenha({
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
        className={`${CAMPO} pr-12 ${invalid ? '!border-burgundy/60' : ''}`}
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
