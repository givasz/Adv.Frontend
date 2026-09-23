import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { computeTrust, type TrustFactor } from '@/lib/trustScore'
import { resolveSchedulingMode } from '@/lib/booking'
import { canUseContratos } from '@/lib/plans'
import { PLAN_LABEL } from '@/lib/upsell'
import { DESTINO_DO_FATOR, SECTIONS_BY_GROUP, editorPath } from '@/lib/editorSections'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { UpgradeTopics } from '@/components/editor/UpgradeTopics'
import { PlanChecklist } from '@/components/editor/PlanChecklist'
import { AvisoCobranca } from '@/components/editor/AvisoCobranca'
import { AvisoDoSuporte } from '@/components/painel/AvisoDoSuporte'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { TrustGauge } from '@/components/ui/TrustGauge'
import { comVolta } from '@/components/ui/SubPage'
import { Avatar } from '@/components/ui/Avatar'
import { ArrowRight, CalendarIcon, CheckIcon, MessageIcon, PenIcon, ShareIcon } from '@/components/ui/icons'
import { StepArt, STEP_HINT } from '@/components/painel/StepArt'
import { AgendaCard } from '@/components/painel/AgendaCard'
import { EscritorioCard } from '@/components/painel/EscritorioCard'
import { PainelHero } from '@/components/painel/PainelHero'
import { SecaoAtalho, SecaoLinha } from '@/components/painel/SecaoTile'
import { VisitasTile } from '@/components/painel/VisitasTile'
import { Atalho, Grupo, ListaEmCartao, SeloDoPlano } from '@/components/painel/pecas'
import { Marca } from '@/components/ui/Marca'
import { TrocaDePainel } from '@/components/painel/TrocaDePainel'

const LAST_KEY = 'advocme:trust:last'

// Frase de incentivo conforme o índice — tom profissional, sem gamificação infantil.
function motivator(score: number): string {
  if (score >= 90) return 'Parabéns — seu perfil está excelente.'
  if (score >= 75) return 'Seu perfil já transmite muita confiança.'
  if (score >= 60) return 'Falta pouco para um perfil muito forte.'
  if (score >= 40) return 'Bom começo. Cada passo aumenta sua credibilidade.'
  return 'Vamos deixar seu perfil mais completo.'
}

// O PAINEL responde, de cima para baixo, a perguntas — e cada cartão mora na
// resposta a que pertence (repaginado em 23/09/2026; antes eram 25 cartões do
// mesmo peso empilhados, e a agenda da semana pesava o mesmo que o botão
// flutuante):
//
//   1. Como está o meu link?      → a CAPA: endereço, "no ar" e editar/copiar/ver.
//      O que falta nele?          → o Índice de Confiança, com os passos dentro.
//   2. O que eu faço toda semana? → agenda do assistente, agenda digital, pedidos.
//   3. Como chego a mais gente?   → visitas, compartilhar, story, QR.
//   4. O que uso com o cliente?   → cartão impresso, contratos, documentos.
//   5. E cada parte do perfil?    → uma LISTA num cartão só (muito, visitado pouco).
//   6. E o meu plano?             → o que o plano abriu e ainda não foi usado; oferta.
//   7. Escritório.
//
// Cobrança e resposta do suporte, quando existem, vêm antes de tudo: são as
// únicas coisas que a pessoa não descobre sozinha olhando a própria página.
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

  const firstName = profile.name.split(' ')[0] || ''
  const max = profile.plan === 'premium'
  // Com o assistente ligado a agenda ganha três cartões em "Toda semana"; sem
  // ele, dois — e a grade acompanha, para não sobrar buraco.
  const assistente = resolveSchedulingMode(profile) === 'assistant'
  const secoesDoPerfil = SECTIONS_BY_GROUP.perfil

  return (
    <div className="grain min-h-dvh overflow-x-clip bg-paper-deep">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
        {/* min-w-0 no logotipo: em 280px o wordmark cede espaço ao menu da conta. */}
        <Link to="/" className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold text-ink">
          <Marca size={28} />
          {/* Abaixo de 340px a balança sozinha identifica melhor que um "ad…"
              cortado — truncar um wordmark de 8 letras não economiza nada. */}
          <span className="hidden min-[340px]:inline">advoc.me</span>
          <span className="sr-only min-[340px]:hidden">advoc.me</span>
        </Link>
        <AccountMenu
          compact
          perfilTo={`/${profile.slug}`}
          supportTo={comVolta('/suporte', '/painel')}
          avatarUrl={profile.avatarUrl}
        />
      </header>

      {/* stagger: a página inteira sobe uma seção de cada vez. Uma entrada
          orquestrada vale mais que microinterações espalhadas — e é só CSS,
          desligado sozinho em prefers-reduced-motion. */}
      <main className="stagger mx-auto w-full max-w-3xl space-y-9 px-4 pb-16 pt-2 sm:space-y-11 sm:px-5 sm:pt-4">
        {/* Saudação + plano. O plano é um carimbo que leva à seção do plano. */}
        <div className="space-y-5">
          {/* Só para quem administra um escritório: a porta do painel da sociedade. */}
          <TrocaDePainel atual="pessoal" />
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <Avatar name={profile.name} src={profile.avatarUrl} size={52} />
              <div className="min-w-0">
                <p className="eyebrow">Painel</p>
                <h1 className="mt-1 truncate font-display text-[26px] font-semibold leading-tight tracking-tight text-ink xs:text-[30px] sm:text-[34px]">
                  {firstName ? `Olá, ${firstName}.` : 'Olá.'}
                </h1>
              </div>
            </div>
            <Link
              to={editorPath('plano')}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-ink/25 bg-paper-soft px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ink/50 hover:text-ink"
            >
              Plano {PLAN_LABEL[profile.plan]}
            </Link>
          </div>

          {/* Situação da cobrança — antes de tudo. Se o pagamento falhou, é a
              primeira coisa que a pessoa precisa saber. Some sozinha quando não
              há nada a dizer (ver lib/assinatura.ts). */}
          <AvisoCobranca profile={profile} />
          {/* Resposta do suporte que a pessoa ainda não leu — some depois de lida. */}
          <AvisoDoSuporte />

          {/* Acabou de assinar: o que abriu vem primeiro, com festa. Nos outros
              dias o mesmo checklist mora em "Seu plano". */}
          {justUpgraded && <PlanChecklist profile={profile} celebrate className="" />}

          <PainelHero profile={profile} />
          <IndiceCard profile={profile} score={trust.score} level={trust.level} delta={delta} next={trust.next} />
        </div>

        <Grupo titulo="Toda semana" subtitulo="Horários e pedidos de reunião.">
          <div className={`grid gap-3 ${assistente ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <AgendaCard profile={profile} coluna />
            <Atalho
              to="/agenda-digital"
              Icone={CalendarIcon}
              titulo="Agenda digital"
              texto="Seus compromissos, com cada um indo para o calendário do celular."
              selo={max ? undefined : 'Max'}
              coluna={assistente}
            />
            <Atalho
              to="/agenda-digital?tab=solicitacoes"
              Icone={MessageIcon}
              titulo="Pedidos de reunião"
              texto="Responda pelo WhatsApp ou e-mail e registre se confirmou."
              selo={max ? undefined : 'Max'}
              coluna={assistente}
            />
          </div>
        </Grupo>

        <Grupo titulo="Divulgue" subtitulo="O que leva gente nova ao seu perfil.">
          <div className="grid gap-3 sm:grid-cols-2">
            <VisitasTile />
            <Atalho
              to={comVolta(`/${profile.slug}/compartilhar`, '/painel')}
              Icone={ShareIcon}
              titulo="Compartilhar"
              texto="O link com um QR grande, para mostrar na tela ou mandar."
            />
            <SecaoAtalho id="story" profile={profile} />
            <SecaoAtalho id="qrcode" profile={profile} />
          </div>
        </Grupo>

        <Grupo titulo="Com o cliente" subtitulo="Do cartão entregue ao contrato assinado.">
          <div className="grid gap-3 sm:grid-cols-3">
            <SecaoAtalho id="cartao" profile={profile} coluna />
            <Atalho
              to={comVolta('/contratos', '/painel')}
              titulo="Contratos e procurações"
              texto="A minuta a partir de um modelo, com o registro do PDF."
              Icone={PenIcon}
              selo={canUseContratos(profile.plan) ? undefined : 'Max'}
              coluna
            />
            <SecaoAtalho id="conteudo" profile={profile} coluna />
          </div>
        </Grupo>

        {/* Seu perfil — uma linha por seção, com o que está preenchido. É daqui
            que se controla cada parte depois que o índice já não tem passos. */}
        <Grupo titulo="Seu perfil" subtitulo="Cada parte do que o visitante vê.">
          <ListaEmCartao impar={secoesDoPerfil.length % 2 === 1}>
            {secoesDoPerfil.map((id) => (
              <SecaoLinha key={id} id={id} profile={profile} />
            ))}
          </ListaEmCartao>
        </Grupo>

        <Grupo titulo="Seu plano" subtitulo={max ? 'Tudo aberto no Max.' : 'O que muda no Pro e no Max.'}>
          <div className="space-y-4">
            {/* O que o plano abriu — só o que ainda não foi aproveitado. Some
                sozinho conforme cada item é configurado. */}
            {!justUpgraded && <PlanChecklist profile={profile} limite={3} className="" />}

            {/* Planos — cada tópico mostra a prova do que muda; o checkout faz o resto */}
            {!max && (
              <section className="card-paper p-4 sm:p-6">
                <h3 className="font-display text-[20px] font-semibold leading-tight text-ink sm:text-[22px]">
                  Leve seu perfil além
                </h3>
                <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-faint">
                  Cada tópico é uma melhoria concreta no seu perfil. Cobrança mensal, troque ou cancele
                  quando quiser.
                </p>
                <div className="mt-4">
                  <UpgradeTopics profile={profile} initial={openCheckout} showIncluded={false} />
                </div>
              </section>
            )}
          </div>
        </Grupo>

        {/* Escritório — criar, gerenciar ou responder a um convite */}
        <Grupo titulo="Escritório" subtitulo="A página da sociedade e os convites.">
          <EscritorioCard />
        </Grupo>

        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-ink/10 pt-6 text-[13px] text-ink-faint">
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
            className="inline-block py-2 font-medium underline-offset-4 transition-colors hover:text-burgundy hover:underline"
          >
            Achou um problema? Falar com o suporte
          </Link>
        </footer>
      </main>
    </div>
  )
}

// O Índice de Confiança com os próximos passos DENTRO: o número e o que fazer
// para ele subir são uma coisa só. Os fatores que dependem de plano (agenda,
// marca) NÃO entram aqui: eles pertencem a "Seu plano", e apareceriam duas
// vezes na mesma tela.
function IndiceCard({
  profile,
  score,
  level,
  delta,
  next,
}: {
  profile: Profile
  score: number
  level: string
  delta: number
  next: TrustFactor[]
}) {
  const passos = next.filter((f) => !f.plan)
  return (
    <section aria-label="Índice de confiança" className="card-paper overflow-hidden">
      {/* Abaixo de 340px o anel sobe e o texto ganha a largura toda — lado a
          lado, "Índice de confiança" quebrava em três linhas. */}
      <div className="flex flex-col items-start gap-3 p-4 min-[340px]:flex-row min-[340px]:items-center min-[340px]:gap-4 sm:gap-5 sm:p-6">
        <TrustGauge score={score} size={84} stroke={8} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Índice de confiança</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-[19px] font-semibold leading-tight text-ink sm:text-[21px]">{level}</span>
            {delta > 0 && (
              <span className="inline-flex items-center rounded-[4px] bg-brass/15 px-1.5 py-0.5 text-[11.5px] font-semibold text-brass-deep">
                ▲ +{delta}
                <span className="sr-only"> desde a última visita</span>
              </span>
            )}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-faint sm:text-[13px]">{motivator(score)}</p>
        </div>
      </div>

      {passos.length > 0 ? (
        <div className="border-t border-ink/[0.09]">
          <h3 className="flex items-center justify-between gap-3 px-4 pb-1 pt-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-deep sm:px-6">
            Próximos passos
            <span className="font-medium normal-case tracking-normal text-ink-faint">
              {passos.length} {passos.length === 1 ? 'item' : 'itens'}
            </span>
          </h3>
          <ul className="divide-y divide-ink/[0.07]">
            {passos.map((f) => (
              <li key={f.key}>
                <StepRow factor={f} profile={profile} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-start gap-2 border-t border-ink/[0.09] px-4 py-3.5 text-[13px] leading-snug text-ink-soft sm:px-6">
          <CheckIcon width={15} height={15} strokeWidth={2.4} className="mt-px shrink-0 text-emerald-700" />
          {next.length === 0
            ? 'Perfil completo — não há mais nada a preencher.'
            : 'Tudo que o seu plano deixa preencher já está preenchido. Os pontos que faltam abrem com o Pro e o Max.'}
        </p>
      )}
    </section>
  )
}

// Um passo do índice. A miniatura da esquerda mostra O QUE o passo produz (os
// logos das redes, o próprio avatar, o botão de WhatsApp) e a linha de baixo diz
// o que muda para quem visita. O destino é o CAMPO, não a seção: "Adicionar
// foto" abre o editor já rolado até a foto.
function StepRow({ factor, profile }: { factor: TrustFactor; profile: Profile }) {
  const to = DESTINO_DO_FATOR[factor.key] ?? editorPath('identidade')
  const hint = STEP_HINT[factor.key]
  return (
    <Link
      to={to}
      className="group flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-paper sm:px-6"
    >
      {/* A miniatura sai abaixo de 340px: 52px dela deixavam o texto com 150. */}
      <span className="hidden min-[340px]:contents">
        <StepArt factorKey={factor.key} profile={profile} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-[15px] font-semibold leading-tight text-ink">{factor.action}</span>
          <span className="text-[11.5px] font-semibold tabular-nums text-brass-deep">+{factor.points}</span>
          {factor.plan && <SeloDoPlano plano={factor.plan === 'premium' ? 'Max' : 'Pro'} />}
        </span>
        {hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-faint">{hint}</span>}
      </span>
      <ArrowRight
        width={16}
        height={16}
        className="shrink-0 text-ink-faint transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:text-burgundy"
      />
    </Link>
  )
}
