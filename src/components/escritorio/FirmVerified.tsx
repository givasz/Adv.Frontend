import { CheckIcon, ExternalLinkIcon } from '@/components/ui/icons'
import { CNA_URL } from '@/components/ui/VerifiedBadge'

// Marca INFORMATIVA "OAB conferida" para o escritório/advogados, coerente com a decisão
// de produto: NÃO é selo/chancela da OAB e NÃO abre modal — é um link para a fonte
// oficial (Cadastro Nacional dos Advogados). Prov. 205/2021 (Art.5º §2º) veda ícones
// que insinuem autorização oficial; por isso, termo neutro e check simples (sem selo).
export function FirmVerified({ compact = false }: { compact?: boolean }) {
  const size = compact ? 12 : 14
  return (
    <a
      href={CNA_URL}
      target="_blank"
      rel="noreferrer noopener nofollow"
      title="Registro conferido pela plataforma. Confira no Cadastro Nacional dos Advogados (CNA/OAB). A conferência não representa endosso da OAB."
      className={`inline-flex items-center gap-1 rounded-full bg-brass/12 font-semibold text-brass-deep transition-opacity hover:opacity-80 ${
        compact ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11.5px]'
      }`}
    >
      <CheckIcon width={size} height={size} strokeWidth={1.8} />
      OAB conferida
      <ExternalLinkIcon width={compact ? 10 : 12} height={compact ? 10 : 12} strokeWidth={1.8} />
    </a>
  )
}
