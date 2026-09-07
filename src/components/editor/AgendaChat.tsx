import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AssistantConfig } from '@/lib/types'
import {
  assistantDayAt,
  buildAssistantDays,
  busyKey,
  dayKey,
  formatBusyLong,
  formatBusyShort,
  MAX_DAY_CHIPS,
  parseBrDate,
  resolveAssistantConfig,
  type AssistantDayOption,
} from '@/lib/assistant'
import { Bubble, cap, Chip, ChipRow, Composer, TypingDots } from '@/components/assistant/pieces'
import { useConversation, usePinnedToBottom } from '@/components/assistant/useConversation'
import { CalendarIcon, CheckIcon, SparkIcon, XIcon } from '@/components/ui/icons'

// A conversa do ADVOGADO com o assistente — o outro lado do balcão.
//
// O assistente público oferece uma grade semanal, que se repete toda semana. A
// agenda de verdade não se repete: alguém liga, marca por fora, e às 14h daquela
// quarta já não há ninguém livre. Sem um jeito de contar isso ao assistente, ele
// segue oferecendo um horário que não existe — e quem descobre é o visitante,
// depois de mandar o pedido pelo WhatsApp.
//
// Por que uma conversa e não um calendário: é o mesmo gesto que o advogado já
// conhece do outro lado, e cabe em três toques. Um calendário mensal aqui seria
// outra tela, outro componente, outro jeito de errar — e o que ele precisa dizer
// tem só duas partes, o dia e a hora.
//
// O que ela guarda: data e hora. Nunca de quem é o compromisso, nunca o motivo.
// Não há dado de terceiro nenhum atravessando esta tela.

type Step = 'dia' | 'hora' | 'mais' | 'fim'

/** Paleta do editor nas variáveis --c-* que as peças da conversa esperam. */
const PALETA = {
  '--c-bg': '#f5f0e6',
  '--c-surface': '#faf6ec',
  '--c-text': '#211c17',
  '--c-muted': '#443b32',
  '--c-faint': '#6b6155',
  '--c-border': 'rgba(33,28,23,0.10)',
  '--c-accent': '#6b2131',
  '--c-accent-ink': '#faf6ec',
  '--c-accent-soft': 'rgba(107,33,49,0.08)',
  '--c-ring': 'rgba(107,33,49,0.30)',
} as React.CSSProperties

export function AgendaChat({
  config,
  onChange,
  disabled = false,
}: {
  /** grade do assistente, já resolvida pelo card */
  config: AssistantConfig
  /** grava a nova lista de horários ocupados (o editor salva sozinho) */
  onChange: (busy: string[]) => void
  /** modo espectro do editor: mostra, não deixa mexer */
  disabled?: boolean
}) {
  const [aberta, setAberta] = useState(false)
  const busy = useMemo(() => resolveAssistantConfig(config).busy ?? [], [config])

  return (
    <div className="rounded-lg border border-ink/10 bg-paper-deep/50 p-3.5">
      <div className="flex items-start gap-2">
        <SparkIcon width={15} height={15} className="mt-0.5 shrink-0 text-brass-deep" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">Marcou um horário por fora?</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
            Converse com o assistente e diga qual horário já foi. Ele para de oferecer esse horário
            naquele dia — só naquele dia — e a grade da semana continua intacta.
          </p>
        </div>
      </div>

      {/* Horários já marcados: sempre à vista, e sempre reversíveis. */}
      {busy.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Ocupados ({busy.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {busy.map((k) => (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() => onChange(busy.filter((b) => b !== k))}
                aria-label={`Liberar ${formatBusyLong(k)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-paper-soft px-2.5 py-1 text-[12px] font-medium tabular-nums text-ink-soft transition-colors hover:border-burgundy/40 hover:text-burgundy"
              >
                {formatBusyShort(k)}
                <XIcon width={11} height={11} />
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Toque para liberar de novo. Depois que a data passa, o horário sai daqui sozinho.
          </p>
        </div>
      )}

      {aberta ? (
        <Conversa
          config={config}
          busy={busy}
          onChange={onChange}
          onEncerrar={() => setAberta(false)}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAberta(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-burgundy/30 bg-burgundy/[0.06] px-3.5 py-2 text-[13px] font-semibold text-burgundy transition-colors hover:bg-burgundy/[0.10] disabled:opacity-60"
        >
          <CalendarIcon width={15} height={15} />
          {busy.length ? 'Marcar outro horário' : 'Marcar um horário'}
        </button>
      )}
    </div>
  )
}

// A conversa em si. Monta só quando o advogado abre — assim o editor não escreve
// falas (nem rouba o foco do campo de texto) para quem passou pela seção.
function Conversa({
  config,
  busy,
  onChange,
  onEncerrar,
}: {
  config: AssistantConfig
  busy: string[]
  onChange: (busy: string[]) => void
  onEncerrar: () => void
}) {
  const { msgs, typing, push, say: falar, reset, reduced, listRef } = useConversation({ pace: 0.8 })
  const [step, setStep] = useState<Step>('dia')
  const [dia, setDia] = useState<AssistantDayOption | null>(null)
  const [verTodos, setVerTodos] = useState(false)
  const [draft, setDraft] = useState('')

  const cfg = useMemo(() => resolveAssistantConfig(config), [config])
  // Os dias que a conversa pública está oferecendo agora — os mesmos que o
  // advogado tem para fechar. Se um dia não está aqui, não há o que fechar nele.
  const dias = useMemo(() => buildAssistantDays(config), [config])
  // O dia em foco relido da grade ATUAL: marcar um horário muda a lista, e o que
  // sobrou tem de vir da fonte, não de uma cópia guardada no passo anterior.
  const emFoco = useMemo(
    () => (dia ? assistantDayAt(config, dia.key) : null),
    [config, dia],
  )
  const restantes = emFoco?.times ?? []

  const say = useCallback(
    (lines: string[], next?: Step) => falar(lines, next ? () => setStep(next) : undefined),
    [falar],
  )

  useAbertura(reset, say, dias.length)
  usePinnedToBottom(listRef, [msgs, typing, step])

  /** Dias à frente entre hoje e a data — o horizonte da conversa pública. */
  function distancia(key: string): number {
    return Math.round(
      (new Date(`${key}T00:00:00`).getTime() - new Date(`${dayKey(new Date())}T00:00:00`).getTime()) /
        86_400_000,
    )
  }

  function escolherDia(opt: AssistantDayOption, digitada = false) {
    push('user', digitada ? opt.label : `${opt.label}${opt.relative ? ` (${opt.relative})` : ''}`)
    setDia(opt)
    setDraft('')
    // Data além do horizonte: dá para marcar, mas o advogado merece saber que ela
    // ainda nem está sendo oferecida — senão parece que a marcação não fez nada.
    const longe = distancia(opt.key) > cfg.horizonDays
    void say(
      [
        longe
          ? `${cap(opt.longLabel)} ainda não aparece na conversa (hoje você aceita pedidos até ${cfg.horizonDays} dias à frente), mas já deixo marcado.`
          : `${cap(opt.longLabel)}. Qual horário já foi?`,
        longe ? 'Qual horário já foi?' : '',
      ].filter(Boolean),
      'hora',
    )
  }

  function digitarData(texto: string) {
    const bruto = texto.trim()
    if (!bruto) return
    push('user', bruto)
    setDraft('')
    const key = parseBrDate(bruto)
    if (!key) {
      void say(['Não entendi a data. Escreva no formato 25/11 — ou toque em um dia acima.'])
      return
    }
    const opt = assistantDayAt(config, key)
    if (!opt) {
      void say([
        `Em ${formatDataCurta(key)} não há horário livre na sua grade — ou você não atende nesse dia da semana, ou já marcou todos.`,
      ])
      return
    }
    escolherDia(opt, true)
  }

  function marcarHorario(time: string) {
    if (!emFoco) return
    push('user', time)
    const chave = busyKey(emFoco.key, time)
    onChange([...busy, chave].sort())
    const sobraram = restantes.filter((t) => t !== time)
    void say(
      [
        `Pronto: ${formatBusyLong(chave)} não é mais oferecido.`,
        sobraram.length
          ? 'Quer marcar mais algum?'
          : 'Esse dia ficou sem horário livre — ele deixa de aparecer na conversa.',
      ],
      'mais',
    )
  }

  function marcarDiaInteiro() {
    if (!emFoco) return
    push('user', 'O dia todo')
    const chaves = restantes.map((t) => busyKey(emFoco.key, t))
    onChange([...busy, ...chaves].sort())
    void say(
      [
        `Fechei ${emFoco.longLabel} inteiro: ${chaves.length} ${chaves.length === 1 ? 'horário sai' : 'horários saem'} da conversa.`,
        'Quer marcar mais algum?',
      ],
      'mais',
    )
  }

  function outroDia() {
    push('user', 'Outro dia')
    setDia(null)
    setVerTodos(false)
    void say(['Claro. Qual dia?'], 'dia')
  }

  function terminar() {
    push('user', 'Terminei')
    void say(
      ['Combinado. Sua grade da semana continua a mesma — só esses horários ficaram de fora.'],
      'fim',
    )
  }

  const chips = verTodos ? dias : dias.slice(0, MAX_DAY_CHIPS)

  return (
    <div
      // A marca serve ao teste de fumaça: a conversa vive no meio de um editor
      // cheio de fichas de horário, e sem um escopo o roteiro seria percorrido
      // na GRADE por engano — o teste passaria sem testar a conversa.
      data-agenda-chat
      className="mt-3 overflow-hidden rounded-xl border"
      style={{ ...PALETA, borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}
    >
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Conversa com o assistente sobre horários ocupados"
        className="flex max-h-[260px] min-h-[120px] flex-col overflow-y-auto px-3.5 py-3.5"
      >
        <div className="mt-auto space-y-2">
          <AnimatePresence initial={false}>
            {msgs.map((m) => (
              <Bubble key={m.id} from={m.from} text={m.text} reduced={!!reduced} />
            ))}
          </AnimatePresence>
          {typing && <TypingDots />}
        </div>
      </div>

      <div
        className="px-3.5 py-3"
        style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-bg)' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step + (typing ? '-t' : '')}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
          >
            {typing ? (
              <p className="t-faint py-2 text-center text-[12px]">…</p>
            ) : step === 'dia' ? (
              <div className="space-y-2.5">
                {chips.length > 0 && (
                  <ChipRow label="Que dia já foi ocupado">
                    {chips.map((d) => (
                      <Chip key={d.key} onClick={() => escolherDia(d)}>
                        <CalendarIcon width={13} height={13} className="t-accent" />
                        {d.label}
                        {d.relative && <em className="t-faint not-italic">· {d.relative}</em>}
                      </Chip>
                    ))}
                    {!verTodos && dias.length > MAX_DAY_CHIPS && (
                      <Chip subtle onClick={() => setVerTodos(true)}>
                        Ver mais dias
                      </Chip>
                    )}
                  </ChipRow>
                )}
                <Composer
                  value={draft}
                  onChange={setDraft}
                  onSend={() => digitarData(draft)}
                  placeholder="Ou escreva a data — ex.: 25/11"
                  label="Data do horário ocupado"
                  canSend={draft.trim().length > 2}
                />
              </div>
            ) : step === 'hora' ? (
              <ChipRow label="Horário que já foi">
                {restantes.map((t) => (
                  <Chip key={t} onClick={() => marcarHorario(t)}>
                    {t}
                  </Chip>
                ))}
                {restantes.length > 1 && (
                  <Chip subtle onClick={marcarDiaInteiro}>
                    O dia todo
                  </Chip>
                )}
                <Chip subtle onClick={outroDia}>
                  Outro dia
                </Chip>
              </ChipRow>
            ) : step === 'mais' ? (
              <ChipRow label="E então">
                {restantes.length > 0 && (
                  <Chip onClick={() => setStep('hora')}>Outro horário nesse dia</Chip>
                )}
                <Chip onClick={outroDia}>Outro dia</Chip>
                <Chip subtle onClick={terminar}>
                  Terminei
                </Chip>
              </ChipRow>
            ) : (
              <button
                type="button"
                onClick={onEncerrar}
                className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13.5px] font-semibold"
                style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
              >
                <CheckIcon width={15} height={15} strokeWidth={2.4} />
                Fechar a conversa
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/** "2026-11-25" → "25/11". */
function formatDataCurta(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`
}

/**
 * Abertura: uma fala só, e o roteiro já começa no dia.
 *
 * O `reset` antes da fala não é zelo: o motor da conversa invalida as falas
 * pendentes quando o componente se desmonta, e uma remontagem (o modo estrito do
 * React faz uma, de propósito, em desenvolvimento) mataria a saudação no meio do
 * "digitando…" — a conversa abria muda, para sempre. Recomeçar do zero a cada
 * montagem é o que o assistente do perfil também faz.
 *
 * As referências seguram `say` e a contagem de dias sem religar o efeito: ele
 * roda por montagem, não a cada fala.
 */
function useAbertura(
  reset: () => void,
  say: (lines: string[], next?: Step) => void,
  temDias: number,
) {
  const sayRef = useRef(say)
  sayRef.current = say
  const temRef = useRef(temDias)
  temRef.current = temDias
  const resetRef = useRef(reset)
  resetRef.current = reset
  useEffect(() => {
    resetRef.current()
    sayRef.current(
      temRef.current
        ? ['Qual dia teve um horário ocupado? Toque em um dia ou escreva a data.']
        : ['Sua grade não tem nenhum horário livre à frente — não há o que marcar por aqui.'],
      temRef.current ? 'dia' : 'fim',
    )
  }, [])
}
