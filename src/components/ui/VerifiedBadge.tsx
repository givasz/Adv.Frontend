import { CheckIcon } from './icons'

// Marca INFORMATIVA de que a plataforma conferiu o número de OAB do perfil.
// NÃO é um selo/chancela oficial da OAB — o Prov. 205/2021 (Art.5º §2º) e o
// REGRAS.md §2.5 vedam selos, logotipos e ícones que insinuem autorização oficial
// da OAB ("Verificado", "Aprovado pela OAB"). Por isso usamos termo neutro
// ("OAB conferida"), ícone de check simples (sem forma de selo) e tooltip que
// deixa claro tratar-se de conferência de dados feita pela plataforma.
export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Número de OAB conferido pela plataforma. Não é selo oficial da OAB."
      style={{
        background: 'var(--c-accent-soft, rgba(176,141,87,0.14))',
        color: 'var(--c-accent, #96743f)',
      }}
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <CheckIcon width={compact ? 13 : 15} height={compact ? 13 : 15} strokeWidth={1.8} />
      {!compact && 'OAB conferida'}
    </span>
  )
}
