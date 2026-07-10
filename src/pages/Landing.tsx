import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { sampleProfile } from '@/lib/mockData'
import { FIRM_PRICING } from '@/lib/plans'
import { PhonePreview } from '@/components/editor/PhonePreview'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { ArrowRight, CheckIcon, ScaleIcon, SparkIcon } from '@/components/ui/icons'

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export default function Landing() {
  useEffect(() => {
    document.title = 'advoc.me — o link na bio, para advogados'
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
          <Link to="/buscar" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:block">
            Buscar advogados
          </Link>
          <AccountMenu />
          <Link to="/editor" className="btn-primary !py-2.5 !px-5 text-[14px]">
            Criar meu perfil
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
            Dentro das normas da OAB (Prov. 205/2021)
          </motion.span>

          <motion.h1
            custom={1}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-5 font-display text-[36px] font-semibold leading-[1.02] tracking-tight min-[380px]:text-[44px] sm:text-6xl"
          >
            Seu escritório,
            <br />
            <span className="italic text-burgundy">em um só link.</span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft"
          >
            A página de perfil compartilhável feita para advogados. Áreas de atuação, contato,
            agendamento e prova social — reunidos com a sobriedade que a advocacia exige.
          </motion.p>

          <motion.div
            custom={3}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-7 flex flex-wrap items-center gap-3"
          >
            <Link to="/editor" className="btn-primary">
              Montar meu perfil grátis
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
            <span className="font-semibold text-ink">Crie seu escritório em 5 minutos</span> · grátis ·
            sem cartão
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="lg:justify-self-end"
        >
          <PhonePreview profile={sampleProfile} />
        </motion.div>
      </header>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rule-brass mx-auto mb-12 max-w-xs" />
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: <SparkIcon width={22} height={22} />,
              title: 'Bio escrita por IA',
              body: 'Digite palavras-chave da sua atuação. A IA redige um texto sóbrio, e você aprova antes de publicar.',
            },
            {
              icon: <CheckIcon width={22} height={22} />,
              title: 'OAB conferida',
              body: 'A plataforma confere seu número de OAB e o exibe como marca informativa — sem selos, logotipos ou símbolos oficiais da OAB.',
            },
            {
              icon: <ScaleIcon width={22} height={22} />,
              title: 'Conformidade embutida',
              body: 'O editor avisa quando um texto fere as regras de publicidade — promessa de resultado, mercantilismo, sigilo.',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl2 border border-ink/10 bg-paper-soft/60 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
                {f.icon}
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-center font-display text-3xl font-semibold sm:text-4xl">
          Planos que crescem com você
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <PlanCard
            name="Free"
            price="R$ 0"
            period="para sempre"
            features={[
              '1 perfil público',
              'Até 2 áreas de atuação',
              'Bio até 300 caracteres',
              'WhatsApp e redes sociais',
              'Marca d’água advoc.me',
            ]}
          />
          <PlanCard
            name="Pro"
            price="R$ 19"
            period="/mês"
            featured
            ctaTo="/editor?plan=pro"
            ctaLabel="Assinar Pro"
            features={[
              'Até 6 áreas com descrição',
              'Endereço personalizável (advoc.me/seu-nome)',
              'Bio até 600 · textos ampliados',
              'Sem marca d’água',
              'Agendamento e QR Code',
              'Analytics de visitas e cliques',
              'Temas visuais adicionais',
            ]}
          />
          <PlanCard
            name="Premium"
            price="R$ 39"
            period="/mês"
            ctaTo="/editor?plan=premium"
            ctaLabel="Assinar Premium"
            features={[
              'Tudo do Pro',
              'Domínio próprio (.adv.br)',
              'Bio até 1000 caracteres',
              'Galeria e vídeo de apresentação',
              'Blog jurídico',
              'Exportar perfil em PDF (conformidade)',
            ]}
          />
          <PlanCard
            name="Escritório"
            price={`R$ ${FIRM_PRICING.basePrice}`}
            period="/mês"
            ctaTo="/escritorio/editar"
            ctaLabel="Criar escritório"
            secondaryTo="/escritorio/andrade-vieira"
            secondaryLabel="Ver exemplo"
            features={[
              'Página institucional da sociedade',
              `Até ${FIRM_PRICING.includedSeats} advogados inclusos`,
              `+ R$ ${FIRM_PRICING.extraSeatPrice}/mês por advogado extra`,
              'Perfil Pro para cada advogado',
              'Triagem de WhatsApp por área',
              'Marca própria (white-label)',
            ]}
          />
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="font-display text-3xl font-semibold sm:text-5xl">
          O único “link na bio”
          <br />
          <span className="italic text-burgundy">pensado para a advocacia.</span>
        </h2>
        <Link to="/editor" className="btn-primary mt-8">
          Criar meu perfil agora
          <ArrowRight width={18} height={18} />
        </Link>
      </section>

      <footer className="border-t border-ink/10 py-8 text-center text-[13px] text-ink-faint">
        <p>advoc.me · perfis em conformidade com o Provimento 205/2021 do CFOAB</p>
        <p className="mt-1">Não constitui aconselhamento jurídico.</p>
      </footer>
    </div>
  )
}

function PlanCard({
  name,
  price,
  period,
  features,
  featured = false,
  ctaTo = '/editor',
  ctaLabel = 'Começar',
  secondaryTo,
  secondaryLabel,
}: {
  name: string
  price: string
  period: string
  features: string[]
  featured?: boolean
  ctaTo?: string
  ctaLabel?: string
  secondaryTo?: string
  secondaryLabel?: string
}) {
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
      <ul className="mt-6 space-y-2.5 text-[14px] leading-snug">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon
              width={16}
              height={16}
              strokeWidth={2.4}
              className={`mt-0.5 shrink-0 ${featured ? 'text-brass-light' : 'text-brass-deep'}`}
            />
            <span className={featured ? 'text-paper-soft/95' : 'text-ink-soft'}>{f}</span>
          </li>
        ))}
      </ul>
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
        {secondaryTo && secondaryLabel && (
          <Link
            to={secondaryTo}
            className={`mt-2.5 block text-center text-[13px] font-medium transition-colors ${
              featured ? 'text-paper/80 hover:text-paper' : 'text-ink-faint hover:text-burgundy'
            }`}
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  )
}
