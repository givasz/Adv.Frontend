import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Plan, Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { Avatar } from '@/components/ui/Avatar'
import {
  ArrowRight,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  InstagramIcon,
  LockIcon,
  MailIcon,
  PinIcon,
  ScaleIcon,
  SearchIcon,
  SparkIcon,
} from '@/components/ui/icons'

// Um item de evolução do perfil — apresentado como BENEFÍCIO, nunca como config.
interface Evolution {
  key: string
  title: string // benefício ("Receba pedidos de atendimento")
  desc: string // uma linha curta
  icon: (p: { width?: number; height?: number; className?: string }) => JSX.Element
  to: string // destino ao clicar
  plan?: Plan // plano mínimo — trava o card se o atual for menor
  done: (p: Profile) => boolean
}

const rank: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

const EVOLUTIONS: Evolution[] = [
  {
    key: 'foto',
    title: 'Mostre seu rosto',
    desc: 'Um perfil com foto passa mais confiança.',
    icon: ScaleIcon,
    to: '/editor?section=identidade',
    done: (p) => !!p.avatarUrl,
  },
  {
    key: 'frase',
    title: 'Resuma sua atuação numa linha',
    desc: 'A frase aparece logo abaixo do seu nome.',
    icon: SparkIcon,
    to: '/editor?section=identidade',
    done: (p) => !!p.headline.trim(),
  },
  {
    key: 'redes',
    title: 'Reúna seus canais',
    desc: 'Instagram, LinkedIn e site num lugar só.',
    icon: InstagramIcon,
    to: '/editor?section=redes',
    done: (p) => p.socials.length > 0,
  },
  {
    key: 'email',
    title: 'Ofereça mais um contato',
    desc: 'Além do WhatsApp, deixe seu e-mail.',
    icon: MailIcon,
    to: '/editor?section=redes',
    done: (p) => !!p.contact.email,
  },
  {
    key: 'destaques',
    title: 'Mostre sua experiência',
    desc: 'Anos de atuação, formações, atuações — sem citar clientes.',
    icon: CheckIcon,
    to: '/editor?section=destaques',
    done: (p) => p.highlights.length > 0,
  },
  {
    key: 'regiao',
    title: 'Diga onde você atende',
    desc: 'Presencial, online e a sua região.',
    icon: PinIcon,
    to: '/editor?section=identidade',
    done: (p) => !!p.regionNote?.trim(),
  },
  {
    key: 'tema',
    title: 'Deixe o perfil com a sua cara',
    desc: 'Escolha um visual que combine com você.',
    icon: SparkIcon,
    to: '/editor?section=aparencia',
    plan: 'pro',
    done: (p) => p.theme !== 'papel',
  },
  {
    key: 'oab',
    title: 'Confirme seu número da OAB',
    desc: 'A gente confere e mostra que seu registro é real.',
    icon: CheckIcon,
    to: '/editor?section=oab',
    plan: 'pro',
    done: (p) => (p.oabStatus ?? (p.oabVerified ? 'verified' : 'none')) === 'verified',
  },
  {
    key: 'agenda',
    title: 'Receba pedidos de atendimento',
    desc: 'Deixe que os clientes marquem um horário com você.',
    icon: CalendarIcon,
    to: '/editor?section=agenda',
    plan: 'pro',
    done: (p) => (p.schedulingMode ?? 'off') !== 'off',
  },
  {
    key: 'compartilhar',
    title: 'Compartilhe seu cartão digital',
    desc: 'QR Code e link para colocar onde quiser.',
    icon: CopyIcon,
    to: '', // preenchido com o slug em runtime
    done: () => false,
  },
  {
    key: 'dominio',
    title: 'Use seu próprio endereço',
    desc: 'Um domínio só seu, sem a marca advoc.me.',
    icon: GlobeIcon,
    to: '/editor?section=marca',
    plan: 'premium',
    done: (p) => !!p.branding?.customDomain,
  },
  {
    key: 'escritorio',
    title: 'Crie a página do seu escritório',
    desc: 'Reúna a sociedade e a equipe num só lugar.',
    icon: ScaleIcon,
    to: '/escritorio/editar',
    done: () => false,
  },
]

export default function Painel() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Seu painel · advoc.me'
    api.getDraft().then((p) => {
      // Sem perfil publicado ainda → volta para o assistente de criação.
      if (!p.published) {
        navigate('/comecar', { replace: true })
        return
      }
      setProfile(p)
    })
  }, [navigate])

  const pct = useMemo(() => (profile ? completeness(profile) : 0), [profile])

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  const firstName = profile.name.split(' ')[0] || 'você'

  return (
    <div className="min-h-dvh bg-paper-deep">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            advoc.me
          </Link>
          <div className="flex items-center gap-3">
            <Link to={`/${profile.slug}`} target="_blank" className="btn-primary !py-2 !px-4 text-[13px]">
              Ver meu perfil
            </Link>
            <AccountMenu compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        {/* Saudação + progresso */}
        <div className="flex items-center gap-4">
          <Avatar name={profile.name} src={profile.avatarUrl} size={56} />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-ink">Olá, {firstName}.</h1>
            <p className="text-[14px] text-ink-soft">Seu perfil está no ar. Melhore quando quiser.</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[17px] font-semibold text-ink">
              Seu perfil está {pct}% completo
            </span>
            {pct < 100 && (
              <span className="text-[12.5px] text-ink-faint">cada item deixa ele mais forte</span>
            )}
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink/10">
            <motion.div
              className="h-full rounded-full bg-brass-deep"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Cards de evolução */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {EVOLUTIONS.map((ev) => (
            <EvolutionCard key={ev.key} ev={ev} profile={profile} />
          ))}
        </div>

        {/* Rodapé leve */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-ink-faint">
          <Link to="/buscar" className="inline-flex items-center gap-1.5 hover:text-ink">
            <SearchIcon width={14} height={14} /> Ver o diretório
          </Link>
          <Link to="/legal" className="hover:text-ink">
            Documentos e privacidade
          </Link>
        </div>
      </main>
    </div>
  )
}

function EvolutionCard({ ev, profile }: { ev: Evolution; profile: Profile }) {
  const done = ev.done(profile)
  const locked = !!ev.plan && rank[profile.plan] < rank[ev.plan]
  const Icon = ev.icon
  // "Compartilhar" e cards de perfil público apontam para o slug.
  const to = ev.key === 'compartilhar' ? `/${profile.slug}` : ev.to
  const isExternal = ev.key === 'compartilhar'

  const inner = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl2 ${
          done ? 'bg-brass/20 text-brass-deep' : 'bg-burgundy/10 text-burgundy'
        }`}
      >
        {done ? <CheckIcon width={18} height={18} strokeWidth={2.4} /> : <Icon width={18} height={18} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-[15px] font-semibold leading-tight text-ink">
            {ev.title}
          </span>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              <LockIcon width={10} height={10} />
              {ev.plan === 'premium' ? 'Premium' : 'Pro'}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-soft">
          {done ? 'Feito ✓ — toque para ajustar' : ev.desc}
        </span>
      </span>
      {!done && <ArrowRight width={16} height={16} className="shrink-0 self-center text-ink-faint" />}
    </>
  )

  const cls = `flex items-start gap-3 rounded-xl2 border p-4 text-left transition-colors ${
    done
      ? 'border-ink/10 bg-paper/60 hover:border-brass/40'
      : 'border-ink/10 bg-paper shadow-card hover:border-burgundy/40'
  }`

  const target = locked ? '/editor?section=plano' : to
  if (isExternal && !locked) {
    return (
      <Link to={target} target="_blank" className={cls}>
        {inner}
      </Link>
    )
  }
  return (
    <Link to={target} className={cls}>
      {inner}
    </Link>
  )
}

// Percentual de completude do perfil — mistura essenciais (já feitos ao publicar)
// e itens do "perfil completo". Honesto e motivador, sem "nota" fria.
function completeness(p: Profile): number {
  const signals: boolean[] = [
    !!p.name.trim(),
    !!p.oabNumber.trim(),
    !!(p.city && p.state),
    p.areas.some((a) => a.label.trim()),
    !!p.bio.trim(),
    !!p.contact.whatsapp,
    // Perfil completo
    !!p.avatarUrl,
    !!p.headline.trim(),
    p.socials.length > 0,
    !!p.contact.email,
    p.areas.filter((a) => a.label.trim()).length >= 2,
    p.highlights.length > 0,
    p.theme !== 'papel',
    (p.schedulingMode ?? 'off') !== 'off',
    (p.oabStatus ?? (p.oabVerified ? 'verified' : 'none')) === 'verified',
    !!p.regionNote?.trim(),
  ]
  const done = signals.filter(Boolean).length
  return Math.round((done / signals.length) * 100)
}
