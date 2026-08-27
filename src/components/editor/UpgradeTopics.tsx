import { useEffect, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Plan, Profile } from '@/lib/types'
import { slugify } from '@/lib/brFormat'
import { PLAN_LABEL } from '@/lib/upsell'
import { CalendarIcon, CheckIcon, GlobeIcon, ScaleIcon, ShieldIcon } from '@/components/ui/icons'
import { useSlugCheck } from '@/lib/useSlugCheck'
import { hostLabel } from '@/lib/publicUrl'

// Tópicos concretos de "como melhorar o perfil" travados por plano.
//
// Cada linha mostra uma PROVA em vez de uma frase: o endereço com o número
// riscado virando o nome limpo, a grade real da agenda (o mesmo
// componente do perfil), horários de agenda, o domínio próprio, a assinatura
// advoc.me riscada. Uma promessa que a pessoa consegue VER vende; uma linha de
// texto cinza descrevendo a promessa, não.
//
// Já incluídos no plano atual aparecem com selo (quando `showIncluded`), dando
// senso de evolução. O botão leva à PÁGINA de assinatura (/assinar/:plano).

type Topic = {
  key: string
  title: string
  /** amostra do resultado — é ela que carrega a identidade da linha */
  proof: (p: Profile) => ReactNode
  plan: Exclude<Plan, 'free'>
}

// Chip monoespaçado de endereço — o mesmo desenho para as três provas de URL,
// para o antes/depois ficar imediatamente comparável.
function Addr({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[12px] tabular-nums ${
        muted
          ? 'bg-ink/[0.05] text-ink-faint line-through decoration-burgundy/50'
          : 'bg-brass/15 font-semibold text-brass-deep'
      }`}
    >
      {children}
    </span>
  )
}

/** Antes → depois do endereço, com a disponibilidade conferida de verdade. */
function SlugProof({ profile }: { profile: Profile }) {
  const alvo = slugify(profile.name) || 'seu-nome'
  const { available, suggested, checking } = useSlugCheck(alvo, profile.name)
  const livre = available !== false
  const final = livre ? alvo : suggested || alvo

  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <Addr muted>
          {hostLabel()}/{profile.slug || 'seu-nome-4821'}
        </Addr>
        <span className="text-ink-faint">→</span>
        <Addr>
          {hostLabel()}/{final}
        </Addr>
      </span>
      <span aria-live="polite" className="text-[11.5px] text-ink-faint">
        {checking && 'conferindo disponibilidade…'}
        {!checking && available === true && 'disponível para você'}
        {!checking && available === false && `${alvo} já está em uso — este fica reservado`}
        {!checking && available === null && 'confirmamos a disponibilidade na ativação'}
      </span>
    </span>
  )
}

const TOPICS: Topic[] = [
  {
    key: 'slug',
    title: 'Seu nome no endereço, sem número',
    plan: 'pro',
    // A prova CONSULTA o servidor: prometer um endereço sem perguntar a ninguém
    // é a promessa mais fácil de quebrar do produto — basta existir outro
    // homônimo, e aí o advogado assina e recebe um número no fim mesmo assim.
    proof: (p) => <SlugProof profile={p} />,
  },
  {
    key: 'agenda',
    title: 'Agenda de consultas no perfil',
    plan: 'pro',
    proof: () => (
      <span className="flex flex-wrap items-center gap-1.5">
        <CalendarIcon width={14} height={14} className="text-brass-deep" />
        {['seg 09:00', 'seg 10:00', 'ter 14:00'].map((slot) => (
          <span
            key={slot}
            className="rounded-md border border-brass/30 bg-brass/[0.08] px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums text-brass-deep"
          >
            {slot}
          </span>
        ))}
      </span>
    ),
  },
  {
    key: 'domain',
    title: 'Domínio próprio (.adv.br) — em breve',
    plan: 'premium',
    proof: (p) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <GlobeIcon width={14} height={14} className="text-brass-deep" />
        <Addr>{slugify(p.name) || 'seu-nome'}.adv.br</Addr>
        {/* Duas verdades no mesmo rótulo: o .adv.br é registrado no registro.br em
            nome do advogado (a plataforma não tem como afirmar que está livre), e o
            suporte a domínio próprio ainda está sendo preparado aqui dentro. */}
        <span className="text-[11.5px] text-ink-faint">em preparo · registrado no seu nome</span>
      </span>
    ),
  },
  {
    key: 'brand',
    title: 'Sem a marca advoc.me',
    plan: 'premium',
    proof: () => (
      <span className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="inline-flex items-center gap-1 rounded-md bg-ink/[0.05] px-1.5 py-0.5 text-ink-faint line-through decoration-burgundy/50">
          <ScaleIcon width={11} height={11} />
          criado com advoc.me
        </span>
        <span className="text-ink-faint">→</span>
        <span className="rounded-md bg-brass/15 px-1.5 py-0.5 font-semibold text-brass-deep">
          só o seu nome no rodapé
        </span>
      </span>
    ),
  },
]

// Marca de cada tópico — mesma caixa, sinais diferentes.
const TOPIC_ICON: Record<string, (p: { width?: number; height?: number }) => JSX.Element> = {
  slug: GlobeIcon,
  oab: ScaleIcon,
  agenda: CalendarIcon,
  domain: GlobeIcon,
  brand: ShieldIcon,
}

const RANK: Record<Plan, number> = { free: 0, pro: 1, premium: 2 }

export function UpgradeTopics({
  profile,
  initial = null,
  showIncluded = true,
}: {
  profile: Profile
  /** vai direto para o checkout deste plano (ex.: quem clicou "Assinar Pro" na home) */
  initial?: Exclude<Plan, 'free'> | null
  /**
   * Mostra também os tópicos já inclusos no plano atual (com selo "Incluído").
   * Desligue onde o senso de progresso já vem de outro lugar — no painel, o
   * checklist do plano cumpre esse papel e repetir aqui vira ruído.
   */
  showIncluded?: boolean
}) {
  const loc = useLocation()
  const navigate = useNavigate()
  const volta = `${loc.pathname}${loc.search}`
  const checkoutUrl = (p: Exclude<Plan, 'free'>) =>
    `/assinar/${p}?voltar=${encodeURIComponent(volta)}`

  // Quem chegou com a intenção já declarada ("Assinar Pro" na home) não precisa
  // clicar de novo: vai direto para a assinatura.
  useEffect(() => {
    if (initial) navigate(checkoutUrl(initial), { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  return (
    <>
      <div className="space-y-2.5">
        {TOPICS.filter((t) => showIncluded || RANK[profile.plan] < RANK[t.plan]).map((t) => {
          const unlocked = RANK[profile.plan] >= RANK[t.plan]
          const Icon = TOPIC_ICON[t.key] ?? ScaleIcon
          return (
            // No celular a linha EMPILHA: com o botão disputando a largura, o
            // título quebrava numa palavra por linha ("Seu nome / no / endereço").
            // A partir de sm volta a ser uma linha só, com o botão à direita.
            <div
              key={t.key}
              className="flex flex-col gap-3 rounded-xl2 border border-ink/10 bg-paper p-3.5 shadow-card transition-colors hover:border-brass/40 sm:flex-row sm:items-center"
            >
              {/* Marca + texto andam sempre juntos; só o botão desce no celular. */}
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brass/25 bg-brass/[0.07] text-brass-deep"
                  aria-hidden
                >
                  <Icon width={17} height={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[14.5px] font-semibold leading-tight text-ink">
                      {t.title}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        unlocked ? 'bg-brass/15 text-brass-deep' : 'bg-ink/[0.06] text-ink-faint'
                      }`}
                    >
                      {PLAN_LABEL[t.plan]}
                    </span>
                  </div>
                  {/* A prova quebra em várias linhas no celular em vez de ser
                      truncada: é ela que vende, cortá-la esvazia a linha inteira. */}
                  <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                    {t.proof(profile)}
                  </div>
                </div>
              </div>

              {unlocked ? (
                <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-brass-deep sm:self-center">
                  <CheckIcon width={14} height={14} strokeWidth={2.4} />
                  Incluído
                </span>
              ) : (
                <Link
                  to={checkoutUrl(t.plan)}
                  className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-full bg-burgundy px-3.5 text-[12.5px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep sm:min-h-0 sm:w-auto sm:self-center sm:py-1.5"
                >
                  Ativar {PLAN_LABEL[t.plan]}
                </Link>
              )}
            </div>
          )
        })}
      </div>

    </>
  )
}
