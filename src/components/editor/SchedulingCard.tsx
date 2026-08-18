import type { Profile, SchedulingMode } from '@/lib/types'
import { canUseScheduling } from '@/lib/plans'
import { Field, TextInput } from './fields'
import { InfoTip } from './InfoTip'
import { LockIcon, WhatsappIcon } from '@/components/ui/icons'

const MODES: { key: SchedulingMode; label: string; hint: string }[] = [
  { key: 'off', label: 'Sem agendamento', hint: 'O botão “Agendar” não aparece no perfil.' },
  {
    key: 'whatsapp',
    label: 'Agendar pelo WhatsApp',
    hint: 'O cliente informa o assunto e o horário; a mensagem chega no seu WhatsApp.',
  },
  { key: 'external', label: 'Link externo', hint: 'Abre seu Calendly ou “Horários de agendamento” do Google.' },
]

export function SchedulingCard({
  profile,
  set,
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  /** modo espectro: ignora a trava de plano e mostra os controles (dentro do
      LockedFeature, inertes e borrados). */
  preview?: boolean
}) {
  const schedulingLocked = !canUseScheduling(profile.plan)
  const mode: SchedulingMode = preview
    ? 'whatsapp'
    : profile.schedulingMode === ('native' as SchedulingMode)
      ? 'whatsapp'
      : profile.schedulingMode ?? (profile.contact.scheduling ? 'external' : 'off')

  // Trava de plano: sem preview, mostra só um aviso curto (o Editor envolve isso
  // num LockedFeature com o espectro real). Com preview, cai direto nos controles.
  if (schedulingLocked && !preview) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-3">
        <LockIcon width={16} height={16} className="mt-0.5 shrink-0 text-brass-deep" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-brass-deep">Recurso Pro e Premium.</span> Deixe o cliente
          pedir uma consulta pelo seu perfil — ele informa o assunto e o horário, e você recebe tudo
          direto no seu WhatsApp. Faça upgrade para liberar.
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

      {mode === 'whatsapp' && (
        <div className="space-y-3 rounded-lg border border-ink/10 bg-paper-soft/60 p-3.5">
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-soft">
            <WhatsappIcon width={16} height={16} className="mt-0.5 shrink-0 text-brass-deep" />
            No seu perfil aparece o botão <span className="font-medium text-ink">Agendar uma consulta</span>.
            O cliente preenche o assunto e a preferência de dia/horário, e você recebe uma mensagem
            pronta no WhatsApp — sem calendário, sem trocar dezenas de mensagens.
          </p>
          {!profile.contact.whatsapp && (
            <p className="rounded-lg bg-brass/[0.08] px-3 py-2 text-[12px] leading-relaxed text-brass-deep">
              Adicione seu número em <span className="font-semibold">Seus canais</span> (WhatsApp) para
              receber os pedidos de agendamento.
            </p>
          )}
        </div>
      )}

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
    </div>
  )
}
