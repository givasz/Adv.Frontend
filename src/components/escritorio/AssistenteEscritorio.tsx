import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { lawyersInNeutralOrder, type Firm } from '@/lib/escritorio'
import {
  FIRM_ANY_LAWYER,
  FIRM_PERIODS,
  firmAssistantDestination,
  firmAssistantWhatsappHref,
  type FirmAssistantAnswers,
} from '@/lib/assistant'
import { ArrowRight, SparkIcon, WhatsappIcon } from '@/components/ui/icons'
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

// Assistente virtual do ESCRITÓRIO. Mesma conversa guiada do perfil individual
// (mesmo motor, mesmas peças em components/assistant), adaptada a quem tem vários
// advogados e NENHUMA agenda:
//
//   • sem grade de horários — a sociedade não tem agenda por advogado, então
//     perguntar horário exato seria prometer o que ninguém pode confirmar. Pergunta
//     dia e PERÍODO, como uma secretária faria, e o escritório confirma;
//   • a escolha de advogado é opcional e a lista é ALFABÉTICA. Nunca "o mais
//     indicado para o seu caso": isso é ranking, e ranking é o que o Prov. 205/2021
//     proíbe.
//
// Não é IA e não pode virar: o roteiro é fechado (chips e perguntas fixas) e a
// interface diz "Automático", nunca "IA". Um modelo respondendo dúvida de cliente na
// página de um advogado seria consulta jurídica automatizada.

type Step = 'boot' | 'area' | 'lawyer' | 'format' | 'period' | 'name' | 'done'

const STEP_ORDER: Step[] = ['area', 'lawyer', 'format', 'period', 'name', 'done']

export function AssistenteEscritorio({ firm }: { firm: Firm }) {
  const { msgs, typing, push, say: falar, reset, reduced, listRef } = useConversation()
  const [step, setStep] = useState<Step>('boot')
  const [answers, setAnswers] = useState<FirmAssistantAnswers>({})
  const [draft, setDraft] = useState('')

  const say = useCallback(
    (lines: string[], next?: Step) => falar(lines, next ? () => setStep(next) : undefined),
    [falar],
  )

  const areas = useMemo(() => firm.areas.map((a) => a.label).filter(Boolean), [firm.areas])
  const lawyers = useMemo(() => lawyersInNeutralOrder(firm), [firm])

  const start = useCallback(() => {
    reset()
    setAnswers({})
    setDraft('')
    setStep('boot')
    const abertura = [
      'Olá! Sou o assistente virtual do escritório.',
      'Não presto orientação jurídica — organizo o seu pedido e encaminho para a equipe.',
    ]
    if (areas.length) {
      void say([...abertura, 'Sobre qual assunto você precisa falar?'], 'area')
    } else {
      void say([...abertura, 'Prefere falar com alguém específico?'], lawyers.length ? 'lawyer' : 'format')
    }
  }, [areas.length, lawyers.length, reset, say])

  useEffect(() => {
    start()
  }, [start])

  usePinnedToBottom(listRef, [msgs, typing, step])

  // ---- Transições ----

  // Advogados que atuam na área escolhida, em ordem alfabética. Quando ninguém tem
  // aquela área cadastrada, a lista inteira aparece — melhor do que uma lista vazia,
  // e continua sem hierarquia.
  const candidatos = useMemo(() => {
    if (!answers.area) return lawyers
    const daArea = lawyers.filter((l) => l.area === answers.area)
    return daArea.length ? daArea : lawyers
  }, [answers.area, lawyers])

  function pickArea(area: string) {
    push('user', area)
    setAnswers((a) => ({ ...a, area }))
    if (!lawyers.length) {
      void say(['Anotado. A conversa seria presencial ou online?'], 'format')
      return
    }
    void say(['Anotado. Prefere falar com alguém específico?'], 'lawyer')
  }

  function pickLawyer(nome: string) {
    const escolhido = nome === FIRM_ANY_LAWYER ? undefined : nome
    push('user', nome)
    setAnswers((a) => ({ ...a, lawyer: escolhido }))
    void say(['A conversa seria presencial ou online?'], 'format')
  }

  function pickFormat(format: string) {
    push('user', cap(format))
    setAnswers((a) => ({ ...a, format }))
    void say(['Que dia e período são melhores para você?'], 'period')
  }

  function pickPeriod(period: string) {
    push('user', period)
    setAnswers((a) => ({ ...a, period }))
    void say(['Por último: como podemos te chamar?'], 'name')
  }

  function sendName(text: string) {
    const value = text.trim()
    if (!value) return
    push('user', value)
    const finais = { ...answers, name: value }
    setAnswers(finais)
    setDraft('')
    const quem = firmAssistantDestination(firm, finais)
    void say(
      [
        `Prazer, ${value.split(/\s+/)[0]}. Registrei o seu pedido.`,
        quem.direct
          ? `Toque no botão abaixo para enviar tudo pelo WhatsApp de ${quem.label} — quem confirma o horário é ${quem.label}.`
          : 'Toque no botão abaixo para enviar tudo pelo WhatsApp — o escritório confirma o horário.',
      ],
      'done',
    )
  }

  // ---- Derivados ----

  const answered = STEP_ORDER.indexOf(step)
  const progress = step === 'boot' ? 0 : Math.min(1, answered / (STEP_ORDER.length - 1))
  const href = firmAssistantWhatsappHref(firm, answers)
  const destino = firmAssistantDestination(firm, answers)
  const ready = step === 'done' && !!answers.name && !!href

  const rows: [string, string][] = [
    answers.area ? ['Assunto', answers.area] : null,
    ['Advogado', answers.lawyer ?? 'Sem preferência'],
    answers.format ? ['Formato', cap(answers.format)] : null,
    answers.period ? ['Quando', answers.period] : null,
    answers.name ? ['Nome', answers.name] : null,
    // Para quem o pedido vai: com encaminhamento direto o visitante sai da conversa
    // no WhatsApp de uma pessoa, não do escritório. Isso não pode ser surpresa.
    ['Vai para', destino.direct ? destino.label : 'WhatsApp do escritório'],
  ].filter(Boolean) as [string, string][]

  return (
    <div className="themed flex w-full flex-col" style={paletaDoEscritorio(firm.brandAccent)}>
      {/* Cabeçalho: quem está falando fica explícito — assistente, não os advogados. */}
      <header className="flex items-center gap-3 pb-3">
        <span className="relative shrink-0">
          <span
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full border font-display text-[15px] font-semibold"
            style={{ borderColor: 'var(--c-ring)', color: 'var(--c-accent)' }}
          >
            {firm.monogram}
          </span>
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full"
            style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
            aria-hidden
          >
            <SparkIcon width={11} height={11} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15.5px] font-semibold leading-tight text-ink">
            Assistente virtual
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-tight">
            <span className="t-faint truncate">de {firm.name}</span>
            {/* Deixa explícito que quem responde é um robô — nunca um(a) advogado(a). */}
            <span
              className="shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider"
              style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
            >
              Automático
            </span>
          </p>
        </div>
      </header>

      {/* Fio de progresso — mostra o quanto falta sem virar formulário. */}
      <div className="relative h-[2px] shrink-0" style={{ background: 'var(--c-border)' }}>
        <motion.div
          className="h-full origin-left"
          style={{ background: 'var(--c-accent)' }}
          initial={false}
          animate={{ scaleX: progress }}
          transition={{ duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Conversa. Altura limitada: o card vive DENTRO da página, que já rola. */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Conversa com o assistente virtual do escritório"
        className="flex max-h-[46dvh] min-h-0 flex-col overflow-y-auto py-4"
      >
        <div className="mt-auto space-y-2.5">
          <AnimatePresence initial={false}>
            {msgs.map((m) => (
              <Bubble key={m.id} from={m.from} text={m.text} reduced={reduced} />
            ))}
          </AnimatePresence>
          {typing && <TypingDots />}
          {ready && <Summary title="Pedido de conversa" rows={rows} reduced={reduced} />}
        </div>
      </div>

      {/* Área de resposta — chips ou campo, conforme a etapa */}
      <div className="shrink-0 pt-3" style={{ borderTop: '1px solid var(--c-border)' }}>
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
            ) : step === 'area' ? (
              <ChipRow label="Assunto">
                {areas.map((a) => (
                  <Chip key={a} onClick={() => pickArea(a)}>
                    {a}
                  </Chip>
                ))}
              </ChipRow>
            ) : step === 'lawyer' ? (
              // Ordem alfabética e "Tanto faz" primeiro: a plataforma não indica
              // ninguém, e a lista não sugere que alguém é melhor que os outros.
              <ChipRow label="Advogado">
                <Chip subtle onClick={() => pickLawyer(FIRM_ANY_LAWYER)}>
                  {FIRM_ANY_LAWYER}
                </Chip>
                {candidatos.map((l) => (
                  <Chip key={l.id} onClick={() => pickLawyer(l.name)}>
                    {l.name}
                  </Chip>
                ))}
              </ChipRow>
            ) : step === 'format' ? (
              <ChipRow label="Formato do atendimento">
                <Chip onClick={() => pickFormat('presencial')}>Presencial</Chip>
                <Chip onClick={() => pickFormat('online')}>Online</Chip>
              </ChipRow>
            ) : step === 'period' ? (
              <ChipRow label="Preferência de horário">
                {FIRM_PERIODS.map((p) => (
                  <Chip key={p.id} onClick={() => pickPeriod(p.label)}>
                    {p.label}
                  </Chip>
                ))}
              </ChipRow>
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
                  {destino.direct ? `Enviar para ${destino.label}` : 'Enviar no WhatsApp'}
                  <ArrowRight width={16} height={16} />
                </a>
                <button
                  type="button"
                  onClick={start}
                  className="t-faint w-full py-1 text-center text-[12.5px] font-medium underline-offset-4 hover:underline"
                >
                  Recomeçar
                </button>
              </div>
            ) : step === 'done' ? (
              <p className="t-faint py-2 text-center text-[12.5px] leading-relaxed">
                Este escritório ainda não informou um WhatsApp para receber o pedido.
              </p>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <p className="t-faint mt-2.5 text-center text-[10.5px] leading-relaxed opacity-90">
          Assistente automático. Não presta orientação jurídica e não confirma o horário — quem
          confirma é {destino.direct ? destino.label : 'o escritório'}.
        </p>
      </div>
    </div>
  )
}

/**
 * A página do escritório não usa o sistema de temas por perfil: ela é sempre
 * "Papel & Tinta" com a cor da sociedade. Aqui essa paleta é declarada nas mesmas
 * variáveis --c-* que as peças da conversa esperam, para o assistente do escritório
 * e o do perfil serem literalmente o mesmo componente pintado de outro jeito.
 */
function paletaDoEscritorio(accent?: string): React.CSSProperties {
  const cor = accent || '#6b2131'
  return {
    '--c-bg': '#f4efe4',
    '--c-surface': '#fbf7ee',
    '--c-text': '#211c17',
    '--c-muted': '#443b32',
    '--c-faint': '#6b6155',
    '--c-border': 'rgba(33,28,23,0.10)',
    '--c-accent': cor,
    '--c-accent-ink': '#fbf7ee',
    '--c-accent-soft': rgba(cor, 0.1),
    '--c-ring': rgba(cor, 0.3),
  } as React.CSSProperties
}

/** "#6b2131" → "rgba(107,33,49,0.1)". Cor inválida cai no vinho da casa. */
function rgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return `rgba(107,33,49,${alpha})`
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
