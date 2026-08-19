import { useState } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { getTheme, themeStyle, type ThemeStyle } from '@/lib/themes'
import { resolveSchedulingMode } from '@/lib/booking'
import { Avatar } from '@/components/ui/Avatar'
import { SchedulingForm } from '@/components/profile/SchedulingForm'
import { AssistantChat } from '@/components/profile/AssistantChat'
import { assistantTitle } from '@/lib/assistant'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import {
  ArrowRight,
  CalendarIcon,
  SparkIcon,
  ChevronDown,
  MailIcon,
  PinIcon,
  ScaleIcon,
  WhatsappIcon,
  socialMeta,
} from '@/components/ui/icons'

interface ProfileViewProps {
  profile: Profile
  /** true dentro do editor: desativa navegação real e o efeito de entrada */
  preview?: boolean
  /**
   * Deixa o assistente virtual abrir mesmo em `preview` — usado no telefone da home,
   * que é uma demonstração viva. Fora isso, segue o `preview`.
   */
  chatEnabled?: boolean
}

// Converte "#rrggbb" em "rgba(r,g,b,a)" para a variável de destaque suave.
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return `rgba(150,116,63,${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function ProfileView({ profile, preview = false, chatEnabled }: ProfileViewProps) {
  const [schedOpen, setSchedOpen] = useState(false)
  const schedulingMode = resolveSchedulingMode(profile)
  // Agendar é a única ação que continua viva na prévia da home (chatEnabled).
  const canSchedule = chatEnabled ?? !preview
  // Perfil vivo (RFC-002): só existe o que tem conteúdo. Áreas sem nome não viram
  // card — nada de caixa vazia.
  const areas = profile.areas.filter((a) => a.label.trim())
  const highlights = profile.highlights.filter((h) => h.title.trim())
  const articles = (profile.articles ?? []).filter((a) => a.title.trim())
  const s = getTheme(profile.theme).style
  const brand = profile.branding
  // White-label: cor de destaque personalizada sobrescreve a do tema via CSS vars.
  const brandVars = brand?.accent
    ? ({ '--c-accent': brand.accent, '--c-accent-soft': hexToRgba(brand.accent, 0.14) } as React.CSSProperties)
    : undefined
  const tile = s.tile === 'card' ? 't-tile' : `t-tile tv-${s.tile}`
  const foil = s.finish === 'foil'
  const left = s.header === 'editorial'
  const nameCls = [
    'leading-tight',
    s.nameCase === 'upper'
      ? 'uppercase tracking-[0.1em] text-[21px] sm:text-[25px] font-medium'
      : 'tracking-tight text-[26px] sm:text-[30px] font-semibold',
    foil ? 'foil' : '',
  ].join(' ')

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: preview ? 0 : 0.07, delayChildren: preview ? 0 : 0.05 },
    },
  }
  const item: Variants = preview
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }

  const whatsappHref = profile.contact.whatsapp
    ? `https://wa.me/${profile.contact.whatsapp}?text=${encodeURIComponent(
        `Olá, ${profile.name.split(' ')[0]}! Vim pelo seu perfil no advoc.me e gostaria de tirar uma dúvida.`,
      )}`
    : undefined

  const stop = preview ? (e: React.MouseEvent) => e.preventDefault() : undefined

  const identity = (
    <>
      <span className="t-accent text-sm font-medium">{profile.oabNumber}</span>
      {profile.oabVerified && <VerifiedBadge compact linkCna interactive={!preview} />}
    </>
  )

  return (
    <div
      className={`themed w-full flex-1 surf-${s.surface}`}
      style={{ ...themeStyle(profile.theme), ...brandVars }}
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-10 sm:pt-14"
      >
        {/* Cabeçalho — layout varia por tema */}
        {left ? (
          <motion.header variants={item} className="flex items-center gap-4 text-left">
            <Avatar src={profile.avatarUrl} name={profile.name} size={78} frame={s.avatar} />
            <div className="min-w-0">
              <h1 className={nameCls}>{profile.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">{identity}</div>
              {profile.headline && <p className="t-muted mt-1 text-[14px]">{profile.headline}</p>}
            </div>
          </motion.header>
        ) : (
          <motion.header variants={item} className="flex flex-col items-center text-center">
            {s.header === 'letterhead' && <div className="t-rule mb-5 w-24" />}
            <Avatar src={profile.avatarUrl} name={profile.name} size={104} frame={s.avatar} />
            <h1 className={`mt-4 ${nameCls}`}>{profile.name}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {identity}
            </div>
            {profile.headline && <p className="t-muted mt-2 text-[15px]">{profile.headline}</p>}
            {s.header === 'letterhead' && <div className="t-rule mt-4 w-16" />}
          </motion.header>
        )}

        {/* Localização */}
        <motion.div
          variants={item}
          className={`t-faint mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] ${
            left ? 'justify-start' : 'justify-center'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <PinIcon width={15} height={15} />
            {profile.city}/{profile.state}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {[profile.serviceMode.inPerson && 'Presencial', profile.serviceMode.online && 'Online']
              .filter(Boolean)
              .join(' · ')}
          </span>
        </motion.div>
        {profile.regionNote && (
          <motion.p
            variants={item}
            className={`t-faint mt-1 text-[13px] ${left ? 'text-left' : 'text-center'}`}
          >
            {profile.regionNote}
          </motion.p>
        )}

        {/* Redes sociais — logo abaixo da identidade (foto/nome/OAB/localização) */}
        {profile.socials.length > 0 && (
          <motion.section variants={item} className="mt-6">
            <SectionTitle ornament={s.divider}>Redes e site</SectionTitle>
            <div
              className={`mt-3 grid gap-2.5 ${
                s.tile === 'underline' ? 'grid-cols-1' : 'grid-cols-2'
              }`}
            >
              {profile.socials.map((soc) => {
                const meta = socialMeta[soc.kind]
                const Icon = meta.Icon
                return (
                  <a
                    key={soc.kind + soc.url}
                    href={soc.url}
                    onClick={stop}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`${tile} !py-3 text-sm font-medium`}
                  >
                    {/* cor da marca SÓ na logo; "Site" (neutro) segue o tema */}
                    <Icon
                      width={24}
                      height={24}
                      className={`shrink-0 ${meta.color ? '' : 't-muted'}`}
                      style={meta.color ? { color: meta.color } : undefined}
                    />
                    {meta.label}
                    <ArrowRight width={15} height={15} className="t-faint ml-auto" />
                  </a>
                )
              })}
            </div>
          </motion.section>
        )}

        <motion.div variants={item}>
          <ThemeDivider type={s.divider} />
        </motion.div>

        {/* Bio */}
        {profile.bio && (
          <motion.p
            variants={item}
            className={`t-muted text-[15.5px] leading-relaxed ${left ? 'text-left' : 'text-center'}`}
          >
            {profile.bio}
          </motion.p>
        )}

        {/* CTAs principais */}
        <div className="mt-7 space-y-3">
          {whatsappHref && (
            <motion.a
              variants={item}
              href={whatsappHref}
              onClick={stop}
              target="_blank"
              rel="noreferrer noopener"
              className="t-btn w-full text-[15px]"
            >
              <WhatsappIcon width={24} height={24} />
              Conversar no WhatsApp
            </motion.a>
          )}
          {schedulingMode === 'external' && profile.contact.scheduling && (
            <motion.a
              variants={item}
              href={profile.contact.scheduling}
              onClick={stop}
              target="_blank"
              rel="noreferrer noopener"
              className={`${tile} justify-center !py-3.5 font-semibold`}
            >
              <CalendarIcon width={19} height={19} className="t-accent" />
              Agendar uma consulta
            </motion.a>
          )}
          {schedulingMode === 'assistant' && (
            // Assistente virtual: a conversa guiada é o caminho mais leve para marcar
            // um horário — e deixa explícito, já no botão, que quem atende é um robô.
            <motion.button
              variants={item}
              type="button"
              onClick={canSchedule ? () => setSchedOpen(true) : undefined}
              className={`${tile} !py-3`}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--c-accent-soft)' }}
                aria-hidden
              >
                <SparkIcon width={17} height={17} className="t-accent" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-tight">
                  Agendar uma conversa
                </span>
                <span className="t-faint block text-[12px] leading-tight">
                  {assistantTitle(profile)}
                </span>
              </span>
              <ArrowRight width={16} height={16} className="t-faint shrink-0" />
            </motion.button>
          )}
          {schedulingMode === 'whatsapp' && (
            <motion.button
              variants={item}
              type="button"
              onClick={canSchedule ? () => setSchedOpen(true) : undefined}
              className={`${tile} justify-center !py-3.5 font-semibold`}
            >
              <CalendarIcon width={19} height={19} className="t-accent" />
              Agendar uma consulta
            </motion.button>
          )}
        </div>

        {/* Áreas de atuação */}
        {areas.length > 0 && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle ornament={s.divider}>Áreas de atuação</SectionTitle>
            <div className="mt-3 space-y-2.5">
              {areas.map((a) => (
                <AreaCard key={a.id} label={a.label} description={a.description} tileClass={tile} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Experiência — o que sustenta a autoridade, em fatos curtos. Recurso que
            escala com o plano (ver lib/plans.ts). */}
        {highlights.length > 0 && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle ornament={s.divider}>Experiência</SectionTitle>
            <div className="mt-3 space-y-2.5">
              {highlights.map((h) => (
                <div key={h.id} className={`${tile} flex-col !items-stretch !gap-1 !py-3.5`}>
                  <span className="flex items-center gap-2.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rotate-45"
                      style={{ background: 'var(--c-accent)' }}
                      aria-hidden
                    />
                    <span className="font-display text-[15.5px] font-semibold leading-tight">
                      {h.title}
                    </span>
                  </span>
                  {h.detail.trim() && (
                    <span className="t-muted pl-[18px] text-left text-[13.5px] leading-relaxed">
                      {h.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Conteúdo educativo — artigos do advogado (plano Max). Informativo por
            definição: título, resumo e tempo de leitura, sem chamada de contratação. */}
        {articles.length > 0 && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle ornament={s.divider}>Conteúdo</SectionTitle>
            <div className="mt-3 space-y-2.5">
              {articles.map((a) => {
                const inner = (
                  <>
                    <span className="flex w-full items-baseline justify-between gap-3">
                      <span className="text-left font-display text-[15.5px] font-semibold leading-tight">
                        {a.title}
                      </span>
                      <span className="t-faint shrink-0 text-[11.5px] tabular-nums">
                        {a.readingMinutes} min
                      </span>
                    </span>
                    {a.summary.trim() && (
                      <span className="t-muted mt-1 text-left text-[13.5px] leading-relaxed">
                        {a.summary}
                      </span>
                    )}
                  </>
                )
                return a.url ? (
                  <a
                    key={a.id}
                    href={a.url}
                    onClick={stop}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`${tile} flex-col !items-stretch !gap-0 !py-4`}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={a.id} className={`${tile} flex-col !items-stretch !gap-0 !py-4`}>
                    {inner}
                  </div>
                )
              })}
            </div>
          </motion.section>
        )}

        {/* E-mail */}
        {profile.contact.email && (
          <motion.a
            variants={item}
            href={`mailto:${profile.contact.email}`}
            onClick={stop}
            className={`${tile} mt-9 justify-center !py-3 text-sm font-medium`}
          >
            <MailIcon width={18} height={18} className="t-muted" />
            {profile.contact.email}
          </motion.a>
        )}

        {/* Marca d'água (plano gratuito) */}
        <motion.footer variants={item} className="mt-12 flex flex-col items-center gap-1">
          {profile.plan === 'free' && !brand?.hideWatermark && (
            <a
              href="/"
              onClick={stop}
              className="t-link inline-flex items-center gap-1.5 text-xs"
            >
              <ScaleIcon width={14} height={14} />
              criado com <span className="font-semibold">advoc.me</span>
            </a>
          )}
          {brand?.brandName && (
            <p className="t-faint text-[11px] font-medium tracking-wide">{brand.brandName}</p>
          )}
          {!preview && profile.contentModerated && (
            <p className="t-faint text-[10.5px] leading-relaxed opacity-80">
              Parte do conteúdo deste perfil foi ocultada por moderação de conformidade.
            </p>
          )}
          <p className="t-faint text-[10.5px] leading-relaxed opacity-85">
            Perfil informativo · em conformidade com o Provimento 205/2021 da OAB
          </p>
        </motion.footer>
      </motion.div>

      {/* Agendamento → WhatsApp (não no preview do editor): conversa guiada do
          assistente virtual ou o formulário curto, conforme o modo escolhido. */}
      <AnimatePresence>
        {schedOpen && canSchedule && schedulingMode === 'assistant' && (
          <AssistantChat profile={profile} onClose={() => setSchedOpen(false)} />
        )}
        {schedOpen && canSchedule && schedulingMode === 'whatsapp' && (
          <SchedulingForm profile={profile} onClose={() => setSchedOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Ornamentos ----

const Diamond = () => (
  <span
    className="inline-block h-2 w-2 rotate-45"
    style={{ background: 'var(--c-accent)' }}
    aria-hidden
  />
)
const Dot = () => (
  <span
    className="inline-block h-1 w-1 rounded-full"
    style={{ background: 'var(--c-accent)', opacity: 0.65 }}
    aria-hidden
  />
)

function ThemeDivider({ type }: { type: ThemeStyle['divider'] }) {
  if (type === 'line') return <div className="t-rule mx-auto my-6 max-w-[220px]" />
  return (
    <div className="my-6 flex items-center justify-center gap-3" aria-hidden>
      <span className="h-px w-14" style={{ background: 'var(--c-ring)' }} />
      {type === 'diamond' && <Diamond />}
      {type === 'deco' && (
        <span className="flex items-center gap-1.5">
          <Dot />
          <Diamond />
          <Dot />
        </span>
      )}
      {type === 'fleuron' && (
        <span className="t-accent font-display text-lg leading-none">&#10086;</span>
      )}
      <span className="h-px w-14" style={{ background: 'var(--c-ring)' }} />
    </div>
  )
}

function SectionTitle({
  children,
  ornament,
}: {
  children: React.ReactNode
  ornament: ThemeStyle['divider']
}) {
  const showMark = ornament !== 'line'
  return (
    <h2 className="t-faint flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em]">
      <span className="h-px flex-1" style={{ background: 'var(--c-border)' }} />
      {showMark && <Diamond />}
      {children}
      {showMark && <Diamond />}
      <span className="h-px flex-1" style={{ background: 'var(--c-border)' }} />
    </h2>
  )
}

function AreaCard({
  label,
  description,
  tileClass,
}: {
  label: string
  description: string
  tileClass: string
}) {
  const [open, setOpen] = useState(false)
  const hasDesc = description.trim().length > 0

  // Área sem descrição: tile estático, editorial — losango de acento acima e o
  // nome em serifada de display, centralizado (timbre de escritório).
  if (!hasDesc) {
    return (
      <div className={`${tileClass} flex-col !items-center !gap-2 !py-4 text-center`}>
        <span className="h-1.5 w-1.5 rotate-45" style={{ background: 'var(--c-accent)' }} aria-hidden />
        <span className="font-display text-[16.5px] font-semibold leading-tight">{label}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className={`${tileClass} flex-col !items-stretch !gap-0 !py-4`}
      // Item expandido ganha borda fina de acento, diferenciando-o dos demais.
      style={open ? { borderColor: 'var(--c-accent)' } : undefined}
    >
      <span className="flex w-full items-center gap-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rotate-45" style={{ background: 'var(--c-accent)' }} aria-hidden />
        <span className="flex-1 text-left font-display text-[16.5px] font-semibold leading-tight">
          {label}
        </span>
        <ChevronDown
          width={16}
          height={16}
          className={`t-accent shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </span>
      {open && (
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="t-muted mt-2.5 block text-left text-[13.5px] font-normal leading-relaxed"
        >
          {description}
        </motion.span>
      )}
    </button>
  )
}
