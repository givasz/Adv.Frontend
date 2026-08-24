import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { computeTrust, type TrustFactor } from '@/lib/trustScore'
import { THEMES, isThemeUnlocked } from '@/lib/themes'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { UpgradeTopics } from '@/components/editor/UpgradeTopics'
import { PlanChecklist } from '@/components/editor/PlanChecklist'
import { Avatar } from '@/components/ui/Avatar'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { TrustGauge } from '@/components/ui/TrustGauge'
import { comVolta } from '@/components/ui/SubPage'
import {
  ArrowRight,
  CardIcon,
  DocIcon,
  EyeIcon,
  LockIcon,
  PlayIcon,
  QrIcon,
  ScaleIcon,
  ShieldIcon,
} from '@/components/ui/icons'
import { StepArt, STEP_HINT } from '@/components/painel/StepArt'
import { EscritorioCard } from '@/components/painel/EscritorioCard'

// Para onde cada passo leva no editor. Itens travados por plano também levam à seção —
// lá o próprio recurso mostra seu valor antes de pedir upgrade (upsell natural).
const DEST: Record<string, string> = {
  nome: '/editor?section=identidade',
  cidade: '/editor?section=identidade',
  oab: '/editor?section=identidade',
  bio: '/editor?section=bio',
  whatsapp: '/editor?section=redes',
  area1: '/editor?section=identidade',
  foto: '/editor?section=identidade',
  frase: '/editor?section=identidade',
  redes: '/editor?section=redes',
  email: '/editor?section=redes',
  area2: '/editor?section=identidade',
  faq: '/editor?section=faq',
  agenda: '/editor?section=agenda',
  dominio: '/editor?section=marca',
  marca: '/editor?section=marca',
}

const LAST_KEY = 'advocme:trust:last'


// Frase de incentivo conforme o índice — tom profissional, sem gamificação infantil.
function motivator(score: number): string {
  if (score >= 90) return 'Parabéns — seu perfil está excelente.'
  if (score >= 75) return 'Seu perfil já transmite muita confiança.'
  if (score >= 60) return 'Falta pouco para um perfil muito forte.'
  if (score >= 40) return 'Bom começo. Cada passo aumenta sua credibilidade.'
  return 'Vamos deixar seu perfil mais completo.'
}

export default function Painel() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [delta, setDelta] = useState(0)
  // true logo depois de confirmar uma assinatura — dá o tom de celebração ao
  // checklist do que abriu (some ao recarregar).
  const [justUpgraded, setJustUpgraded] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // "Assinar Pro" clicado na home chega como ?assinar=pro e segue direto para a
  // página de assinatura. Na volta, ?assinou=pro dá o tom de celebração ao
  // checklist do que abriu — o estado da compra atravessa a navegação pela URL,
  // que é justamente o que um modal não sabia fazer.
  const wanted = searchParams.get('assinar')
  const openCheckout: Exclude<Plan, 'free'> | null =
    wanted === 'pro' || wanted === 'premium' ? wanted : null
  const acabouDeAssinar = searchParams.get('assinou')

  useEffect(() => {
    document.title = 'Evolua seu perfil · advoc.me'
    api
      .getDraft()
      .then((p) => {
        if (!p.published) {
          navigate('/comecar', { replace: true })
          return
        }
        setProfile(p)
      })
      .catch((e: unknown) => {
        // Sessão caída já derrubou o retrato (ver api.sessaoCaiu) e o RequireAuth
        // leva ao login sozinho — aqui não há tela a desenhar. Qualquer outra
        // falha vira mensagem: antes, o painel girava o carregador para sempre.
        if (e instanceof SessaoExpirada) return
        setErro(e instanceof Error ? e.message : 'Falha ao carregar o perfil.')
      })
  }, [navigate])

  const trust = useMemo(() => (profile ? computeTrust(profile) : null), [profile])

  // Delta desde a última visita — reforça a sensação de evolução ("ficou melhor").
  useEffect(() => {
    if (!trust) return
    try {
      const last = Number(localStorage.getItem(LAST_KEY))
      if (Number.isFinite(last)) setDelta(trust.score - last)
      localStorage.setItem(LAST_KEY, String(trust.score))
    } catch {
      /* storage indisponível */
    }
  }, [trust])

  // Voltou da assinatura: comemora uma vez e limpa o parâmetro, para o recarregar
  // não repetir a festa.
  //
  // ⚠️ TEM de ficar ACIMA do `return` de carregamento: hook depois de saída
  // antecipada só roda em alguns renders, e a contagem de hooks muda entre um e
  // outro — foi exatamente isso que deixou o painel em tela branca (React #310).
  useEffect(() => {
    if (!acabouDeAssinar) return
    setJustUpgraded(true)
    searchParams.delete('assinou')
    setSearchParams(searchParams, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [acabouDeAssinar, searchParams, setSearchParams])

  if (erro) return <FalhaAoCarregar mensagem={erro} />

  if (!profile || !trust) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  const firstName = profile.name.split(' ')[0] || 'você'
  // Passos do conteúdo básico. Os fatores que dependem de plano (agenda, selo da
  // OAB, marca, domínio) NÃO entram aqui: eles pertencem ao checklist do plano,
  // logo acima, e apareceriam duas vezes na mesma tela.
  const freeSteps = trust.next.filter((f) => !f.plan)
  const unlockedThemes = THEMES.filter((t) => isThemeUnlocked(t, profile.plan)).length


  return (
    <div className="grain min-h-dvh bg-paper-deep">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          {/* min-w-0 + shrink no logotipo: em 320px o wordmark cedia espaço para o
              CTA e os dois se sobrepunham. Agora o logo encolhe e o CTA nunca. */}
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold"
          >
            <ScaleIcon width={20} height={20} className="shrink-0 text-burgundy" />
            {/* Abaixo de 360px a balança sozinha identifica melhor que um "ad…"
                cortado — truncar um wordmark de 8 letras não economiza nada. */}
            <span className="hidden min-[360px]:inline">advoc.me</span>
            <span className="sr-only min-[360px]:hidden">advoc.me</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* !py-2.5 leva o alvo a ~40px: é o CTA principal do painel no
                celular e estava com 36px de altura. */}
            <Link
              to={`/${profile.slug}`}
              target="_blank"
              className="btn-primary !py-2.5 !px-4 text-[13px]"
            >
              Ver perfil
            </Link>
            <AccountMenu compact supportTo={comVolta('/suporte', '/painel')} />
          </div>
        </div>
      </header>

      {/* stagger: a página inteira sobe uma seção de cada vez. Uma entrada
          orquestrada vale mais que microinterações espalhadas — e é só CSS,
          desligado sozinho em prefers-reduced-motion. */}
      <main className="stagger mx-auto max-w-3xl px-5 py-8">
        <div className="flex items-center gap-4">
          <Avatar name={profile.name} src={profile.avatarUrl} size={52} />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-ink">Evolua seu perfil</h1>
            <p className="text-[14px] text-ink-soft">Olá, {firstName}. Seu perfil já está online.</p>
          </div>
        </div>

        {/* Índice de Confiança — roda que esverdeia conforme melhora */}
        <div className="mt-6 rounded-xl2 border border-ink/10 bg-paper p-6 shadow-card">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:gap-6 sm:text-left">
            <TrustGauge score={trust.score} size={152} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                Índice de confiança
              </p>
              <p className="mt-1 font-display text-[22px] font-semibold leading-tight text-ink">
                {trust.level}
              </p>
              {delta > 0 && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-brass/15 px-2.5 py-0.5 text-[12px] font-semibold text-brass-deep">
                  ▲ +{delta} desde a última visita
                </p>
              )}
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{motivator(trust.score)}</p>
            </div>
          </div>
        </div>

        {/* O que o plano abriu — só o que ainda não foi aproveitado. Some sozinho
            conforme cada item é configurado, então quem já montou o perfil vê
            apenas a novidade. */}
        <PlanChecklist profile={profile} celebrate={justUpgraded} />

        {/* Próximos passos — só o que dá pra fazer no plano atual (sem cadeados).
            Os itens de planos pagos vão para a seção de upsell abaixo. */}
        {freeSteps.length > 0 && (
          <>
            <PanelHeading>Próximos passos</PanelHeading>
            <div className="mt-3 space-y-2.5">
              {freeSteps.map((f) => (
                <StepCard key={f.key} factor={f} locked={false} profile={profile} />
              ))}
            </div>
          </>
        )}

        {/* Planos — vitrine atraente com ativação simulada (em teste, sem cobrança) */}
        {profile.plan !== 'premium' && (
          <section className="mt-10 rounded-xl2 border border-brass/25 bg-gradient-to-b from-brass/[0.06] to-transparent p-5 sm:p-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-[11.5px] font-semibold text-brass-deep">
                Em teste · todos os planos liberados
              </span>
              <h2 className="mt-3 font-display text-[22px] font-semibold text-ink">
                Leve seu perfil além
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-soft">
                Cada tópico é uma melhoria concreta no seu perfil. Ative agora, sem pagar.
              </p>
            </div>
            <div className="mt-5">
              <UpgradeTopics profile={profile} initial={openCheckout} showIncluded={false} />
            </div>
          </section>
        )}

        {/* A cara do perfil — temas (6 dos 8 são de plano pago → isca natural) */}
        <PanelHeading>A cara do seu perfil</PanelHeading>
        <Link
          to="/editor?section=aparencia"
          className="group mt-3 block rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-lift"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-[15px] font-semibold text-ink">Escolha um tema</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
                {unlockedThemes} de {THEMES.length} liberados no seu plano — os demais são do Pro e do Max.
              </p>
            </div>
            <ArrowRight
              width={16}
              height={16}
              className="shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {THEMES.map((t) => {
              const unlocked = isThemeUnlocked(t, profile.plan)
              return (
                <div
                  key={t.id}
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-ink/10"
                  style={{ background: t.swatch.bg }}
                  title={t.name}
                >
                  <span
                    className="absolute bottom-1.5 left-1.5 h-1.5 w-5 rounded-full"
                    style={{ background: t.swatch.accent }}
                  />
                  {!unlocked && (
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/45 backdrop-blur-[1px]">
                      <LockIcon width={12} height={12} strokeWidth={2} className="text-paper" />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Link>

        {/* Descubra mais — recursos que não pontuam mas ampliam o alcance */}
        <PanelHeading>Descubra mais</PanelHeading>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <DiscoverCard
            to="/editor?section=analytics"
            title="Quem visita você"
            desc="Veja quantas pessoas abriram seu perfil."
            icon={EyeIcon}
          />
          <DiscoverCard
            to="/editor?section=qrcode"
            title="Seu cartão digital"
            desc="Compartilhe seu perfil com um QR Code."
            icon={QrIcon}
          />
          <DiscoverCard
            to="/editor?section=cartao"
            title="Seu cartão de visita"
            desc="Monte a arte e leve o arquivo pronto para a gráfica."
            icon={CardIcon}
          />
          <DiscoverCard
            to="/editor?section=faq"
            title="Perguntas frequentes"
            desc="Responda as dúvidas que você mais ouve."
            icon={DocIcon}
          />
          <DiscoverCard
            to="/editor?section=video"
            title="Seu vídeo"
            desc="Cole um link do YouTube ou Vimeo — tem um passo a passo lá dentro."
            icon={PlayIcon}
          />
          <DiscoverCard
            to="/editor?section=conteudo"
            title="Documentos e privacidade"
            desc="Gere sua política de privacidade e o comprovante de conformidade."
            icon={ShieldIcon}
          />
        </div>

        {/* Escritório — criar, gerenciar ou responder a um convite */}
        <PanelHeading>Escritório</PanelHeading>
        <EscritorioCard />

        {/* Conquistados */}
        {trust.earned.length > 0 && (
          <p className="mt-6 text-center text-[12.5px] text-ink-faint">
            {trust.earned.length} {trust.earned.length === 1 ? 'item concluído' : 'itens concluídos'} ·
            você continua evoluindo quando quiser.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-ink-faint">
          <Link to="/legal" className="inline-block py-2 hover:text-ink">
            Documentos e privacidade
          </Link>
          {/* Suporte fica na área logada de propósito: é canal de cliente, não
              formulário público — e é o que permite responder a pessoa certa. */}
          <Link
            to={comVolta('/suporte', '/painel')}
            className="inline-block py-2 font-medium text-ink-faint underline-offset-4 transition-colors hover:text-burgundy hover:underline"
          >
            Achou um problema? Falar com o suporte
          </Link>
        </div>

      </main>
    </div>
  )
}

// Cabeçalho de seção no idioma da marca: versalete + filete de latão que corre
// até a margem — o mesmo timbre do perfil, trazido para o painel. Substitui o
// rótulo cinza solto, que não dizia de que produto aquela tela era.
function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-9 flex items-center gap-3 px-1">
      <span className="shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brass-deep">
        {children}
      </span>
      <span className="rule-brass h-px flex-1 opacity-50" />
    </h2>
  )
}

function DiscoverCard({
  to,
  title,
  desc,
  icon: Icon,
}: {
  to: string
  title: string
  desc: string
  icon: (p: { width?: number; height?: number; className?: string }) => JSX.Element
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl2 border border-ink/10 bg-paper/60 p-4 transition-[transform,border-color,background-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-brass/50 hover:bg-paper hover:shadow-card"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brass/25 bg-brass/[0.07] text-brass-deep transition-colors group-hover:bg-brass/15"
        aria-hidden
      >
        <Icon width={17} height={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[14.5px] font-semibold leading-tight text-ink">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-soft">{desc}</span>
      </span>
      <ArrowRight
        width={15}
        height={15}
        className="shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5"
      />
    </Link>
  )
}

// Um passo do painel. A miniatura da esquerda mostra O QUE o passo produz (os
// logos das redes, o próprio avatar, o botão de WhatsApp) e a linha de baixo diz
// o que muda para quem visita. Antes eram todos a mesma caixa com o mesmo chip de
// pontos: uma lista onde nada se distinguia e nada dava vontade de tocar.
function StepCard({
  factor,
  locked,
  profile,
}: {
  factor: TrustFactor
  locked: boolean
  profile: Profile
}) {
  const to = DEST[factor.key] ?? '/editor?section=identidade'
  const hint = STEP_HINT[factor.key]
  return (
    <Link
      to={to}
      className="group flex items-center gap-3.5 rounded-xl2 border border-ink/10 bg-paper p-3.5 shadow-card transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-lift sm:p-4"
    >
      <StepArt factorKey={factor.key} profile={profile} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-[15px] font-semibold leading-tight text-ink">
            {factor.action}
          </span>
          <span className="text-[11.5px] font-semibold tabular-nums text-brass-deep">
            +{factor.points}
          </span>
          {factor.plan && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              {locked && <LockIcon width={10} height={10} />}
              {factor.plan === 'premium' ? 'Max' : 'Pro'}
            </span>
          )}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">{hint}</span>
        )}
      </span>
      <ArrowRight
        width={16}
        height={16}
        className="shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-burgundy"
      />
    </Link>
  )
}
