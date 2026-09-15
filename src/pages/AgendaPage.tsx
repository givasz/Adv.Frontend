import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import { resolveSchedulingMode } from '@/lib/booking'
import { enderecoEmLinha, enderecoVisivel } from '@/lib/endereco'
import {
  abrirNoCalendarioDaApple,
  baixarIcs,
  ehApple,
  ehIos,
  ehSafari,
  emUmBloco,
  linkGoogleAgenda,
  linkOutlook,
  nomeDoCalendarioDaApple,
  type Compromisso,
} from '@/lib/ics'
import { themeStyle } from '@/lib/themes'
import {
  assistantDayAt,
  buildAssistantDays,
  busyKey,
  dayKey,
  firstName,
  formatBusyLong,
  formatBusyShort,
  faixaDoHorario,
  horariosQueBatem,
  MAX_BUSY,
  MAX_DAY_CHIPS,
  motivoSemHorario,
  pareceData,
  weekdayLong,
  minToTime,
  parseBrDate,
  resolveAssistantConfig,
  timeToMin,
  type AssistantDayOption,
  type SemHorario,
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

type Step = 'boot' | 'dia' | 'hora' | 'duracao' | 'mais' | 'liberar' | 'qual' | 'outras' | 'fim'

/** Para onde o compromisso vai. Google e Outlook são link; Apple e "outra", arquivo. */
type Destino = 'google' | 'outlook' | 'outlook365' | 'apple' | 'arquivo'

const ORDEM: Step[] = ['dia', 'hora', 'duracao', 'mais', 'fim']

/** Quanto o compromisso pode durar. A duração do atendimento entra se não estiver aqui. */
const DURACOES = [30, 45, 60, 90, 120, 180]

/** 30 → "30 min", 60 → "1 hora", 90 → "1h30", 120 → "2 horas". */
function rotuloDuracao(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  if (!m) return h === 1 ? '1 hora' : `${h} horas`
  return `${h}h${String(m).padStart(2, '0')}`
}

/** ["09:00", "10:00", "11:00"] → "09:00, 10:00 e 11:00". */
function juntar(lista: string[]): string {
  return lista.length > 1
    ? `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`
    : (lista[0] ?? '')
}

// ---- Quando algo sai do trilho ---------------------------------------------
//
// Toda resposta de erro diz duas coisas: o que aconteceu com a agenda de quem
// visita, e o que ele pode fazer agora. "Erro ao salvar" não diz nenhuma das duas.

const LISTA_CHEIA = `Sua lista de horários fechados chegou ao limite de ${MAX_BUSY}. Libere os que já não valem em "Liberar um horário" — ou tire da grade os dias em que não vai atender.`

/** A marcação não chegou ao servidor: por quê, e o que isso muda para quem visita. */
function mensagemDeFalha(e: unknown): string {
  const efeito = 'Para quem visita, sua agenda continua como estava antes dela.'
  if (e instanceof SessaoExpirada) {
    return `Sua sessão expirou e a última alteração não foi guardada. ${efeito} Entre de novo e refaça a marcação.`
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return `Você está sem internet, e a última alteração não foi guardada. ${efeito} Quando a conexão voltar, toque em Tentar de novo.`
  }
  const detalhe = e instanceof Error && e.message ? ` (${e.message.replace(/\.$/, '')})` : ''
  return `Não consegui guardar a última alteração${detalhe}. ${efeito}`
}

/** A resposta para uma data digitada sem horário a fechar — ver motivoSemHorario. */
function porQueNaoTemHorario(motivo: SemHorario | null, key: string): string {
  const curta = `${key.slice(8, 10)}/${key.slice(5, 7)}`
  switch (motivo) {
    case 'passada':
      return `${curta} já passou. Aqui só dá para fechar horários de hoje em diante.`
    case 'nao-atende': {
      const wd = new Date(
        Number(key.slice(0, 4)),
        Number(key.slice(5, 7)) - 1,
        Number(key.slice(8, 10)),
      ).getDay()
      return `${cap(weekdayLong(wd))} não está na sua grade, então não há o que fechar em ${curta}. Se vai atender nesse dia, inclua-o em Dias e horários de atendimento.`
    }
    case 'lotado':
      return `Todos os horários de ${curta} já estão fechados. Para reabrir algum, use "Liberar um horário".`
    case 'ja-passaram':
      return 'Os horários de hoje na sua grade já passaram — não sobrou nada para fechar hoje.'
    default:
      return 'Não entendi a data. Escreva assim: 25/11 — ou toque em um dos dias acima.'
  }
}

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
  // O horário que ele tocou, à espera de quanto tempo o compromisso vai durar.
  const [inicio, setInicio] = useState<string | null>(null)
  // O compromisso que a ÚLTIMA ação fechou: início e duração (de um horário, ou
  // do dia inteiro). É o que a oferta de pôr na agenda leva — e some assim que
  // ele muda de assunto, para o botão nunca oferecer um compromisso que não é o
  // que está na tela.
  const [bloco, setBloco] = useState<{ inicio: string; duracaoMin: number } | null>(null)
  // O nome que ele dá ao compromisso, no campo logo abaixo das agendas. Opcional,
  // e fica só no aparelho — ver lib/ics.ts.
  const [nome, setNome] = useState('')
  // O compromisso que JÁ foi para uma agenda. Preenchido, a oferta não volta (seria
  // o evento em dobro); "Não abriu? Escolher outra agenda" reabre a escolha.
  const [agendado, setAgendado] = useState<Compromisso | null>(null)
  // No iPhone, só o Safari entrega o compromisso ao Calendário da Apple (ver
  // ehSafari); no Mac qualquer navegador baixa o arquivo, que o Calendário abre.
  const naApple = useMemo(() => (ehIos() ? ehSafari() : ehApple()), [])
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Sessão vencida não se resolve tentando de novo: o aviso troca o botão pelo login.
  const [sessaoExpirou, setSessaoExpirou] = useState(false)

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
  // Endereço no evento só quando ele atende presencialmente E publicou um: o
  // interruptor de endereço não-público vale aqui como vale no perfil.
  const localDoAtendimento = useMemo(
    () =>
      profile.serviceMode.inPerson && enderecoVisivel(profile.address)
        ? enderecoEmLinha(profile.address, profile.city, profile.state)
        : undefined,
    [profile.serviceMode.inPerson, profile.address, profile.city, profile.state],
  )
  // O compromisso como vai para a agenda: o horário que acabou de fechar e o nome,
  // se ele escreveu um. Os links do Google e do Outlook se remontam a cada letra, então
  // o que abre é sempre o que está escrito na tela.
  const compromisso = useMemo<Compromisso | null>(
    () =>
      bloco
        ? {
            ...bloco,
            titulo: nome.trim() || 'Atendimento',
            local: localDoAtendimento,
            descricao: 'Anotado pela sua agenda no advoc.me.',
          }
        : null,
    [bloco, nome, localDoAtendimento],
  )

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
              setSessaoExpirou(e instanceof SessaoExpirada)
              setErro(mensagemDeFalha(e))
            },
          ),
        () => undefined,
      )
    },
    [profile, cfg, setProfile],
  )

  // Reenvia a lista inteira como está na tela: é ela que a falha deixou de guardar.
  function tentarDeNovo() {
    gravar(busy)
  }

  // ---- Roteiro --------------------------------------------------------------

  const abrir = useCallback(() => {
    reset()
    setStep('boot')
    setDia(null)
    setVerTodos(false)
    setDraft('')
    setNesta([])
    setBloco(null)
    setAgendado(null)
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
    setBloco(null)
    setAgendado(null)
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
      void say([
        pareceData(bruto)
          ? `${bruto} não existe no calendário. Confira o dia e o mês — ex.: 25/11.`
          : 'Não entendi a data. Escreva assim: 25/11 — ou toque em um dos dias acima.',
      ])
      return
    }
    const opt = assistantDayAt(cfg, key)
    if (!opt) {
      void say([porQueNaoTemHorario(motivoSemHorario(cfg, key), key)])
      return
    }
    escolherDia(opt, true)
  }

  function fecharHorario(time: string) {
    if (!emFoco) return
    push('user', time)
    setInicio(time)
    setBloco(null)
    setAgendado(null)
    void say(['Quanto tempo vai durar?'], 'duracao')
  }

  // A duração fecha, além do horário tocado, os que ficariam EM CIMA do
  // compromisso — uma reunião de duas horas às 14:00 tira também o das 15:00 da
  // conversa. E é o mesmo tempo que vai para a agenda dele depois.
  function fecharComDuracao(minutos: number) {
    if (!emFoco || !inicio) return
    push('user', rotuloDuracao(minutos))
    const saem = horariosQueBatem(restantes, inicio, minutos, cfg.durationMin)
    // O horário tocado já não está livre (o dia inteiro foi fechado antes, por
    // exemplo). Gravar agora duplicaria a marcação e anunciaria algo que não mudou.
    if (!saem.includes(inicio)) {
      void say(
        [`O das ${inicio} já está fechado.${restantes.length ? ' Escolha outro horário.' : ''}`],
        restantes.length ? 'hora' : 'mais',
      )
      return
    }
    const chaves = saem.map((t) => busyKey(emFoco.key, t))
    // Acima do teto a lista seria cortada ao guardar, e justamente os horários
    // mais distantes — este inclusive — sumiriam sem aviso.
    if (busy.length + chaves.length > MAX_BUSY) {
      void say([LISTA_CHEIA], 'mais')
      return
    }
    gravar([...busy, ...chaves].sort())
    setNesta((n) => [...n, ...chaves])
    setBloco({ inicio: busyKey(emFoco.key, inicio), duracaoMin: minutos })

    const fim = timeToMin(inicio) + minutos
    const outros = saem.filter((t) => t !== inicio)
    const dia = cfg.days.find((d) => d.weekday === emFoco.weekday)
    const faixa = dia ? faixaDoHorario(dia, inicio, cfg.durationMin) : null
    const linhas = [
      `Anotado: ${emFoco.longLabel}, das ${inicio} ${fim < 24 * 60 ? `às ${minToTime(fim)}` : 'até a meia-noite'}.`,
    ]
    // Passar do horário não é erro — reunião estica, audiência atrasa —, mas ele
    // precisa saber que o compromisso saiu da grade que ele mesmo montou.
    if (fim > 24 * 60) {
      linhas.push(
        'Ele passa da meia-noite. Se continuar no dia seguinte em cima de algum horário da sua grade, feche lá também.',
      )
    } else if (faixa && fim > timeToMin(faixa.fim)) {
      linhas.push(
        `Ele termina ${rotuloDuracao(fim - timeToMin(faixa.fim))} depois do fim do seu atendimento nesse dia (${faixa.fim}). Tudo bem — se isso virar rotina, ajuste a grade em Dias e horários de atendimento.`,
      )
    }
    linhas.push(
      outros.length === 0
        ? 'Esse horário não aparece mais para quem visita.'
        : outros.length === 1
          ? `O das ${outros[0]} também sai da conversa — ficaria em cima desse compromisso.`
          : `Os das ${juntar(outros)} também saem da conversa — ficariam em cima desse compromisso.`,
    )
    if (restantes.length <= saem.length) {
      linhas.push('Com isso, o dia ficou sem horário livre — ele some da conversa.')
    }
    setNome('')
    void say([...linhas, ...ofertaDaAgenda()], 'qual')
  }

  function fecharDiaInteiro() {
    if (!emFoco) return
    push('user', 'O dia todo')
    const chaves = restantes.map((t) => busyKey(emFoco.key, t))
    if (busy.length + chaves.length > MAX_BUSY) {
      void say([LISTA_CHEIA], 'mais')
      return
    }
    gravar([...busy, ...chaves].sort())
    setNesta((n) => [...n, ...chaves])
    const b = emUmBloco(chaves, cfg.durationMin, { titulo: '' })
    setBloco(b && { inicio: b.inicio, duracaoMin: b.duracaoMin })
    setAgendado(null)
    setNome('')
    void say(
      [
        `Fechei ${emFoco.longLabel} inteiro: ${chaves.length} ${chaves.length === 1 ? 'horário sai' : 'horários saem'} da conversa.`,
        ...(b ? ofertaDaAgenda() : ['Marcou mais algum?']),
      ],
      b ? 'qual' : 'mais',
    )
  }

  function liberar(chave: string) {
    push('user', formatBusyShort(chave))
    gravar(busy.filter((b) => b !== chave))
    setNesta((n) => n.filter((b) => b !== chave))
    setBloco(null)
    setAgendado(null)
    void say(
      [`Liberado: ${formatBusyLong(chave)} volta a ser oferecido.`, 'Quer mexer em mais algum?'],
      'mais',
    )
  }

  // ---- Levar o compromisso para a agenda dele -------------------------------
  //
  // Fechou o horário → a conversa já oferece as agendas → a escolhida abre com o
  // evento preenchido, e ele só confirma. O nome é opcional, no campo junto dos
  // botões. Tudo é montado NO APARELHO DELE e vai direto para a agenda que ele
  // escolheu: o nome não passa pela API, não vai para o banco e não fica em log —
  // a coluna do perfil continua guardando só data e hora. Ver lib/ics.ts.

  /**
   * As falas que abrem a escolha. Na frente, as agendas do celular: o Google e, no
   * iPhone, o Calendário dele. Outlook e o arquivo moram em "Outra agenda".
   */
  function ofertaDaAgenda(
    abertura = 'Quer pôr na sua agenda? Toque nela, e o compromisso abre com dia e hora preenchidos.',
  ): string[] {
    return [
      abertura,
      // Fora do Safari o iPhone baixa o arquivo e para ali: o botão nem aparece, e a
      // conversa diz por quê em vez de deixá-lo procurando.
      ...(ehIos() && !ehSafari()
        ? ['O Calendário do iPhone só recebe o compromisso pelo Safari. Por aqui, use o Google Agenda.']
        : []),
    ]
  }

  function irParaAgenda() {
    if (!bloco) return
    push('user', `Pôr ${formatBusyShort(bloco.inicio)} na minha agenda`)
    void say(ofertaDaAgenda('Toque na sua agenda: o compromisso abre com dia e hora preenchidos.'), 'qual')
  }

  function escolherAgenda(destino: Destino) {
    if (!compromisso) return
    setAgendado(compromisso)
    const rotulo: Record<Destino, string> = {
      google: 'Google Agenda',
      outlook: 'Outlook',
      outlook365: 'Outlook do trabalho',
      apple: nomeDoCalendarioDaApple(),
      arquivo: 'Baixar o arquivo (.ics)',
    }
    push('user', rotulo[destino])
    // Google e Outlook já abriram pelo próprio link (ver o Chip com `href`);
    // Apple e "outra" saem daqui, ainda dentro do gesto do toque.
    if (destino === 'apple') abrirNoCalendarioDaApple([compromisso], profile.slug)
    if (destino === 'arquivo') baixarIcs([compromisso], profile.slug)
    // "Deve abrir", e não "abri": o assistente não tem como saber se a agenda
    // abriu — o navegador embutido de app engole aba nova e download em silêncio.
    // Para esse caso há o "Não abriu?" logo abaixo.
    const comoConfirmar: Record<Destino, string> = {
      google: 'O Google Agenda deve abrir com tudo preenchido. Confira e toque em Salvar.',
      outlook: 'O Outlook deve abrir com tudo preenchido. Confira e toque em Salvar.',
      outlook365: 'O Outlook deve abrir com tudo preenchido. Confira e toque em Salvar.',
      apple: ehIos()
        ? 'O Calendário deve abrir o compromisso. Toque em Adicionar.'
        : 'Baixei o compromisso — abra o arquivo e o Calendário adiciona.',
      arquivo:
        'Baixei o arquivo do compromisso (.ics). Abra-o e escolha a agenda — se a sua não aceitar arquivo, toque em "Não abriu?".',
    }
    void say(
      [
        comoConfirmar[destino],
        'Marcou mais algum? Me diga o dia e o horário, que eu ponho na agenda também.',
      ],
      'mais',
    )
  }

  function outraAgenda() {
    push('user', 'Escolher outra agenda')
    void say(['Sem problema. Qual?'], 'qual')
  }

  function outrasAgendas() {
    push('user', 'Outra agenda')
    void say(['Qual delas?'], 'outras')
  }

  function voltarAsAgendas() {
    push('user', 'Voltar')
    void say(['Certo. Qual agenda?'], 'qual')
  }

  // Não quis agora: o horário segue fechado, e o "Pôr … na minha agenda" fica no
  // passo seguinte para quando ele mudar de ideia.
  function agoraNao() {
    push('user', 'Agora não')
    void say(['Tudo bem. Marcou mais algum?'], 'mais')
  }

  function outroDia() {
    push('user', 'Outro dia')
    setDia(null)
    setVerTodos(false)
    setBloco(null)
    setAgendado(null)
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
  const duracoes = [...new Set([...DURACOES, cfg.durationMin])].sort((a, b) => a - b)
  // 'liberar', 'qual' e 'outras' são desvios a partir de 'mais', e não etapas próprias:
  // sem esta linha o fio de progresso ZERAVA no meio da conversa e voltava —
  // parecia que ela tinha recomeçado sozinha.
  const referencia = ORDEM.includes(step) ? step : 'mais'
  const andados = ORDEM.indexOf(referencia)
  const progresso = step === 'boot' ? 0 : Math.min(1, (andados + 1) / ORDEM.length)

  return (
    <div
      className="themed min-h-dvh w-full"
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
          {/* A falha de gravação fica AQUI, onde ele está olhando: o selo do
              cabeçalho só diz "não guardou", e o motivo num `title` não aparece
              no celular. */}
          {erro && (
            <div
              role="alert"
              className="mb-3 rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed"
              style={{ background: 'var(--c-accent-soft)', color: 'var(--c-text)' }}
            >
              <p>{erro}</p>
              {sessaoExpirou ? (
                <Link
                  to={`/entrar?next=${encodeURIComponent('/agenda')}`}
                  className="mt-1.5 inline-block font-semibold underline underline-offset-4"
                  style={{ color: 'var(--c-accent)' }}
                >
                  Entrar de novo
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={tentarDeNovo}
                  disabled={gravando}
                  className="mt-1.5 font-semibold underline underline-offset-4 disabled:opacity-50"
                  style={{ color: 'var(--c-accent)' }}
                >
                  {gravando ? 'Tentando…' : 'Tentar de novo'}
                </button>
              )}
            </div>
          )}

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
              ) : step === 'duracao' ? (
                <ChipRow label="Quanto tempo vai durar">
                  {duracoes.map((m) => (
                    <Chip key={m} onClick={() => fecharComDuracao(m)}>
                      {rotuloDuracao(m)}
                    </Chip>
                  ))}
                  <Chip subtle onClick={() => setStep('hora')}>
                    Outro horário
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
              ) : step === 'qual' && compromisso ? (
                <div className="space-y-2.5">
                  <ChipRow label="Em qual agenda">
                    {naApple && ehIos() && (
                      <Chip onClick={() => escolherAgenda('apple')}>{nomeDoCalendarioDaApple()}</Chip>
                    )}
                    <Chip href={linkGoogleAgenda(compromisso)} onClick={() => escolherAgenda('google')}>
                      Google Agenda
                    </Chip>
                    {naApple && !ehIos() && (
                      <Chip onClick={() => escolherAgenda('apple')}>{nomeDoCalendarioDaApple()}</Chip>
                    )}
                    <Chip subtle onClick={outrasAgendas}>
                      Outra agenda
                    </Chip>
                    <Chip subtle onClick={agoraNao}>
                      Agora não
                    </Chip>
                  </ChipRow>
                  {/* Sem foco automático: o teclado subindo sozinho a cada horário
                      fechado cobriria os botões das agendas. */}
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome do compromisso (opcional)"
                    aria-label="Nome do compromisso na sua agenda"
                    maxLength={140}
                    className="w-full rounded-full border px-4 py-2.5 text-[16px] outline-none transition-colors sm:text-[14px]"
                    style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                  />
                  <p className="t-faint px-1 text-[11px] leading-snug">
                    O nome fica só no seu aparelho — não guardo isso aqui.
                  </p>
                </div>
              ) : step === 'outras' && compromisso ? (
                <ChipRow label="Outra agenda">
                  <Chip href={linkOutlook(compromisso, 'pessoal')} onClick={() => escolherAgenda('outlook')}>
                    Outlook
                  </Chip>
                  <Chip
                    href={linkOutlook(compromisso, 'trabalho')}
                    onClick={() => escolherAgenda('outlook365')}
                  >
                    Outlook do trabalho
                  </Chip>
                  <Chip onClick={() => escolherAgenda('arquivo')}>Baixar o arquivo (.ics)</Chip>
                  <Chip subtle onClick={voltarAsAgendas}>
                    Voltar
                  </Chip>
                </ChipRow>
              ) : step === 'mais' ? (
                <ChipRow label="E então">
                  {/* Uma vez por compromisso, e dizendo QUAL: depois de ele ir para a
                      agenda, o botão sumido é o que evita o evento em dobro — e
                      quem quer outro compromisso marca o horário dele primeiro.
                      Para reabrir numa agenda diferente há o "Não abriu?". */}
                  {bloco && !agendado && (
                    <Chip onClick={irParaAgenda}>
                      <CalendarIcon width={13} height={13} className="t-accent" />
                      Pôr {formatBusyShort(bloco.inicio)} na minha agenda
                    </Chip>
                  )}
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
                  <Link
                    to="/editor?section=agenda"
                    className="t-faint block w-full py-1 text-center text-[12.5px] font-medium underline-offset-4 hover:underline"
                  >
                    Mudar meus dias e horários de atendimento
                  </Link>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Plano B, e só logo depois de escolher: navegador embutido (o do
              Instagram, o do WhatsApp) engole aba nova e download sem erro nenhum
              — a mesma armadilha de lib/whatsapp.ts. Voltar à escolha não pede o
              nome de novo. */}
          {agendado && step === 'mais' && !typing && (
            <button
              type="button"
              onClick={outraAgenda}
              className="t-faint mt-2.5 block w-full text-center text-[12px] font-medium underline-offset-4 hover:underline"
            >
              Não abriu? Escolher outra agenda
            </button>
          )}

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
