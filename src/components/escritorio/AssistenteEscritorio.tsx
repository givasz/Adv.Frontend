import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { lawyersInNeutralOrder, type Firm, type FirmLawyer } from '@/lib/escritorio'
import { comoAbrirWhatsapp } from '@/lib/whatsapp'
import {
  buildAssistantDays,
  FIRM_ANY_LAWYER,
  FIRM_PERIODS,
  falaDoEnderecoPresencial,
  firmAlcancaAdvogado,
  firmAssistantDestination,
  firmAssistantWhatsappHref,
  firmRecebeSemPreferencia,
  firmTemDestino,
  MAX_DAY_CHIPS,
  type AssistantDayOption,
  type FirmAssistantAnswers,
} from '@/lib/assistant'
import { ArrowRight, CalendarIcon, SparkIcon, WhatsappIcon } from '@/components/ui/icons'
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
// advogados:
//
//   • cada advogado é um perfil, e quem usa o assistente no próprio perfil tem
//     agenda. Escolhido um advogado assim, a conversa oferece os dias e horários
//     livres DELE — os mesmos do perfil, respeitando o que ele fechou em /agenda.
//     Sem escolha, ou com alguém sem agenda, não há de onde tirar horário: a
//     conversa pergunta dia e PERÍODO, como uma secretária faria;
//   • a escolha de advogado é opcional e a lista é ALFABÉTICA. Nunca "o mais
//     indicado para o seu caso": isso é ranking, e ranking é o que o Prov. 205/2021
//     proíbe. Ter agenda também não dá destaque a ninguém na lista.
//
// Não é IA e não pode virar: o roteiro é fechado (chips e perguntas fixas) e a
// interface diz "Automático", nunca "IA". Um modelo respondendo dúvida de cliente na
// página de um advogado seria consulta jurídica automatizada.

type Step = 'boot' | 'area' | 'lawyer' | 'format' | 'day' | 'time' | 'period' | 'name' | 'done'

// 'period' ocupa o lugar de 'day' no fio de progresso: é a mesma pergunta ("quando?")
// para quem não tem agenda.
const STEP_ORDER: Step[] = ['area', 'lawyer', 'format', 'day', 'time', 'name', 'done']

export function AssistenteEscritorio({ firm }: { firm: Firm }) {
  const { msgs, typing, push, say: falar, reset, reduced, listRef } = useConversation()
  const [step, setStep] = useState<Step>('boot')
  const [answers, setAnswers] = useState<FirmAssistantAnswers>({})
  const [draft, setDraft] = useState('')
  // Os dias oferecidos, calculados no momento da pergunta — e de novo quando o
  // horário escolhido expira no meio da conversa.
  const [dias, setDias] = useState<AssistantDayOption[]>([])
  const [verTodosOsDias, setVerTodosOsDias] = useState(false)

  const say = useCallback(
    (lines: string[], next?: Step) => falar(lines, next ? () => setStep(next) : undefined),
    [falar],
  )

  const areas = useMemo(() => firm.areas.map((a) => a.label).filter(Boolean), [firm.areas])
  const lawyers = useMemo(() => lawyersInNeutralOrder(firm), [firm])
  const temDestino = firmTemDestino(firm)
  const semPreferenciaChega = firmRecebeSemPreferencia(firm)
  // Advogados a quem um pedido consegue chegar. Com o WhatsApp do escritório
  // preenchido são todos; sem ele (e com encaminhamento direto), só quem tem número.
  const alcancaveis = useMemo(
    () => lawyers.filter((l) => firmAlcancaAdvogado(firm, l)),
    [firm, lawyers],
  )
  const escolhido = useMemo(
    () => lawyers.find((l) => l.id === answers.lawyerId),
    [lawyers, answers.lawyerId],
  )

  const start = useCallback(() => {
    reset()
    setAnswers({})
    setDraft('')
    setDias([])
    setVerTodosOsDias(false)
    setStep('boot')
    const abertura = [
      'Olá! Sou o assistente virtual do escritório.',
      'Não presto orientação jurídica — organizo o seu pedido e encaminho para a equipe.',
    ]
    if (!temDestino) {
      void say(
        [
          ...abertura,
          'Por enquanto este escritório não informou um WhatsApp para receber pedidos, então não consigo encaminhar o seu por aqui.',
        ],
        'done',
      )
      return
    }
    if (areas.length) {
      void say([...abertura, 'Sobre qual assunto você precisa falar?'], 'area')
    } else {
      void say(
        [...abertura, 'Prefere falar com alguém específico?'],
        alcancaveis.length ? 'lawyer' : 'format',
      )
    }
  }, [areas.length, alcancaveis.length, reset, say, temDestino])

  useEffect(() => {
    start()
  }, [start])

  usePinnedToBottom(listRef, [msgs, typing, step])

  // ---- Transições ----

  // Advogados que atuam na área escolhida, em ordem alfabética. Quando ninguém tem
  // aquela área cadastrada, a lista inteira aparece — melhor do que uma lista vazia,
  // e continua sem hierarquia.
  const candidatos = useMemo(() => {
    if (!answers.area) return alcancaveis
    const daArea = alcancaveis.filter((l) => l.area === answers.area)
    return daArea.length ? daArea : alcancaveis
  }, [answers.area, alcancaveis])

  function pickArea(area: string) {
    push('user', area)
    setAnswers((a) => ({ ...a, area }))
    if (!alcancaveis.length) {
      void say(['Anotado. A conversa seria presencial ou online?'], 'format')
      return
    }
    void say(['Anotado. Prefere falar com alguém específico?'], 'lawyer')
  }

  function pickLawyer(l: FirmLawyer | null) {
    push('user', l ? l.name : FIRM_ANY_LAWYER)
    // Sem preferência o pedido vai ao WhatsApp do escritório. Se ele não existe,
    // seguir adiante levaria a pessoa até o fim para descobrir que não há destino.
    if (!l && !semPreferenciaChega) {
      void say(
        [
          'Sem preferência, o pedido iria para o WhatsApp do escritório, que ainda não foi informado. Escolha um dos advogados, por favor:',
        ],
        'lawyer',
      )
      return
    }
    setAnswers((a) => ({
      ...a,
      lawyer: l?.name,
      lawyerId: l?.id,
      day: undefined,
      time: undefined,
      period: undefined,
    }))
    void say(['A conversa seria presencial ou online?'], 'format')
  }

  function pickFormat(format: string) {
    push('user', cap(format))
    setAnswers((a) => ({ ...a, format }))
    // Presencial numa sociedade é ir até a sede — e o endereço dela é o que a
    // pessoa vai precisar em seguida. Vazio quando não há endereço publicado.
    const endereco = format === 'presencial' ? falaDoEnderecoPresencial(firm) : ''
    perguntarQuando(endereco ? [endereco] : [])
  }

  /** Dia e horário da agenda do advogado escolhido — ou período, quando não há agenda. */
  function perguntarQuando(antes: string[]) {
    const agenda = escolhido?.agenda
    if (!escolhido || !agenda) {
      void say([...antes, 'Que dia e período são melhores para você?'], 'period')
      return
    }
    const livres = buildAssistantDays(agenda)
    setDias(livres)
    setVerTodosOsDias(false)
    if (livres.length) {
      void say(
        [...antes, `Estes são os dias com horário livre na agenda de ${escolhido.name}. Qual fica melhor?`],
        'day',
      )
      return
    }
    void say(
      [
        ...antes,
        `A agenda de ${escolhido.name} não tem horário livre nos próximos dias. Diga sua preferência e o pedido segue com ela:`,
      ],
      'period',
    )
  }

  function pickDay(day: AssistantDayOption) {
    push('user', `${day.label}${day.relative ? ` (${day.relative})` : ''}`)
    setAnswers((a) => ({ ...a, day, time: undefined, period: undefined }))
    void say([`${cap(day.longLabel)}. Que horário prefere?`], 'time')
  }

  function outroDia() {
    push('user', 'Outro dia')
    setAnswers((a) => ({ ...a, day: undefined, time: undefined }))
    void say(['Claro. Qual dia?'], 'day')
  }

  // Nenhum dia da agenda serve: a pessoa ainda pode pedir, só que por período — e
  // quem recebe procura um encaixe. Melhor do que um beco sem saída.
  function preferirPeriodo() {
    push('user', 'Nenhum desses dias')
    setAnswers((a) => ({ ...a, day: undefined, time: undefined }))
    void say(['Sem problema. Diga sua preferência e o pedido segue com ela:'], 'period')
  }

  function pickTime(time: string) {
    push('user', time)
    setAnswers((a) => ({ ...a, time, period: undefined }))
    // Voltou só para trocar um horário que expirou: o resto já está respondido.
    if (answers.name) {
      void say(
        [
          `Troquei para ${answers.day?.longLabel ?? 'esse dia'} às ${time}.`,
          'Toque no botão abaixo para enviar o pedido — o horário só vale depois da confirmação.',
        ],
        'done',
      )
      return
    }
    void say(['Por último: como podemos te chamar?'], 'name')
  }

  function pickPeriod(period: string) {
    push('user', period)
    setAnswers((a) => ({ ...a, period, day: undefined, time: undefined }))
    if (answers.name) {
      void say(['Anotado. Toque no botão abaixo para enviar o pedido.'], 'done')
      return
    }
    void say(['Por último: como podemos te chamar?'], 'name')
  }

  function sendName(text: string) {
    const value = text.trim()
    if (!value) return
    push('user', value)
    const finais = { ...answers, name: value }
    setAnswers(finais)
    setDraft('')
    const saudacao = `Prazer, ${value.split(/\s+/)[0]}.`
    if (!horarioAindaVale(answers)) {
      horarioSaiu([saudacao])
      return
    }
    const quem = firmAssistantDestination(firm, finais)
    void say(
      [
        `${saudacao} Registrei o seu pedido.`,
        quem.direct
          ? `Toque no botão abaixo para enviar tudo pelo WhatsApp de ${quem.label} — quem confirma o horário é ${quem.label}.`
          : 'Toque no botão abaixo para enviar tudo pelo WhatsApp — o escritório confirma o horário.',
      ],
      'done',
    )
  }

  // ---- Horário que expirou no meio da conversa ----
  //
  // Os dias são calculados quando a pergunta é feita. Quem escolhe "hoje às 16:00"
  // e demora a responder pode chegar ao fim com o horário já dentro da antecedência
  // mínima do advogado. A conta é refeita antes de fechar o pedido e antes de abrir
  // o WhatsApp. Pedido por período não expira: não há horário a conferir.

  function horarioAindaVale(a: FirmAssistantAnswers): boolean {
    if (!a.day || !a.time) return true
    const agenda = lawyers.find((l) => l.id === a.lawyerId)?.agenda
    if (!agenda) return true
    const { key } = a.day
    const time = a.time
    return buildAssistantDays(agenda).some((d) => d.key === key && d.times.includes(time))
  }

  function horarioSaiu(antes: string[] = []) {
    const agenda = escolhido?.agenda
    const agora = agenda ? buildAssistantDays(agenda) : []
    setDias(agora)
    setVerTodosOsDias(false)
    setAnswers((a) => ({ ...a, day: undefined, time: undefined }))
    void say(
      agora.length
        ? [
            ...antes,
            'Só que esse horário acabou de sair da agenda — passou do prazo mínimo para pedir. Escolha outro, por favor:',
          ]
        : [
            ...antes,
            'Só que esse horário acabou de sair da agenda, e não sobrou outro livre. Diga sua preferência e o pedido segue com ela:',
          ],
      agora.length ? 'day' : 'period',
    )
  }

  // ---- Derivados ----

  const referencia = step === 'period' ? 'day' : step
  const answered = STEP_ORDER.indexOf(referencia)
  const progress = step === 'boot' ? 0 : Math.min(1, answered / (STEP_ORDER.length - 1))
  const comHorario = !!(answers.day && answers.time)
  const duracao = comHorario ? escolhido?.agenda?.durationMin : undefined
  const href = firmAssistantWhatsappHref(firm, answers, duracao)
  const destino = firmAssistantDestination(firm, answers)
  const ready = step === 'done' && !!answers.name && !!href
  const diasNaTela = verTodosOsDias ? dias : dias.slice(0, MAX_DAY_CHIPS)

  const quando = comHorario ? `${answers.day!.longLabel} às ${answers.time}` : answers.period
  const rows: [string, string][] = [
    answers.area ? ['Assunto', answers.area] : null,
    ['Advogado', answers.lawyer ?? 'Sem preferência'],
    answers.format ? ['Formato', cap(answers.format)] : null,
    quando ? ['Quando', quando] : null,
    duracao ? ['Duração', `${duracao} minutos`] : null,
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
            className="flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full border font-display text-[15px] font-semibold"
            style={{ borderColor: 'var(--c-ring)', color: 'var(--c-accent)' }}
          >
            {firm.logoUrl ? (
              <img src={firm.logoUrl} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              firm.monogram
            )}
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
                <Chip subtle onClick={() => pickLawyer(null)}>
                  {FIRM_ANY_LAWYER}
                </Chip>
                {candidatos.map((l) => (
                  <Chip key={l.id} onClick={() => pickLawyer(l)}>
                    {l.name}
                  </Chip>
                ))}
              </ChipRow>
            ) : step === 'format' ? (
              <ChipRow label="Formato do atendimento">
                <Chip onClick={() => pickFormat('presencial')}>Presencial</Chip>
                <Chip onClick={() => pickFormat('online')}>Online</Chip>
              </ChipRow>
            ) : step === 'day' ? (
              <ChipRow label="Escolha um dia">
                {diasNaTela.map((d) => (
                  <Chip key={d.key} onClick={() => pickDay(d)}>
                    <CalendarIcon width={14} height={14} className="t-accent" />
                    {d.label}
                    {d.relative && <em className="t-faint not-italic">· {d.relative}</em>}
                  </Chip>
                ))}
                {!verTodosOsDias && dias.length > MAX_DAY_CHIPS && (
                  <Chip subtle onClick={() => setVerTodosOsDias(true)}>
                    Ver mais dias
                  </Chip>
                )}
                <Chip subtle onClick={preferirPeriodo}>
                  Nenhum desses dias
                </Chip>
              </ChipRow>
            ) : step === 'time' ? (
              <ChipRow label="Escolha um horário">
                {(answers.day?.times ?? []).map((t) => (
                  <Chip key={t} onClick={() => pickTime(t)}>
                    {t}
                  </Chip>
                ))}
                <Chip subtle onClick={outroDia}>
                  Outro dia
                </Chip>
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
                  {...comoAbrirWhatsapp()}
                  onClick={(e) => {
                    // A pessoa pode ter parado no botão por um bom tempo.
                    if (horarioAindaVale(answers)) return
                    e.preventDefault()
                    horarioSaiu()
                  }}
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
