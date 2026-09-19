import type { Profile, SchedulingMode } from '@/lib/types'
import { canUseScheduling } from '@/lib/plans'
import { etapaNaConversa } from '@/lib/triagem'
import { Field, TextInput } from './fields'
import { InfoTip } from './InfoTip'
import { AssistantCard } from './AssistantCard'
import { ArrowRight, CalendarIcon, CheckIcon, ExternalLinkIcon, LockIcon, MailIcon, SparkIcon, WhatsappIcon } from '@/components/ui/icons'

const MODES = [
  { key: 'off', label: 'WhatsApp direto', hint: 'Conversa imediata, sem escolher horário.', icon: WhatsappIcon },
  {
    key: 'assistant',
    label: 'Assistente com horários',
    hint: 'Conversa guiada com os horários que você definir.',
    icon: SparkIcon,
  },
  {
    key: 'whatsapp',
    label: 'Pedido por formulário',
    hint: 'Contato, assunto e horário preferido em poucos campos.',
    icon: CalendarIcon,
  },
  { key: 'external', label: 'Agenda externa', hint: 'Abre seu link de reservas no Calendly ou Google.', icon: ExternalLinkIcon },
] as const satisfies { key: SchedulingMode; label: string; hint: string; icon: typeof WhatsappIcon }[]

export function SchedulingCard({
  profile,
  set,
  preview = false,
  irPara,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  /** modo espectro: ignora a trava de plano e mostra os controles (dentro do
      LockedFeature, inertes e borrados). */
  preview?: boolean
  /** sai do editor gravando o que estiver em voo (ver Editor.irPara) */
  irPara?: (destino: string) => void
}) {
  const schedulingLocked = !canUseScheduling(profile.plan)
  const mode: SchedulingMode = preview
    ? 'assistant'
    : profile.schedulingMode === ('native' as SchedulingMode)
      ? 'whatsapp'
      : profile.schedulingMode ?? (profile.contact.scheduling ? 'external' : 'off')
  const acceptsRequests = mode === 'assistant' || mode === 'whatsapp'
  const canChooseDestination = profile.plan === 'premium' && acceptsRequests
  const receivesInPanel = canChooseDestination && !!profile.meetingInboxEnabled
  const scheduleQuestionEnabled = etapaNaConversa(profile, 'horario')
  const suggestsTimes = mode === 'assistant' && scheduleQuestionEnabled
  const needsWhatsapp = mode === 'off' || (acceptsRequests && !receivesInPanel)
  const result = mode === 'off'
    ? { button: 'Conversar no WhatsApp', detail: 'O visitante fala diretamente com você. Não há pedido de horário nem confirmação prévia.' }
    : mode === 'external'
      ? { button: 'Agendar', detail: 'O visitante abre sua página externa para escolher um horário. O botão aparece após você informar o link.' }
      : mode === 'assistant'
        ? suggestsTimes
          ? receivesInPanel
            ? { button: 'Solicitar uma reunião', detail: 'O assistente sugere horários da sua grade; contato e triagem chegam às Solicitações. Você combina e confirma o horário no painel.' }
            : { button: 'Agendar uma conversa', detail: 'O assistente sugere horários da sua grade e prepara uma mensagem para o visitante enviar ao seu WhatsApp.' }
          : receivesInPanel
            ? { button: 'Solicitar uma reunião', detail: 'O assistente recebe o contato e a triagem sem pedir horário. Você combina a data e confirma em Solicitações; o compromisso entra na agenda.' }
            : { button: 'Agendar uma conversa', detail: 'O assistente recebe a triagem sem pedir horário e prepara a mensagem para seu WhatsApp. Você combina a data diretamente com a pessoa.' }
        : receivesInPanel
          ? { button: 'Solicitar uma reunião', detail: 'O visitante informa contato, assunto e horário preferido. O pedido chega às Solicitações para você responder.' }
          : { button: 'Agendar uma consulta', detail: 'O visitante informa assunto e horário preferido; uma mensagem pronta abre no WhatsApp.' }

  // Trava de plano: sem preview, mostra só um aviso curto (o Editor envolve isso
  // num LockedFeature com o espectro real). Com preview, cai direto nos controles.
  if (schedulingLocked && !preview) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-3">
        <LockIcon width={16} height={16} className="mt-0.5 shrink-0 text-brass-deep" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-brass-deep">Recurso Pro e Max.</span> Escolha como as
          pessoas podem pedir contato ou horário no seu perfil. Faça upgrade para liberar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="agenda-method-title" className="space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brass-deep">01 · NO MINI-SITE</p>
          <h4 id="agenda-method-title" className="mt-1 font-display text-xl font-semibold text-ink">Como a pessoa entra em contato?</h4>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">Escolha a experiência que aparece no seu perfil.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Forma de contato no perfil">
          {MODES.map((m) => {
            const active = mode === m.key
            const Icon = m.icon
            return <button key={m.key} type="button" aria-pressed={active}
              onClick={() => set({ schedulingMode: m.key })}
              className={`group flex min-h-[100px] items-start gap-3 rounded-xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy ${active ? 'border-burgundy bg-burgundy/[0.055] shadow-[0_0_0_1px_rgba(103,36,51,0.18)]' : 'border-ink/10 bg-paper-soft/55 hover:border-brass/60 hover:bg-paper-soft'}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-burgundy text-paper' : 'bg-paper text-brass-deep'}`}><Icon width={18} height={18} aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-1 text-[13px] font-semibold leading-snug text-ink">{m.key === 'assistant' && !scheduleQuestionEnabled ? 'Assistente sem horários' : m.label}{active && <CheckIcon width={17} height={17} className="shrink-0 text-burgundy" aria-hidden />}</span><span className="mt-1.5 block text-[11.5px] leading-relaxed text-ink-soft">{m.key === 'assistant' && !scheduleQuestionEnabled ? 'Triagem e pedido de contato, sem escolha de data.' : m.hint}</span></span>
            </button>
          })}
        </div>
      </section>

      {canChooseDestination && <section aria-labelledby="agenda-destination-title" className="space-y-3 border-t border-ink/10 pt-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brass-deep">02 · DESTINO DO PEDIDO</p><h4 id="agenda-destination-title" className="mt-1 font-display text-xl font-semibold text-ink">Onde você quer receber os pedidos?</h4></div>
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Destino dos pedidos">
          <button type="button" aria-pressed={!receivesInPanel} onClick={() => set({ meetingInboxEnabled: false })}
            className={`flex min-h-[88px] items-start gap-3 rounded-xl border p-3.5 text-left transition-[border-color,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy ${!receivesInPanel ? 'border-burgundy bg-burgundy/[0.055]' : 'border-ink/10 bg-paper-soft/55 hover:border-brass/60'}`}>
            <WhatsappIcon width={21} height={21} className="mt-0.5 shrink-0 text-[#1f7a55]" aria-hidden />
            <span><strong className="block text-[13px] text-ink">No meu WhatsApp</strong><span className="mt-1 block text-[11.5px] leading-relaxed text-ink-soft">O visitante envia uma mensagem pronta.</span></span>
            {!receivesInPanel && <CheckIcon width={17} height={17} className="ml-auto shrink-0 text-burgundy" aria-hidden />}
          </button>
          <button type="button" aria-pressed={receivesInPanel} onClick={() => set({ meetingInboxEnabled: true })}
            className={`flex min-h-[88px] items-start gap-3 rounded-xl border p-3.5 text-left transition-[border-color,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy ${receivesInPanel ? 'border-burgundy bg-burgundy/[0.055]' : 'border-ink/10 bg-paper-soft/55 hover:border-brass/60'}`}>
            <MailIcon width={21} height={21} className="mt-0.5 shrink-0 text-brass-deep" aria-hidden />
            <span><strong className="block text-[13px] text-ink">No painel advoc.me</strong><span className="mt-1 block text-[11.5px] leading-relaxed text-ink-soft">Contato e triagem ficam em Solicitações.</span></span>
            {receivesInPanel && <CheckIcon width={17} height={17} className="ml-auto shrink-0 text-burgundy" aria-hidden />}
          </button>
        </div>
      </section>}

      <div className="rounded-xl border border-ink/15 bg-ink p-4 text-paper sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brass">RESULTADO NO SEU PERFIL</p>
        <p className="mt-3 text-[11px] text-paper/65">Botão que o visitante verá</p>
        <p className="mt-0.5 font-display text-[19px] font-semibold leading-tight">{result.button}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-paper/80">{result.detail}</p>
        {profile.plan === 'premium' && irPara && <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-paper/15 pt-3 text-[12px] font-semibold">
          {receivesInPanel && <button type="button" onClick={() => irPara('/agenda-digital?tab=solicitacoes')} className="inline-flex min-h-10 items-center gap-1.5 text-brass hover:text-paper">Ver solicitações <ArrowRight width={15} height={15} aria-hidden /></button>}
          <button type="button" onClick={() => irPara('/agenda-digital')} className="inline-flex min-h-10 items-center gap-1.5 text-brass hover:text-paper">Abrir minha agenda <ArrowRight width={15} height={15} aria-hidden /></button>
        </div>}
      </div>

      {needsWhatsapp && !profile.contact.whatsapp && <div className="flex items-start gap-2.5 rounded-xl border border-brass/30 bg-brass/[0.08] p-3.5 text-[12px] leading-relaxed text-brass-deep">
        <WhatsappIcon width={18} height={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>Adicione seu número em <strong>Contato e redes</strong> para receber mensagens no WhatsApp.{irPara && <button type="button" onClick={() => irPara('/editor?section=redes#whatsapp')} className="ml-1 font-semibold underline underline-offset-2">Ir para contatos</button>}</p>
      </div>}

      {mode === 'assistant' && <section aria-labelledby="agenda-hours-title" className="space-y-3 border-t border-ink/10 pt-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brass-deep">{canChooseDestination ? '03' : '02'} · DISPONIBILIDADE</p><h4 id="agenda-hours-title" className="mt-1 font-display text-xl font-semibold text-ink">Horários do assistente</h4><p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{suggestsTimes ? 'Defina os dias e horários que ele pode sugerir. A escolha da pessoa ainda é um pedido.' : 'A etapa de escolher horário foi retirada na Triagem. O assistente agora recebe apenas o pedido de contato.'}</p></div>
        {suggestsTimes ? <div className="rounded-xl border border-ink/10 bg-paper-soft/60 p-3.5 sm:p-4"><AssistantCard profile={profile} set={set} preview={preview} irPara={irPara} /></div> : <>
          <div className="rounded-xl border border-brass/30 bg-brass/[0.07] p-4 text-[12.5px] leading-relaxed text-ink-soft">
            <p>{receivesInPanel ? 'Depois de combinar a data, preencha o horário no pedido em Solicitações e confirme para adicioná-lo à sua agenda.' : 'Depois de combinar a data pelo WhatsApp, adicione o compromisso à sua agenda se você usa a agenda digital.'}</p>
            {irPara && <button type="button" onClick={() => irPara('/editor?section=triagem')} className="mt-2 font-semibold text-burgundy underline underline-offset-2">Editar a etapa na Triagem</button>}
          </div>
          <details className="rounded-xl border border-ink/10 bg-paper-soft/60 p-3.5 sm:p-4"><summary className="cursor-pointer text-[12.5px] font-semibold text-burgundy">Ver ou editar a grade guardada</summary><div className="mt-4"><AssistantCard profile={profile} set={set} preview={preview} irPara={irPara} /></div></details>
        </>}
      </section>}

      {mode === 'external' && <section aria-labelledby="agenda-external-title" className="space-y-3 border-t border-ink/10 pt-5">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brass-deep">02 · SEU LINK</p><h4 id="agenda-external-title" className="mt-1 font-display text-xl font-semibold text-ink">Página de agendamento</h4></div>
          <Field
            label="Link de agendamento"
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
          <p className="text-[11.5px] leading-relaxed text-ink-faint">Use um link de reserva, não uma agenda compartilhada. Sem link, o botão não aparece no perfil.</p>
        </section>}
    </div>
  )
}
