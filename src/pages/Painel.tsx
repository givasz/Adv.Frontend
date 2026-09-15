import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { computeTrust, type TrustFactor } from '@/lib/trustScore'
import { resolveSchedulingMode } from '@/lib/booking'
import { canUseContratos } from '@/lib/plans'
import { DESTINO_DO_FATOR, SECTIONS_BY_GROUP, editorPath } from '@/lib/editorSections'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { UpgradeTopics } from '@/components/editor/UpgradeTopics'
import { PlanChecklist } from '@/components/editor/PlanChecklist'
import { AvisoCobranca } from '@/components/editor/AvisoCobranca'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { TrustGauge } from '@/components/ui/TrustGauge'
import { comVolta } from '@/components/ui/SubPage'
import { ArrowRight, CheckIcon, LockIcon, PenIcon } from '@/components/ui/icons'
import { StepArt, STEP_HINT } from '@/components/painel/StepArt'
import { AgendaCard } from '@/components/painel/AgendaCard'
import { EscritorioCard } from '@/components/painel/EscritorioCard'
import { PainelHero } from '@/components/painel/PainelHero'
import { SecaoTile, Tile } from '@/components/painel/SecaoTile'
import { VisitasTile } from '@/components/painel/VisitasTile'
import { Marca } from '@/components/ui/Marca'

const LAST_KEY = 'advocme:trust:last'

// Frase de incentivo conforme o índice — tom profissional, sem gamificação infantil.
function motivator(score: number): string {
  if (score >= 90) return 'Parabéns — seu perfil está excelente.'
  if (score >= 75) return 'Seu perfil já transmite muita confiança.'
  if (score >= 60) return 'Falta pouco para um perfil muito forte.'
  if (score >= 40) return 'Bom começo. Cada passo aumenta sua credibilidade.'
  return 'Vamos deixar seu perfil mais completo.'
}

// A ordem do painel, de cima para baixo, segue a frequência com que cada coisa
// é usada:
//   1. quem é + link do perfil + editar/compartilhar (todo dia)
//   2. cobrança, só quando há algo a dizer
//   3. Índice de Confiança com os próximos passos dentro dele
//   4. a agenda, a única tarefa que se repete toda semana
//   5. "Seu perfil": um cartão por seção, com o que está preenchido
//   6. ferramentas: visitas, QR, cartão, contratos, documentos
//   7. o que o plano abriu e ainda não foi usado; planos; escritório
export default function Painel() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [delta, setDelta] = useState(0)
  // true logo depois de confirmar uma assinatura — o checklist do que abriu
  // sobe para o alto da página com tom de celebração (some ao recarregar).
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
    document.title = 'Seu painel · advoc.me'
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

  // Passos do conteúdo básico. Os fatores que dependem de plano (agenda, marca)
  // NÃO entram aqui: eles pertencem ao checklist do plano e à vitrine de planos,
  // e apareceriam duas vezes na mesma tela.
  const freeSteps = trust.next.filter((f) => !f.plan)
  // Com o assistente ligado a agenda tem o cartão grande logo abaixo do índice;
  // repetir o cartão pequeno na grade seria a mesma porta duas vezes.
  const agendaEmDestaque = resolveSchedulingMode(profile) === 'assistant'
  const secoesDoPerfil = SECTIONS_BY_GROUP.perfil.filter((id) => id !== 'agenda' || !agendaEmDestaque)

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
            <Marca size={29} />
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
            <AccountMenu
              compact
              perfilTo={`/${profile.slug}`}
              supportTo={comVolta('/suporte', '/painel')}
              avatarUrl={profile.avatarUrl}
            />
          </div>
        </div>
      </header>

      {/* stagger: a página inteira sobe uma seção de cada vez. Uma entrada
          orquestrada vale mais que microinterações espalhadas — e é só CSS,
          desligado sozinho em prefers-reduced-motion. */}
      <main className="stagger mx-auto max-w-3xl px-5 py-8">
        <PainelHero profile={profile} />

        {/* Situação da cobrança — antes de tudo. Se o pagamento falhou, é a primeira
            coisa que a pessoa precisa saber, e é a única que ela não descobre
            sozinha olhando a própria página. Some sozinha quando não há nada a
            dizer (ver lib/assinatura.ts). */}
        <AvisoCobranca profile={profile} className="mt-6" />

        {/* Acabou de assinar: o que abriu vem primeiro, com festa. Nos outros
            dias o mesmo checklist mora mais abaixo, depois das ferramentas. */}
        {justUpgraded && <PlanChecklist profile={profile} celebrate />}

        {/* Índice de Confiança — acima de tudo, com os próximos passos dentro:
            o número e o que fazer para ele subir são uma coisa só. */}
        <section className="mt-6 overflow-hidden rounded-xl2 border border-ink/10 bg-paper shadow-card">
          <div className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:gap-6 sm:text-left">
            <TrustGauge score={trust.score} size={140} />
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

          {freeSteps.length > 0 ? (
            <div className="border-t border-ink/[0.07] bg-paper-soft/60 px-4 py-4 sm:px-5">
              <h2 className="px-1 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brass-deep">
                Próximos passos
              </h2>
              <div className="mt-2.5 space-y-2.5">
                {freeSteps.map((f) => (
                  <StepCard key={f.key} factor={f} profile={profile} />
                ))}
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 border-t border-ink/[0.07] px-6 py-3.5 text-[13px] text-ink-soft">
              <CheckIcon width={15} height={15} strokeWidth={2.4} className="shrink-0 text-brass-deep" />
              {trust.next.length === 0
                ? 'Perfil completo — não há mais nada a preencher.'
                : 'Tudo que o seu plano deixa preencher já está preenchido. Os pontos que faltam abrem com o Pro e o Max.'}
            </p>
          )}
        </section>

        {/* A agenda — logo abaixo do índice. É a única tarefa recorrente do painel. */}
        <AgendaCard profile={profile} />

        {/* Seu perfil — um cartão por seção, com o que está preenchido. É daqui
            que se controla o perfil depois que o índice já não tem passos. */}
        <PanelHeading>Seu perfil</PanelHeading>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {secoesDoPerfil.map((id) => (
            <SecaoTile key={id} id={id} profile={profile} />
          ))}
        </div>

        {/* Ferramentas — o que se TIRA do perfil: relatório, QR, cartão, documentos. */}
        <PanelHeading>Ferramentas</PanelHeading>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <VisitasTile />
          <SecaoTile id="story" profile={profile} />
          <SecaoTile id="qrcode" profile={profile} />
          <SecaoTile id="cartao" profile={profile} />
          <Tile
            to={comVolta('/contratos', '/painel')}
            title="Contratos e procurações"
            texto="Monte a minuta a partir de um modelo, revise e registre a impressão digital do PDF."
            icon={PenIcon}
            selo={canUseContratos(profile.plan) ? undefined : 'Max'}
          />
          <SecaoTile id="conteudo" profile={profile} />
        </div>

        {/* O que o plano abriu — só o que ainda não foi aproveitado. Some sozinho
            conforme cada item é configurado, então quem já montou o perfil vê
            apenas a novidade. */}
        {!justUpgraded && <PlanChecklist profile={profile} />}

        {/* Planos — cada tópico mostra a prova do que muda; o checkout faz o resto */}
        {profile.plan !== 'premium' && (
          <section className="mt-10 rounded-xl2 border border-brass/25 bg-gradient-to-b from-brass/[0.06] to-transparent p-5 sm:p-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-[11.5px] font-semibold text-brass-deep">
                Planos Pro e Max
              </span>
              <h2 className="mt-3 font-display text-[22px] font-semibold text-ink">
                Leve seu perfil além
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-soft">
                Cada tópico é uma melhoria concreta no seu perfil. Cobrança mensal, troque ou
                cancele quando quiser.
              </p>
            </div>
            <div className="mt-5">
              <UpgradeTopics profile={profile} initial={openCheckout} showIncluded={false} />
            </div>
          </section>
        )}

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
          <Link to={editorPath('plano')} className="inline-block py-2 hover:text-ink">
            Seu plano
          </Link>
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
// até a margem — o mesmo timbre do perfil, trazido para o painel.
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

// Um passo do índice. A miniatura da esquerda mostra O QUE o passo produz (os
// logos das redes, o próprio avatar, o botão de WhatsApp) e a linha de baixo diz
// o que muda para quem visita. O destino é o CAMPO, não a seção: "Adicionar
// foto" abre o editor já rolado até a foto.
function StepCard({ factor, profile }: { factor: TrustFactor; profile: Profile }) {
  const to = DESTINO_DO_FATOR[factor.key] ?? editorPath('identidade')
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
              <LockIcon width={10} height={10} />
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
