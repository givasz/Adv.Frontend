import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { sampleProfile } from '@/lib/mockData'
import { PLAN_OFFERS, avisoDeCobranca, seloDeCobranca, type PlanOffer } from '@/lib/planOffer'
import { PhonePreview } from '@/components/editor/PhonePreview'
import { AssistantDemo } from '@/components/profile/AssistantDemo'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { useMyProfileLink } from '@/lib/useMyProfileLink'
import { LEGAL_DOCS } from '@/lib/legalContent'
import {
  ArrowRight,
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  ChevronDown,
  InfoIcon,
  LockIcon,
  MessageIcon,
  ScaleIcon,
  SparkIcon,
  WhatsappIcon,
} from '@/components/ui/icons'

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

// Anima uma seção ao entrar na viewport (sóbrio, sem exageros).
const rise = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function Landing() {
  // Convidar a "criar meu perfil" quem já tem um (e está logado, com o nome ali
  // do lado no menu de conta) faz o produto parecer que não sabe quem você é.
  const meu = useMyProfileLink()

  useEffect(() => {
    document.title = 'advoc.me — presença digital profissional para advogados'
  }, [])

  return (
    <div className="grain min-h-dvh overflow-x-hidden">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2 font-display text-xl font-semibold">
          <ScaleIcon width={22} height={22} className="text-burgundy" />
          advoc.me
        </span>
        <div className="flex items-center gap-2 sm:gap-4">
          <a href="#assistente" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:block">
            Assistente
          </a>
          <a href="#como-funciona" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:block">
            Como funciona
          </a>
          {/* Quem chega decidido a comparar preço não devia ter de adivinhar que
              precisa rolar até o fim. O link aparece a partir de 480px porque
              abaixo disso ele brigava por espaço com o CTA principal. */}
          <a href="#planos" className="hidden text-sm font-medium text-ink-soft hover:text-ink min-[480px]:block">
            Planos
          </a>
          <AccountMenu />
          <Link
            to={meu.to}
            {...(meu.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
            className="btn-primary !py-2.5 !px-5 text-[14px]"
          >
            {meu.label}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
        <div>
          <motion.span
            custom={0}
            variants={fade}
            initial="hidden"
            animate="show"
            className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-[12.5px] font-semibold text-brass-deep"
          >
            <CheckIcon width={14} height={14} />
            Dentro das regras da OAB
          </motion.span>

          <motion.h1
            custom={1}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-5 font-display text-[34px] font-semibold leading-[1.04] tracking-tight min-[380px]:text-[42px] sm:text-[56px]"
          >
            Presença digital
            <br />
            profissional,
            <br />
            <span className="italic text-burgundy">dentro das regras.</span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft"
          >
            Tenha um perfil profissional sem decorar as regras da OAB. A gente confere seu conteúdo
            antes de publicar — e mostra o que ajustar.
          </motion.p>

          <motion.div
            custom={3}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-7 flex flex-wrap items-center gap-3"
          >
            <Link
              to={meu.to}
              {...(meu.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
              className="btn-primary"
            >
              {/* "grátis" só faz sentido para quem ainda não tem conta. */}
              {meu.to === '/comecar' && meu.label === 'Criar meu perfil'
                ? 'Criar meu perfil grátis'
                : meu.label}
              <ArrowRight width={18} height={18} />
            </Link>
            <Link to={`/${sampleProfile.slug}`} className="btn-ghost">
              Ver um exemplo
            </Link>
          </motion.div>

          <motion.p
            custom={4}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-4 text-[13.5px] text-ink-faint"
          >
            <span className="font-semibold text-ink">Pronto em minutos</span> · grátis · sem cartão ·
            não é aconselhamento jurídico
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="lg:justify-self-end"
        >
          <PhonePreview profile={sampleProfile} hero />
        </motion.div>
      </header>

      {/* Problema */}
      <Section id="problema" eyebrow="O problema" title="Divulgar-se como advogado tem regra — e risco.">
        <p className="mx-auto mb-10 max-w-2xl text-center text-[15.5px] leading-relaxed text-ink-soft">
          A publicidade na advocacia tem regras próprias. Um descuido de linguagem pode virar uma
          questão disciplinar — e as ferramentas genéricas de “link na bio” não foram pensadas para isso.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              title: 'Regras extensas',
              body: 'Promessa de resultado, preços, superlativos, captação, sigilo… são muitas vedações para memorizar a cada texto.',
            },
            {
              title: 'Risco disciplinar',
              body: 'Um anúncio fora das normas pode levar a advertência, censura ou suspensão. A responsabilidade é do advogado.',
            },
            {
              title: 'Ferramentas genéricas',
              body: 'Linktrees e criadores de site tratam advocacia como qualquer negócio — incentivam justamente o que a OAB veda.',
            },
          ].map((c) => (
            <Panel key={c.title}>
              <h3 className="font-display text-lg font-semibold text-ink">{c.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{c.body}</p>
            </Panel>
          ))}
        </div>
      </Section>

      {/* Solução */}
      <Section
        eyebrow="A solução"
        title="A conformidade vira uma funcionalidade do produto."
      >
        <p className="mx-auto mb-10 max-w-2xl text-center text-[15.5px] leading-relaxed text-ink-soft">
          Em vez de você aprender todas as regras, o advoc.me as embute. Você escreve; a plataforma
          confere e explica. Sóbrio por padrão, seguro por construção.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: <ScaleIcon width={22} height={22} />,
              title: 'Conformidade embutida',
              body: 'Um revisor mostra, enquanto você digita, quando um texto fere as normas — promessa de resultado, mercantilismo, sigilo — e sugere como ajustar.',
            },
            {
              icon: <CheckIcon width={22} height={22} />,
              title: 'Inscrição conferível na fonte',
              body: 'Ao lado do seu número, o perfil leva à consulta pública do CNA, base oficial da OAB. Quem quiser confere na fonte — sem selo nosso, sem plano, sem intermediário.',
            },
            {
              icon: <SparkIcon width={22} height={22} />,
              title: 'Bio escrita por IA',
              body: 'Descreva sua atuação em palavras-chave; a IA redige um texto sóbrio, que passa pela mesma checagem e depende sempre da sua aprovação.',
            },
          ].map((f) => (
            <Panel key={f.title}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
                {f.icon}
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{f.body}</p>
            </Panel>
          ))}
        </div>
      </Section>

      {/* Assistente virtual — demonstração funcional */}
      <motion.section
        id="assistente"
        variants={rise}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16"
      >
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
              Assistente virtual
            </p>
            <h2 className="mt-2 max-w-lg font-display text-3xl font-semibold leading-tight sm:text-4xl">
              Um assistente marca a conversa
              <span className="italic text-burgundy"> enquanto você atua.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-ink-soft">
              Quem chega ao seu perfil conversa com o seu assistente virtual: ele oferece{' '}
              <span className="font-medium text-ink">apenas os dias e horários que você marcou</span>,
              pergunta o assunto e entrega o pedido pronto no seu WhatsApp. Você só confirma.
            </p>

            <ul className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: <CalendarIcon width={18} height={18} />,
                  title: 'Sua grade, suas regras',
                  body: 'Você escolhe os dias da semana, os horários e a antecedência mínima. Fora disso, nada é oferecido.',
                },
                {
                  icon: <MessageIcon width={18} height={18} />,
                  title: 'Conversa, não formulário',
                  body: 'Perguntas curtas, respostas em um toque. O visitante só escreve o assunto e o nome.',
                },
                {
                  icon: <WhatsappIcon width={18} height={18} />,
                  title: 'Cai no seu WhatsApp',
                  body: 'Dia, horário, formato e assunto chegam organizados em uma única mensagem.',
                },
                {
                  icon: <ScaleIcon width={18} height={18} />,
                  title: 'Sem passar do limite',
                  body: 'O assistente se identifica como automático e não dá orientação jurídica — só organiza o horário.',
                },
              ].map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
                    {f.icon}
                  </span>
                  <div>
                    <h3 className="font-display text-[16px] font-semibold text-ink">{f.title}</h3>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-soft">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="justify-self-center lg:justify-self-end">
            <AssistantDemo profile={sampleProfile} />
          </div>
        </div>
      </motion.section>

      {/* Como funciona */}
      <Section id="como-funciona" eyebrow="Como funciona" title="Do zero ao perfil publicado, em quatro passos.">
        <ol className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
          {[
            {
              n: 1,
              title: 'Monte o essencial',
              body: 'Nome, OAB, cidade, área principal. O necessário para um perfil útil — em poucos minutos.',
            },
            {
              n: 2,
              title: 'Escreva com apoio da IA',
              body: 'Gere uma bio sóbria a partir de palavras-chave, ou escreva você mesmo. Você sempre revisa e aprova.',
            },
            {
              n: 3,
              title: 'O revisor confere',
              body: 'A checagem de conformidade aponta o que precisa de ajuste e explica o porquê, com a base normativa.',
            },
            {
              n: 4,
              title: 'Publique e compartilhe',
              body: 'Um endereço só seu e um QR Code para reunir seus canais com sobriedade.',
            },
          ].map((s) => (
            <li key={s.n} className="flex gap-4 rounded-xl2 border border-ink/10 bg-paper-soft/60 p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy font-display text-[15px] font-semibold text-paper-soft">
                {s.n}
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Conformidade OAB */}
      <Section eyebrow="Conformidade OAB" title="O que o revisor observa por você.">
        <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl2 border border-ink/10 bg-paper-soft/60 p-6">
            <p className="mb-4 text-[14.5px] leading-relaxed text-ink-soft">
              Codificamos as regras da OAB. Antes de publicar, a própria plataforma confere de novo —
              é a fonte da verdade, não só um aviso visual.
            </p>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {[
                'Promessa de resultado',
                'Preços, honorários e descontos',
                'Superlativos e comparações',
                'Chamadas de contratação',
                'Depoimentos e lista de clientes',
                'Exposição de casos (sigilo)',
                'Selos ou símbolos oficiais da OAB',
                'Apelos de urgência e brindes',
              ].map((v) => (
                <li key={v} className="flex items-start gap-2 text-[13.5px] text-ink-soft">
                  <CheckIcon
                    width={16}
                    height={16}
                    strokeWidth={2.2}
                    className="mt-0.5 shrink-0 text-brass-deep"
                  />
                  {v}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-center gap-4">
            <div className="flex items-start gap-3">
              <LockIcon width={20} height={20} className="mt-0.5 shrink-0 text-burgundy" />
              <p className="text-[14px] leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">Trilha de auditoria.</span> Cada versão
                registra a data e a política vigente — exportável em PDF como comprovante de
                conformidade.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <InfoIcon width={20} height={20} className="mt-0.5 shrink-0 text-burgundy" />
              <p className="text-[14px] leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">A palavra final é sua.</span> A IA e o
                revisor auxiliam; a decisão de publicar e a responsabilidade pelo conteúdo continuam
                do advogado.
              </p>
            </div>
            <p className="text-[12px] leading-relaxed text-ink-faint">
              O advoc.me não constitui aconselhamento jurídico e não é filiado à OAB. Não conferimos,
              não validamos e não endossamos inscrições — apontamos para a consulta pública do CNA.
            </p>
          </div>
        </div>
      </Section>

      {/* Planos */}
      <section id="planos" className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-center font-display text-3xl font-semibold sm:text-4xl">
          Planos que crescem com você
        </h2>
        {/* O aviso de cobrança vem ANTES dos preços, não depois.
            Abaixo dos cartões ele seria uma letra miúda que a pessoa lê quando já
            decidiu não assinar; acima, ele é o motivo de continuar lendo. E é a
            mesma frase que o checkout já mostrava — a home é que estava calada. */}
        {avisoDeCobranca() && (
          <p className="mx-auto mt-4 max-w-xl text-center text-[14px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-brass-deep">Em testes:</span>{' '}
            {avisoDeCobranca()!.replace('Plataforma em teste: os', 'Os')}
          </p>
        )}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_OFFERS.map((oferta) => (
            <PlanCard key={oferta.id} oferta={oferta} />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <Section eyebrow="Dúvidas frequentes" title="Perguntas frequentes">
        <div className="mx-auto max-w-2xl divide-y divide-ink/10 rounded-xl2 border border-ink/10 bg-paper-soft/60">
          {FAQ.map((item) => (
            <FaqItem key={item.q} {...item} />
          ))}
        </div>
      </Section>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <div className="rule-brass mx-auto mb-8 max-w-xs" />
        <h2 className="font-display text-3xl font-semibold sm:text-5xl">
          Uma presença digital
          <br />
          <span className="italic text-burgundy">que respeita a profissão.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15.5px] leading-relaxed text-ink-soft">
          Comece grátis. Um perfil sóbrio, claro e conferido antes de ir ao ar.
        </p>
        <Link
          to={meu.to}
          {...(meu.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          className="btn-primary mt-8"
        >
          {meu.label === 'Criar meu perfil' ? 'Criar meu perfil agora' : meu.label}
          <ArrowRight width={18} height={18} />
        </Link>
      </section>

      <footer className="border-t border-ink/10 py-10 text-center text-[13px] text-ink-faint">
        <nav className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-5">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.slug} to={`/legal/${d.slug}`} className="hover:text-ink">
              {d.navLabel}
            </Link>
          ))}
        </nav>
        <p>advoc.me · perfis em conformidade com o Provimento 205/2021 do CFOAB</p>
        <p className="mt-1">Não constitui aconselhamento jurídico. Não filiado à OAB.</p>
      </footer>
    </div>
  )
}

// Seção padrão da landing — eyebrow (rótulo), título e conteúdo, com animação sóbria.
function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      id={id}
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16"
    >
      <p className="text-center text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
        {eyebrow}
      </p>
      <h2 className="mx-auto mt-2 max-w-2xl text-center font-display text-3xl font-semibold leading-tight sm:text-4xl">
        {title}
      </h2>
      <div className="mt-10">{children}</div>
    </motion.section>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl2 border border-ink/10 bg-paper-soft/60 p-6">{children}</div>
}

// Item de FAQ acessível (nativo <details>), sem estado — expande/recolhe.
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group px-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-[15px] font-semibold text-ink marker:hidden">
        {q}
        <ChevronDown
          width={18}
          height={18}
          className="shrink-0 text-ink-faint transition-transform group-open:rotate-180"
        />
      </summary>
      <p className="pb-4 text-[14px] leading-relaxed text-ink-soft">{a}</p>
    </details>
  )
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'O advoc.me é filiado à OAB?',
    a: 'Não. Somos uma plataforma independente e não exibimos selo, chancela ou endosso da OAB — as regras vedam isso. Quem quiser conferir uma inscrição usa o link para o CNA que fica no próprio perfil.',
  },
  {
    q: 'A checagem de conformidade substitui um advogado ou a OAB?',
    a: 'Não. É um guarda-corpo que reduz violações óbvias e explica o porquê, mas não é aconselhamento jurídico. A decisão de publicar e a responsabilidade pelo conteúdo são sempre suas.',
  },
  {
    q: 'A bio gerada por IA já sai dentro das regras?',
    a: 'A IA é orientada pelas normas e o texto passa pela mesma checagem de conformidade. Ainda assim, nada é publicado sem a sua revisão e aprovação.',
  },
  {
    q: 'Vocês verificam se a pessoa é mesmo advogada?',
    a: 'Não fazemos essa verificação — e não fingimos que fazemos. Todo perfil traz, ao lado do número, um link para o Cadastro Nacional dos Advogados (CNA), a base pública da OAB, onde qualquer pessoa confere em segundos. Perfis com registro falso podem ser denunciados pelo próprio perfil e são retirados do ar.',
  },
  {
    q: 'O assistente virtual dá orientação jurídica aos visitantes?',
    a: 'Não. Ele é um roteiro fechado: oferece os dias e horários que você marcou, pergunta o assunto e monta a mensagem para o seu WhatsApp. Ele se identifica como automático, não avalia casos, não fala de honorários e não confirma nada — a confirmação é sempre sua.',
  },
  {
    q: 'Posso usar de graça?',
    a: 'Sim. O plano Free publica um perfil completo e em conformidade, sem cartão e para sempre. Os planos pagos acrescentam agendamento pelo perfil, perguntas frequentes, identidade visual própria e a contagem de visitas — e você troca de plano ou volta ao Free quando quiser.',
  },
  {
    q: 'O que acontece se eu escrever algo fora das normas?',
    a: 'O editor sinaliza o trecho, explica a vedação e sugere um ajuste. Termos que bloqueiam a publicação impedem o envio até serem corrigidos — a mesma checagem roda de novo antes de publicar.',
  },
]

/**
 * Cartão de um plano na home. Todo o conteúdo vem de `lib/planOffer.ts` — este
 * componente não sabe o nome de recurso nenhum, e é de propósito: enquanto a
 * lista de benefícios morava aqui dentro, ela divergiu do que o produto fazia.
 */
function PlanCard({ oferta }: { oferta: PlanOffer }) {
  const { name, price, period, pitch, items, falta, featured, ctaTo, ctaLabel } = oferta
  const selo = seloDeCobranca()
  const pago = oferta.id === 'pro' || oferta.id === 'premium'

  return (
    <div
      className={`relative flex h-full flex-col rounded-xl2 border p-6 ${
        featured
          ? 'border-burgundy bg-burgundy text-paper-soft shadow-lift'
          : 'border-ink/10 bg-paper-soft'
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-brass px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink">
          Mais popular
        </span>
      )}
      <h3 className="font-display text-2xl font-semibold">{name}</h3>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-4xl font-semibold">{price}</span>
        <span className={`text-[14px] ${featured ? 'text-paper/70' : 'text-ink-faint'}`}>
          {period}
        </span>
      </p>
      {/* O preço de tabela fica, e ao lado dele a verdade de hoje. Riscar o valor
          seria teatro de desconto; dizer o que se paga agora é informação. */}
      {pago && selo && (
        <p
          className={`mt-1.5 text-[12px] font-semibold ${
            featured ? 'text-brass-light' : 'text-brass-deep'
          }`}
        >
          R$ 0 hoje — {selo}
        </p>
      )}
      <p
        className={`mt-2 text-[13.5px] font-medium leading-snug ${
          featured ? 'text-paper-soft/95' : 'text-burgundy'
        }`}
      >
        {pitch}
      </p>

      <ul className="mt-6 space-y-2.5 text-[14px] leading-snug">
        {items.map((item) => (
          <li key={item.text} className="flex items-start gap-2.5">
            {item.emPreparo ? (
              // Sem ✓: um recurso que ainda não existe não pode usar a mesma
              // marca dos que existem. O relógio e o rótulo dizem o que é.
              <ClockIcon
                width={16}
                height={16}
                className={`mt-0.5 shrink-0 ${featured ? 'text-paper/50' : 'text-ink-faint'}`}
              />
            ) : (
              <CheckIcon
                width={16}
                height={16}
                strokeWidth={2.4}
                className={`mt-0.5 shrink-0 ${featured ? 'text-brass-light' : 'text-brass-deep'}`}
              />
            )}
            <span
              className={
                item.emPreparo
                  ? featured
                    ? 'text-paper/60'
                    : 'text-ink-faint'
                  : featured
                    ? 'text-paper-soft/95'
                    : 'text-ink-soft'
              }
            >
              {item.text}
              {item.emPreparo && (
                <span
                  className={`ml-1.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                    featured ? 'bg-paper/15 text-paper/70' : 'bg-ink/[0.06] text-ink-faint'
                  }`}
                >
                  em preparo
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* O que o plano NÃO tem. Quem escolhe o Free precisa descobrir aqui que
          não há agendamento — e não meia hora depois, procurando no editor. */}
      {falta && falta.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-[13px] leading-snug">
          {falta.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-ink-faint">
              <span
                aria-hidden
                className="mt-[7px] h-px w-3 shrink-0 bg-ink/25"
              />
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* mt-auto empurra o CTA para a base → botões alinhados entre os cards */}
      <div className="mt-auto pt-7">
        <Link
          to={ctaTo}
          className={`block w-full rounded-full py-3 text-center font-semibold transition-colors ${
            featured
              ? 'bg-paper-soft text-burgundy hover:bg-paper'
              : 'border border-ink/15 hover:border-burgundy/40 hover:text-burgundy'
          }`}
        >
          {ctaLabel}
        </Link>
        {oferta.secondaryTo && oferta.secondaryLabel && (
          <Link
            to={oferta.secondaryTo}
            className={`mt-2.5 block text-center text-[13px] font-medium transition-colors ${
              featured ? 'text-paper/80 hover:text-paper' : 'text-ink-faint hover:text-burgundy'
            }`}
          >
            {oferta.secondaryLabel}
          </Link>
        )}
        {/* Tirar o medo de errar a escolha é o que destrava a decisão: trocar de
            plano não custa nada e não apaga o que já foi escrito. */}
        {pago && (
          <p
            className={`mt-3 text-center text-[11.5px] leading-relaxed ${
              featured ? 'text-paper/70' : 'text-ink-faint'
            }`}
          >
            Troca ou volta ao Free quando quiser — seus textos continuam salvos.
          </p>
        )}
      </div>
    </div>
  )
}
