import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import { resolveSchedulingMode } from '@/lib/booking'
import { getTheme, themeStyle } from '@/lib/themes'
import {
  assistantDayAt,
  buildAssistantDays,
  busyKey,
  dayKey,
  firstName,
  formatBusyLong,
  formatBusyShort,
  MAX_DAY_CHIPS,
  parseBrDate,
  resolveAssistantConfig,
  type AssistantDayOption,
} from '@/lib/assistant'
import { Avatar } from '@/components/ui/Avatar'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { ArrowRight, CalendarIcon, CheckIcon, SparkIcon } from '@/components/ui/icons'
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

// /agenda — o advogado conversando com o próprio assistente.
//
// O assistente do perfil oferece uma GRADE semanal, que se repete toda semana. A
// agenda de verdade não se repete: alguém liga, marca por fora, e às 14h daquela
// quarta já não há ninguém livre. Sem um jeito de contar isso a ele, o assistente
// segue oferecendo um horário que não existe — e quem descobre é o visitante,
// depois de mandar o pedido pelo WhatsApp.
//
// Por que uma PÁGINA, e a mesma conversa: o advogado já conhece este diálogo de
// cor, porque é o que ele mostra para os clientes. Do lado de dentro, ele responde
// as mesmas perguntas em vez de aprender um calendário novo — e a tela inteira é
// o que faz caber num celular, com o teclado subindo, sem virar uma fresta.
//
// O que fica guardado: data e hora. Nunca de quem é o compromisso, nunca o motivo
// — não há dado de terceiro nenhum atravessando esta tela.

type Step = 'boot' | 'dia' | 'hora' | 'mais' | 'liberar' | 'fim'

const ORDEM: Step[] = ['dia', 'hora', 'mais', 'fim']

export default function AgendaPage() {
  const navigate = useNavigate()
  const voltar = useVoltar('/painel')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Sua agenda · advoc.me'
    api
      .getDraft()
      .then(setProfile)
      .catch((e: unknown) => {
        if (e instanceof SessaoExpirada) return
        setErroAoCarregar(e instanceof Error ? e.message : 'Falha ao carregar sua agenda.')
      })
  }, [])

  if (erroAoCarregar) return <FalhaAoCarregar mensagem={erroAoCarregar} />

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  // Sem assistente ligado não há grade — e sem grade não há horário a fechar.
  // Em vez de uma conversa vazia, a página diz o que falta e leva até lá.
  if (resolveSchedulingMode(profile) !== 'assistant') {
    return (
      <SubPage
        title="Sua agenda"
        subtitle="Aqui você conta ao assistente quais horários já foram marcados."
        icon={<CalendarIcon width={18} height={18} />}
        backTo={voltar}
        backLabel="Voltar"
      >
        <div className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Esta conversa trabalha em cima da grade do{' '}
            <span className="font-medium text-ink">assistente virtual</span> — os dias e horários
            que você aceita oferecer. Ative o assistente e monte a grade primeiro; depois é só vir
            aqui dizer o que foi ocupado.
          </p>
          <Link to="/editor?section=agenda" className="btn-primary mt-4 w-full !py-3">
            Montar minha grade
            <ArrowRight width={16} height={16} />
          </Link>
        </div>
      </SubPage>
    )
  }

  return <Conversa profile={profile} setProfile={setProfile} onSair={() => navigate(voltar)} />
}

function Conversa({
  profile,
  setProfile,
  onSair,
}: {
  profile: Profile
  setProfile: (p: Profile) => void
  onSair: () => void
}) {
  const { msgs, typing, push, say: falar, reset, reduced, listRef } = useConversation()
  const [step, setStep] = useState<Step>('boot')
  const [dia, setDia] = useState<AssistantDayOption | null>(null)
  const [verTodos, setVerTodos] = useState(false)
  const [draft, setDraft] = useState('')
  // O que ELE fechou nesta conversa — é o que o comprovante do fim mostra. A lista
  // inteira de ocupados pode ter meses; o que ele quer conferir antes de sair é o
  // que acabou de fazer.
  const [nesta, setNesta] = useState<string[]>([])
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const cfg = useMemo(() => resolveAssistantConfig(profile.assistant), [profile.assistant])
  const busy = cfg.busy ?? []
  const dias = useMemo(() => buildAssistantDays(cfg), [cfg])
  // O dia em foco relido da grade ATUAL: fechar um horário muda a lista, e o que
  // sobrou tem de vir da fonte, não de uma cópia guardada no passo anterior.
  const emFoco = useMemo(
    () => (dia ? assistantDayAt(cfg, dia.key) : null),
    [cfg, dia],
  )
  const restantes = emFoco?.times ?? []
  const primeiro = firstName(profile.name)

  const say = useCallback(
    (lines: string[], next?: Step) => falar(lines, next ? () => setStep(next) : undefined),
    [falar],
  )

  // ---- Gravação -------------------------------------------------------------
  //
  // Cada marcação grava na hora: são gestos avulsos, não um formulário que se
  // preenche e se envia. A FILA serializa os PUTs — duas marcações em sequência
  // rápida chegariam fora de ordem, e a segunda a chegar venceria com uma lista
  // desatualizada, desfazendo a primeira sem avisar ninguém.
  const fila = useRef<Promise<unknown>>(Promise.resolve())
  const gravar = useCallback(
    (lista: string[]) => {
      const proximo: Profile = { ...profile, assistant: { ...cfg, busy: lista } }
      setProfile(proximo)
      setGravando(true)
      setErro(null)
      fila.current = fila.current.then(
        () =>
          api.saveDraft(proximo).then(
            () => setGravando(false),
            (e: unknown) => {
              setGravando(false)
              if (e instanceof SessaoExpirada) {
                setErro('Sua sessão expirou. Entre de novo para guardar o que faltou.')
                return
              }
              setErro(e instanceof Error ? e.message : 'Não consegui guardar. Tente de novo.')
            },
          ),
        () => undefined,
      )
    },
    [profile, cfg, setProfile],
  )

  // ---- Roteiro --------------------------------------------------------------

  const abrir = useCallback(() => {
    reset()
    setStep('boot')
    setDia(null)
    setVerTodos(false)
    setDraft('')
    setNesta([])
    void say(
      dias.length
        ? [
            `Olá, ${primeiro || 'tudo bem'}! Sou o seu assistente.`,
            'Quando você marcar um horário por fora — no telefone, no WhatsApp, no balcão —, me conte aqui. Eu paro de oferecer esse horário para quem visita seu perfil.',
            'Que dia você marcou?',
          ]
        : [
            `Olá, ${primeiro || 'tudo bem'}! Sou o seu assistente.`,
            'Sua grade não tem nenhum horário livre à frente — não há o que fechar por aqui hoje.',
          ],
      dias.length ? 'dia' : 'fim',
    )
    // `dias.length` de propósito, e não `dias`: a abertura só precisa saber SE há
    // horário, e a lista muda a cada marcação — reabriria a conversa sozinha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, say, primeiro, dias.length])

  useEffect(() => {
    abrir()
  }, [abrir])

  usePinnedToBottom(listRef, [msgs, typing, step])

  /** Dias à frente entre hoje e a data — para avisar quando passa do horizonte. */
  function distancia(key: string): number {
    const hoje = new Date(`${dayKey(new Date())}T00:00:00`).getTime()
    return Math.round((new Date(`${key}T00:00:00`).getTime() - hoje) / 86_400_000)
  }

  function escolherDia(opt: AssistantDayOption, digitada = false) {
    push('user', digitada ? opt.label : `${opt.label}${opt.relative ? ` (${opt.relative})` : ''}`)
    setDia(opt)
    setDraft('')
    // Data além do horizonte: dá para fechar, mas ele merece saber que ela ainda
    // nem está sendo oferecida — senão parece que a marcação não fez nada.
    const longe = distancia(opt.key) > cfg.horizonDays
    void say(
      longe
        ? [
            `${cap(opt.longLabel)} ainda não aparece na conversa (hoje você aceita pedidos até ${cfg.horizonDays} dias à frente), mas já deixo fechado.`,
            'Que horário ficou marcado?',
          ]
        : [`${cap(opt.longLabel)}. Que horário ficou marcado?`],
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
      void say(['Não entendi a data. Escreva assim: 25/11 — ou toque em um dos dias acima.'])
      return
    }
    const opt = assistantDayAt(cfg, key)
    if (!opt) {
      void say([
        `Em ${key.slice(8, 10)}/${key.slice(5, 7)} não há horário livre na sua grade — ou você não atende nesse dia da semana, ou já fechou todos.`,
      ])
      return
    }
    escolherDia(opt, true)
  }

  function fecharHorario(time: string) {
    if (!emFoco) return
    push('user', time)
    const chave = busyKey(emFoco.key, time)
    gravar([...busy, chave].sort())
    setNesta((n) => [...n, chave])
    const sobraram = restantes.filter((t) => t !== time)
    void say(
      [
        `Anotado. ${cap(formatBusyLong(chave))} não vai mais aparecer para quem visita.`,
        sobraram.length
          ? 'Marcou mais algum?'
          : 'Com esse, o dia ficou sem horário livre — ele some da conversa. Marcou mais algum?',
      ],
      'mais',
    )
  }

  function fecharDiaInteiro() {
    if (!emFoco) return
    push('user', 'O dia todo')
    const chaves = restantes.map((t) => busyKey(emFoco.key, t))
    gravar([...busy, ...chaves].sort())
    setNesta((n) => [...n, ...chaves])
    void say(
      [
        `Fechei ${emFoco.longLabel} inteiro: ${chaves.length} ${chaves.length === 1 ? 'horário sai' : 'horários saem'} da conversa.`,
        'Marcou mais algum?',
      ],
      'mais',
    )
  }

  function liberar(chave: string) {
    push('user', formatBusyShort(chave))
    gravar(busy.filter((b) => b !== chave))
    setNesta((n) => n.filter((b) => b !== chave))
    void say(
      [`Liberado: ${formatBusyLong(chave)} volta a ser oferecido.`, 'Quer mexer em mais algum?'],
      'mais',
    )
  }

  function outroDia() {
    push('user', 'Outro dia')
    setDia(null)
    setVerTodos(false)
    void say(['Claro. Que dia?'], 'dia')
  }

  function irLiberar() {
    push('user', 'Liberar um horário')
    void say(['Qual deles voltou a ficar livre?'], 'liberar')
  }

  function terminar() {
    push('user', 'Não, é só isso')
    void say(
      [
        nesta.length
          ? 'Pronto. Sua grade da semana continua a mesma — só esses horários ficaram de fora.'
          : 'Combinado. Sua grade segue como estava.',
      ],
      'fim',
    )
  }

  const chips = verTodos ? dias : dias.slice(0, MAX_DAY_CHIPS)
  const andados = ORDEM.indexOf(step)
  const progresso = step === 'boot' ? 0 : Math.min(1, (andados + 1) / ORDEM.length)
  const tema = getTheme(profile.theme)

  return (
    <div
      className={`themed min-h-dvh w-full surf-${tema.style.surface}`}
      style={themeStyle(profile.theme)}
    >
      <div data-agenda-chat className="mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden">
        {/* Cabeçalho: o mesmo da conversa do cliente, com o aviso trocado — do
            lado de dentro o que importa não é "isto é automático", é "isto é só
            seu". */}
        <header
          className="relative z-10 flex shrink-0 items-center gap-3 px-4 pb-3.5 pt-3.5"
          style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
        >
          <button
            type="button"
            onClick={onSair}
            // "Sair da agenda", e não "Voltar": a conversa tem uma ficha de
            // escape com esse nome, e dois controles com o MESMO nome acessível
            // na mesma tela é ambiguidade para quem navega por leitor de tela —
            // e para o teste, que clicava num achando que era o outro.
            aria-label="Sair da agenda"
            className="t-faint -ml-1 shrink-0 rounded-full p-2 transition-colors hover:bg-[var(--c-accent-soft)]"
          >
            <ArrowRight width={18} height={18} className="rotate-180" />
          </button>
          <span className="relative shrink-0">
            <Avatar src={profile.avatarUrl} name={profile.name} size={40} frame="circle" />
            <span
              className="absolute -bottom-0.5 -right-0.5 flex h-[17px] w-[17px] items-center justify-center rounded-full"
              style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
              aria-hidden
            >
              <SparkIcon width={10} height={10} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[15.5px] font-semibold leading-tight">
              Sua agenda
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-tight">
              <span className="t-faint truncate">assistente virtual</span>
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider"
                style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
              >
                Só você vê
              </span>
            </p>
          </div>
          <EstadoDaGravacao gravando={gravando} erro={erro} fechados={busy.length} />
        </header>

        {/* Fio de progresso — o mesmo da conversa do cliente. */}
        <div className="relative z-10 h-[2px] shrink-0" style={{ background: 'var(--c-border)' }}>
          <motion.div
            className="h-full origin-left"
            style={{ background: 'var(--c-accent)' }}
            initial={false}
            animate={{ scaleX: progresso }}
            transition={{ duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* `min-h-0` é essencial: sem isso o item flex cresce com o conteúdo, a
            lista para de rolar e o painel corta as mensagens. */}
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-label="Conversa com o assistente sobre a sua agenda"
          className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5"
        >
          <div className="mt-auto space-y-2.5">
            <AnimatePresence initial={false}>
              {msgs.map((m) => (
                <Bubble key={m.id} from={m.from} text={m.text} reduced={!!reduced} />
              ))}
            </AnimatePresence>
            {typing && <TypingDots />}
            {step === 'fim' && nesta.length > 0 && (
              <Summary
                title="Horários fechados"
                rows={nesta.map((k) => [formatBusyShort(k).split(' · ')[0], `às ${k.slice(11)}`])}
                reduced={reduced}
              />
            )}
          </div>
        </div>

        {/* Área de resposta — chips ou campo, conforme a etapa */}
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
              ) : step === 'dia' ? (
                <div className="space-y-2.5">
                  <ChipRow label="Que dia você marcou">
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
                    {busy.length > 0 && (
                      <Chip subtle onClick={irLiberar}>
                        Liberar um horário
                      </Chip>
                    )}
                  </ChipRow>
                  <Composer
                    value={draft}
                    onChange={setDraft}
                    onSend={() => digitarData(draft)}
                    placeholder="Ou escreva a data — ex.: 25/11"
                    label="Data do horário marcado"
                    canSend={draft.trim().length > 2}
                  />
                </div>
              ) : step === 'hora' ? (
                <ChipRow label="Horário marcado">
                  {restantes.map((t) => (
                    <Chip key={t} onClick={() => fecharHorario(t)}>
                      {t}
                    </Chip>
                  ))}
                  {restantes.length > 1 && (
                    <Chip subtle onClick={fecharDiaInteiro}>
                      O dia todo
                    </Chip>
                  )}
                  <Chip subtle onClick={outroDia}>
                    Outro dia
                  </Chip>
                </ChipRow>
              ) : step === 'liberar' ? (
                <ChipRow label="Horários fechados">
                  {busy.map((k) => (
                    <Chip key={k} onClick={() => liberar(k)}>
                      {formatBusyShort(k)}
                    </Chip>
                  ))}
                  <Chip subtle onClick={outroDia}>
                    Nenhum
                  </Chip>
                </ChipRow>
              ) : step === 'mais' ? (
                <ChipRow label="E então">
                  {restantes.length > 0 && (
                    <Chip onClick={() => setStep('hora')}>Outro horário nesse dia</Chip>
                  )}
                  <Chip onClick={outroDia}>Outro dia</Chip>
                  {busy.length > 0 && (
                    <Chip subtle onClick={irLiberar}>
                      Liberar um horário
                    </Chip>
                  )}
                  <Chip subtle onClick={terminar}>
                    Não, é só isso
                  </Chip>
                </ChipRow>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={abrir}
                    className="t-btn w-full !py-3.5 text-[15px]"
                  >
                    <CalendarIcon width={18} height={18} />
                    Marcar outro horário
                  </button>
                  <button
                    type="button"
                    onClick={onSair}
                    className="t-faint w-full py-1 text-center text-[12.5px] font-medium underline-offset-4 hover:underline"
                  >
                    Voltar ao painel
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <p className="t-faint mt-2.5 text-center text-[10.5px] leading-relaxed opacity-90">
            Isto é só entre você e o assistente. Nada aqui aparece no seu perfil — o horário
            simplesmente deixa de ser oferecido naquele dia.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * O selo de gravação no cabeçalho.
 *
 * A conversa parece um mensageiro, e mensageiro nenhum tem botão de salvar — mas
 * aqui cada marcação é uma ida ao servidor, e uma que falha em silêncio devolve o
 * horário ao ar sem ninguém saber. Daí o estado à vista: guardando, guardado, ou
 * o que deu errado.
 */
function EstadoDaGravacao({
  gravando,
  erro,
  fechados,
}: {
  gravando: boolean
  erro: string | null
  fechados: number
}) {
  if (erro) {
    return (
      <span
        className="shrink-0 rounded-full px-2 py-1 text-[10.5px] font-semibold"
        style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
        title={erro}
      >
        não guardou
      </span>
    )
  }
  if (gravando) {
    return <span className="t-faint shrink-0 text-[10.5px]">guardando…</span>
  }
  if (!fechados) return null
  return (
    <span className="t-faint flex shrink-0 items-center gap-1 text-[10.5px] tabular-nums">
      <CheckIcon width={11} height={11} strokeWidth={2.4} />
      {fechados}
    </span>
  )
}
