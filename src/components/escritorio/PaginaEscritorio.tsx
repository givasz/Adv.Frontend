import { useState } from 'react'
import { type Firm, lawyersInNeutralOrder } from '@/lib/escritorio'
import { Avatar } from '@/components/ui/Avatar'
import {
  ArrowRight,
  ExternalLinkIcon,
  InstagramIcon,
  LinkedinIcon,
  MailIcon,
  PinIcon,
  ScaleIcon,
  SparkIcon,
  WhatsappIcon,
} from '@/components/ui/icons'
import { CnaLink } from '@/components/ui/CnaLink'
import { MiniPerfil } from './MiniPerfil'
import { PainelEmLinha } from './PainelEmLinha'
import { AssistenteEscritorio } from './AssistenteEscritorio'
import { safeHref } from '@/lib/safeUrl'
import { cliqueDoEscritorio, registrarEventoDoEscritorio } from '@/lib/eventos'
import { firmAssistantDestination, firmTemDestino } from '@/lib/assistant'
import { enderecoCurto, enderecoVisivel, linkDoMapa } from '@/lib/endereco'
import { comoAbrirFora } from '@/lib/abrirFora'

// Página institucional standalone do escritório (sociedade de advogados). Estilo próprio
// baseado na paleta "Papel & Tinta" (bege/grafite/dourado) — NÃO usa o sistema de temas
// por perfil. Sóbria, mobile-first, sem aparência de loja.
export function PaginaEscritorio({ firm }: { firm: Firm }) {
  const [assistente, setAssistente] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const lawyers = lawyersInNeutralOrder(firm)
  const active = lawyers.find((l) => l.id === selected) ?? null
  // Há para onde mandar um pedido? Antes a conversa só aparecia com WhatsApp
  // institucional — com a caixa de solicitações ligada, um escritório pode
  // receber sem ter número nenhum.
  const podeFalar = firmTemDestino(firm)
  // Sem escolher advogado, o pedido sai pelo WhatsApp ou fica numa caixa? O ícone
  // de WhatsApp num escritório que recebe pelo site prometeria o aplicativo errado.
  const saiPorWhatsapp = firmAssistantDestination(firm, {}).inbox === null

  /**
   * O clique num link da página, contado. A visita é gravada pelo SERVIDOR ao
   * montar a resposta (firms.service.getBySlug): contar do lado do navegador
   * exigiria confiar em quem chama, e uma rota pública que aceita "some mais uma
   * visita" é um contador que qualquer um infla.
   */
  const clique = (evento: Parameters<typeof cliqueDoEscritorio>[1]) =>
    cliqueDoEscritorio(firm.slug, evento, false)

  function abrirAssistente() {
    registrarEventoDoEscritorio(firm.slug, 'assistente')
    setAssistente(true)
  }

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
          {/* A logo quando existe; as iniciais quando não. O monograma sempre foi
              descrito como substituto de uma logo que não tinha como ser enviada —
              agora tem (ver components/escritorio/LogoUpload). */}
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-brass/40 bg-paper-soft">
            {firm.logoUrl ? (
              // `contain` e não `cover`: logo é marca, e cortar marca é pior do
              // que deixar sobrar espaço em volta.
              <img src={firm.logoUrl} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <span
                className="font-display text-2xl font-semibold"
                style={{ color: 'var(--firm-accent)' }}
              >
                {firm.monogram}
              </span>
            )}
          </div>
          <h1 className="mt-4 font-display text-[26px] font-semibold leading-tight text-ink sm:text-[30px]">
            {firm.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-brass-deep">{firm.oabRegistry}</span>
            {firm.oabRegistry?.trim() && <CnaLink name={firm.name} />}
          </div>
          <p className="mt-2 text-[15px] text-ink-soft">{firm.tagline}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-ink-faint">
            <PinIcon width={15} height={15} />
            {firm.city}/{firm.state}
          </div>
          {/* Endereço da sede — linha discreta logo abaixo da cidade, e não um
              cartão. Mesma decisão do perfil individual, pelo mesmo motivo:
              endereço é referência, não é a ação da página (ver ProfileView). */}
          {enderecoVisivel(firm.address) && (
            <a
              href={linkDoMapa(firm.address, firm.city, firm.state)}
              {...comoAbrirFora()}
              onClick={clique('endereco')}
              className="mt-1 inline text-[12px] leading-snug text-ink-faint hover:underline"
            >
              {enderecoCurto(firm.address)}{' '}
              <ExternalLinkIcon
                width={10}
                height={10}
                className="inline shrink-0 -translate-y-px opacity-70"
              />
            </a>
          )}
        </header>

        {/* Redes institucionais (topo) — separadas das redes pessoais dos advogados */}
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Redes do escritório">
          {safeHref(firm.contact.instagram) && (
            <SocialDot
              href={safeHref(firm.contact.instagram)!}
              label="Instagram do escritório"
              onClick={clique('rede:instagram')}
            >
              <InstagramIcon width={19} height={19} />
            </SocialDot>
          )}
          {safeHref(firm.contact.linkedin) && (
            <SocialDot
              href={safeHref(firm.contact.linkedin)!}
              label="LinkedIn do escritório"
              onClick={clique('rede:linkedin')}
            >
              <LinkedinIcon width={19} height={19} />
            </SocialDot>
          )}
          {podeFalar && (
            <button
              type="button"
              onClick={abrirAssistente}
              // Nome PRÓPRIO, diferente do botão grande logo abaixo: os dois
              // abrem a mesma conversa, e dois controles com o mesmo nome
              // acessível deixam quem usa leitor de tela sem saber que são o
              // mesmo destino (foi o que o teste de fumaça pegou).
              aria-label="Ir para a conversa com o escritório"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/12 bg-paper-soft text-ink-soft transition-colors hover:border-brass/50 hover:text-burgundy"
            >
              {saiPorWhatsapp ? (
                <WhatsappIcon width={19} height={19} />
              ) : (
                <SparkIcon width={19} height={19} />
              )}
            </button>
          )}
        </nav>

        {/* Falar com o escritório — a conversa guiada é a ação principal da
            página, então mora aqui em cima, não no rodapé. */}
        {podeFalar && (
          <section className="mt-7">
            {!assistente && (
              <button
                type="button"
                onClick={abrirAssistente}
                className="flex w-full items-center gap-3 rounded-xl2 border border-ink/10 bg-paper-soft p-3.5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-lift"
              >
                <span
                  className="disco-do-escritorio flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  aria-hidden
                >
                  <SparkIcon width={17} height={17} style={{ color: 'var(--firm-accent)' }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight text-ink">
                    Falar com o escritório
                  </span>
                  {/* "Automático" já aqui: quem clica sabe de antemão que quem
                      responde é um robô, nunca um(a) advogado(a). */}
                  <span className="block text-[12px] leading-tight text-ink-faint">
                    Assistente virtual · Automático
                  </span>
                </span>
                <ArrowRight width={16} height={16} className="shrink-0 text-ink-faint" />
              </button>
            )}
            {/* A conversa abre AQUI, no lugar do botão — não numa janela sobre a
                página. Substituiu a triagem de duas telas: é o mesmo assistente do
                perfil individual, sem grade de horários (ver AssistenteEscritorio). */}
            {assistente && (
              <PainelEmLinha onClose={() => setAssistente(false)}>
                <div className="mt-1 text-left">
                  <AssistenteEscritorio firm={firm} />
                </div>
              </PainelEmLinha>
            )}
          </section>
        )}

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
                onClick={clique('email')}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-burgundy"
              >
                <MailIcon width={16} height={16} />
                {firm.contact.email}
              </a>
            )}
          </div>
          {/* Mesmo assistente do topo: um só painel na página. Ao abrir, o
              PainelEmLinha se traz para a vista, então clicar daqui leva a pessoa
              até a conversa em vez de abrir uma segunda cópia dela. */}
          {podeFalar && !assistente && (
            <button
              type="button"
              onClick={abrirAssistente}
              className="btn-primary mt-4 w-full"
              style={{ background: 'var(--firm-accent)' }}
            >
              {saiPorWhatsapp ? (
                <WhatsappIcon width={18} height={18} />
              ) : (
                <SparkIcon width={18} height={18} />
              )}
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

    </main>
  )
}

function SocialDot({
  href,
  label,
  children,
  onClick,
}: {
  href: string
  label: string
  children: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <a
      href={href}
      {...comoAbrirFora()}
      onClick={onClick}
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
