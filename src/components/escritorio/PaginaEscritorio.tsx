import { useState } from 'react'
import { type Firm, lawyersInNeutralOrder } from '@/lib/escritorio'
import { Avatar } from '@/components/ui/Avatar'
import {
  InstagramIcon,
  LinkedinIcon,
  MailIcon,
  PinIcon,
  ScaleIcon,
  WhatsappIcon,
} from '@/components/ui/icons'
import { FirmVerified } from './FirmVerified'
import { MiniPerfil } from './MiniPerfil'
import { ModalTriagemWhatsApp } from './ModalTriagemWhatsApp'

// Página institucional standalone do escritório (sociedade de advogados). Estilo próprio
// baseado na paleta "Papel & Tinta" (bege/grafite/dourado) — NÃO usa o sistema de temas
// por perfil. Sóbria, mobile-first, sem aparência de loja.
export function PaginaEscritorio({ firm }: { firm: Firm }) {
  const [triage, setTriage] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const lawyers = lawyersInNeutralOrder(firm)
  const active = lawyers.find((l) => l.id === selected) ?? null

  // White-label: a cor do escritório (se houver) sobrescreve o vinho padrão via CSS var,
  // que cascateia para os destaques da página e dos modais (mesma subárvore do DOM).
  const accentVars = {
    '--firm-accent': firm.brandAccent || '#6b2131',
  } as React.CSSProperties

  return (
    <main className="grain relative min-h-dvh overflow-x-hidden" style={accentVars}>
      <div className="mx-auto w-full max-w-[560px] px-5 pb-16 pt-10 sm:pt-14">
        {/* Cabeçalho institucional */}
        <header className="flex flex-col items-center text-center">
          <div className="rule-brass mb-6 w-24" />
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-brass/40 bg-paper-soft">
            <span
              className="font-display text-2xl font-semibold"
              style={{ color: 'var(--firm-accent)' }}
            >
              {firm.monogram}
            </span>
          </div>
          <h1 className="mt-4 font-display text-[26px] font-semibold leading-tight text-ink sm:text-[30px]">
            {firm.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-brass-deep">{firm.oabRegistry}</span>
            {firm.oabVerified && <FirmVerified />}
          </div>
          <p className="mt-2 text-[15px] text-ink-soft">{firm.tagline}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-ink-faint">
            <PinIcon width={15} height={15} />
            {firm.city}/{firm.state}
          </div>
        </header>

        {/* Redes institucionais (topo) — separadas das redes pessoais dos advogados */}
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Redes do escritório">
          {firm.contact.instagram && (
            <SocialDot href={firm.contact.instagram} label="Instagram do escritório">
              <InstagramIcon width={19} height={19} />
            </SocialDot>
          )}
          {firm.contact.linkedin && (
            <SocialDot href={firm.contact.linkedin} label="LinkedIn do escritório">
              <LinkedinIcon width={19} height={19} />
            </SocialDot>
          )}
          {firm.contact.whatsapp && (
            <button
              type="button"
              onClick={() => setTriage(true)}
              aria-label="WhatsApp do escritório"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/12 bg-paper-soft text-ink-soft transition-colors hover:border-brass/50 hover:text-burgundy"
            >
              <WhatsappIcon width={19} height={19} />
            </button>
          )}
        </nav>

        <div className="rule-brass mx-auto my-8 max-w-[220px]" />

        {/* Sobre o escritório */}
        <p className="text-center text-[15.5px] leading-relaxed text-ink-soft">{firm.about}</p>

        {/* Áreas de atuação — tags neutras, sem hierarquia */}
        <section className="mt-8">
          <SectionLabel>Áreas de atuação</SectionLabel>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {firm.areas.map((a) => (
              <span
                key={a.id}
                className="rounded-full border border-ink/12 bg-paper-soft px-3.5 py-1.5 text-[13px] font-medium text-ink-soft"
              >
                {a.label}
              </span>
            ))}
          </div>
        </section>

        {/* Grid de advogados OU mini-perfil inline */}
        <section className="mt-9">
          <SectionLabel>Advogados</SectionLabel>
          {active ? (
            <div className="mt-3">
              <MiniPerfil lawyer={active} onBack={() => setSelected(null)} />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {lawyers.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelected(l.id)}
                  className="flex flex-col items-center gap-2 rounded-xl2 border border-ink/10 bg-paper-soft p-4 text-center shadow-card transition-all hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-lift"
                >
                  <Avatar src={l.avatarUrl} name={l.name} size={64} />
                  <span className="mt-0.5 font-display text-[15px] font-semibold leading-snug text-ink">
                    {l.name}
                  </span>
                  <span className="text-[12.5px] text-ink-faint">{l.area}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Contato institucional geral */}
        <section className="mt-10 rounded-xl2 border border-ink/10 bg-paper-soft p-5 text-center shadow-card">
          <SectionLabel>Contato do escritório</SectionLabel>
          <div className="mt-3 flex flex-col items-center gap-1.5 text-sm text-ink-soft">
            {firm.contact.phone && <span>{firm.contact.phone}</span>}
            {firm.contact.email && (
              <a
                href={`mailto:${firm.contact.email}`}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-burgundy"
              >
                <MailIcon width={16} height={16} />
                {firm.contact.email}
              </a>
            )}
          </div>
          {firm.contact.whatsapp && (
            <button
              type="button"
              onClick={() => setTriage(true)}
              className="btn-primary mt-4 w-full"
              style={{ background: 'var(--firm-accent)' }}
            >
              <WhatsappIcon width={18} height={18} />
              Falar com o escritório
            </button>
          )}
        </section>

        {/* Rodapé de compliance */}
        <footer className="mt-12 flex flex-col items-center gap-1 text-center">
          <p className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-faint">
            <ScaleIcon width={14} height={14} />
            Publicidade em conformidade com o Provimento 205/2021 da OAB
          </p>
        </footer>
      </div>

      {triage && <ModalTriagemWhatsApp firm={firm} onClose={() => setTriage(false)} />}
    </main>
  )
}

function SocialDot({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/12 bg-paper-soft text-ink-soft transition-colors hover:border-brass/50 hover:text-burgundy"
    >
      {children}
    </a>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
      <span className="h-px flex-1 bg-ink/10" />
      {children}
      <span className="h-px flex-1 bg-ink/10" />
    </h2>
  )
}
