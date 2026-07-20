import type { Profile, SchedulingMode } from '@/lib/types'
import { DEFAULT_BOOKING_CONFIG, minToLabel, WEEKDAYS_SHORT } from '@/lib/booking'
import { canUseScheduling } from '@/lib/plans'
import { Field, TextInput } from './fields'
import { InfoTip } from './InfoTip'
import { LockIcon } from '@/components/ui/icons'

// "HH:MM" → minutos desde a meia-noite. Vazio/ inválido → fallback.
function labelToMin(v: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v)
  if (!m) return fallback
  return Math.min(1439, Math.max(0, Number(m[1]) * 60 + Number(m[2])))
}

const MODES: { key: SchedulingMode; label: string; hint: string }[] = [
  { key: 'off', label: 'Sem agendamento', hint: 'O botão “Agendar” não aparece no perfil.' },
  { key: 'external', label: 'Link externo', hint: 'Abre seu Calendly ou “Horários de agendamento” do Google.' },
  { key: 'native', label: 'Agenda no advoc.me', hint: 'O cliente marca dia e horário; você aceita ou recusa.' },
]

const SLOT_OPTIONS = [15, 20, 30, 45, 60, 90]
const LEAD_OPTIONS = [
  { v: 0, label: 'Sem antecedência' },
  { v: 2, label: '2 horas antes' },
  { v: 6, label: '6 horas antes' },
  { v: 12, label: '12 horas antes' },
  { v: 24, label: '1 dia antes' },
  { v: 48, label: '2 dias antes' },
]
const HORIZON_OPTIONS = [7, 14, 30, 60, 90]

const selectCls =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] text-ink ' +
  'focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

export function SchedulingCard({
  profile,
  set,
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  /** modo espectro: ignora a trava de plano e mostra os controles (usado dentro
      de um envelope LockedFeature, onde ficam inertes e borrados). */
  preview?: boolean
}) {
  const schedulingLocked = !canUseScheduling(profile.plan)
  // No preview forçamos "native" para revelar a agenda cheia (o espaço que o
  // advogado teria); fora do preview, respeitamos o modo real do perfil.
  const mode: SchedulingMode = preview
    ? 'native'
    : profile.schedulingMode ?? (profile.contact.scheduling ? 'external' : 'off')
  const cfg = profile.booking ?? DEFAULT_BOOKING_CONFIG
  const patchCfg = (p: Partial<typeof cfg>) => set({ booking: { ...cfg, ...p } })
  const toggleDay = (d: number) => {
    const has = cfg.weekdays.includes(d)
    const next = has ? cfg.weekdays.filter((x) => x !== d) : [...cfg.weekdays, d].sort((a, b) => a - b)
    patchCfg({ weekdays: next })
  }

  // Trava de plano: sem preview, mostra só um aviso curto (o Editor envolve isso
  // num LockedFeature com o espectro real). Com preview, cai direto nos controles.
  if (schedulingLocked && !preview) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-3">
        <LockIcon width={16} height={16} className="mt-0.5 shrink-0 text-brass-deep" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-brass-deep">Recurso Pro e Premium.</span> Ofereça
          agendamento no seu perfil — um link do Calendly/Google ou a agenda própria do advoc.me
          (o cliente marca dia e hora e você aceita ou recusa). Faça upgrade para liberar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Seletor de modo — segmented, empilha no mobile */}
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Modo de agendamento">
        {MODES.map((m) => {
          const active = mode === m.key
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set({ schedulingMode: m.key })}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'border-burgundy bg-burgundy/[0.06] ring-1 ring-burgundy/30'
                  : 'border-ink/15 bg-paper-soft hover:border-ink/30'
              }`}
            >
              <span className="block text-[13px] font-semibold text-ink">{m.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{m.hint}</span>
            </button>
          )
        })}
      </div>

      {mode === 'external' && (
        <>
          <Field
            label="Link de agendamento"
            hint="opcional"
            info={
              <InfoTip
                title="Qual link usar aqui"
                align="left"
                label="Ajuda sobre o link de agendamento"
                items={[
                  'Cole um link de agendamento — o cliente escolhe um horário livre e marca sozinho.',
                  'Funciona com Calendly (ex.: calendly.com/seu-nome/30min).',
                  'Funciona com o Google: use “Horários de agendamento” (gera um link público de reserva).',
                  'Não use o link de uma agenda compartilhada do Google — ela só mostra a agenda, não deixa marcar.',
                ]}
              />
            }
          >
            <TextInput
              value={profile.contact.scheduling ?? ''}
              onChange={(e) => set({ contact: { ...profile.contact, scheduling: e.target.value } })}
              placeholder="https://calendly.com/seu-nome/consulta"
            />
          </Field>
          <p className="-mt-2 text-[11.5px] leading-relaxed text-ink-faint">
            Página de agendamento (Calendly ou “Horários de agendamento” do Google) — não a agenda
            compartilhada. Se ficar em branco, o botão “Agendar” não aparece no perfil.
          </p>
        </>
      )}

      {mode === 'native' && (
        <div className="space-y-4 rounded-lg border border-ink/10 bg-paper-soft/60 p-3.5">
          <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-faint">
            Defina quando você atende. O cliente vê só os horários livres, marca um e deixa o WhatsApp;
            você recebe a solicitação na sua{' '}
            <span className="whitespace-nowrap font-medium text-ink">Agenda</span> para aceitar ou recusar.
          </p>

          {/* Dias da semana */}
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">Dias de atendimento</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS_SHORT.map((d, i) => {
                const active = cfg.weekdays.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDay(i)}
                    className={`h-9 min-w-[44px] flex-1 rounded-lg border text-[12.5px] font-medium capitalize transition-colors ${
                      active
                        ? 'border-burgundy bg-burgundy text-paper-soft'
                        : 'border-ink/15 bg-paper text-ink-faint hover:border-ink/30'
                    }`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Horário de expediente */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <TextInput
                type="time"
                value={minToLabel(cfg.startMin)}
                onChange={(e) => patchCfg({ startMin: labelToMin(e.target.value, cfg.startMin) })}
              />
            </Field>
            <Field label="Fim">
              <TextInput
                type="time"
                value={minToLabel(cfg.endMin)}
                onChange={(e) => patchCfg({ endMin: labelToMin(e.target.value, cfg.endMin) })}
              />
            </Field>
          </div>

          {/* Duração / antecedência / janela */}
          <Field label="Duração de cada consulta">
            <select
              className={selectCls}
              value={cfg.slotMin}
              onChange={(e) => patchCfg({ slotMin: Number(e.target.value) })}
            >
              {SLOT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v} minutos
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Antecedência mínima">
              <select
                className={selectCls}
                value={cfg.leadHours}
                onChange={(e) => patchCfg({ leadHours: Number(e.target.value) })}
              >
                {LEAD_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marcar até">
              <select
                className={selectCls}
                value={cfg.horizonDays}
                onChange={(e) => patchCfg({ horizonDays: Number(e.target.value) })}
              >
                {HORIZON_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v} dias à frente
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {cfg.endMin <= cfg.startMin && (
            <p className="text-[11.5px] font-medium text-burgundy">
              O horário final precisa ser depois do inicial.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
