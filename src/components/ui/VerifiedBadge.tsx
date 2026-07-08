import { CheckIcon, ExternalLinkIcon } from './icons'

// Consulta pública do Cadastro Nacional dos Advogados (CNA) — fonte OFICIAL e aberta
// da OAB. Linkar para cá é factual/informativo (não é selo nem chancela): apenas
// aponta o visitante para a base onde ele mesmo confere a inscrição.
export const CNA_URL = 'https://cna.oab.org.br/'

const TOOLTIP =
  'Número de OAB conferido pela plataforma. Confira a inscrição no Cadastro Nacional ' +
  'dos Advogados (CNA/OAB). A conferência não representa endosso ou aprovação da OAB.'

// Marca INFORMATIVA de que a plataforma conferiu o número de OAB do perfil.
// NÃO é um selo/chancela oficial da OAB — o Prov. 205/2021 (Art.5º §2º) e o
// REGRAS.md §2.5 vedam selos, logotipos e ícones que insinuem autorização oficial
// da OAB ("Verificado", "Aprovado pela OAB"). Por isso usamos termo neutro
// ("OAB conferida"), ícone de check simples (sem forma de selo) e tooltip que
// deixa claro tratar-se de conferência de dados feita pela plataforma.
//
// Quando `linkCna` é true (perfil público), o selo vira um link para a consulta
// pública do CNA — reforça a confiança de terceiros apontando a FONTE oficial,
// sem simular chancela da OAB.
export function VerifiedBadge({
  compact = false,
  linkCna = false,
  interactive = true,
}: {
  compact?: boolean
  linkCna?: boolean
  /** false dentro da prévia do editor: desabilita a navegação real */
  interactive?: boolean
}) {
  const style = {
    background: 'var(--c-accent-soft, rgba(176,141,87,0.14))',
    color: 'var(--c-accent, #96743f)',
  }
  const cls = `inline-flex items-center gap-1 rounded-full font-semibold ${
    compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
  }`
  const iconSize = compact ? 13 : 15
  const label = compact ? 'OAB conferida · CNA' : 'OAB conferida'

  if (linkCna) {
    return (
      <a
        href={CNA_URL}
        title={TOOLTIP}
        aria-label={`${label}. Abrir a consulta pública do CNA da OAB.`}
        target="_blank"
        rel="noreferrer noopener nofollow"
        onClick={interactive ? undefined : (e) => e.preventDefault()}
        style={style}
        className={`${cls} transition-opacity hover:opacity-80`}
      >
        <CheckIcon width={iconSize} height={iconSize} strokeWidth={1.8} />
        {!compact && 'OAB conferida'}
        <ExternalLinkIcon width={compact ? 11 : 13} height={compact ? 11 : 13} strokeWidth={1.8} />
      </a>
    )
  }

  return (
    <span title={TOOLTIP} style={style} className={cls}>
      <CheckIcon width={iconSize} height={iconSize} strokeWidth={1.8} />
      {!compact && 'OAB conferida'}
    </span>
  )
}
