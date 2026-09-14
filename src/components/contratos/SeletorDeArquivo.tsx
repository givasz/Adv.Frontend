import { useId, useState, type DragEvent } from 'react'
import { DocIcon } from '@/components/ui/icons'
import { tamanhoLegivel } from '@/lib/contratos/entrega'

// Escolher um PDF. No celular é um toque (abre Arquivos/Drive); no computador
// também aceita arrastar. O <input> é de verdade e fica dentro do <label>: o
// alvo inteiro é clicável, e o teclado chega nele pelo Tab como em qualquer campo.
export function SeletorDeArquivo({
  onArquivo,
  rotulo,
  dica,
  ocupado = false,
  nomeAtual,
  tamanhoAtual,
}: {
  onArquivo: (f: File) => void
  rotulo: string
  dica: string
  ocupado?: boolean
  nomeAtual?: string
  tamanhoAtual?: number
}) {
  const id = useId()
  const [arrastando, setArrastando] = useState(false)

  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    const f = e.dataTransfer.files?.[0]
    if (f && !ocupado) onArquivo(f)
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault()
        setArrastando(true)
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={soltar}
      className={`flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed px-5 py-6 text-center transition-[border-color,background-color] duration-200 focus-within:ring-2 focus-within:ring-burgundy/30 ${
        arrastando ? 'border-burgundy/60 bg-burgundy/[0.04]' : 'border-ink/15 bg-paper-soft hover:border-brass/60'
      } ${ocupado ? 'pointer-events-none opacity-60' : ''}`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brass/15 text-brass-deep" aria-hidden>
        <DocIcon width={20} height={20} />
      </span>
      <span className="font-display text-[16px] font-semibold text-ink">{rotulo}</span>
      <span className="max-w-sm text-[12.5px] leading-relaxed text-ink-faint">{dica}</span>
      {nomeAtual && (
        <span className="mt-1 max-w-full truncate rounded-full bg-ink/[0.05] px-3 py-1 text-[12px] font-medium text-ink-soft">
          {nomeAtual}
          {tamanhoAtual ? ` · ${tamanhoLegivel(tamanhoAtual)}` : ''}
        </span>
      )}
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        disabled={ocupado}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onArquivo(f)
          // Permite escolher o MESMO arquivo de novo depois de um erro.
          e.target.value = ''
        }}
      />
    </label>
  )
}
