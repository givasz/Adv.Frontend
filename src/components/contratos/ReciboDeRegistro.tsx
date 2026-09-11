import { useState } from 'react'
import { hashEmBlocos } from '@/lib/contratos/codigo'
import { dataEHora } from '@/lib/contratos/entrega'
import { CheckIcon, CopyIcon, FingerprintIcon } from '@/components/ui/icons'

// O comprovante do registro, desenhado como um canhoto de protocolo: picotado
// em cima, código grande, impressão digital em blocos.
//
// Canhoto, e não selo: nada aqui tem forma de chancela, estrela ou "verificado".
// O registro prova que ESTE arquivo existia NESTE momento — não que o documento
// é válido, e a plataforma nunca atesta documento de ninguém (REGRAS.md, nota de
// 04/09/2026). A forma do desenho não pode dizer mais do que o texto diz.
export function ReciboDeRegistro({
  codigo,
  hash,
  registradoEm,
  titulo = 'Documento registrado',
  compacto = false,
}: {
  codigo: string
  hash: string
  registradoEm: string
  titulo?: string
  compacto?: boolean
}) {
  const [copiado, setCopiado] = useState<'codigo' | 'hash' | null>(null)
  const copiar = async (o: 'codigo' | 'hash') => {
    try {
      await navigator.clipboard.writeText(o === 'codigo' ? codigo : hash)
      setCopiado(o)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      /* sem permissão de área de transferência — o texto continua selecionável */
    }
  }

  return (
    <div className="relative rounded-xl2 border border-ink/10 bg-paper-soft shadow-card">
      {/* Picote: uma fileira de furos feita com gradiente, sem imagem. */}
      <span
        className="pointer-events-none absolute inset-x-5 top-0 h-2 -translate-y-1/2 bg-[radial-gradient(circle,theme(colors.paper.deep)_2.5px,transparent_3px)] bg-[length:12px_8px] bg-repeat-x"
        aria-hidden
      />
      <div className={compacto ? 'p-4' : 'p-5 sm:p-6'}>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brass-deep">{titulo}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p
            className="font-mono text-[22px] font-semibold tracking-[0.08em] text-ink sm:text-[26px]"
            translate="no"
          >
            {codigo}
          </p>
          <button
            type="button"
            onClick={() => copiar('codigo')}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[12.5px] font-medium text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-burgundy"
          >
            {copiado === 'codigo' ? <CheckIcon width={14} height={14} aria-hidden /> : <CopyIcon width={14} height={14} aria-hidden />}
            {copiado === 'codigo' ? 'Copiado' : 'Copiar código'}
          </button>
        </div>
        <p className="mt-1 text-[13px] text-ink-soft">Registrado em {dataEHora(registradoEm)}</p>

        {!compacto && (
          <div className="mt-4 border-t border-dashed border-ink/15 pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                <FingerprintIcon width={15} height={15} className="text-brass-deep" aria-hidden />
                Impressão digital do PDF (SHA-256)
              </p>
              <button
                type="button"
                onClick={() => copiar('hash')}
                className="shrink-0 rounded-full px-2.5 py-2 text-[12.5px] font-medium text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-burgundy"
              >
                {copiado === 'hash' ? 'Copiada' : 'Copiar'}
              </button>
            </div>
            <p className="mt-1.5 grid grid-cols-2 gap-x-3 font-mono text-[11.5px] leading-relaxed text-ink-soft min-[420px]:grid-cols-4" translate="no">
              {hashEmBlocos(hash).map((b, i) => (
                <span key={i} className="break-all">
                  {b}
                </span>
              ))}
            </p>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {copiado ? 'Copiado para a área de transferência.' : ''}
        </p>
      </div>
    </div>
  )
}
