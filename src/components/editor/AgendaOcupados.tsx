import { useMemo } from 'react'
import type { AssistantConfig } from '@/lib/types'
import { formatBusyShort, resolveAssistantConfig } from '@/lib/assistant'
import { CalendarIcon, XIcon } from '@/components/ui/icons'

// Os horários que o advogado fechou, dentro do editor: o RESUMO, não a conversa.
//
// A conversa mora em /agenda, numa página só dela — é a única tarefa do produto
// que se repete toda semana, e obrigá-lo a atravessar a tela de configuração da
// grade toda vez era cobrar pedágio por uma coisa de dez segundos. Aqui fica o
// que faz sentido ver enquanto se MEXE na grade: o que está fechado hoje, e a
// porta para fechar mais.

export function AgendaOcupados({
  config,
  onChange,
  onAbrir,
  disabled = false,
}: {
  config: AssistantConfig
  /** libera um horário (o editor grava sozinho) */
  onChange: (busy: string[]) => void
  /** sai para a conversa em /agenda, gravando o que estiver em voo */
  onAbrir: () => void
  /** modo espectro do editor: mostra, não deixa mexer */
  disabled?: boolean
}) {
  const busy = useMemo(() => resolveAssistantConfig(config).busy ?? [], [config])

  return (
    <div className="rounded-lg border border-ink/10 bg-paper-deep/50 p-3.5">
      <div className="flex items-start gap-2">
        <CalendarIcon width={15} height={15} className="mt-0.5 shrink-0 text-brass-deep" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">Horários já ocupados</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
            {busy.length
              ? 'Estes não estão sendo oferecidos. Toque em um para liberar de novo — e, quando a data passa, ele sai daqui sozinho.'
              : 'Marcou um horário por fora? Conte ao assistente e ele para de oferecer esse horário naquele dia — só naquele dia, sem mexer na grade da semana.'}
          </p>
        </div>
      </div>

      {busy.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {busy.map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onChange(busy.filter((b) => b !== k))}
              aria-label={`Liberar ${formatBusyShort(k)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-paper-soft px-2.5 py-1 text-[12px] font-medium tabular-nums text-ink-soft transition-colors hover:border-burgundy/40 hover:text-burgundy"
            >
              {formatBusyShort(k)}
              <XIcon width={11} height={11} />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onAbrir}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-burgundy/30 bg-burgundy/[0.06] px-3.5 py-2 text-[13px] font-semibold text-burgundy transition-colors hover:bg-burgundy/[0.10] disabled:opacity-60"
      >
        <CalendarIcon width={15} height={15} />
        {busy.length ? 'Marcar outro horário' : 'Marcar um horário'}
      </button>
    </div>
  )
}
