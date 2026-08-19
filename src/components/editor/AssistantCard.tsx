import { useMemo, useState } from 'react'
import type { AssistantConfig, Profile } from '@/lib/types'
import { WEEKDAYS_FULL, WEEKDAYS_SHORT } from '@/lib/booking'
import {
  buildAssistantDays,
  DEFAULT_ASSISTANT_CONFIG,
  normalizeTimes,
  resolveAssistantConfig,
  TIME_PRESETS,
  timeToMin,
  weeklySlotCount,
} from '@/lib/assistant'
import { checkCompliance } from '@/lib/oab'
import { Field, TextArea } from './fields'
import { InfoTip } from './InfoTip'
import { MarginNotes } from './MarginNotes'
import { CalendarIcon, CheckIcon, WhatsappIcon } from '@/components/ui/icons'

// Disponibilidade do assistente virtual: o advogado marca os dias da semana que
// atende e, dentro de cada dia, os horários que aceita oferecer. É só isso que o
// assistente sabe — ele nunca inventa um horário fora dessa grade.

const DEFAULT_TIMES = ['09:00', '10:00', '14:00', '15:00', '16:00']
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

export function AssistantCard({
  profile,
  set,
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  /** modo espectro (dentro do cadeado): controles inertes, só para o advogado ver */
  preview?: boolean
}) {
  const config = useMemo(
    () => resolveAssistantConfig(profile.assistant ?? DEFAULT_ASSISTANT_CONFIG),
    [profile.assistant],
  )
  const activeWeekdays = config.days.map((d) => d.weekday)
  const [selected, setSelected] = useState<number>(activeWeekdays[0] ?? 1)
  const focusDay = activeWeekdays.includes(selected) ? selected : activeWeekdays[0]
  const focusTimes = config.days.find((d) => d.weekday === focusDay)?.times ?? []

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
      : [...config.days, { weekday, times: [...(focusTimes.length ? focusTimes : DEFAULT_TIMES)] }].sort(
          (a, b) => a.weekday - b.weekday,
        )
    patch({ days })
    if (!has) setSelected(weekday)
  }

  function toggleTime(time: string) {
    if (focusDay === undefined) return
    const current = config.days.find((d) => d.weekday === focusDay)?.times ?? []
    const times = current.includes(time)
      ? current.filter((t) => t !== time)
      : normalizeTimes([...current, time])
    // Dia sem nenhum horário deixa de ser atendido — evita "dia fantasma" na conversa.
    const days = times.length
      ? config.days.map((d) => (d.weekday === focusDay ? { ...d, times } : d))
      : config.days.filter((d) => d.weekday !== focusDay)
    patch({ days })
  }

  function copyToAllDays() {
    if (focusDay === undefined) return
    patch({ days: config.days.map((d) => ({ ...d, times: [...focusTimes] })) })
  }

  const noDays = !config.days.length

  return (
    <div className={`space-y-5 ${preview ? 'pointer-events-none select-none' : ''}`}>
      <div className="flex items-start gap-2">
        <CalendarIcon width={16} height={16} className="mt-0.5 shrink-0 text-brass-deep" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          No seu perfil aparece um <span className="font-medium text-ink">assistente virtual</span>{' '}
          que conversa com quem chega, oferece só os horários marcados aqui e envia o pedido pronto
          para o seu WhatsApp. Nada é confirmado sem você.
        </p>
      </div>

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
          {/* 2 — horários do dia em foco */}
          <div>
            <span className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">Horários oferecidos</span>
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
            <div className="mb-2.5 flex flex-wrap gap-1.5">
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

            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {TIME_PRESETS.map((t) => {
                const on = focusTimes.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTime(t)}
                    className={`rounded-lg border py-2 text-[12.5px] tabular-nums transition-colors ${
                      on
                        ? 'border-burgundy bg-burgundy/[0.10] font-semibold text-burgundy'
                        : 'border-ink/12 bg-paper-soft font-medium text-ink-faint hover:border-ink/30'
                    }`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>

            {/* horário fora da grade (ex.: 07:15) */}
            <label className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
              Outro horário
              <input
                type="time"
                step={300}
                onChange={(e) => {
                  const v = e.target.value
                  if (Number.isFinite(timeToMin(v)) && !focusTimes.includes(v)) toggleTime(v)
                }}
                className="rounded-lg border border-ink/15 bg-paper-soft px-2.5 py-1.5 text-[13px] text-ink focus:border-burgundy focus:outline-none"
                aria-label="Adicionar outro horário ao dia selecionado"
              />
              {focusTimes.filter((t) => !TIME_PRESETS.includes(t)).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTime(t)}
                  className="inline-flex items-center gap-1 rounded-full border border-burgundy bg-burgundy/[0.07] px-2.5 py-1 text-[12px] font-medium text-burgundy"
                  aria-label={`Remover o horário ${t}`}
                >
                  {t} ×
                </button>
              ))}
            </label>
          </div>

          {/* 3 — regras da conversa */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Choice
              label="Duração"
              value={config.durationMin}
              options={DURATIONS.map((d) => ({ value: d, label: `${d} min` }))}
              onChange={(durationMin) => patch({ durationMin })}
            />
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

          {/* 4 — abertura da conversa */}
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

          {!profile.contact.whatsapp && (
            <div className="flex items-start gap-2 rounded-lg bg-brass/[0.08] px-3 py-2.5">
              <WhatsappIcon width={15} height={15} className="mt-0.5 shrink-0 text-brass-deep" />
              <p className="text-[12px] leading-relaxed text-brass-deep">
                Adicione seu número em <span className="font-semibold">Seus canais</span> — é para lá
                que o assistente envia os pedidos.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

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
