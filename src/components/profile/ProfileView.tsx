import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { getTheme, themeStyle, type RuleStyle } from '@/lib/themes'
import { resolveSchedulingMode } from '@/lib/booking'
import { canUseVideo } from '@/lib/plans'
import { parseVideoUrl } from '@/lib/video'
import { Avatar } from '@/components/ui/Avatar'
import { SchedulingForm } from '@/components/profile/SchedulingForm'
import { VideoPlayer } from '@/components/profile/VideoPlayer'
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
   * O DONO está vendo o próprio perfil público. Liga marcas discretas nos
   * lugares onde falta conteúdo — a diferença entre o perfil dele e o exemplo da
   * home é justamente o que ainda não foi preenchido, e sem uma pista aqui isso
   * se parece com defeito do produto. Nunca aparece para visitante.
   */
  owner?: boolean
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

export function ProfileView({
  profile,
  preview = false,
  chatEnabled,
  owner = false,
}: ProfileViewProps) {
  const [schedOpen, setSchedOpen] = useState(false)
  const schedulingMode = resolveSchedulingMode(profile)
  // Agendar é a única ação que continua viva na prévia da home (chatEnabled).
  const canSchedule = chatEnabled ?? !preview
  // Perfil vivo (RFC-002): só existe o que tem conteúdo. Áreas sem nome não viram
  // card — nada de caixa vazia.
  const areas = profile.areas.filter((a) => a.label.trim())
  const highlights = profile.highlights.filter((h) => h.title.trim())
  const articles = (profile.articles ?? []).filter((a) => a.title.trim())
  // Vídeo de apresentação (Max): só existe se o link for reconhecido — link
  // quebrado não vira caixa vazia no perfil de ninguém.
  const video = canUseVideo(profile.plan) ? parseVideoUrl(profile.videoUrl) : null
  const s = getTheme(profile.theme).style
  const brand = profile.branding
  // White-label: cor de destaque personalizada sobrescreve a do tema via CSS vars.
  const brandVars = brand?.accent
    ? ({ '--c-accent': brand.accent, '--c-accent-soft': hexToRgba(brand.accent, 0.14) } as React.CSSProperties)
    : undefined
  const tile = s.tile === 'card' ? 't-tile' : `t-tile tv-${s.tile}`
  const foil = s.finish === 'foil'
  const left = s.header === 'editorial'
  // A entreletra do NOME vem do tema (--name-tracking), não de uma classe fixa:
  // caixa alta pede ar, serifa em corpo grande pede aperto, e cada família tem
  // seu ponto de equilíbrio. Inline porque a regra do tema no CSS vence a classe
  // do Tailwind por especificidade — deixar as duas brigando dá resultado
  // diferente por tema sem ninguém entender o porquê.
  const nameCls = [
    'leading-tight',
    s.nameCase === 'upper'
      ? 'uppercase text-[21px] sm:text-[25px] font-medium'
      : 'text-[26px] sm:text-[30px] font-semibold',
    foil ? 'foil' : '',
  ].join(' ')
  const nameStyle: React.CSSProperties = { letterSpacing: 'var(--name-tracking, -0.01em)' }

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
              <h1 className={nameCls} style={nameStyle}>{profile.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">{identity}</div>
              {profile.headline ? (
                <p className="t-muted mt-1 text-[14px]">{profile.headline}</p>
              ) : (
                owner && (
                  <OwnerHint to="/editor?section=identidade" className="mt-1.5">
                    Falta a sua frase de apresentação
                  </OwnerHint>
                )
              )}
            </div>
          </motion.header>
        ) : (
          <motion.header variants={item} className="flex flex-col items-center text-center">
            {s.header === 'letterhead' && <div className="t-rule mb-5 w-24" />}
            <Avatar src={profile.avatarUrl} name={profile.name} size={104} frame={s.avatar} />
            <h1 className={`mt-4 ${nameCls}`} style={nameStyle}>{profile.name}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {identity}
            </div>
            {profile.headline ? (
              <p className="t-muted mt-2 text-[15px]">{profile.headline}</p>
            ) : (
              owner && (
                <OwnerHint to="/editor?section=identidade" className="mt-2.5">
                  Falta a sua frase de apresentação
                </OwnerHint>
              )
            )}
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

        {owner && profile.socials.length === 0 && (
          <motion.div variants={item} className="mt-6 flex justify-center">
            <OwnerHint to="/editor?section=redes">
              Suas redes e site ainda não aparecem aqui
            </OwnerHint>
          </motion.div>
        )}

        {/* Redes sociais — logo abaixo da identidade (foto/nome/OAB/localização) */}
        {profile.socials.length > 0 && (
          <motion.section variants={item} className="mt-6">
            <SectionTitle rule={s.rule}>Redes e site</SectionTitle>
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
          <ThemeDivider type={s.rule} />
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
            <SectionTitle rule={s.rule}>Áreas de atuação</SectionTitle>
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
            <SectionTitle rule={s.rule}>Experiência</SectionTitle>
            <div className="mt-3 space-y-2.5">
              {highlights.map((h) => (
                <div key={h.id} className={`${tile} flex-col !items-stretch !gap-1 !py-3.5`}>
                  {/* Filete vertical de acento no lugar do losango: marca a
                      entrada sem virar enfeite, e alinha o título com o detalhe. */}
                  <span className="flex items-stretch gap-2.5">
                    <span
                      aria-hidden
                      className="w-[2px] shrink-0 rounded-full"
                      style={{ background: 'var(--c-accent)' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[15.5px] font-semibold leading-tight">
                        {h.title}
                      </span>
                      {h.detail.trim() && (
                        <span className="t-muted mt-1 block text-left text-[13.5px] leading-relaxed">
                          {h.detail}
                        </span>
                      )}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Conteúdo educativo — artigos do advogado (plano Max). Informativo por
            definição: título, resumo e tempo de leitura, sem chamada de contratação. */}
        {articles.length > 0 && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle rule={s.rule}>Conteúdo</SectionTitle>
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

        {/* Vídeo de apresentação — fecha o perfil: quem chegou até aqui já leu
            quem você é, e o vídeo é o que mais aproxima. Fica por último também
            porque é o único bloco que fala com um servidor de terceiro, e só
            depois do clique (ver VideoPlayer). */}
        {video && (
          <motion.section variants={item} className="mt-9">
            <SectionTitle rule={s.rule}>Apresentação</SectionTitle>
            <div className="mt-3">
              <VideoPlayer
                video={video}
                caption={profile.videoCaption}
                name={profile.name}
                inert={preview && !chatEnabled}
              />
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

/**
 * Marca de "falta isto aqui", visível SÓ para o dono.
 *
 * Tracejada e em corpo pequeno de propósito: é um bilhete no rascunho, não parte
 * do perfil. Quem chega pelo link nunca vê nada disso — o que o visitante lê
 * continua sendo apenas o que existe de verdade.
 */
function OwnerHint({
  to,
  children,
  className = '',
}: {
  to: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={`t-faint inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-[12px] transition-colors hover:opacity-80 ${className}`}
      style={{ borderColor: 'var(--c-ring)' }}
    >
      + {children}
    </Link>
  )
}

// ---- Filetes e títulos de seção ----
//
// Aqui morava um losango (◆) repetido em três lugares. Ele saiu por completo:
// símbolo decorativo envelhece mal, some no contraste e faz o perfil de um
// advogado parecer convite de casamento. O que separa e hierarquiza agora é
// RÉGUA E TIPO — filete, versalete e entreletra —, que é justamente o idioma do
// impresso jurídico e o que continua legível em qualquer tela.
//
// Cada variante é uma escolha do tema (ThemeStyle.rule), não um enfeite solto.

/** Filete horizontal do tema. `soft` usa a cor de borda; senão, a de acento. */
function Rule({
  className = '',
  soft = false,
  thick = false,
  fade = false,
}: {
  className?: string
  soft?: boolean
  thick?: boolean
  fade?: boolean
}) {
  const color = soft ? 'var(--c-border)' : 'var(--c-ring)'
  return (
    <span
      aria-hidden
      className={className}
      style={{
        height: thick ? 2 : 1,
        // `fade`: o filete se dissolve nas pontas em vez de terminar seco —
        // é o que dá o ar do tema Névoa sem precisar de nenhum símbolo.
        background: fade
          ? `linear-gradient(to right, transparent, ${color} 22%, ${color} 78%, transparent)`
          : color,
      }}
    />
  )
}

/** Separador entre blocos do perfil — a pontuação do documento. */
function ThemeDivider({ type }: { type: RuleStyle }) {
  if (type === 'double') {
    return (
      <div className="my-6 flex flex-col gap-[3px]" aria-hidden>
        <Rule soft />
        <Rule soft />
      </div>
    )
  }
  if (type === 'capline') {
    return <Rule thick className="my-6 w-16" />
  }
  if (type === 'bar') {
    return <Rule thick className="my-6 w-10 rounded-full" />
  }
  if (type === 'tapered') {
    return <Rule fade className="my-6 w-full" />
  }
  return <div className="t-rule mx-auto my-6 max-w-[220px]" />
}

/**
 * Título de seção. A variante do tema decide o ALINHAMENTO e o desenho do
 * filete: centralizado entre duas réguas (clássico), rente à esquerda sob um
 * filete duplo (livro-razão), sob um filete grosso curto (editorial) ou com uma
 * barra sólida de acento na frente (impresso moderno).
 */
function SectionTitle({ children, rule }: { children: React.ReactNode; rule: RuleStyle }) {
  const label = (
    <span
      className="t-faint whitespace-nowrap text-[11px] font-semibold uppercase"
      style={{ letterSpacing: 'var(--label-tracking, 0.18em)' }}
    >
      {children}
    </span>
  )

  if (rule === 'double') {
    return (
      <h2 className="flex flex-col gap-1.5">
        {label}
        <span className="flex flex-col gap-[3px]">
          <Rule soft />
          <Rule soft />
        </span>
      </h2>
    )
  }

  if (rule === 'capline') {
    return (
      <h2 className="flex flex-col items-start gap-2">
        <Rule thick className="w-9" />
        {label}
      </h2>
    )
  }

  if (rule === 'bar') {
    return (
      <h2 className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-3.5 w-[3px] shrink-0 rounded-full"
          style={{ background: 'var(--c-accent)' }}
        />
        {label}
        <Rule soft className="flex-1" />
      </h2>
    )
  }

  // hairline (padrão) e tapered: rótulo centralizado entre dois filetes.
  return (
    <h2 className="flex items-center gap-3">
      <Rule soft={rule !== 'tapered'} fade={rule === 'tapered'} className="flex-1" />
      {label}
      <Rule soft={rule !== 'tapered'} fade={rule === 'tapered'} className="flex-1" />
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

  // Área sem descrição: tile estático e editorial. O nome sozinho, centralizado,
  // com um filete curto de acento acima — o mesmo gesto do timbre, sem símbolo.
  if (!hasDesc) {
    return (
      <div className={`${tileClass} flex-col !items-center !gap-2.5 !py-4 text-center`}>
        <span
          aria-hidden
          className="h-[2px] w-6 rounded-full"
          style={{ background: 'var(--c-accent)' }}
        />
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
        {/* Barrinha vertical em vez do losango — a mesma marca dos destaques,
            para o perfil inteiro falar uma língua só. */}
        <span
          aria-hidden
          className="h-4 w-[2px] shrink-0 rounded-full"
          style={{ background: 'var(--c-accent)' }}
        />
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
