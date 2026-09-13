import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { themeStyle } from '@/lib/themes'
import { useDialog } from '@/lib/a11y'
import { comoAbrirWhatsapp } from '@/lib/whatsapp'
import { isExampleSlug } from '@/lib/perfilPublico'
import { Avatar } from '@/components/ui/Avatar'
import { PrivacyNote } from '@/components/ui/PrivacyNote'
import { ArrowRight, CalendarIcon, SparkIcon, WhatsappIcon, XIcon } from '@/components/ui/icons'
import {
  Bubble,
  cap,
  Chip,
  ChipRow,
  ChipToggle,
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
  falaDoEnderecoPresencial,
  formatChoice,
  MAX_DAY_CHIPS,
  resolveAssistantConfig,
  type AssistantAnswers,
  type AssistantDayOption,
} from '@/lib/assistant'
import {
  AVISO_DE_SEGURANCA,
  formatarData,
  limparResposta,
  pedeOrientacaoJuridica,
  proximaPergunta,
  perguntasDaConversa,
  respostaLivre,
  respostaNeutra,
  tetoDaResposta,
  type PerguntaDeTriagem,
  type RespostaDeTriagem,
} from '@/lib/triagem'

// Assistente virtual: uma conversa GUIADA (não é IA, não interpreta texto livre) que
// coleta dia, horário, formato e assunto e entrega tudo pronto no WhatsApp do advogado.
// Cada resposta do visitante é uma escolha entre opções que o próprio advogado marcou —
// o único campo livre é o "detalhe" e o nome.
//
// Conformidade: o roteiro é operacional. Ele não avalia o caso, não estima chances, não
// fala de honorários e não insiste — apenas organiza um pedido de horário (Prov. 205/2021).
//
// ---------------------------------------------------------------------------
// TRIAGEM (plano Max) — o roteiro que o PRÓPRIO ADVOGADO escreve.
//
// Quando ela está ligada, as perguntas dele vêm ANTES do agendamento, na ordem em
// que ele as ordenou, e substituem o par "assunto + detalhe" embutido: quem define
// o que é perguntado é ele, não nós. O assistente continua sem interpretar nada —
// ele lê enunciado, registra resposta e passa para a próxima.
//
// Três coisas mudam, e só elas:
//   • uma fala de segurança abre a conversa (não envie documento, senha, banco);
//   • um pedido de ANÁLISE JURÍDICA recebe uma recusa neutra e a conversa segue
//     (ver pedeOrientacaoJuridica) — nunca uma resposta sobre o caso;
//   • sem grade de horários, a triagem ainda roda e o pedido vira de CONTATO.
//
// Nada do que o visitante responde é gravado em lugar nenhum: as respostas vivem
// neste componente até virarem uma mensagem no aparelho dele. Ver lib/triagem.ts.

type Step = 'boot' | 'triagem' | 'day' | 'time' | 'format' | 'subject' | 'detail' | 'name' | 'done'

const STEP_ORDER: Step[] = ['day', 'time', 'format', 'subject', 'detail', 'name', 'done']
const OTHER_SUBJECT = 'Outro assunto'

export function AssistantChat({
  profile,
  onClose,
  variant = 'sheet',
  fullPage = false,
  autoStart = true,
  pace = 1,
  teste = false,
}: {
  profile: Profile
  /** ausente no modo 'inline' (demonstração embutida) */
  onClose?: () => void
  /**
   * Ensaio do próprio advogado ("Testar meu assistente"). A conversa roda inteira
   * e de verdade — é o ponto —, mas o fim não abre o WhatsApp: o pedido seria
   * dele para ele mesmo. Mesmo tratamento do perfil de exemplo.
   */
  teste?: boolean
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
  // Os dias recalculados AGORA, quando o horário escolhido expirou no meio da
  // conversa (ver horarioSaiu). Ficam por cima de `days` só até recomeçar — mexer
  // no próprio `days` reabriria a conversa, que depende do tamanho dele.
  const [diasFrescos, setDiasFrescos] = useState<AssistantDayOption[] | null>(null)
  const diasVisiveis = diasFrescos ?? days
  // Sem número válido não há para onde mandar o pedido: melhor dizer na abertura
  // do que depois de a pessoa responder tudo.
  const semWhatsapp = !assistantWhatsappHref(profile, {}, config.durationMin)
  const areas = useMemo(
    () => profile.areas.map((a) => a.label.trim()).filter(Boolean),
    [profile.areas],
  )
  const bothFormats = profile.serviceMode.inPerson && profile.serviceMode.online
  const soloFormat = profile.serviceMode.online ? 'online' : 'presencial'
  const first = firstName(profile.name)
  // A fala do endereço, pronta. Vazia quando o advogado não publicou um — e aí a
  // conversa segue como sempre seguiu. Ver falaDoEnderecoPresencial.
  const endereco = falaDoEnderecoPresencial(profile)

  // Falas, "digitando…" e o cancelamento das falas pendentes vivem no motor
  // compartilhado com o assistente do escritório (components/assistant).
  const { msgs, typing, push, say: falar, reset, reduced, listRef } = useConversation({ pace })
  const [step, setStep] = useState<Step>('boot')
  const [answers, setAnswers] = useState<AssistantAnswers>({})
  const [showAllDays, setShowAllDays] = useState(false)
  const [draft, setDraft] = useState('')
  // Perfil de EXEMPLO: a conversa inteira funciona (é a demonstração), mas o fim
  // não abre o WhatsApp — o número do perfil-modelo é inventado e pode ser de
  // alguém real. O botão continua lá, e tocar nele faz o próprio assistente dizer
  // o que aconteceria. Ver lib/exemplo.ts. `avisouExemplo` só encurta a fala a
  // partir do segundo toque.
  const exemplo = isExampleSlug(profile.slug)
  const [avisouExemplo, setAvisouExemplo] = useState(false)
  /** A conversa roda, mas o fim não envia nada: perfil-modelo ou ensaio do dono. */
  const semEnvio = exemplo || teste

  // ---- Triagem (plano Max) ----
  // A lista vem do perfil e NUNCA muda durante a conversa: nada do que o visitante
  // escreve entra aqui, o que é a resposta de arquitetura ao prompt injection.
  const perguntas = useMemo(() => perguntasDaConversa(profile), [profile])
  const temTriagem = perguntas.length > 0
  // O advogado pode ter posto a preferência de atendimento e o nome DENTRO da
  // triagem. Quando pôs, o roteiro não pergunta de novo — duas perguntas iguais
  // seguidas é o defeito mais visível que um assistente pode ter.
  const formatoNaTriagem = perguntas.some((q) => q.kind === 'atendimento')
  const nomeNaTriagem = perguntas.some((q) => q.kind === 'contato')
  const [triagemIdx, setTriagemIdx] = useState(0)
  const [triagem, setTriagem] = useState<RespostaDeTriagem[]>([])
  /** Opções já marcadas numa pergunta de múltipla escolha, antes de confirmar. */
  const [marcadas, setMarcadas] = useState<string[]>([])
  /** Quantas vezes o visitante já pediu uma análise do caso (ver respostaNeutra). */
  const [pedidosDeAnalise, setPedidosDeAnalise] = useState(0)

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
    setDiasFrescos(null)
    setDraft('')
    setAvisouExemplo(false)
    setTriagemIdx(0)
    setTriagem([])
    setMarcadas([])
    setPedidosDeAnalise(0)
    setStep('boot')
    const custom = config.greeting?.trim()
    const opening = custom
      ? [custom]
      : temTriagem
        ? [
            `Olá! Sou o assistente virtual${first ? ` de ${first}` : ''}.`,
            'Vou fazer algumas perguntas para organizar o seu atendimento. Não presto orientação jurídica — quem avalia o caso é o advogado.',
          ]
        : [
            `Olá! Sou o assistente virtual${first ? ` de ${first}` : ''}.`,
            'Posso reservar um horário de conversa. Não presto orientação jurídica — só organizo o pedido e encaminho.',
          ]
    if (semWhatsapp) {
      void say(
        [
          ...opening,
          'Por enquanto este perfil não informou um WhatsApp para receber pedidos, então não consigo reservar um horário por aqui.',
        ],
        'done',
      )
      return
    }
    // Com triagem, a fala de segurança vem ANTES da primeira pergunta: é o único
    // momento em que a pessoa ainda não escreveu nada e pode decidir o que
    // escrever. Depois da primeira resposta, o aviso chegaria tarde.
    if (temTriagem) {
      void say([...opening, AVISO_DE_SEGURANCA, perguntas[0].label], 'triagem')
      return
    }
    void say(days.length ? [...opening, 'Qual dia fica melhor para você?'] : opening, days.length ? 'day' : 'done')
  }, [config.greeting, days.length, first, say, reset, semWhatsapp, temTriagem, perguntas])

  useAutoStart(start, autoStart)
  usePinnedToBottom(listRef, [msgs, typing, step])

  // ---- Transições da TRIAGEM ----

  /**
   * Registra uma resposta e vai para a próxima pergunta do advogado.
   *
   * Duas respostas NÃO entram no bloco da triagem: a preferência de atendimento e
   * o nome. Elas alimentam os campos que a mensagem já tem ("Formato:", "Nome:"),
   * e repeti-las embaixo faria o advogado ler a mesma informação duas vezes na
   * mesma mensagem. O enunciado continua sendo o dele — o que muda é onde a
   * resposta aparece.
   */
  function responderTriagem(
    indice: number,
    bruto: string,
    antesDaProxima: string[] = [],
    opcaoId?: string,
  ) {
    const pergunta = perguntas[indice]
    if (!pergunta) return
    const resposta = limparResposta(bruto, tetoDaResposta(pergunta.kind))
    push('user', resposta || 'Prefiro não responder agora')
    if (pergunta.kind === 'contato') {
      if (resposta) setAnswers((a) => ({ ...a, name: resposta }))
    } else if (pergunta.kind === 'atendimento') {
      if (resposta) setAnswers((a) => ({ ...a, format: resposta.toLowerCase() }))
    } else {
      setTriagem((r) => [...r, { id: pergunta.id, pergunta: pergunta.label, resposta }])
    }

    // Pedido de análise jurídica numa resposta escrita à mão: o assistente diz,
    // de frente, que não avalia — e segue. Ignorar deixaria a pessoa achando que
    // alguém vai responder depois; responder seria consulta automatizada, que é o
    // que o Prov. 205/2021 veda.
    const antes = [...antesDaProxima]
    if (respostaLivre(pergunta.kind) && pedeOrientacaoJuridica(resposta)) {
      const n = pedidosDeAnalise + 1
      setPedidosDeAnalise(n)
      antes.unshift(respostaNeutra(n))
    }
    // O CAMINHO é da resposta, não da ordem da lista: "Família" pode levar a uma
    // pergunta e "Trabalhista" a outra. `proximaPergunta` resolve a cascata
    // (resposta → pergunta → a próxima da lista) e só anda para frente, que é o
    // que impede a conversa de andar em círculo.
    seguirTriagem(proximaPergunta(perguntas, indice, opcaoId), antes)
  }

  /** Da pergunta `proximo` em diante — ou o agendamento, quando acabarem. */
  function seguirTriagem(proximo: number, antes: string[] = []) {
    setDraft('')
    setMarcadas([])
    let i = proximo
    // Perfil que atende de um jeito só não tem o que perguntar sobre formato: a
    // resposta já é conhecida, e perguntar seria fingir uma escolha.
    while (perguntas[i]?.kind === 'atendimento' && !bothFormats) {
      setAnswers((a) => ({ ...a, format: a.format ?? soloFormat }))
      // A pergunta some, mas o caminho dela continua valendo: quem só atende
      // online e mandou "presencial → pergunta 5" não perde o desvio.
      i = proximaPergunta(perguntas, i)
    }
    setTriagemIdx(i)
    if (i < perguntas.length) {
      void say([...antes, perguntas[i].label], 'triagem')
      return
    }
    // Acabaram as perguntas do advogado. Daqui para a frente é o agendamento de
    // sempre — e, sem grade, o pedido é de contato.
    if (diasVisiveis.length) {
      void say([...antes, 'Obrigado. Agora, qual dia fica melhor para você?'], 'day')
      return
    }
    askSubject(antes, false)
  }

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
    // Voltou só para trocar um horário que expirou: o resto do pedido já está
    // respondido, e perguntar tudo de novo seria castigo por esperar.
    if (answers.name) {
      void say(
        [
          `Troquei para ${answers.day?.longLabel ?? 'esse dia'} às ${time}.`,
          'Toque no botão abaixo para enviar pelo WhatsApp — o horário só vale depois da confirmação.',
        ],
        'done',
      )
      return
    }
    // Com a preferência de atendimento já perguntada DENTRO da triagem, repetir
    // a pergunta aqui seria o assistente não tendo escutado a própria conversa.
    if (bothFormats && !formatoNaTriagem) {
      void say(['Anotado. A conversa seria presencial ou online?'], 'format')
      return
    }
    const escolhido = answers.format ?? soloFormat
    setAnswers((a) => ({ ...a, time, format: a.format ?? soloFormat }))
    // Perfil que só atende presencial nunca chega à pergunta de formato — mas o
    // endereço faz a mesma falta. Ele entra aqui, no mesmo ponto do roteiro.
    // (Na triagem o endereço já foi dito ao responder a pergunta de atendimento.)
    askSubject(escolhido === 'presencial' && !formatoNaTriagem ? [endereco] : [])
  }

  function pickFormat(format: string) {
    push('user', cap(format))
    setAnswers((a) => ({ ...a, format }))
    askSubject(format === 'presencial' ? [endereco] : [])
  }

  /**
   * `antes` são as falas que precedem a pergunta (o endereço do presencial, a
   * ressalva de que não há análise jurídica). `comHorario` distingue um pedido de
   * HORÁRIO de um pedido de CONTATO — só o primeiro pode prometer confirmação de
   * um horário.
   */
  function askSubject(antes: string[] = [], comHorario = true) {
    const abre = antes.filter(Boolean)
    // Com triagem, o par "assunto + detalhe" embutido não existe: quem define o
    // que é perguntado é o advogado, e ele já perguntou.
    if (temTriagem) {
      pedirNomeOuFechar(abre, comHorario)
      return
    }
    if (!areas.length) {
      void say(
        [...abre, 'Sobre qual assunto seria a conversa? Pode escrever em poucas palavras.'],
        'detail',
      )
      return
    }
    void say([...abre, 'Sobre qual assunto seria a conversa?'], 'subject')
  }

  /** O nome fecha a conversa — a menos que a triagem já o tenha perguntado. */
  function pedirNomeOuFechar(abre: string[], comHorario: boolean) {
    if (!nomeNaTriagem) {
      void say([...abre, 'Por último: como posso te chamar?'], 'name')
      return
    }
    encerrar(abre, comHorario)
  }

  /**
   * A última fala. Com horário escolhido, o pedido é de agendamento e a promessa
   * é a de sempre: quem confirma é o advogado. Sem horário (triagem em perfil sem
   * grade aberta), é um pedido de CONTATO — e prometer confirmação de um horário
   * que ninguém marcou seria a conversa mentindo no último balão.
   */
  function encerrar(abre: string[], comHorario: boolean) {
    void say(
      comHorario
        ? [
            ...abre,
            'Registrei seu pedido.',
            'Toque no botão abaixo para enviar tudo pelo WhatsApp — o horário só vale depois da confirmação.',
          ]
        : [
            ...abre,
            'Registrei suas respostas.',
            'Toque no botão abaixo para enviar pelo WhatsApp. O advogado vai analisar e responder — quem confirma o atendimento é ele.',
          ],
      'done',
    )
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
    const value = limparResposta(text)
    if (!value) return
    push('user', value)
    setAnswers((a) => ({ ...a, name: value }))
    setDraft('')
    // Sem horário escolhido não há o que expirar: é o caso da triagem num perfil
    // que não abriu grade nenhuma.
    if (answers.time && !horarioAindaVale(answers)) {
      horarioSaiu([`Prazer, ${firstName(value)}.`])
      return
    }
    encerrar([`Prazer, ${firstName(value)}.`], !!answers.time)
  }

  // ---- Horário que expirou no meio da conversa ----
  //
  // Os horários são calculados quando a conversa abre. Quem abre às 13:50, escolhe
  // "hoje às 16:00" e demora a responder pode chegar ao fim com o horário já
  // dentro da antecedência mínima — e mandar um pedido que o advogado não aceita.
  // A conta é refeita antes de fechar o pedido e antes de abrir o WhatsApp.

  function horarioAindaVale(a: AssistantAnswers): boolean {
    if (!a.day || !a.time) return false
    const { key } = a.day
    const time = a.time
    return buildAssistantDays(config).some((d) => d.key === key && d.times.includes(time))
  }

  function horarioSaiu(antes: string[] = []) {
    const agora = buildAssistantDays(config)
    setDiasFrescos(agora)
    setShowAllDays(false)
    setAnswers((a) => ({ ...a, day: undefined, time: undefined }))
    if (agora.length) {
      void say(
        [
          ...antes,
          'Só que esse horário acabou de sair da agenda — passou do prazo mínimo para pedir. Escolha outro, por favor:',
        ],
        'day',
      )
      return
    }
    // Nenhum horário sobrou. Com triagem, o que a pessoa respondeu continua
    // valendo: mandar isso e esperar o retorno é melhor do que pedir para ela
    // voltar mais tarde e responder tudo de novo.
    void say(
      temTriagem
        ? [
            ...antes,
            'Só que esse horário acabou de sair da agenda, e não sobrou outro aberto agora.',
            'Posso enviar o que você já respondeu — aí o advogado retorna com um horário.',
          ]
        : [
            ...antes,
            'Só que esse horário acabou de sair da agenda, e não sobrou outro aberto agora. Tente de novo mais tarde.',
          ],
      'done',
    )
  }

  // ---- Dados derivados da tela atual ----

  const dayOptions = showAllDays ? diasVisiveis : diasVisiveis.slice(0, MAX_DAY_CHIPS)
  const times = answers.day?.times ?? []
  const answered = STEP_ORDER.indexOf(step)
  // As respostas da triagem viajam junto: é o que vira o bloco "— Triagem —" na
  // mensagem. Fora do Max a lista é sempre vazia e nada muda.
  const respostas: AssistantAnswers = temTriagem ? { ...answers, triagem } : answers
  const href = assistantWhatsappHref(profile, respostas, config.durationMin)
  // Com triagem, o fio de progresso conta as perguntas do advogado — o roteiro
  // tem um tamanho diferente em cada perfil, e o STEP_ORDER fixo mostraria a
  // barra pulando de 0 a 60% na primeira resposta.
  const progress = temTriagem
    ? progressoDaTriagem({
        step,
        respondidas: triagemIdx,
        perguntas: perguntas.length,
        comDias: diasVisiveis.length > 0,
        pedeFormato: bothFormats && !formatoNaTriagem,
        pedeNome: !nomeNaTriagem,
        answers,
      })
    : step === 'boot'
      ? 0
      : Math.min(1, answered / (STEP_ORDER.length - 1))
  // Sem horário escolhido não há PEDIDO DE HORÁRIO — mas com triagem há um pedido
  // de contato, que vale por si. O que nunca há é conversa sem WhatsApp de destino.
  const ready = step === 'done' && !!href && (!!answers.time || temTriagem)
  /** A pergunta em cena, quando o roteiro está na triagem. */
  const perguntaAtual = step === 'triagem' ? perguntas[triagemIdx] : undefined

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
            {/* No perfil de exemplo, um selo ao lado: a conversa funciona de
                verdade, mas a pessoa do outro lado não existe. Cor fixa da marca,
                e não a do tema, para não se confundir com o "Automático". */}
            {exemplo && (
              <span className="shrink-0 rounded-full bg-burgundy px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-paper">
                Exemplo
              </span>
            )}
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
            title={answers.time ? 'Pedido de horário' : 'Pedido de contato'}
            rows={summaryRows(answers, config.durationMin)}
            empilhadas={triagem.map((r) => [r.pergunta, r.resposta || '—'] as [string, string])}
            reduced={reduced}
          />
        )}
        </div>
      </div>

      {/* Área de resposta — chips ou campo de texto, conforme a etapa.
          Os três `data-` são como o teste de fumaça percorre o roteiro: com a
          triagem, o que aparece aqui muda a cada perfil, e o teste responde ao
          que estiver em cena em vez de repetir uma sequência fixa.
          `data-passo` é o sinal de que a conversa ANDOU — entre duas falas do
          assistente a área volta a mostrar os controles anteriores por um
          instante, e sem ele o teste respondia duas vezes à mesma pergunta. */}
      <div
        data-conversa-resposta
        data-passo={step === 'triagem' ? `triagem-${triagemIdx}` : step}
        data-digitando={typing ? '1' : '0'}
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
            ) : perguntaAtual ? (
              <CampoDaTriagem
                pergunta={perguntaAtual}
                indice={triagemIdx}
                draft={draft}
                setDraft={setDraft}
                marcadas={marcadas}
                setMarcadas={setMarcadas}
                onResponder={responderTriagem}
                endereco={endereco}
              />
            ) : step === 'day' ? (
              <ChipRow label="Escolha um dia">
                {dayOptions.map((d) => (
                  <Chip key={d.key} onClick={() => pickDay(d)}>
                    <CalendarIcon width={14} height={14} className="t-accent" />
                    {d.label}
                    {d.relative && <em className="t-faint not-italic">· {d.relative}</em>}
                  </Chip>
                ))}
                {!showAllDays && diasVisiveis.length > MAX_DAY_CHIPS && (
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
                {semEnvio ? (
                  // Perfil de exemplo, ou o ensaio do próprio advogado: o mesmo
                  // botão, com a mesma cara — e sem link nenhum. Sem `href` não
                  // sobra o que abrir em nova aba nem o que copiar.
                  <button
                    type="button"
                    onClick={() => {
                      if (answers.time && !horarioAindaVale(answers)) {
                        horarioSaiu()
                        return
                      }
                      void say(
                        avisouExemplo
                          ? [teste ? 'Continua sendo um teste — nada foi enviado.' : 'Este é só um exemplo — nada foi enviado.']
                          : teste
                            ? [
                                'Aqui a mensagem seguiria pronta para o seu WhatsApp, com tudo o que foi respondido.',
                                'Como este é um teste seu, nada foi enviado.',
                              ]
                            : [
                                `Aqui o pedido seguiria pronto para o WhatsApp de ${first || 'quem publicou o perfil'}.`,
                                'Como este é um perfil de exemplo, nada foi enviado — ninguém recebe esta mensagem.',
                              ],
                      )
                      setAvisouExemplo(true)
                    }}
                    className="t-btn w-full !py-3.5 text-[15px]"
                  >
                    <WhatsappIcon width={20} height={20} />
                    Enviar no WhatsApp
                    <ArrowRight width={16} height={16} />
                  </button>
                ) : (
                  <a
                    href={href}
                    {...comoAbrirWhatsapp()}
                    onClick={(e) => {
                      // A pessoa pode ter parado no botão por um bom tempo. Sem
                      // horário escolhido não há o que expirar.
                      if (!answers.time || horarioAindaVale(answers)) return
                      e.preventDefault()
                      horarioSaiu()
                    }}
                    className="t-btn w-full !py-3.5 text-[15px]"
                  >
                    <WhatsappIcon width={20} height={20} />
                    Enviar no WhatsApp
                    <ArrowRight width={16} height={16} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={start}
                  className="t-faint w-full py-1 text-center text-[12.5px] font-medium underline-offset-4 hover:underline"
                >
                  {answers.time ? 'Escolher outro horário' : 'Começar de novo'}
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

        {/* O aviso de privacidade entra só quando a conversa começa a PEDIR dado
            pessoal (assunto e nome). Mostrá-lo desde o "escolha um dia" seria
            ruído; escondê-lo na etapa do assunto seria pedir sem avisar. */}
        {(step === 'detail' || step === 'name' || step === 'triagem' || ready) && (
          <PrivacyNote
            fluxo="assistente"
            tone="themed"
            // A orientação "escreva em linhas gerais" só faz sentido ENQUANTO há
            // um campo livre aberto. Numa pergunta de escolha ela viraria conselho
            // sobre um campo que não existe.
            semGuarda={step === 'triagem' ? !respostaLivre(perguntaAtual?.kind ?? 'escolha') : step !== 'detail'}
            className="mt-2.5 text-center"
          />
        )}
        <p className="t-faint mt-2.5 text-center text-[10.5px] leading-relaxed opacity-90">
          Assistente automático. Não presta orientação jurídica e não confirma{' '}
          {temTriagem && !diasVisiveis.length ? 'o atendimento' : 'o horário'} — quem confirma é{' '}
          {first || 'o(a) advogado(a)'}.
        </p>
      </div>
    </div>
  )

  // Em página, o fundo da tela também é o do tema do perfil: a conversa continua
  // sendo "a casa" do advogado, não uma tela branca do sistema.
  if (page) {
    return (
      <div
        className="themed min-h-dvh w-full"
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

// ---- A área de resposta de uma pergunta da triagem -------------------------
//
// Um tipo por vez, e nenhum deles é um formulário: escolha vira chip, sim/não
// vira dois chips, texto vira o mesmo campo do resto da conversa. O visitante
// não deve perceber que mudou de mecanismo no meio do caminho.
//
// O enunciado JÁ FOI DITO pelo assistente, no balão acima. Aqui o rótulo é o do
// gesto ("Escolha uma opção"), e o `aria-label` do campo livre repete a pergunta
// — quem ouve a tela precisa do vínculo que o olho faz sozinho.

const ROTULO_DO_GESTO: Record<PerguntaDeTriagem['kind'], string> = {
  escolha: 'Escolha uma opção',
  multipla: 'Marque quantas quiser',
  'sim-nao': 'Sim ou não',
  atendimento: 'Formato do atendimento',
  data: 'Escolha uma data',
  texto: 'Sua resposta',
  'texto-longo': 'Sua resposta',
  contato: 'Seu nome',
}

function CampoDaTriagem({
  pergunta,
  indice,
  draft,
  setDraft,
  marcadas,
  setMarcadas,
  onResponder,
  endereco,
}: {
  pergunta: PerguntaDeTriagem
  indice: number
  draft: string
  setDraft: (v: string) => void
  marcadas: string[]
  setMarcadas: (v: string[]) => void
  onResponder: (indice: number, texto: string, antes?: string[], opcaoId?: string) => void
  /** fala do endereço, dita quando a pessoa escolhe presencial */
  endereco: string
}) {
  const rotulo = ROTULO_DO_GESTO[pergunta.kind]
  const pular = pergunta.optional ? (
    <Chip subtle onClick={() => onResponder(indice, '')}>
      Prefiro não responder
    </Chip>
  ) : null

  // Escolha, sim/não e atendimento são o MESMO gesto: uma fileira de opções.
  // As três guardam suas opções no mesmo lugar (as duas últimas com a lista
  // fixa, posta pelo normalizador) — é isso que faz ramificar ser um mecanismo
  // só, e não três.
  if (pergunta.kind !== 'multipla' && pergunta.options?.length) {
    return (
      <ChipRow label={rotulo}>
        {pergunta.options.map((o) => (
          <Chip
            key={o.id}
            onClick={() =>
              // Escolher "presencial" é a hora de dizer onde fica o escritório —
              // quem acabou de decidir sair de casa pergunta "onde?" em seguida.
              onResponder(
                indice,
                o.texto,
                pergunta.kind === 'atendimento' && o.id === 'presencial' && endereco
                  ? [endereco]
                  : [],
                // O id da opção é o que decide o CAMINHO. O texto é o que vai na
                // mensagem; usá-lo como chave de caminho quebraria o desvio a cada
                // correção de digitação do advogado.
                o.id,
              )
            }
          >
            {o.texto}
          </Chip>
        ))}
        {pular}
      </ChipRow>
    )
  }

  if (pergunta.kind === 'multipla') {
    const alterna = (id: string) =>
      setMarcadas(marcadas.includes(id) ? marcadas.filter((x) => x !== id) : [...marcadas, id])
    return (
      <div>
        <ChipRow label={rotulo}>
          {(pergunta.options ?? []).map((o) => (
            <ChipToggle key={o.id} on={marcadas.includes(o.id)} onClick={() => alterna(o.id)}>
              {o.texto}
            </ChipToggle>
          ))}
        </ChipRow>
        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            disabled={!marcadas.length}
            // A ordem das OPÇÕES manda, não a ordem em que foram tocadas: a
            // resposta é lida pelo advogado, e ele reconhece a própria lista.
            // Múltipla escolha NÃO ramifica (duas respostas apontando para
            // lugares diferentes não têm desempate honesto), então nenhum id de
            // opção viaja daqui.
            onClick={() =>
              onResponder(
                indice,
                (pergunta.options ?? [])
                  .filter((o) => marcadas.includes(o.id))
                  .map((o) => o.texto)
                  .join(', '),
              )
            }
            className="rounded-full px-4 py-2 text-[13.5px] font-semibold transition-opacity disabled:opacity-40"
            style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
          >
            Pronto{marcadas.length ? ` (${marcadas.length})` : ''}
          </button>
          {pergunta.optional && (
            <button
              type="button"
              onClick={() => onResponder(indice, '')}
              className="t-faint text-[13px] font-medium underline-offset-4 hover:underline"
            >
              Prefiro não responder
            </button>
          )}
        </div>
      </div>
    )
  }

  // Campo escrito: data, resposta curta, resposta longa e o nome.
  const data = pergunta.kind === 'data'
  return (
    <Composer
      value={draft}
      onChange={setDraft}
      onSend={() => onResponder(indice, data ? formatarData(draft) : draft)}
      type={data ? 'date' : 'text'}
      maxLength={tetoDaResposta(pergunta.kind)}
      placeholder={data ? '' : pergunta.kind === 'contato' ? 'Seu nome' : 'Escreva sua resposta'}
      label={pergunta.label}
      skipLabel={pergunta.optional ? 'Pular' : undefined}
      onSkip={pergunta.optional ? () => onResponder(indice, '') : undefined}
      canSend={draft.trim().length > (pergunta.kind === 'contato' ? 1 : 0)}
    />
  )
}

// ---- Fio de progresso da conversa com triagem ------------------------------
//
// O roteiro tem um tamanho diferente em cada perfil (3 perguntas aqui, 7 ali,
// com ou sem grade de horários), então a fração é contada, não tabelada. Sem
// isto a barra pulava de 0 a 60% na primeira resposta de quem tem sete perguntas.
function progressoDaTriagem(o: {
  step: Step
  respondidas: number
  perguntas: number
  comDias: boolean
  pedeFormato: boolean
  pedeNome: boolean
  answers: AssistantAnswers
}): number {
  if (o.step === 'boot') return 0
  if (o.step === 'done') return 1
  const total = o.perguntas + (o.comDias ? 2 : 0) + (o.pedeFormato ? 1 : 0) + (o.pedeNome ? 1 : 0)
  if (!total) return 1
  const feitos =
    o.respondidas +
    (o.answers.day ? 1 : 0) +
    (o.answers.time ? 1 : 0) +
    (o.pedeFormato && o.answers.format ? 1 : 0) +
    (o.pedeNome && o.answers.name ? 1 : 0)
  return Math.min(1, feitos / total)
}
