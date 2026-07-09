import { useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { getTheme, themeStyle, type ThemeStyle } from '@/lib/themes'
import { Avatar } from '@/components/ui/Avatar'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import {
  ArrowRight,
  CalendarIcon,
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
}

// Converte "#rrggbb" em "rgba(r,g,b,a)" para a variável de destaque suave.
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return `rgba(150,116,63,${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function ProfileView({ profile, preview = false }: ProfileViewProps) {
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
              <p className="t-muted mt-1 text-[14px]">{profile.headline}</p>
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
            <p className="t-muted mt-2 text-[15px]">{profile.headline}</p>
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
          {profile.contact.scheduling && (
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
        </div>

        {/* Áreas de atuação */}
        {profile.areas.length > 0 && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle ornament={s.divider}>Áreas de atuação</SectionTitle>
            <div className="mt-3 space-y-2.5">
              {profile.areas.map((a) => (
                <AreaCard key={a.id} label={a.label} description={a.description} tileClass={tile} />
              ))}
            </div>
          </motion.section>
        )}

        {/* Destaques / experiência — lista editorial em coluna única (marcador + divisória) */}
        {profile.highlights.length > 0 && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle ornament={s.divider}>Experiência</SectionTitle>
            <div className="mt-2">
              {profile.highlights.map((h, i) => (
                <div
                  key={h.id}
                  className={`flex gap-3 py-3.5 ${i > 0 ? 't-border-c border-t' : ''}`}
                >
                  <span
                    className="mt-[9px] h-1.5 w-1.5 shrink-0 rotate-45"
                    style={{ background: 'var(--c-accent)' }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="t-accent font-display text-[18px] font-semibold leading-snug">
                      {h.title}
                    </p>
                    <p className="t-muted mt-1 text-[14px] leading-relaxed">{h.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Conteúdo — artigos educativos (informativo, nunca blog de marketing) */}
        {profile.articles && profile.articles.length > 0 && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle ornament={s.divider}>Conteúdo</SectionTitle>
            <div className="mt-3 space-y-2.5">
              {profile.articles.map((art) => {
                const inner = (
                  <>
                    <p className="font-display text-[16px] font-semibold leading-snug">
                      {art.title}
                    </p>
                    <p className="t-muted mt-1 text-[13.5px] leading-relaxed">{art.summary}</p>
                    <p className="t-faint mt-2 text-[12px] font-medium tracking-wide">
                      {art.readingMinutes} min de leitura
                    </p>
                  </>
                )
                return art.url ? (
                  <a
                    key={art.id}
                    href={art.url}
                    onClick={stop}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="t-border-c block border p-4 transition-colors"
                    style={{
                      background: 'var(--c-surface)',
                      borderRadius: 'var(--tile-radius, 20px)',
                    }}
                  >
                    {inner}
                  </a>
                ) : (
                  <div
                    key={art.id}
                    className="t-border-c border p-4"
                    style={{
                      background: 'var(--c-surface)',
                      borderRadius: 'var(--tile-radius, 20px)',
                    }}
                  >
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
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className={`${tileClass} flex-col !items-start !gap-1.5`}
      // Item expandido ganha borda fina de acento (bordô no tema Papel/Toga),
      // diferenciando-o dos demais que mantêm a borda neutra sutil.
      style={open ? { borderColor: 'var(--c-accent)' } : undefined}
    >
      <span className="flex w-full items-center justify-between font-semibold">
        {label}
        <span
          className={`t-accent transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
          aria-hidden
        >
          +
        </span>
      </span>
      {open && (
        <motion.span
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="t-faint text-[13.5px] font-normal leading-relaxed"
        >
          {description}
        </motion.span>
      )}
    </button>
  )
}
