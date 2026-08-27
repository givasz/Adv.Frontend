import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  GenerateKind,
  ModerationStatus,
  Plan,
  PracticeArea,
  Profile,
  SocialKind,
} from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { allAreas } from '@/lib/mockData'
import { slugify } from '@/lib/brFormat'
import { checkCompliance, OAB_GUIDANCE_BY_FIELD } from '@/lib/oab'
import { validateSocialUrl } from '@/lib/socials'
import { getTheme, isThemeUnlocked, THEMES, type ThemeId } from '@/lib/themes'
import {
  AREA_LABEL_MAX,
  CHAR_LIMITS,
  FAQ_ANSWER_MAX,
  NAME_MAX,
  canUseFaq,
  canUseDigitalCard,
  canUsePrintCard,
  canUseScheduling,
  canUseVideo,
} from '@/lib/plans'
import { areaQuota, charQuota, featurePoints, nextPlan, type UpsellFeature } from '@/lib/upsell'
import { comVolta } from '@/components/ui/SubPage'
import { fitToLimit } from '@/lib/textLimit'
import { useSlugCheck } from '@/lib/useSlugCheck'
import { hostLabel } from '@/lib/publicUrl'
import { canUseAi } from '@/lib/aiFeatures'
import { PhonePreview } from '@/components/editor/PhonePreview'
import { AiButton, AiGenerator } from '@/components/editor/AiGenerator'
import { Card, Field, TextArea, TextInput, Toggle } from '@/components/editor/fields'
import { InfoTip } from '@/components/editor/InfoTip'
import { PlanShowcase } from '@/components/editor/PlanShowcase'
import { PlanChecklist } from '@/components/editor/PlanChecklist'
import { FaqCard } from '@/components/editor/FaqCard'
import { VideoCard } from '@/components/editor/VideoCard'
import { ThemePicker } from '@/components/editor/ThemePicker'
import { ThemeTrialBar } from '@/components/editor/ThemeTrialBar'
import { LegalDocsCard } from '@/components/editor/LegalDocsCard'
import { AuditReportCard } from '@/components/editor/AuditReportCard'
import { BrandingCard } from '@/components/editor/BrandingCard'
import { SchedulingCard } from '@/components/editor/SchedulingCard'
import { MarginNotes } from '@/components/editor/MarginNotes'
import { AvatarUpload } from '@/components/editor/AvatarUpload'
import { DigitalCard } from '@/components/editor/DigitalCard'
import { CARD_PREVIEW, CardStudio } from '@/components/editor/CardStudio'
import { UpsellCard } from '@/components/editor/UpsellCard'
import { GhostSlot, LockedFeature, QuotaCounter } from '@/components/editor/upsellBits'
import { OabNumberInput, UfSelect, WhatsappInput } from '@/components/editor/inputs'
import { LockIcon, ScaleIcon, SparkIcon, TrashIcon } from '@/components/ui/icons'
import { socialMeta } from '@/components/ui/icons'

type AiTarget = {
  kind: GenerateKind
  areaId?: string
  areaLabel?: string
  currentText?: string
  /** pergunta que recebe a resposta gerada (kind === 'faq') */
  faqId?: string
} | null
type SectionId =
  | 'identidade'
  | 'bio'
  | 'redes'
  | 'agenda'
  | 'aparencia'
  | 'marca'
  | 'faq'
  | 'video'
  | 'conteudo'
  | 'analytics'
  | 'qrcode'
  | 'cartao'
  | 'plano'

let uid = 0
const nextId = () => `id-${Date.now()}-${uid++}`

// Vídeo institucional do Judiciário usado só como espectro sob o cadeado da
// seção de vídeo — nunca é salvo no perfil de ninguém.
const PREVIEW_VIDEO_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'

// Conteúdo de exemplo mostrado BORRADO sob o cadeado da seção de FAQ: serve só
// para o advogado ver o formato do que teria. Nunca é salvo em perfil nenhum.
const PREVIEW_FAQS = [
  {
    id: 'preview-1',
    question: 'Quanto tempo demora um inventário?',
    answer:
      'Depende da via escolhida e da documentação. Em cartório, com todos de acordo e documentos em ordem, costuma ser mais rápido que na Justiça. Cada caso exige análise própria.',
  },
  {
    id: 'preview-2',
    question: 'Preciso ir ao fórum para me divorciar?',
    answer:
      'Nem sempre. Havendo consenso e sem incapazes, o divórcio pode ser feito em cartório, com assistência de advogado. Cada situação precisa ser avaliada.',
  },
]

// Cada seção do editor é um passo do assistente, aberto a partir de um card do painel.
// Título e subtítulo conversam com o advogado — nada de "Configurações".
const SECTIONS: Record<SectionId, { title: string; subtitle: string }> = {
  identidade: { title: 'Seu perfil', subtitle: 'Seus dados e como você aparece para quem chega.' },
  bio: { title: 'Sua apresentação', subtitle: 'Poucas linhas sobre você. A IA pode começar.' },
  redes: { title: 'Seus canais', subtitle: 'Por onde os clientes falam com você.' },
  agenda: { title: 'Sua agenda', subtitle: 'Deixe que marquem um horário direto no perfil.' },
  aparencia: { title: 'A cara do perfil', subtitle: 'Escolha um visual que combine com você.' },
  marca: { title: 'Sua marca', subtitle: 'Domínio próprio e identidade sem a marca advoc.me.' },
  faq: {
    title: 'Perguntas frequentes',
    subtitle: 'As dúvidas que você mais ouve, respondidas por você no perfil.',
  },
  video: {
    title: 'Seu vídeo',
    subtitle: 'Um vídeo curto de apresentação no fim do perfil — do YouTube ou do Vimeo.',
  },
  conteudo: { title: 'Documentos', subtitle: 'Reúna seus termos legais e a política de privacidade.' },
  analytics: { title: 'Quem visita você', subtitle: 'Descubra como as pessoas encontram seu perfil.' },
  qrcode: { title: 'Seu cartão digital', subtitle: 'Um QR Code para compartilhar onde quiser.' },
  cartao: {
    title: 'Seu cartão de visita',
    subtitle: 'A arte do seu cartão, pronta para levar à gráfica.',
  },
  plano: { title: 'Seu plano', subtitle: 'Troque quando quiser. Mais recursos, mais alcance.' },
}

const SECTION_IDS = Object.keys(SECTIONS) as SectionId[]

export default function Editor() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ai, setAi] = useState<AiTarget>(null)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  // Upsell e checkout deixaram de ser modais: viram páginas (/planos, /assinar).
  // Antes de sair do editor é preciso DESCARREGAR o que está em voo, senão os
  // últimos caracteres digitados morrem com a tela (mesmo motivo do "Pronto").
  // Tema travado que o advogado está PROVANDO: entra só na prévia, nunca no
  // rascunho. Deixar experimentar antes de pedir a assinatura é o que transforma
  // um cadeado em vontade — o cadeado continua, mas no salvar.
  const [tryTheme, setTryTheme] = useState<ThemeId | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const sectionParam = searchParams.get('section')
  const section: SectionId = SECTION_IDS.includes(sectionParam as SectionId)
    ? (sectionParam as SectionId)
    : 'identidade'

  useEffect(() => {
    api
      .getDraft()
      .then((d) => {
        // Auto-correção de endereço órfão: um slug auto-gerado (nome-1234, do tempo
        // de Free) que não foi personalizado à mão e não bate mais com o nome atual
        // volta a seguir o nome. Evita mostrar o nome antigo depois de renomear.
        if (!d.slugCustom && d.plan !== 'free' && /-\d{4}$/.test(d.slug) && d.slug !== slugify(d.name)) {
          setProfile({ ...d, slug: slugify(d.name) })
          return
        }
        setProfile(d)
      })
      .catch((e: unknown) => {
        // Sessão caída → o RequireAuth devolve ao login. Falha do servidor vira
        // tela de erro: o editor ficava girando o carregador para sempre.
        if (e instanceof SessaoExpirada) return
        setLoadError(e instanceof Error ? e.message : 'Falha ao carregar seu perfil.')
      })
    document.title = 'Editar · advoc.me'
  }, [])

  // Salva com debounce quando o rascunho muda. O que está em voo fica no `pending`
  // para poder ser DESCARREGADO na saída: quem digitava e clicava em "Pronto" na
  // sequência perdia os últimos caracteres — o timer morria com a tela e o texto
  // nunca chegava ao servidor. Era isso que fazia uma área recém-digitada "não
  // aparecer depois".
  const pending = useRef<Profile | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(async (draft: Profile) => {
    try {
      const saved = await api.saveDraft(draft)
      // Só limpa o pendente se nada novo entrou na fila enquanto salvávamos.
      if (pending.current === draft) pending.current = null
      setSaveState('saved')
      if (saved?.slug) {
        setProfile((p) => (p && p.slug !== saved.slug ? { ...p, slug: saved.slug } : p))
      }
      return saved
    } catch (e) {
      // Falha de rede ou recusa do servidor NÃO pode passar por "Tudo salvo".
      setSaveState('error')
      setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar agora.')
      return null
    }
  }, [])

  /** Grava agora o que estiver em voo. Chamado antes de sair do editor. */
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const draft = pending.current
    if (!draft) return
    setSaveState('saving')
    await persist(draft)
  }, [persist])

  useEffect(() => {
    if (!profile) return
    pending.current = profile
    setSaveState('saving')
    setSaveError(null)
    timer.current = setTimeout(() => {
      timer.current = null
      void persist(profile)
    }, 700)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [profile, persist])

  // Fechar/recarregar a aba com algo por salvar pede confirmação — o navegador não
  // espera um fetch pendente, e perder texto em silêncio é o pior desfecho possível.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!pending.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Sair da aparência encerra a prova: nas outras seções a prévia tem de mostrar o
  // perfil como ele está de verdade.
  useEffect(() => {
    if (section !== 'aparencia') setTryTheme(null)
  }, [section])

  const bioIssues = useMemo(() => (profile ? checkCompliance(profile.bio) : []), [profile])

  if (loadError) return <FalhaAoCarregar mensagem={loadError} />

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  const set = (patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p))
  // A troca de plano passa pelo servidor (api.setPlan) e o resultado dele é adotado
  // como novo estado: quem manda é a assinatura vigente, não o objeto local. Sem
  // isso, o recurso "comprado" destravava só na tela e voltava a travar no reload.
  // Hoje só o DOWNGRADE passa por aqui — assinar acontece em /assinar/:plano.
  const changePlan = async (plan: Plan) => {
    // Grava o que estiver em voo antes de trocar: setPlan devolve o perfil do
    // servidor e nós o adotamos por inteiro — sem este flush, os últimos
    // caracteres digitados (ainda no debounce) seriam sobrescritos.
    await api.saveDraft(profile)
    const saved = await api.setPlan(plan)
    // Quem assinou provando um tema fica com ele: obrigar a escolher de novo
    // depois de pagar seria perder justamente o que motivou a compra.
    const wanted = tryTheme && isThemeUnlocked(getTheme(tryTheme), plan) ? tryTheme : saved.theme
    // Tema de plano superior não sobrevive a um downgrade — volta ao neutro.
    const theme = isThemeUnlocked(getTheme(wanted), plan) ? wanted : 'papel'
    setProfile({ ...saved, theme })
    setTryTheme(null)
  }
  const lim = CHAR_LIMITS[profile.plan]

  // Abre o gerador de IA se o plano permite o recurso; senão, abre o upsell.
  function openAi(target: NonNullable<AiTarget>) {
    if (canUseAi(target.kind, profile!.plan)) setAi(target)
    else abrirUpsell('ai')
  }

  // Teto de caracteres do campo que vai receber o texto. É o mesmo número que o
  // servidor cobra no save — passa para a IA no pedido e corta na aplicação.
  function aiLimit(target: NonNullable<AiTarget>): number {
    if (target.kind === 'faq') return FAQ_ANSWER_MAX
    if (target.kind === 'headline') return lim.headline
    if (target.kind === 'area') return lim.areaDesc
    return lim.bio // bio e improve
  }

  function applyAi(text: string) {
    if (!ai) return
    // Corte final: nada aplicado pode estourar o limite do campo. Sem isto, um
    // texto generoso da IA travava TODO o save do perfil com "excede o limite".
    const texto = fitToLimit(text, aiLimit(ai))
    if (ai.kind === 'bio' || ai.kind === 'improve') set({ bio: texto })
    else if (ai.kind === 'headline') set({ headline: texto.replace(/[.]+$/, '').trim() })
    else if (ai.kind === 'area')
      set({ areas: profile!.areas.map((a) => (a.id === ai.areaId ? { ...a, description: texto } : a)) })
    else if (ai.kind === 'faq')
      set({
        faqs: (profile!.faqs ?? []).map((f) => (f.id === ai.faqId ? { ...f, answer: texto } : f)),
      })
  }

  /** Endereço atual do editor — é para cá que as subpáginas devolvem a pessoa. */
  const aqui = `/editor?section=${section}`

  /** Sai do editor para uma subpágina, gravando o que estiver em voo. */
  async function irPara(destino: string) {
    await flush()
    navigate(destino)
  }

  /** Abre a comparação de planos focada no recurso que bateu o limite. */
  function abrirUpsell(feature: UpsellFeature) {
    void irPara(
      comVolta(`/planos?recurso=${feature}&plano=${profile!.plan}`, aqui),
    )
  }

  // Sair do editor GRAVA o que estiver em voo antes de navegar. Se o servidor
  // recusar, ficamos na tela com o aviso — sair calado perderia o texto.
  async function sairParaPainel() {
    // Na primeira falha o editor SEGURA a saída e mostra o aviso. Se a pessoa
    // insistir, ela sai: ficar presa numa tela que não grava é pior do que perder
    // a alteração — e o aviso já disse o que aconteceu.
    const jaAvisado = saveState === 'error'
    await flush()
    if (pending.current && !jaAvisado) return
    navigate('/painel')
  }

  const meta = SECTIONS[section]

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper-deep">
      <h1 className="sr-only">Editar perfil — advoc.me</h1>
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/painel" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            advoc.me
          </Link>
          <div className="flex items-center gap-3">
            {/* "Tudo salvo" só quando de fato salvou. Falha vira aviso visível com
                botão de tentar de novo — antes um PUT recusado passava por salvo. */}
            <span
              className={`hidden text-[12px] sm:inline ${
                saveState === 'error' ? 'font-semibold text-burgundy-deep' : 'text-ink-faint'
              }`}
              aria-live="polite"
            >
              {saveState === 'saved' ? 'Tudo salvo' : saveState === 'saving' ? 'Salvando…' : 'Não salvou'}
            </span>
            <Link to={`/${profile.slug}`} className="btn-primary !py-2 !px-4 text-[13px]" target="_blank">
              Ver perfil
            </Link>
            <AccountMenu compact supportTo={comVolta('/suporte', `/editor?section=${section}`)} />
          </div>
        </div>
      </header>

      {/* Alternância mobile edição/prévia */}
      <div className="sticky top-[57px] z-10 flex gap-1 border-b border-ink/10 bg-paper-deep p-2 lg:hidden">
        {(['edit', 'preview'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-burgundy text-paper-soft' : 'text-ink-faint'
            }`}
          >
            {t === 'edit' ? 'Editar' : 'Prévia'}
          </button>
        ))}
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        {/* Coluna de edição */}
        {/* min-w-0: sem isso um conteúdo largo (uma grade de horários, por exemplo)
            vira a largura mínima da coluna e estoura a página no celular. */}
        <div className={`mx-auto w-full min-w-0 max-w-2xl space-y-5 lg:max-w-none ${tab === 'preview' ? 'hidden lg:block' : ''}`}>
          <button
            type="button"
            onClick={sairParaPainel}
            className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-faint transition-colors hover:text-burgundy"
          >
            ‹ Voltar ao painel
          </button>

          <ModerationBanner status={profile.moderationStatus} note={profile.moderationNote} />

          <div>
            <h2 className="font-display text-[24px] font-semibold leading-tight text-ink">{meta.title}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{meta.subtitle}</p>
          </div>

          {/* Gerador de IA — PAINEL, não janela. Fica aqui, no fluxo da coluna de
              edição, logo acima do campo que vai receber o texto: a pessoa vê o
              antes e o depois na mesma tela, e cancelar não "fecha" nada. */}
          <AnimatePresence>
            {ai && (
              <AiGenerator
                kind={ai.kind}
                areaLabel={ai.areaLabel}
                name={profile.name}
                plan={profile.plan}
                city={[profile.city, profile.state].filter(Boolean).join('/')}
                areas={profile.areas.map((a) => a.label).filter(Boolean)}
                currentText={ai.currentText}
                limit={aiLimit(ai)}
                onApply={applyAi}
                onClose={() => setAi(null)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-5"
            >
              {section === 'identidade' && (
                <IdentitySection
                  profile={profile}
                  set={set}
                  setProfile={setProfile}
                  lim={lim}
                  onAi={openAi}
                  onUpsell={abrirUpsell}
                />
              )}

              {section === 'bio' && (
                <Card title="Bio" action={<AiButton label="Gerar" onClick={() => openAi({ kind: 'bio' })} />}>
                  <Field
                    label="Sobre você"
                    hint={<QuotaCounter quota={charQuota(profile.plan, 'bio', profile.bio.length)} />}
                    info={<InfoTip items={OAB_GUIDANCE_BY_FIELD.bio} title="O que a OAB permite na bio" />}
                  >
                    <TextArea
                      rows={5}
                      value={profile.bio}
                      maxLength={lim.bio}
                      onChange={(e) => set({ bio: e.target.value })}
                      placeholder="Escreva ou gere com IA…"
                    />
                  </Field>
                  <OverLimit value={profile.bio} limit={lim.bio} onFix={(v) => set({ bio: v })} />
                  <MarginNotes issues={bioIssues} />
                  {profile.bio.trim() && (
                    <button
                      type="button"
                      onClick={() => openAi({ kind: 'improve', currentText: profile.bio })}
                      className="inline-flex items-center gap-1.5 self-start rounded-full border border-brass/40 bg-brass/10 px-3 py-1.5 text-[12.5px] font-semibold text-brass-deep transition-colors hover:bg-brass/20"
                    >
                      <SparkIcon width={14} height={14} />
                      Melhorar com IA
                      {!canUseAi('improve', profile.plan) && <LockIcon width={11} height={11} />}
                    </button>
                  )}
                </Card>
              )}

              {section === 'redes' && (
                <ContactSection profile={profile} set={set} />
              )}

              {section === 'agenda' && (
                <Card title="Agendamento">
                  {canUseScheduling(profile.plan) ? (
                    <SchedulingCard profile={profile} set={set} />
                  ) : (
                    // Free: a seção continua no lugar, com o espectro real da agenda
                    // borrado sob o cadeado — o advogado vê o que teria.
                    <LockedFeature
                      unlockPlan={nextPlan(profile.plan) ?? 'pro'}
                      points={featurePoints('agenda')}
                      onOpen={() => abrirUpsell('agenda')}
                    >
                      <SchedulingCard profile={profile} set={() => {}} preview />
                    </LockedFeature>
                  )}
                </Card>
              )}

              {section === 'aparencia' && (
                <Card
                  title="Aparência"
                  action={
                    <span className="text-[12px] text-ink-faint">
                      {THEMES.filter((t) => isThemeUnlocked(t, profile.plan)).length}/{THEMES.length} temas
                    </span>
                  }
                >
                  {/* No toque não existe hover, então o convite a experimentar
                      precisa estar escrito: sem isto, num celular o cadeado é a
                      única mensagem e ninguém descobre que dá para provar. */}
                  <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
                    Toque em qualquer tema para vê-lo no seu perfil. Os do Pro e do Max você
                    experimenta antes de assinar — só o salvar depende do plano.
                  </p>
                  <AnimatePresence>
                    {tryTheme && (
                      <ThemeTrialBar
                        trying={tryTheme}
                        saved={profile.theme}
                        onSubscribe={(p) =>
                          void irPara(comVolta(`/assinar/${p}?tema=${tryTheme}`, `/editor?section=aparencia`))
                        }
                        onCancel={() => setTryTheme(null)}
                        onShowPreview={() => setTab('preview')}
                      />
                    )}
                  </AnimatePresence>
                  <ThemePicker
                    value={profile.theme}
                    trying={tryTheme}
                    plan={profile.plan}
                    onChange={(theme) => {
                      setTryTheme(null)
                      set({ theme })
                    }}
                    onTry={(theme) => setTryTheme(theme)}
                  />
                </Card>
              )}

              {section === 'marca' && (
                <>
                  {profile.plan !== 'premium' && (
                    <UpsellCard
                      plan="premium"
                      title="Sua marca, seu domínio"
                      body={`Hoje seu endereço é advoc.me/${profile.slug}. No Max ele pode ser o seu próprio: ${slugify(profile.name) || 'seunome'}.adv.br — sem a marca advoc.me.`}
                      bullets={['Domínio próprio (.adv.br)', 'Cor de destaque personalizada', 'Sem marca d’água advoc.me']}
                    />
                  )}
                  <BrandingCard
                    plan={profile.plan}
                    branding={profile.branding}
                    slug={profile.slug}
                    onChange={(patch) => set({ branding: { ...profile.branding, ...patch } })}
                  />
                </>
              )}

              {section === 'analytics' && <AnalyticsSection profile={profile} />}

              {section === 'qrcode' &&
                (canUseDigitalCard(profile.plan) ? (
                  <DigitalCard profile={profile} />
                ) : (
                  // Free vê o cartão real borrado sob o cadeado — inclusive com o
                  // endereço limpo que ele passaria a ter, que é metade do apelo.
                  <LockedFeature unlockPlan="pro" onOpen={() => abrirUpsell('qrcode')}>
                    <DigitalCard profile={{ ...profile, slug: slugify(profile.name) || profile.slug }} />
                  </LockedFeature>
                ))}

              {section === 'cartao' &&
                (canUsePrintCard(profile.plan) ? (
                  <CardStudio profile={profile} set={set} />
                ) : (
                  // Igual ao FAQ e ao vídeo: a seção continua no lugar, com o
                  // cartão REAL dele borrado sob o cadeado. Ver o próprio nome no
                  // papel é o que faz querer.
                  <LockedFeature unlockPlan="premium" onOpen={() => abrirUpsell('cartao')}>
                    <CardStudio profile={{ ...profile, card: CARD_PREVIEW }} set={() => {}} preview />
                  </LockedFeature>
                ))}

              {section === 'faq' &&
                (canUseFaq(profile.plan) ? (
                  <FaqCard
                    profile={profile}
                    set={set}
                    onUpsell={abrirUpsell}
                    // A pergunta vai como `areaLabel` (é o assunto) e a resposta atual
                    // como `currentText` — é o que faz a IA APOIAR o texto do advogado
                    // em vez de escrever outro por cima.
                    onAi={(f) =>
                      openAi({
                        kind: 'faq',
                        faqId: f.id,
                        areaLabel: f.question || profile.areas[0]?.label,
                        currentText: f.answer,
                      })
                    }
                  />
                ) : (
                  // No Free a seção continua no lugar, com o card real borrado sob o
                  // cadeado — o advogado vê exatamente o que teria.
                  <LockedFeature unlockPlan="pro" onOpen={() => abrirUpsell('faq')}>
                    <FaqCard
                      profile={{ ...profile, plan: 'pro', faqs: PREVIEW_FAQS }}
                      set={() => {}}
                      onUpsell={() => {}}
                      preview
                    />
                  </LockedFeature>
                ))}

              {section === 'video' &&
                (canUseVideo(profile.plan) ? (
                  <VideoCard profile={profile} set={set} />
                ) : (
                  // Igual ao FAQ: a seção fica no lugar, com o card real
                  // borrado sob o cadeado, para o advogado ver o que teria.
                  <LockedFeature unlockPlan="premium" onOpen={() => abrirUpsell('video')}>
                    <VideoCard profile={{ ...profile, videoUrl: PREVIEW_VIDEO_URL }} set={() => {}} preview />
                  </LockedFeature>
                ))}

              {section === 'conteudo' && (
                <>
                  <LegalDocsCard profile={profile} />
                  <AuditReportCard profile={profile} onUpsell={() => abrirUpsell('branding')} />
                </>
              )}

              {section === 'plano' && (
                <>
                  {/* Quem já assina vê primeiro o que ainda não usou do que pagou —
                      não uma vitrine para comprar de novo. */}
                  <PlanChecklist profile={profile} />
                  <Card title="Planos">
                    <PlanShowcase plan={profile.plan} onPick={changePlan} voltar={aqui} />
                    <p className="text-[11.5px] leading-relaxed text-ink-faint">
                      Plataforma em teste: a assinatura é ativada na hora e nenhuma cobrança é
                      feita. Você pode voltar ao Free quando quiser — seus textos continuam
                      guardados.
                    </p>
                  </Card>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Aviso de falha de gravação: fica JUNTO do botão de sair, que é onde a
              pessoa está olhando quando decide ir embora. */}
          {saveState === 'error' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-burgundy/30 bg-burgundy/[0.06] px-3 py-2.5">
              <p className="text-[12.5px] font-medium text-burgundy-deep">
                {saveError ?? 'Não foi possível salvar as últimas alterações.'}
              </p>
              <button
                type="button"
                onClick={() => void flush()}
                className="rounded-full border border-burgundy/40 px-3 py-1.5 text-[12px] font-semibold text-burgundy hover:bg-burgundy/10"
              >
                Tentar de novo
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button type="button" onClick={sairParaPainel} className="btn-ghost">
              ‹ Painel
            </button>
            <button type="button" onClick={sairParaPainel} className="btn-primary">
              Pronto
            </button>
          </div>
        </div>

        {/* Coluna de prévia */}
        <div className={`lg:sticky lg:top-[80px] lg:self-start ${tab === 'edit' ? 'hidden lg:block' : ''}`}>
          {/* A prova de tema vive AQUI e só aqui: o objeto que vai para o save
              continua sendo `profile`, com o tema que o plano permite. */}
          <PhonePreview profile={tryTheme ? { ...profile, theme: tryTheme } : profile} />
        </div>
      </div>

    </div>
  )
}

// ---- Seções ----

function IdentitySection({
  profile,
  set,
  setProfile,
  lim,
  onAi,
  onUpsell,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>
  lim: (typeof CHAR_LIMITS)[Plan]
  onAi: (t: NonNullable<AiTarget>) => void
  onUpsell: (f: UpsellFeature) => void
}) {
  const areasQuota = areaQuota(profile.plan, profile.areas.length)
  return (
    <>
      <Card title="Identidade">
        <Field
          label="Nome completo"
          info={<InfoTip items={OAB_GUIDANCE_BY_FIELD.name} title="O que a OAB permite no nome" align="left" />}
        >
          <TextInput
            value={profile.name}
            maxLength={NAME_MAX}
            onChange={(e) => {
              const name = e.target.value
              setProfile((p) => {
                if (!p) return p
                // O endereço acompanha o nome, a menos que o usuário já tenha
                // personalizado à mão (slugCustom). No Free, sempre segue o nome
                // (o número único é aplicado no save).
                const keep = p.plan !== 'free' && p.slugCustom
                const slug = keep ? p.slug : slugify(name)
                return { ...p, name, slug }
              })
            }}
          />
        </Field>
        <div className="grid gap-4">
          <Field label="Número da OAB" hint="UF + número">
            <OabNumberInput value={profile.oabNumber} onChange={(oabNumber) => set({ oabNumber })} />
          </Field>
          <Field label="Endereço do perfil" hint={profile.plan === 'free' ? 'gerado do nome' : 'personalizável'}>
            {profile.plan === 'free' ? (
              <TextInput value={`advoc.me/${profile.slug}`} readOnly className="!bg-paper-deep text-ink-faint" />
            ) : (
              <SlugField profile={profile} set={set} />
            )}
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">Foto de perfil</span>
          <AvatarUpload
            name={profile.name}
            value={profile.avatarUrl}
            onChange={(avatarUrl) => set({ avatarUrl })}
            size={72}
          />
        </div>
        <Field
          label="Frase de apresentação"
          hint={`${profile.headline.length}/${lim.headline}`}
          info={<InfoTip items={OAB_GUIDANCE_BY_FIELD.headline} title="O que a OAB permite na frase" />}
        >
          <TextInput
            value={profile.headline}
            maxLength={lim.headline}
            onChange={(e) => set({ headline: e.target.value })}
            placeholder="Advogada · Direito de Família"
          />
        </Field>
        {/* A linha mais visível do perfil depois do nome — e a última a ganhar
            revisão ao vivo. Um "o melhor criminalista da cidade" aqui é tão
            irregular quanto na bio. */}
        <MarginNotes issues={checkCompliance(profile.headline)} />
        <button
          type="button"
          onClick={() => onAi({ kind: 'headline' })}
          className="-mt-1 inline-flex items-center gap-1.5 self-start rounded-full border border-brass/40 bg-brass/10 px-3 py-1.5 text-[12.5px] font-semibold text-brass-deep transition-colors hover:bg-brass/20"
        >
          <SparkIcon width={14} height={14} />
          Gerar frase com IA
          {!canUseAi('headline', profile.plan) && <LockIcon width={11} height={11} />}
        </button>
      </Card>

      <Card title="Localização e atendimento">
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <Field label="Cidade">
            <TextInput value={profile.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="UF">
            <UfSelect value={profile.state} onChange={(state) => set({ state })} />
          </Field>
        </div>
        <Field label="Observação de região" hint="opcional">
          <TextInput
            value={profile.regionNote ?? ''}
            onChange={(e) => set({ regionNote: e.target.value })}
            placeholder="Atendimento em toda a Grande SP"
          />
        </Field>
        <MarginNotes issues={checkCompliance(profile.regionNote ?? '')} />
        <div className="flex gap-6">
          <Toggle
            checked={profile.serviceMode.inPerson}
            onChange={(v) => set({ serviceMode: { ...profile.serviceMode, inPerson: v } })}
            label="Presencial"
          />
          <Toggle
            checked={profile.serviceMode.online}
            onChange={(v) => set({ serviceMode: { ...profile.serviceMode, online: v } })}
            label="Online"
          />
        </div>
      </Card>

      <Card
        title="Áreas de atuação"
        action={<QuotaCounter quota={areasQuota} />}
      >
        {profile.areas.map((area) => (
          <AreaEditor
            key={area.id}
            area={area}
            descLimit={lim.areaDesc}
            onChange={(patch) =>
              set({ areas: profile.areas.map((a) => (a.id === area.id ? { ...a, ...patch } : a)) })
            }
            onRemove={() => set({ areas: profile.areas.filter((a) => a.id !== area.id) })}
            onAi={() => onAi({ kind: 'area', areaId: area.id, areaLabel: area.label })}
          />
        ))}
        {!areasQuota.atLimit ? (
          <button
            type="button"
            onClick={() => set({ areas: [...profile.areas, { id: nextId(), label: '', description: '' }] })}
            className="btn-ghost w-full border-dashed"
          >
            + Adicionar área
          </button>
        ) : areasQuota.unlockPlan ? (
          // No limite do plano: em vez de só avisar, mostra o próximo slot como
          // fantasma (cadeado). Clicar abre o modal focado em "áreas".
          <GhostSlot
            unlockPlan={areasQuota.unlockPlan}
            points={featurePoints('areas')}
            onOpen={() => onUpsell('areas')}
          />
        ) : (
          <p className="rounded-lg bg-brass/10 px-3 py-2 text-[12.5px] text-brass-deep">
            Você chegou ao máximo de áreas do maior plano.
          </p>
        )}
      </Card>
    </>
  )
}

/**
 * Endereço editável (Pro/Max) com consulta REAL de disponibilidade.
 *
 * O campo antes aceitava qualquer coisa em silêncio e a colisão só aparecia
 * depois de salvar, na forma de um número grudado no fim do endereço. Agora o
 * estado é dito enquanto se digita — e, quando ocupado, a alternativa que o
 * servidor daria vem com um botão para aceitar de uma vez.
 */
function SlugField({
  profile,
  set,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
}) {
  const { available, suggested, checking } = useSlugCheck(profile.slug, profile.name)
  const taken = available === false
  const hintId = 'slug-status'

  return (
    <>
      <div
        className={`flex items-stretch overflow-hidden rounded-lg border bg-paper-soft transition-colors focus-within:ring-2 ${
          taken
            ? 'border-burgundy/60 focus-within:border-burgundy focus-within:ring-burgundy/15'
            : 'border-ink/15 focus-within:border-burgundy focus-within:ring-burgundy/15'
        }`}
      >
        <span className="flex select-none items-center bg-paper-deep px-3 text-[13px] text-ink-faint">
          {hostLabel()}/
        </span>
        <input
          value={profile.slug}
          onChange={(e) => set({ slug: slugify(e.target.value), slugCustom: true })}
          placeholder="seu-nome"
          aria-label="Endereço personalizado do perfil"
          aria-invalid={taken}
          aria-describedby={hintId}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent px-2 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:outline-none"
        />
      </div>
      {/* aria-live: quem usa leitor de tela ouve a mudança de estado sem
          precisar sair do campo para descobrir que o endereço está ocupado. */}
      <p id={hintId} aria-live="polite" className="mt-1.5 text-[12px] leading-relaxed">
        {checking && <span className="text-ink-faint">Conferindo se está livre…</span>}
        {!checking && available === true && (
          <span className="font-medium text-brass-deep">Endereço disponível.</span>
        )}
        {!checking && taken && (
          <span className="text-burgundy">
            Esse endereço já é de outro advogado.{' '}
            {suggested && suggested !== profile.slug && (
              <button
                type="button"
                onClick={() => set({ slug: suggested, slugCustom: true })}
                className="font-semibold underline underline-offset-2"
              >
                Usar {suggested}
              </button>
            )}
          </span>
        )}
        {!checking && available === null && profile.slug.trim() && (
          <span className="text-ink-faint">
            Não deu para conferir agora — o servidor confirma ao salvar.
          </span>
        )}
      </p>
    </>
  )
}

function ContactSection({
  profile,
  set,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
}) {
  return (
    <Card title="Redes e contato">
      <div className="grid gap-3">
        {(Object.keys(socialMeta) as SocialKind[]).map((kind) => {
          const existing = profile.socials.find((s) => s.kind === kind)
          const check = validateSocialUrl(kind, existing?.url ?? '')
          const warn = check.status === 'invalid' || check.status === 'mismatch'
          return (
            <Field key={kind} label={socialMeta[kind].label}>
              <TextInput
                value={existing?.url ?? ''}
                placeholder="https://…"
                aria-invalid={warn}
                onChange={(e) => {
                  const url = e.target.value
                  const rest = profile.socials.filter((s) => s.kind !== kind)
                  set({ socials: url ? [...rest, { kind, url }] : rest })
                }}
              />
              {warn && (
                <p className="mt-1 text-[11.5px] leading-relaxed text-brass-deep">{check.message}</p>
              )}
            </Field>
          )
        })}
      </div>
      <div className="rule-brass my-1" />
      <Field label="WhatsApp" hint="DDD + número">
        <WhatsappInput
          value={profile.contact.whatsapp ?? ''}
          onChange={(whatsapp) => set({ contact: { ...profile.contact, whatsapp } })}
        />
      </Field>
      <Field label="E-mail">
        <TextInput
          type="email"
          value={profile.contact.email ?? ''}
          onChange={(e) => set({ contact: { ...profile.contact, email: e.target.value } })}
        />
      </Field>
    </Card>
  )
}

// Analytics — mostra o valor real (visitas) e convida ao PRO para os detalhes.
// Nunca esconde: o número já aparece; o upgrade é para "descobrir mais".
function AnalyticsSection({ profile }: { profile: Profile }) {
  const views = profile.views ?? 0
  return (
    <div className="space-y-4">
      <Card title="Visitas ao seu perfil">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[40px] font-semibold leading-none text-ink">{views}</span>
          <span className="text-[15px] text-ink-faint">{views === 1 ? 'visita' : 'visitas'}</span>
        </div>
        {profile.plan !== 'free' && (
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">
            Em breve: origem das visitas, horários de pico e páginas mais acessadas.
          </p>
        )}
      </Card>
      {profile.plan === 'free' && (
        <UpsellCard
          plan="pro"
          title="Descubra quem visita você"
          body={`Você já recebeu ${views} ${views === 1 ? 'visita' : 'visitas'}. Atualize para entender de onde elas vêm.`}
          bullets={['Origem das visitas', 'Horários de maior movimento', 'Botões e links mais clicados']}
        />
      )}
    </div>
  )
}

// Aviso de moderação — mostrado ao dono quando o perfil recebeu aviso/censura/restrição.
function ModerationBanner({ status, note }: { status?: ModerationStatus; note?: string }) {
  if (!status || status === 'active') return null
  const meta = {
    warned: {
      title: 'Aviso da moderação',
      body: 'Seu perfil recebeu um aviso sobre conformidade. Ajuste o conteúdo indicado.',
      danger: false,
    },
    partial: {
      title: 'Parte do perfil foi ocultada',
      body: 'A moderação ocultou uma ou mais seções do seu perfil por violarem as normas. Corrija o conteúdo para solicitar revisão.',
      danger: false,
    },
    restricted: {
      title: 'Perfil retirado do ar',
      body: 'Seu perfil foi restringido pela moderação e não está visível ao público. Fale com o suporte para revisão.',
      danger: true,
    },
  }[status]

  return (
    <div className={`rounded-xl2 border px-4 py-3 ${meta.danger ? 'border-burgundy/30 bg-burgundy/[0.06]' : 'border-brass/30 bg-brass/[0.08]'}`}>
      <p className={`text-[13px] font-semibold ${meta.danger ? 'text-burgundy-deep' : 'text-brass-deep'}`}>{meta.title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{meta.body}</p>
      {note && (
        <p className="mt-2 rounded-lg bg-paper/70 px-3 py-2 text-[12.5px] leading-relaxed text-ink">
          <span className="font-medium text-ink-faint">Moderador:</span> {note}
        </p>
      )}
    </div>
  )
}

/**
 * Aviso + conserto de um campo que passou do limite. Só aparece quando o texto
 * já está acima do teto — situação que hoje só acontece com texto colado ou
 * vindo de uma geração antiga (a IA passou a escrever dentro do orçamento).
 */
function OverLimit({
  value,
  limit,
  onFix,
}: {
  value: string
  limit: number
  onFix: (v: string) => void
}) {
  const excedente = value.length - limit
  if (excedente <= 0) return null
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-burgundy/25 bg-burgundy/[0.05] px-3 py-2">
      <span className="text-[12px] font-medium text-burgundy-deep">
        {excedente} {excedente === 1 ? 'caractere' : 'caracteres'} acima do limite — o perfil não salva
        assim.
      </span>
      <button
        type="button"
        onClick={() => onFix(fitToLimit(value, limit))}
        className="shrink-0 rounded-full border border-burgundy/40 px-3 py-1 text-[12px] font-semibold text-burgundy hover:bg-burgundy/10"
      >
        Cortar no limite
      </button>
    </div>
  )
}

function AreaEditor({
  area,
  descLimit,
  onChange,
  onRemove,
  onAi,
}: {
  area: PracticeArea
  descLimit: number
  onChange: (patch: Partial<PracticeArea>) => void
  onRemove: () => void
  onAi: () => void
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-ink/10 bg-paper-soft p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] font-semibold text-ink">Área de atuação</span>
        <InfoTip items={OAB_GUIDANCE_BY_FIELD.area} title="O que a OAB permite na área" align="left" />
      </div>
      <div className="flex gap-2">
        <input
          list="area-suggestions"
          value={area.label}
          maxLength={AREA_LABEL_MAX}
          placeholder="Direito de Família"
          aria-label="Nome da área de atuação"
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />
        <AiButton onClick={onAi} />
      </div>
      <div>
        <TextArea
          rows={2}
          value={area.description}
          maxLength={descLimit}
          placeholder="Descrição do que você faz nessa área…"
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <p
          className={`mt-1 text-right text-[11px] tabular-nums ${
            area.description.length > descLimit ? 'font-semibold text-burgundy-deep' : 'text-ink-faint'
          }`}
        >
          {area.description.length}/{descLimit}
        </p>
        {/* Texto acima do teto trava o save do perfil INTEIRO. Em vez de deixar a
            pessoa contar caracteres na mão, um toque corta na última frase que cabe. */}
        <OverLimit
          value={area.description}
          limit={descLimit}
          onFix={(v) => onChange({ description: v })}
        />
      </div>
      {/* Nome e descrição conferidos juntos: são um bloco só na leitura de quem
          visita, e separar daria dois avisos para o mesmo problema. */}
      <MarginNotes issues={checkCompliance(`${area.label} ${area.description}`)} />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover área"
        className="inline-flex items-center gap-1.5 justify-self-start rounded-lg border border-ink/10 px-2.5 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:border-burgundy/40 hover:bg-burgundy/[0.06] hover:text-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/20"
      >
        <TrashIcon width={13} height={13} />
        Remover área
      </button>
      <datalist id="area-suggestions">
        {allAreas.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
    </div>
  )
}
