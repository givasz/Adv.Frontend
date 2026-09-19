import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AssistantConfig, FaixaDeAtendimento, Profile } from '@/lib/types'
import { WEEKDAYS_FULL, WEEKDAYS_SHORT } from '@/lib/booking'
import {
  avisosDasFaixas,
  buildAssistantDays,
  DEFAULT_ASSISTANT_CONFIG,
  diaDasFaixas,
  FAIXAS_PADRAO,
  faixasDoDia,
  FIM_DO_DIA,
  MAX_FAIXAS,
  minToTime,
  resolveAssistantConfig,
  timeToMin,
  weeklySlotCount,
} from '@/lib/assistant'
import { checkCompliance } from '@/lib/oab'
import { AgendaOcupados } from './AgendaOcupados'
import { Field, TextArea } from './fields'
import { InfoTip } from './InfoTip'
import { comVolta } from '@/components/ui/SubPage'
import { MarginNotes } from './MarginNotes'
import { CheckIcon } from '@/components/ui/icons'

// Disponibilidade do assistente virtual: o advogado marca os dias da semana que
// atende e, dentro de cada dia, as FAIXAS em que atende ("das 7 às 11, das 13 às
// 17"). Os horários saem das faixas no passo da duração do atendimento — é só
// isso que o assistente sabe, e ele nunca inventa um horário fora dessa grade.

const DURATIONS = [30, 45, 60, 90]
const LEADS = [
  { hours: 2, label: '2 horas' },
  { hours: 12, label: '12 horas' },
  { hours: 24, label: '1 dia' },
  { hours: 48, label: '2 dias' },
]
const HORIZONS = [
  { days: 7, label: '1 semana' },
  { days: 14, label: '2 semanas' },
  { days: 30, label: '1 mês' },
]

// 16px no celular: o Safari do iPhone dá zoom na página em campo menor que isso.
const CAMPO_HORA =
  'rounded-lg border border-ink/15 bg-paper-soft px-2.5 py-1.5 text-[16px] tabular-nums text-ink focus:border-burgundy focus:outline-none sm:text-[13px]'

export function AssistantCard({
  profile,
  set,
  preview = false,
  irPara,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  /** modo espectro (dentro do cadeado): controles inertes, só para o advogado ver */
  preview?: boolean
  /** sai do editor gravando o que estiver em voo (ver Editor.irPara) */
  irPara?: (destino: string) => void
}) {
  const config = useMemo(
    () => resolveAssistantConfig(profile.assistant ?? DEFAULT_ASSISTANT_CONFIG),
    [profile.assistant],
  )
  const activeWeekdays = config.days.map((d) => d.weekday)
  const [selected, setSelected] = useState<number>(activeWeekdays[0] ?? 1)
  const focusDay = activeWeekdays.includes(selected) ? selected : activeWeekdays[0]
  const focus = config.days.find((d) => d.weekday === focusDay)
  const focusFaixas = useMemo(
    () => (focus ? faixasDoDia(focus, config.durationMin) : []),
    [focus, config.durationMin],
  )
  const avisos = useMemo(
    () => avisosDasFaixas(focusFaixas, config.durationMin),
    [focusFaixas, config.durationMin],
  )

  const greetingIssues = useMemo(
    () => checkCompliance(config.greeting ?? ''),
    [config.greeting],
  )
  // Quantos horários a conversa realmente vai mostrar daqui para a frente.
  const upcoming = useMemo(() => buildAssistantDays(config), [config])
  const upcomingSlots = upcoming.reduce((n, d) => n + d.times.length, 0)

  const patch = (next: Partial<AssistantConfig>) => {
    if (preview) return
    set({ assistant: { ...config, ...next } })
  }

  function toggleWeekday(weekday: number) {
    const has = activeWeekdays.includes(weekday)
    const days = has
      ? config.days.filter((d) => d.weekday !== weekday)
      : [
          ...config.days,
          diaDasFaixas(weekday, focusFaixas.length ? focusFaixas : FAIXAS_PADRAO, config.durationMin),
        ].sort((a, b) => a.weekday - b.weekday)
    patch({ days })
    if (!has) setSelected(weekday)
  }

  function setFocusFaixas(faixas: FaixaDeAtendimento[]) {
    if (focusDay === undefined) return
    // Dia sem nenhuma faixa deixa de ser atendido — evita "dia fantasma" na conversa.
    const days = faixas.length
      ? config.days.map((d) =>
          d.weekday === focusDay ? diaDasFaixas(focusDay, faixas, config.durationMin) : d,
        )
      : config.days.filter((d) => d.weekday !== focusDay)
    patch({ days })
  }

  function mudarFaixa(i: number, campo: 'inicio' | 'fim', valor: string) {
    const v = timeToMin(valor)
    // Campo apagado no meio da digitação: ignora, e o valor anterior volta.
    if (!Number.isFinite(v)) return
    const f = { ...focusFaixas[i], [campo]: minToTime(v) }
    // Início passou do fim (ou o contrário): empurra a outra ponta em vez de
    // descartar a faixa na mão de quem ainda está digitando.
    if (timeToMin(f.inicio) >= timeToMin(f.fim)) {
      if (campo === 'inicio') f.fim = minToTime(Math.min(v + config.durationMin, FIM_DO_DIA))
      else f.inicio = minToTime(Math.max(v - config.durationMin, 0))
    }
    if (timeToMin(f.inicio) >= timeToMin(f.fim)) return
    setFocusFaixas(focusFaixas.map((x, j) => (j === i ? f : x)))
  }

  function adicionarFaixa() {
    // A próxima faixa começa uma hora depois da última terminar — o intervalo de
    // almoço é o caso comum, e ajustar é mais rápido do que digitar do zero.
    const ultima = focusFaixas[focusFaixas.length - 1]
    const ini = ultima ? Math.min(timeToMin(ultima.fim) + 60, 22 * 60) : 9 * 60
    const fim = Math.min(ini + 4 * 60, FIM_DO_DIA)
    setFocusFaixas([...focusFaixas, { inicio: minToTime(ini), fim: minToTime(fim) }])
  }

  function copyToAllDays() {
    if (focusDay === undefined) return
    patch({
      days: config.days.map((d) => diaDasFaixas(d.weekday, focusFaixas, config.durationMin)),
    })
  }

  // Mudar a duração refaz os horários de TODOS os dias a partir das faixas: "das
  // 7 às 11" continua sendo das 7 às 11, só o passo muda.
  function mudarDuracao(durationMin: number) {
    patch({
      durationMin,
      days: config.days.map((d) =>
        diaDasFaixas(d.weekday, faixasDoDia(d, config.durationMin), durationMin),
      ),
    })
  }

  const noDays = !config.days.length

  return (
    <div className={`space-y-5 ${preview ? 'pointer-events-none select-none' : ''}`}>
      {/* 1 — dias da semana */}
      <div>
        <span className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink">Dias que você atende</span>
          <span className="text-[11px] text-ink-faint">
            {config.days.length
              ? `${config.days.length} ${config.days.length === 1 ? 'dia' : 'dias'}`
              : 'nenhum dia'}
          </span>
        </span>
        <div className="flex gap-1.5" role="group" aria-label="Dias da semana atendidos">
          {WEEKDAYS_SHORT.map((short, weekday) => {
            const on = activeWeekdays.includes(weekday)
            return (
              <button
                key={weekday}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAYS_FULL[weekday]}
                onClick={() => toggleWeekday(weekday)}
                className={`h-11 flex-1 rounded-lg border text-[12.5px] font-semibold uppercase transition-colors ${
                  on
                    ? 'border-burgundy bg-burgundy text-paper-soft'
                    : 'border-ink/15 bg-paper-soft text-ink-faint hover:border-ink/30'
                }`}
              >
                {short}
              </button>
            )
          })}
        </div>
      </div>

      {noDays ? (
        <p className="rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-brass-deep">
          Escolha ao menos um dia acima para o assistente ter o que oferecer.
        </p>
      ) : (
        <>
          {/* 2 — faixas de atendimento do dia em foco */}
          <div>
            <span className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">Horário de atendimento</span>
              {config.days.length > 1 && (
                <button
                  type="button"
                  onClick={copyToAllDays}
                  className="text-[11.5px] font-semibold text-burgundy underline-offset-4 hover:underline"
                >
                  Repetir em todos os dias
                </button>
              )}
            </span>

            {/* abas por dia — só os dias ativos. Quebram em duas linhas no celular em
                vez de rolar na horizontal (rolagem lateral escondida some no toque). */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {config.days.map((d) => {
                const on = d.weekday === focusDay
                return (
                  <button
                    key={d.weekday}
                    type="button"
                    onClick={() => setSelected(d.weekday)}
                    aria-pressed={on}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      on
                        ? 'border-burgundy bg-burgundy/[0.07] text-burgundy'
                        : 'border-ink/15 text-ink-soft hover:border-brass/50'
                    }`}
                  >
                    {WEEKDAYS_FULL[d.weekday]}
                    <span className="ml-1.5 text-[11px] text-ink-faint">{d.times.length}</span>
                  </button>
                )
              })}
            </div>

            <ul className="space-y-2">
              {focusFaixas.map((f, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft"
                >
                  <span className="text-ink-faint">das</span>
                  <input
                    type="time"
                    step={300}
                    value={f.inicio}
                    onChange={(e) => mudarFaixa(i, 'inicio', e.target.value)}
                    className={CAMPO_HORA}
                    aria-label={`Início da faixa ${i + 1}`}
                  />
                  <span className="text-ink-faint">às</span>
                  <input
                    type="time"
                    step={300}
                    value={f.fim}
                    onChange={(e) => mudarFaixa(i, 'fim', e.target.value)}
                    className={CAMPO_HORA}
                    aria-label={`Fim da faixa ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => setFocusFaixas(focusFaixas.filter((_, j) => j !== i))}
                    className="ml-auto rounded-full px-2 py-1 text-[12px] font-medium text-ink-faint transition-colors hover:text-burgundy"
                    aria-label={`Remover a faixa das ${f.inicio} às ${f.fim}`}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            {focusFaixas.length < MAX_FAIXAS ? (
              <button
                type="button"
                onClick={adicionarFaixa}
                className="mt-2.5 text-[12.5px] font-semibold text-burgundy underline-offset-4 hover:underline"
              >
                + Adicionar outra faixa
              </button>
            ) : (
              <p className="mt-2.5 text-[12px] text-ink-faint">
                Este dia chegou ao máximo de {MAX_FAIXAS} faixas.
              </p>
            )}

            {avisos.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2.5 text-[12px] leading-relaxed text-brass-deep">
                {avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}

            <div className="mt-4">
              <Choice
                label="Cada atendimento dura"
                value={config.durationMin}
                options={DURATIONS.map((d) => ({ value: d, label: `${d} min` }))}
                onChange={mudarDuracao}
              />
            </div>

            {focus && (
              <p className="mt-3 rounded-lg bg-paper-deep/60 px-3 py-2.5 text-[12px] leading-relaxed text-ink-faint">
                {cap(WEEKDAYS_FULL[focus.weekday] ?? '')}, o assistente oferece{' '}
                <span className="font-medium tabular-nums text-ink-soft">
                  {focus.times.join(' · ')}
                </span>
                .
              </p>
            )}
          </div>

          {/* 3 — o que já foi ocupado (a conversa em si mora em /agenda) */}
          <AgendaOcupados
            config={config}
            onChange={(busy) => patch({ busy })}
            onAbrir={() => irPara?.(comVolta('/agenda', '/editor?section=agenda'))}
            disabled={preview || !irPara}
          />

          {/* 4 — regras da conversa */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              label="Antecedência mínima"
              value={config.leadHours}
              options={LEADS.map((l) => ({ value: l.hours, label: l.label }))}
              onChange={(leadHours) => patch({ leadHours })}
            />
            <Choice
              label="Aceitar até"
              value={config.horizonDays}
              options={HORIZONS.map((h) => ({ value: h.days, label: h.label }))}
              onChange={(horizonDays) => patch({ horizonDays })}
            />
          </div>

          {/* 5 — abertura da conversa */}
          <Field
            label="Primeira frase do assistente"
            hint="opcional"
            info={
              <InfoTip
                title="O que escrever aqui"
                align="left"
                label="Ajuda sobre a frase de abertura"
                items={[
                  'É a primeira coisa que a pessoa lê ao abrir a conversa.',
                  'Deixe em branco para usar a apresentação padrão, que já avisa tratar-se de um assistente automático.',
                  'Mantenha informativo: nada de promessa de resultado, preço, urgência ou convite a contratar.',
                ]}
              />
            }
          >
            <TextArea
              rows={2}
              maxLength={180}
              value={config.greeting ?? ''}
              onChange={(e) => patch({ greeting: e.target.value })}
              placeholder="Olá! Sou o assistente virtual do escritório e posso reservar um horário."
            />
          </Field>
          <MarginNotes issues={greetingIssues} />

          {/* 6 — o atalho no canto do perfil mora em "Botão flutuante": lá o
              advogado escolhe entre este assistente e o WhatsApp — um só. */}
          <p className="rounded-lg border border-ink/10 bg-paper-deep/60 px-3 py-2.5 text-[12px] leading-relaxed text-ink-faint">
            Quer um atalho no canto do perfil que abre esta conversa? Escolha o assistente em{' '}
            <Link
              to="/editor?section=botao"
              className="font-semibold text-burgundy underline-offset-4 hover:underline"
            >
              Botão flutuante
            </Link>
            .
          </p>


          {/* A grade tem horário, mas nenhum chega à conversa: sem este aviso o
              advogado vê "35 horários por semana" e acha que está tudo no ar. */}
          {upcomingSlots === 0 && weeklySlotCount(config) > 0 && (
            <p className="rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-brass-deep">
              Agora nenhum horário aparece para quem abre seu perfil: nos próximos{' '}
              {config.horizonDays} {config.horizonDays === 1 ? 'dia' : 'dias'}, os horários da grade
              já estão fechados ou caem antes da antecedência mínima. Aumente o “Aceitar até” ou
              libere algum horário.
            </p>
          )}

          {/* resumo do que o visitante vai ver */}
          <div className="flex items-start gap-2.5 rounded-lg border border-ink/10 bg-paper-soft/60 px-3.5 py-3">
            <CheckIcon width={16} height={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-brass-deep" />
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">
                {weeklySlotCount(config)} horários por semana
              </span>{' '}
              na sua grade — {upcomingSlots} deles já aparecem para quem abre seu perfil agora,
              distribuídos em {upcoming.length} {upcoming.length === 1 ? 'dia' : 'dias'}.
            </p>
          </div>

        </>
      )}
    </div>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Escolha curta (duração/antecedência/horizonte) — segmentado, sem <select> nativo.
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number
  options: { value: number; label: string }[]
  onChange: (v: number) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              value === o.value
                ? 'border-burgundy bg-burgundy/[0.07] text-burgundy'
                : 'border-ink/15 text-ink-soft hover:border-brass/50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
