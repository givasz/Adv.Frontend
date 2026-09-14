import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { sampleProfile } from '@/lib/mockData'
import { buildAssistantMessage, type AssistantAnswers, type AssistantDayOption } from '@/lib/assistant'
import { themeStyle } from '@/lib/themes'
import { Avatar } from '@/components/ui/Avatar'
import { CalendarIcon, CheckIcon, MessageIcon, PenIcon, WhatsappIcon } from '@/components/ui/icons'

// O PRIMEIRO CONTATO, em três quadros — a seção que mais vende o produto.
//
// Descrever "assistente virtual configurável" não faz ninguém se enxergar
// usando. Mostrar faz: (1) o que o cliente encontra ao abrir o endereço, (2) o
// que acontece quando ele quer falar com o advogado, (3) o que chega no WhatsApp
// do advogado. Quem lê os três quadros pensa "meu cliente entra ali e eu recebo
// isto" — e é esse pensamento que leva ao plano Max.
//
// Os dois primeiros quadros são desenhados em HTML na linguagem das telas de
// verdade (o perfil e a conversa do assistente), como a folha da vitrine de
// contratos — nada de captura de tela que envelhece. O terceiro NÃO é desenhado:
// a mensagem é montada por `buildAssistantMessage`, a mesma função que monta a
// mensagem real. Se o formato mudar no produto, o quadro muda junto — a home não
// tem como prometer um formato que o assistente não entrega.
//
// Tudo é exemplo, com dados fictícios (o mesmo perfil-modelo do telefone do
// topo), e os botões desenhados não levam a lugar nenhum: são `<span>`, não
// links — ver lib/exemplo.ts para o porquê.

/** O dia escolhido no exemplo. Só `longLabel` entra na mensagem. */
const DIA_DO_EXEMPLO: AssistantDayOption = {
  key: '2026-09-22',
  date: new Date(2026, 8, 22),
  weekday: 2,
  label: 'Ter, 22 set',
  longLabel: 'terça-feira, 22 de setembro',
  relative: '',
  times: ['10:00', '11:00'],
}

/**
 * As respostas do visitante fictício. As três perguntas são as do perfil-modelo
 * (lib/mockData.ts) — as mesmas que a conversa ao vivo, mais abaixo na home,
 * faz de verdade. O relato é curto e genérico de propósito: a vitrine ensina a
 * escrever "em linhas gerais", como o aviso da conversa pede.
 */
const RESPOSTAS_DO_EXEMPLO: AssistantAnswers = {
  name: 'Ana',
  day: DIA_DO_EXEMPLO,
  time: '10:00',
  format: 'online',
  triagem: [
    { id: 'e1', pergunta: 'Qual assunto você deseja tratar?', resposta: 'Direito de Família' },
    { id: 'e2', pergunta: 'Você já possui processo sobre esse assunto?', resposta: 'Não' },
    {
      id: 'e3',
      pergunta: 'Conte brevemente o que aconteceu.',
      resposta: 'Quero entender como rever um acordo de pensão.',
    },
  ],
}

const PASSOS = [
  {
    n: 1,
    titulo: 'O que o seu cliente encontra',
    texto:
      'Um endereço com o seu nome. Foto, OAB, áreas de atuação, apresentação e os seus canais — sem distração e sem rolar por um feed.',
  },
  {
    n: 2,
    titulo: 'O que acontece quando ele quer falar com você',
    texto:
      'Ele responde às perguntas que você definiu e escolhe um horário que você deixou aberto. O assistente se identifica como automático e não dá orientação jurídica.',
    tag: 'Plano Max',
  },
  {
    n: 3,
    titulo: 'O que chega para você',
    texto:
      'Uma mensagem só, no seu WhatsApp, com tudo no lugar: nome, dia, horário, formato e as respostas. Você lê, avalia e confirma — quando puder.',
  },
] as const

export function PrimeiroContato() {
  const reduzido = useReducedMotion()

  // Uma revelação só, orquestrada: os três quadros sobem em sequência quando a
  // seção entra na tela, e dentro do quadro da conversa os balões chegam um a
  // um — o mesmo gesto do assistente de verdade. Só opacidade e deslocamento
  // (nada de altura), que o celular compõe sem repintar.
  const lista: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduzido ? 0 : 0.16, delayChildren: reduzido ? 0 : 0.05 } },
  }
  const quadro: Variants = {
    hidden: { opacity: 0, y: reduzido ? 0 : 22 },
    show: { opacity: 1, y: 0, transition: { duration: reduzido ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] } },
  }

  return (
    <motion.ol
      variants={lista}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      className="relative grid gap-9 lg:grid-cols-3 lg:gap-6"
    >
      {PASSOS.map((p, i) => (
        <motion.li
          key={p.n}
          variants={quadro}
          className={`relative flex flex-col ${
            // A linha que liga os passos: vertical no celular (à esquerda dos
            // números, de um passo ao seguinte) e horizontal no computador (o
            // filete atrás dos números). O último passo não continua a linha.
            i < PASSOS.length - 1
              ? "before:absolute before:bottom-[-2.25rem] before:left-[19px] before:top-11 before:w-px before:bg-brass/35 before:content-[''] lg:before:hidden"
              : ''
          }`}
        >
          <div className="relative flex items-start gap-4">
            {i < PASSOS.length - 1 && (
              <span
                aria-hidden
                className="absolute left-10 right-[-1.5rem] top-[19px] hidden h-px bg-brass/35 lg:block"
              />
            )}
            <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brass/50 bg-paper font-display text-[17px] font-semibold italic text-brass-deep">
              {p.n}
            </span>
            <div className="min-w-0 pt-1.5">
              <h3 className="font-display text-[19px] font-semibold leading-tight text-ink">
                {p.titulo}
                {'tag' in p && (
                  <span className="ml-2 inline-block translate-y-[-2px] rounded-full bg-burgundy px-2 py-0.5 align-middle font-sans text-[10.5px] font-bold uppercase not-italic tracking-wider text-paper">
                    {p.tag}
                  </span>
                )}
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{p.texto}</p>
            </div>
          </div>

          {/* `relative z-[1]`: no celular o quadro ocupa a largura toda e cobre a
              linha vertical do passo — ela só aparece nos vãos entre o quadro
              e o número seguinte, que é onde diz alguma coisa. */}
          <div className="relative z-[1] mt-5 flex-1">
            {p.n === 1 && <PerfilEmMiniatura />}
            {p.n === 2 && <ConversaEmMiniatura reduzido={!!reduzido} />}
            {p.n === 3 && <MensagemQueChega />}
          </div>
        </motion.li>
      ))}
    </motion.ol>
  )
}

// ---- Quadro 1: o topo do perfil ---------------------------------------------

function PerfilEmMiniatura() {
  return (
    <div
      aria-hidden
      style={themeStyle('papel')}
      className="themed flex h-full flex-col justify-center rounded-[22px] border border-ink/10 px-5 pb-5 pt-6 shadow-card"
    >
      <div className="flex flex-col items-center text-center">
        <Avatar name={sampleProfile.name} size={60} />
        <p className="mt-3 font-display text-[20px] font-semibold leading-tight text-ink">
          {sampleProfile.name}
        </p>
        <p className="mt-1 text-[12px] text-ink-faint">
          {sampleProfile.oabNumber} · {sampleProfile.city}, {sampleProfile.state}
        </p>
        <p className="mt-2 max-w-[240px] text-[12.5px] leading-snug text-ink-soft">
          {sampleProfile.headline}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {sampleProfile.areas.slice(0, 3).map((a) => (
          <span
            key={a.id}
            className="rounded-full border border-ink/10 bg-paper-soft px-2.5 py-1 text-[11.5px] font-medium text-ink-soft"
          >
            {a.label}
          </span>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        <span className="t-btn flex h-10 w-full text-[13px]">
          <WhatsappIcon width={18} height={18} />
          Conversar no WhatsApp
        </span>
        <span className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-burgundy/40 text-[13px] font-semibold text-burgundy">
          <CalendarIcon width={17} height={17} />
          Agendar uma conversa
        </span>
      </div>

      <p className="mt-4 text-center text-[11px] text-ink-faint">
        advoc.me/<span className="font-semibold text-ink">{sampleProfile.slug}</span>
      </p>
    </div>
  )
}

// ---- Quadro 2: a triagem, no vocabulário da conversa real -------------------

function ConversaEmMiniatura({ reduzido }: { reduzido: boolean }) {
  const primeiroNome = sampleProfile.name.split(' ')[0]
  const balao: Variants = {
    hidden: { opacity: 0, y: reduzido ? 0 : 8 },
    show: { opacity: 1, y: 0, transition: { duration: reduzido ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] } },
  }
  const fila: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduzido ? 0 : 0.22, delayChildren: reduzido ? 0 : 0.35 } },
  }

  return (
    <div
      aria-hidden
      style={themeStyle('papel')}
      className="themed flex h-full flex-col rounded-[22px] border border-ink/10 shadow-card"
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--c-border)' }}>
        <span className="t-muted flex items-center gap-1.5 text-[12px] font-semibold">
          <MessageIcon width={15} height={15} className="t-accent" />
          Assistente de {primeiroNome}
        </span>
        <span className="t-accent flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider">
          <PenIcon width={11} height={11} />
          perguntas suas
        </span>
      </div>

      <motion.div variants={fila} className="flex flex-1 flex-col gap-2 px-3.5 py-4 text-[13px]">
        <Balao variants={balao} de="bot">
          Olá! Sou o assistente virtual de {primeiroNome}. Vou fazer algumas perguntas para organizar o
          seu atendimento.
        </Balao>
        <Balao variants={balao} de="bot">
          Qual assunto você deseja tratar?
        </Balao>
        <motion.div variants={balao} className="flex flex-wrap gap-1.5 pl-1">
          <Ficha marcada>Direito de Família</Ficha>
          <Ficha>Direito do Trabalho</Ficha>
          <Ficha>Outro assunto</Ficha>
        </motion.div>
        <Balao variants={balao} de="bot">
          Você já possui processo sobre esse assunto?
        </Balao>
        <Balao variants={balao} de="visitante">
          Não
        </Balao>
        <Balao variants={balao} de="bot">
          Qual dia fica melhor para você?
        </Balao>
        <motion.div variants={balao} className="flex flex-wrap gap-1.5 pl-1">
          <Ficha>Ter, 22 set</Ficha>
          <Ficha>Qua, 23 set</Ficha>
          <Ficha>Qui, 24 set</Ficha>
        </motion.div>
      </motion.div>

      <p className="t-faint border-t px-4 py-2 text-center text-[10.5px] leading-snug" style={{ borderColor: 'var(--c-border)' }}>
        Assistente automático. Não presta orientação jurídica — quem confirma é {primeiroNome}.
      </p>
    </div>
  )
}

function Balao({
  de,
  variants,
  children,
}: {
  de: 'bot' | 'visitante'
  variants: Variants
  children: React.ReactNode
}) {
  const bot = de === 'bot'
  return (
    <motion.div variants={variants} className={`flex ${bot ? 'justify-start' : 'justify-end'}`}>
      <p
        className={`max-w-[88%] px-3 py-2 leading-snug ${
          bot ? 'rounded-[14px] rounded-bl-[4px] border' : 'rounded-[14px] rounded-br-[4px] font-medium'
        }`}
        style={
          bot
            ? { background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }
            : { background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }
        }
      >
        {children}
      </p>
    </motion.div>
  )
}

function Ficha({ marcada = false, children }: { marcada?: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium"
      style={{
        borderColor: marcada ? 'var(--c-accent)' : 'var(--c-ring)',
        background: marcada ? 'var(--c-accent)' : 'var(--c-accent-soft)',
        color: marcada ? 'var(--c-accent-ink)' : 'var(--c-text)',
      }}
    >
      {marcada && <CheckIcon width={11} height={11} strokeWidth={2.8} />}
      {children}
    </span>
  )
}

// ---- Quadro 3: a mensagem, montada pela função de verdade -------------------

function MensagemQueChega() {
  const mensagem = buildAssistantMessage(sampleProfile, RESPOSTAS_DO_EXEMPLO, sampleProfile.assistant?.durationMin)
  return (
    <figure
      aria-label="Exemplo da mensagem que chega no WhatsApp do advogado"
      className="flex h-full flex-col rounded-[22px] border border-ink/10 bg-paper-deep/60 shadow-card"
    >
      <figcaption className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
          <WhatsappIcon width={15} height={15} className="text-[#1f8f4f]" />
          Nova mensagem · Ana
        </span>
        <span className="text-[11px] tabular-nums text-ink-faint">10:42</span>
      </figcaption>
      <div className="flex-1 px-3.5 py-4">
        <p className="whitespace-pre-line rounded-[14px] rounded-tl-[4px] border border-ink/[0.08] bg-[#fffdf8] px-3.5 py-3 text-[12.5px] leading-[1.5] text-ink-soft shadow-card">
          {mensagem}
        </p>
      </div>
      <p className="border-t border-ink/10 px-4 py-2 text-center text-[10.5px] leading-snug text-ink-faint">
        Sai do aparelho de quem pediu direto para o seu WhatsApp — sem passar por nós.
      </p>
    </figure>
  )
}
