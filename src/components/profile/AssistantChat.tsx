import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { themeStyle } from '@/lib/themes'
import { useDialog } from '@/lib/a11y'
import { Avatar } from '@/components/ui/Avatar'
import {
  ArrowRight,
  CalendarIcon,
  CheckIcon,
  SparkIcon,
  WhatsappIcon,
  XIcon,
} from '@/components/ui/icons'
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

interface Msg {
  id: number
  from: 'bot' | 'user'
  text: string
}

const STEP_ORDER: Step[] = ['day', 'time', 'format', 'subject', 'detail', 'name', 'done']
const OTHER_SUBJECT = 'Outro assunto'

export function AssistantChat({
  profile,
  onClose,
  variant = 'sheet',
}: {
  profile: Profile
  /** ausente no modo 'inline' (demonstração embutida) */
  onClose?: () => void
  /** 'sheet' = diálogo sobre o perfil; 'inline' = embutido (ex.: vitrine da home) */
  variant?: 'sheet' | 'inline'
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

  const reduced = useReducedMotion()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [step, setStep] = useState<Step>('boot')
  const [answers, setAnswers] = useState<AssistantAnswers>({})
  const [showAllDays, setShowAllDays] = useState(false)
  const [draft, setDraft] = useState('')

  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  // Cada "geração" invalida os temporizadores da anterior — evita mensagens fantasma
  // ao recomeçar a conversa ou ao desmontar o componente.
  const genRef = useRef(0)

  // O trap de foco só vale no modo diálogo. `closeRef` mantém o callback estável:
  // a conversa re-renderiza muito (digitando…) e um efeito re-executado roubaria o foco.
  const nullRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const requestClose = useCallback(() => closeRef.current?.(), [])
  useDialog(variant === 'sheet' ? panelRef : nullRef, requestClose)

  const push = useCallback((from: Msg['from'], text: string) => {
    idRef.current += 1
    setMsgs((m) => [...m, { id: idRef.current, from, text }])
  }, [])

  // Fala do assistente: uma linha por vez, com "digitando…" proporcional ao tamanho
  // do texto. Em prefers-reduced-motion, tudo aparece imediatamente.
  const say = useCallback(
    async (lines: string[], next?: Step) => {
      const gen = genRef.current
      for (const line of lines) {
        if (!reduced) {
          setTyping(true)
          await sleep(Math.min(1100, 380 + line.length * 11))
          if (genRef.current !== gen) return
          setTyping(false)
        }
        push('bot', line)
        if (!reduced) await sleep(140)
        if (genRef.current !== gen) return
      }
      if (next) setStep(next)
    },
    [push, reduced],
  )

  const start = useCallback(() => {
    genRef.current += 1
    setTyping(false)
    setMsgs([])
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
  }, [config.greeting, days.length, first, say])

  useEffect(() => {
    start()
    return () => {
      genRef.current += 1
    }
  }, [start])

  // Mantém a conversa colada no fim, como em qualquer mensageiro. Além da mensagem
  // nova, a própria área de resposta muda de altura (chips ↔ campo de texto) e encolhe
  // a lista DEPOIS do quadro seguinte — daí o ResizeObserver, que re-ancora no fim.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const pin = () => {
      el.scrollTop = el.scrollHeight
    }
    const id = requestAnimationFrame(pin)
    const ro = new ResizeObserver(pin)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
    }
  }, [msgs, typing, step])

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

  const sheet = variant === 'sheet'

  const body = (
    <div
      ref={panelRef}
      role={sheet ? 'dialog' : undefined}
      aria-modal={sheet ? true : undefined}
      aria-label={sheet ? assistantTitle(profile) : undefined}
      className={`themed flex w-full flex-col overflow-hidden ${
        sheet
          ? 'mx-auto h-[92dvh] max-w-[440px] rounded-t-[26px] shadow-lift sm:h-[min(88dvh,680px)] sm:rounded-[26px]'
          : 'h-full'
      }`}
      style={themeStyle(profile.theme)}
    >
      {/* Cabeçalho: quem está falando fica explícito — assistente, não o advogado. */}
      <header
        className={`relative z-10 flex shrink-0 items-center gap-3 px-4 pb-3.5 ${
          sheet ? 'pt-3.5' : 'pt-8'
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
            aria-label="Fechar a conversa"
            className="t-faint -mr-1 shrink-0 rounded-full p-2 transition-colors hover:bg-[var(--c-accent-soft)]"
          >
            <XIcon width={18} height={18} />
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
        {ready && <Summary answers={answers} durationMin={config.durationMin} reduced={!!reduced} />}
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

// ---- Peças da conversa ----

function Bubble({ from, text, reduced }: { from: 'bot' | 'user'; text: string; reduced: boolean }) {
  const bot = from === 'bot'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${bot ? 'justify-start' : 'justify-end'}`}
    >
      <p
        className={`max-w-[85%] px-3.5 py-2.5 text-[14px] leading-relaxed ${
          bot ? 'rounded-[16px] rounded-bl-[5px] border' : 'rounded-[16px] rounded-br-[5px] font-medium'
        }`}
        style={
          bot
            ? { background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }
            : { background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }
        }
      >
        {text}
      </p>
    </motion.div>
  )
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <span
        className="flex items-center gap-1 rounded-[16px] rounded-bl-[5px] border px-3.5 py-3"
        style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
        aria-label="digitando"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--c-faint)' }}
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
          />
        ))}
      </span>
    </div>
  )
}

// Cartão de resumo — o "comprovante" do que foi combinado, antes de enviar.
function Summary({
  answers,
  durationMin,
  reduced,
}: {
  answers: AssistantAnswers
  durationMin: number
  reduced: boolean
}) {
  const rows = [
    ['Quando', formatChoice(answers)],
    ['Duração', `${durationMin} minutos`],
    answers.format ? ['Formato', cap(answers.format)] : null,
    answers.subject ? ['Assunto', answers.subject] : null,
    answers.detail ? ['Contexto', answers.detail] : null,
    answers.name ? ['Nome', answers.name] : null,
  ].filter(Boolean) as [string, string][]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mt-1 overflow-hidden rounded-[16px] border"
      style={{ borderColor: 'var(--c-ring)', background: 'var(--c-surface)' }}
    >
      <p
        className="flex items-center gap-2 px-4 py-2.5 font-display text-[13px] font-semibold uppercase tracking-[0.14em]"
        style={{ background: 'var(--c-accent-soft)' }}
      >
        <CheckIcon width={14} height={14} className="t-accent" strokeWidth={2.4} />
        Pedido de horário
      </p>
      <dl className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 px-4 py-2.5">
            <dt className="t-faint w-[74px] shrink-0 text-[11.5px] uppercase tracking-wider">{k}</dt>
            <dd className="t-muted flex-1 text-[13.5px] leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  )
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="t-faint mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Chip({
  children,
  onClick,
  subtle = false,
}: {
  children: React.ReactNode
  onClick: () => void
  subtle?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-all duration-200 hover:-translate-y-px active:translate-y-0"
      style={{
        borderColor: subtle ? 'var(--c-border)' : 'var(--c-ring)',
        background: subtle ? 'transparent' : 'var(--c-accent-soft)',
        color: subtle ? 'var(--c-faint)' : 'var(--c-text)',
      }}
    >
      {children}
    </button>
  )
}

function Composer({
  value,
  onChange,
  onSend,
  placeholder,
  label,
  canSend,
  skipLabel,
  onSkip,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder: string
  label: string
  canSend: boolean
  skipLabel?: string
  onSkip?: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSend()
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={140}
        className="min-w-0 flex-1 rounded-full border px-4 py-2.5 text-[14px] outline-none transition-colors"
        style={{
          borderColor: 'var(--c-border)',
          background: 'var(--c-bg)',
          color: 'var(--c-text)',
        }}
      />
      {skipLabel && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="t-faint shrink-0 px-1 text-[13px] font-medium underline-offset-4 hover:underline"
        >
          {skipLabel}
        </button>
      )}
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Enviar resposta"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-40"
        style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
      >
        <ArrowRight width={18} height={18} />
      </button>
    </form>
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
