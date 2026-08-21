import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { getTheme, themeStyle } from '@/lib/themes'
import { useDialog } from '@/lib/a11y'
import { Avatar } from '@/components/ui/Avatar'
import { ArrowRight, CalendarIcon, SparkIcon, WhatsappIcon, XIcon } from '@/components/ui/icons'
import {
  Bubble,
  cap,
  Chip,
  ChipRow,
  Composer,
  Summary,
  TypingDots,
} from '@/components/assistant/pieces'
import { useConversation, usePinnedToBottom } from '@/components/assistant/useConversation'
import {
  assistantTitle,
  assistantWhatsappHref,
  buildAssistantDays,
  firstName,
  formatChoice,
  MAX_DAY_CHIPS,
  resolveAssistantConfig,
  type AssistantAnswers,
  type AssistantDayOption,
} from '@/lib/assistant'

// Assistente virtual: uma conversa GUIADA (não é IA, não interpreta texto livre) que
// coleta dia, horário, formato e assunto e entrega tudo pronto no WhatsApp do advogado.
// Cada resposta do visitante é uma escolha entre opções que o próprio advogado marcou —
// o único campo livre é o "detalhe" e o nome.
//
// Conformidade: o roteiro é operacional. Ele não avalia o caso, não estima chances, não
// fala de honorários e não insiste — apenas organiza um pedido de horário (Prov. 205/2021).

type Step = 'boot' | 'day' | 'time' | 'format' | 'subject' | 'detail' | 'name' | 'done'

const STEP_ORDER: Step[] = ['day', 'time', 'format', 'subject', 'detail', 'name', 'done']
const OTHER_SUBJECT = 'Outro assunto'

export function AssistantChat({
  profile,
  onClose,
  variant = 'sheet',
  fullPage = false,
  autoStart = true,
  pace = 1,
}: {
  profile: Profile
  /** ausente no modo 'inline' (demonstração embutida) */
  onClose?: () => void
  /**
   * 'page'   = tela inteira, com endereço próprio (/:slug/agendar) — o padrão no perfil;
   * 'inline' = embutido numa página (ex.: a vitrine da home);
   * 'sheet'  = folha sobreposta (legado; a conversa saiu dos modais).
   */
  variant?: 'sheet' | 'inline' | 'page'
  /** atalho de `variant="page"` para quem chama a partir da rota */
  fullPage?: boolean
  /**
   * Quando a conversa deve COMEÇAR a se escrever. No perfil ela abre por clique e
   * já nasce em cena, então o padrão é `true`. Na vitrine da home o componente é
   * montado com a página inteira: sem esta trava, a saudação e o "digitando…"
   * aconteciam antes de alguém rolar até lá, e o visitante encontrava a conversa
   * pronta — o efeito que mais vende o recurso simplesmente não era visto.
   */
  autoStart?: boolean
  /**
   * Multiplicador do ritmo da conversa. 1 = ritmo do perfil real, onde quem está
   * ali quer marcar e pressa é cortesia. Acima de 1 desacelera — é o que a
   * vitrine da home usa: lá o objetivo não é agendar, é ASSISTIR o assistente
   * trabalhar, e no ritmo normal a abertura inteira passava antes de a pessoa
   * terminar de ler a primeira frase.
   */
  pace?: number
}) {
  const config = useMemo(() => resolveAssistantConfig(profile.assistant), [profile.assistant])
  const days = useMemo(() => buildAssistantDays(config), [config])
  const areas = useMemo(
    () => profile.areas.map((a) => a.label.trim()).filter(Boolean),
    [profile.areas],
  )
  const bothFormats = profile.serviceMode.inPerson && profile.serviceMode.online
  const soloFormat = profile.serviceMode.online ? 'online' : 'presencial'
  const first = firstName(profile.name)

  // Falas, "digitando…" e o cancelamento das falas pendentes vivem no motor
  // compartilhado com o assistente do escritório (components/assistant).
  const { msgs, typing, push, say: falar, reset, reduced, listRef } = useConversation({ pace })
  const [step, setStep] = useState<Step>('boot')
  const [answers, setAnswers] = useState<AssistantAnswers>({})
  const [showAllDays, setShowAllDays] = useState(false)
  const [draft, setDraft] = useState('')

  const panelRef = useRef<HTMLDivElement>(null)

  // O trap de foco só vale no modo diálogo. `closeRef` mantém o callback estável:
  // a conversa re-renderiza muito (digitando…) e um efeito re-executado roubaria o foco.
  const nullRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const requestClose = useCallback(() => closeRef.current?.(), [])
  useDialog(variant === 'sheet' ? panelRef : nullRef, requestClose)

  // Açúcar em cima do motor: as transições do roteiro continuam se lendo como
  // "diz isto e vai para o passo tal".
  const say = useCallback(
    (lines: string[], next?: Step) => falar(lines, next ? () => setStep(next) : undefined),
    [falar],
  )

  const start = useCallback(() => {
    reset()
    setAnswers({})
    setShowAllDays(false)
    setDraft('')
    setStep('boot')
    const custom = config.greeting?.trim()
    const opening = custom
      ? [custom]
      : [
          `Olá! Sou o assistente virtual${first ? ` de ${first}` : ''}.`,
          'Posso reservar um horário de conversa. Não presto orientação jurídica — só organizo o pedido e encaminho.',
        ]
    void say(days.length ? [...opening, 'Qual dia fica melhor para você?'] : opening, days.length ? 'day' : 'done')
  }, [config.greeting, days.length, first, say, reset])

  useAutoStart(start, autoStart)
  usePinnedToBottom(listRef, [msgs, typing, step])

  // ---- Transições ----

  function pickDay(day: AssistantDayOption) {
    push('user', `${day.label}${day.relative ? ` (${day.relative})` : ''}`)
    setAnswers((a) => ({ ...a, day, time: undefined }))
    void say(
      [`${cap(day.longLabel)}, então. Que horário prefere?`],
      'time',
    )
  }

  function backToDays() {
    push('user', 'Prefiro outro dia')
    setAnswers((a) => ({ ...a, day: undefined, time: undefined }))
    void say(['Claro. Estes são os dias disponíveis:'], 'day')
  }

  function pickTime(time: string) {
    push('user', time)
    setAnswers((a) => ({ ...a, time }))
    if (bothFormats) {
      void say(['Anotado. A conversa seria presencial ou online?'], 'format')
      return
    }
    setAnswers((a) => ({ ...a, time, format: soloFormat }))
    askSubject()
  }

  function pickFormat(format: string) {
    push('user', cap(format))
    setAnswers((a) => ({ ...a, format }))
    askSubject()
  }

  function askSubject() {
    if (!areas.length) {
      void say(['Sobre qual assunto seria a conversa? Pode escrever em poucas palavras.'], 'detail')
      return
    }
    void say(['Sobre qual assunto seria a conversa?'], 'subject')
  }

  function pickSubject(subject: string) {
    push('user', subject)
    if (subject === OTHER_SUBJECT) {
      setAnswers((a) => ({ ...a, subject: undefined }))
      void say(['Sem problema. Escreva em poucas palavras o assunto.'], 'detail')
      return
    }
    setAnswers((a) => ({ ...a, subject }))
    void say(['Se quiser, acrescente uma frase de contexto. É opcional.'], 'detail')
  }

  function sendDetail(text: string) {
    const value = text.trim()
    if (value) {
      push('user', value)
      setAnswers((a) => ({ ...a, subject: a.subject ?? value, detail: a.subject ? value : undefined }))
    } else {
      push('user', 'Prefiro não detalhar agora')
    }
    setDraft('')
    void say(['Por último: como posso te chamar?'], 'name')
  }

  function sendName(text: string) {
    const value = text.trim()
    if (!value) return
    push('user', value)
    setAnswers((a) => ({ ...a, name: value }))
    setDraft('')
    void say(
      [
        `Prazer, ${firstName(value)}. Registrei seu pedido.`,
        'Toque no botão abaixo para enviar tudo pelo WhatsApp — o horário só vale depois da confirmação.',
      ],
      'done',
    )
  }

  // ---- Dados derivados da tela atual ----

  const dayOptions = showAllDays ? days : days.slice(0, MAX_DAY_CHIPS)
  const times = answers.day?.times ?? []
  const answered = STEP_ORDER.indexOf(step)
  const progress = step === 'boot' ? 0 : Math.min(1, answered / (STEP_ORDER.length - 1))
  const href = assistantWhatsappHref(profile, answers, config.durationMin)
  // Sem horário escolhido não há pedido: o fim da conversa vira só um recado.
  const ready = step === 'done' && !!answers.time && !!href

  const modo = fullPage ? 'page' : variant
  const sheet = modo === 'sheet'
  // Página inteira: sem overlay, sem foco preso, com endereço próprio. É o modo
  // do perfil desde que a conversa deixou de ser modal — no celular ela precisa
  // da tela toda (o teclado sobe e uma folha de 92dvh vira uma fresta).
  const page = modo === 'page'

  const body = (
    <div
      ref={panelRef}
      role={sheet ? 'dialog' : undefined}
      aria-modal={sheet ? true : undefined}
      aria-label={sheet ? assistantTitle(profile) : undefined}
      className={`themed flex w-full flex-col overflow-hidden ${
        sheet
          ? 'mx-auto h-[92dvh] max-w-[440px] rounded-t-[26px] shadow-lift sm:h-[min(88dvh,680px)] sm:rounded-[26px]'
          : page
            ? // Centralizado e com altura de tela: no desktop a conversa não se
              // esparrama pela largura toda, no celular ocupa tudo.
              'mx-auto h-dvh max-w-[520px]'
            : 'h-full'
      }`}
      style={themeStyle(profile.theme)}
    >
      {/* Cabeçalho: quem está falando fica explícito — assistente, não o advogado. */}
      <header
        className={`relative z-10 flex shrink-0 items-center gap-3 px-4 pb-3.5 ${
          sheet || page ? 'pt-3.5' : 'pt-8'
        }`}
        style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
      >
        <span className="relative shrink-0">
          <Avatar src={profile.avatarUrl} name={profile.name} size={42} frame="circle" />
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full"
            style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
            aria-hidden
          >
            <SparkIcon width={11} height={11} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15.5px] font-semibold leading-tight">
            Assistente virtual
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-tight">
            <span className="t-faint truncate">de {profile.name}</span>
            {/* Deixa explícito que quem responde é um robô — nunca o(a) advogado(a). */}
            <span
              className="shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider"
              style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
            >
              Automático
            </span>
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={page ? 'Voltar ao perfil' : 'Fechar a conversa'}
            className="t-faint -mr-1 shrink-0 rounded-full p-2 transition-colors hover:bg-[var(--c-accent-soft)]"
          >
            {/* Em página o gesto é VOLTAR (seta), não fechar (X): a pessoa não está
                por cima do perfil, está numa tela seguinte. */}
            {page ? (
              <ArrowRight width={18} height={18} className="rotate-180" />
            ) : (
              <XIcon width={18} height={18} />
            )}
          </button>
        )}
      </header>

      {/* Fio de progresso — mostra o quanto falta sem transformar isso num formulário. */}
      <div className="relative z-10 h-[2px] shrink-0" style={{ background: 'var(--c-border)' }}>
        <motion.div
          className="h-full origin-left"
          style={{ background: 'var(--c-accent)' }}
          initial={false}
          animate={{ scaleX: progress }}
          transition={{ duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Conversa. `min-h-0` é essencial: sem isso o item flex cresce com o conteúdo
          (min-height:auto), a lista para de rolar e o painel corta as mensagens. */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Conversa com o assistente virtual"
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5"
      >
        {/* mt-auto: com poucas mensagens a conversa fica ancorada embaixo, como num
            mensageiro — e continua rolando normalmente quando cresce. */}
        <div className="mt-auto space-y-2.5">
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <Bubble key={m.id} from={m.from} text={m.text} reduced={!!reduced} />
          ))}
        </AnimatePresence>
        {typing && <TypingDots />}
        {ready && (
          <Summary
            title="Pedido de horário"
            rows={summaryRows(answers, config.durationMin)}
            reduced={reduced}
          />
        )}
        </div>
      </div>

      {/* Área de resposta — chips ou campo de texto, conforme a etapa */}
      <div
        className="relative z-10 shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step + (typing ? '-t' : '')}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            {typing ? (
              <p className="t-faint py-2 text-center text-[12px]">…</p>
            ) : step === 'day' ? (
              <ChipRow label="Escolha um dia">
                {dayOptions.map((d) => (
                  <Chip key={d.key} onClick={() => pickDay(d)}>
                    <CalendarIcon width={14} height={14} className="t-accent" />
                    {d.label}
                    {d.relative && <em className="t-faint not-italic">· {d.relative}</em>}
                  </Chip>
                ))}
                {!showAllDays && days.length > MAX_DAY_CHIPS && (
                  <Chip subtle onClick={() => setShowAllDays(true)}>
                    Ver mais dias
                  </Chip>
                )}
              </ChipRow>
            ) : step === 'time' ? (
              <ChipRow label="Escolha um horário">
                {times.map((t) => (
                  <Chip key={t} onClick={() => pickTime(t)}>
                    {t}
                  </Chip>
                ))}
                <Chip subtle onClick={() => backToDays()}>
                  Outro dia
                </Chip>
              </ChipRow>
            ) : step === 'format' ? (
              <ChipRow label="Formato do atendimento">
                <Chip onClick={() => pickFormat('presencial')}>Presencial</Chip>
                <Chip onClick={() => pickFormat('online')}>Online</Chip>
              </ChipRow>
            ) : step === 'subject' ? (
              <ChipRow label="Assunto">
                {areas.map((a) => (
                  <Chip key={a} onClick={() => pickSubject(a)}>
                    {a}
                  </Chip>
                ))}
                <Chip subtle onClick={() => pickSubject(OTHER_SUBJECT)}>
                  {OTHER_SUBJECT}
                </Chip>
              </ChipRow>
            ) : step === 'detail' ? (
              <Composer
                value={draft}
                onChange={setDraft}
                onSend={() => sendDetail(draft)}
                placeholder={answers.subject ? 'Escreva uma frase (opcional)' : 'Escreva o assunto'}
                label="Assunto da conversa"
                skipLabel={answers.subject ? 'Pular' : undefined}
                onSkip={answers.subject ? () => sendDetail('') : undefined}
                canSend={answers.subject ? true : draft.trim().length > 1}
              />
            ) : step === 'name' ? (
              <Composer
                value={draft}
                onChange={setDraft}
                onSend={() => sendName(draft)}
                placeholder="Seu nome"
                label="Seu nome"
                canSend={draft.trim().length > 1}
              />
            ) : ready ? (
              <div className="space-y-2">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="t-btn w-full !py-3.5 text-[15px]"
                >
                  <WhatsappIcon width={20} height={20} />
                  Enviar no WhatsApp
                  <ArrowRight width={16} height={16} />
                </a>
                <button
                  type="button"
                  onClick={start}
                  className="t-faint w-full py-1 text-center text-[12.5px] font-medium underline-offset-4 hover:underline"
                >
                  Escolher outro horário
                </button>
              </div>
            ) : step === 'done' ? (
              <p className="t-faint py-2 text-center text-[12.5px] leading-relaxed">
                {profile.contact.whatsapp
                  ? 'Nenhum horário está aberto por aqui no momento.'
                  : 'Este perfil ainda não informou um WhatsApp para receber o pedido.'}
              </p>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <p className="t-faint mt-2.5 text-center text-[10.5px] leading-relaxed opacity-90">
          Assistente automático. Não presta orientação jurídica e não confirma o horário —
          quem confirma é {first || 'o(a) advogado(a)'}.
        </p>
      </div>
    </div>
  )

  // Em página, o fundo da tela também é o do tema do perfil: a conversa continua
  // sendo "a casa" do advogado, não uma tela branca do sistema.
  if (page) {
    return (
      <div
        className={`themed min-h-dvh w-full surf-${getTheme(profile.theme).style.surface}`}
        style={themeStyle(profile.theme)}
      >
        {body}
      </div>
    )
  }

  if (!sheet) return body

  // Portal para o <body>: dentro do perfil, `.themed > *` força position:relative e
  // um overlay `fixed` deixaria de cobrir a tela.
  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full sm:flex sm:w-auto sm:justify-center"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </motion.div>
    </motion.div>,
    document.body,
  )
}

// Linhas do "comprovante" mostrado antes de enviar. O cartão em si é compartilhado
// (components/assistant/pieces); o que muda entre os assistentes é o conteúdo.
function summaryRows(answers: AssistantAnswers, durationMin: number): [string, string][] {
  return [
    ['Quando', formatChoice(answers)],
    ['Duração', `${durationMin} minutos`],
    answers.format ? ['Formato', cap(answers.format)] : null,
    answers.subject ? ['Assunto', answers.subject] : null,
    answers.detail ? ['Contexto', answers.detail] : null,
    answers.name ? ['Nome', answers.name] : null,
  ].filter(Boolean) as [string, string][]
}

// Dispara a conversa quando o componente entra em cena (ver a prop autoStart).
function useAutoStart(start: () => void, autoStart: boolean) {
  useEffect(() => {
    if (autoStart) start()
  }, [start, autoStart])
}
