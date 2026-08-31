import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Plan, Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { sampleProfile } from '@/lib/mockData'
import { hasBlockingIssue } from '@/lib/oab'
import { parseOab } from '@/lib/brFormat'
import { computeTrust } from '@/lib/trustScore'
import { AREA_LABEL_MAX, CHAR_LIMITS } from '@/lib/plans'
import { PLAN_LABEL } from '@/lib/upsell'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { AiGenerator } from '@/components/editor/AiGenerator'
import { UnlockMore } from '@/components/editor/UnlockMore'
import { UpgradeTopics } from '@/components/editor/UpgradeTopics'
import { AvatarUpload } from '@/components/editor/AvatarUpload'
import { PhonePreview } from '@/components/editor/PhonePreview'
import { Avatar } from '@/components/ui/Avatar'
import { TrustGauge } from '@/components/ui/TrustGauge'
import { Field, TextArea, TextInput } from '@/components/editor/fields'
import { OabNumberInput, WhatsappInput } from '@/components/editor/inputs'
import { CidadeUfCampos } from '@/components/editor/CidadeInput'
import { SparkIcon, ArrowRight, CheckIcon } from '@/components/ui/icons'
import { Marca } from '@/components/ui/Marca'

let uid = 0
const nextId = () => `id-${Date.now()}-${uid++}`

// Um rascunho recém-carregado ainda é o perfil-modelo (Marina) — o backend/mock
// clona o exemplo. Aqui detectamos isso para começar de fato do zero.
const isUnstarted = (p: Profile) =>
  p.name === sampleProfile.name && p.bio === sampleProfile.bio && !p.published

// Zera só o essencial para o assistente começar em branco, sem tocar no editor.
function blankEssentials(p: Profile): Profile {
  return {
    ...p,
    name: '',
    headline: '',
    bio: '',
    avatarUrl: '',
    city: '',
    state: '',
    regionNote: '',
    oabNumber: '',
    areas: [{ id: nextId(), label: '', description: '' }],
    faqs: [],
    socials: [],
    contact: {},
    schedulingMode: 'off',
    plan: 'free',
    theme: 'papel',
    published: false,
    views: 0,
  }
}

// As 6 telas do assistente (RFC-001). Uma ideia por tela.
const WELCOME = 0
const WHO = 1
const HOW = 2
const CONTACT = 3
const PHOTO = 4
const REVIEW = 5
const LAST = REVIEW

export default function Onboarding() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)
  const [step, setStep] = useState(WELCOME)
  const [aiOpen, setAiOpen] = useState(false)
  const [published, setPublished] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Vamos criar seu perfil · advoc.me'
    api
      .getDraft()
      .then((d) => {
        // Quem JÁ publicou nunca é jogado de volta no assistente de criação. Isto é o
        // que fazia "trocar de plano" parecer refazer o perfil inteiro: os botões de
        // plano da home apontam para /comecar?plan=pro, e aqui a pessoa caía na tela
        // 1 de 6. Agora vai direto ao painel, com o checkout do plano já aberto.
        if (d.published) {
          const wanted = searchParams.get('plan')
          const q = wanted === 'pro' || wanted === 'premium' ? `?assinar=${wanted}` : ''
          navigate(`/painel${q}`, { replace: true })
          return
        }
        setProfile(isUnstarted(d) ? blankEssentials(d) : d)
      })
      .catch((e: unknown) => {
        // Sessão caída → o RequireAuth já leva ao login. O resto vira mensagem, em
        // vez de um assistente em branco que parece um perfil recém-criado.
        if (e instanceof SessaoExpirada) return
        setErro(e instanceof Error ? e.message : 'Falha ao carregar seu rascunho.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Plano escolhido na landing (?plan=) por quem ainda NÃO tem perfil: guardado
  // para ser oferecido no fim da criação (a assinatura só existe depois que há um
  // perfil no ar — o plano é do servidor, ver api.setPlan).
  const wantedPlan = searchParams.get('plan')
  const pendingPlan: Exclude<Plan, 'free'> | null =
    wantedPlan === 'pro' || wantedPlan === 'premium' ? wantedPlan : null

  // Salva o rascunho com debounce (mesmo armazenamento do editor).
  useEffect(() => {
    if (!profile) return
    const t = setTimeout(() => {
      api
        .saveDraft(profile)
        .then((saved) => {
          setErroAoSalvar(null)
          if (saved?.slug && saved.slug !== profile.slug) {
            setProfile((p) => (p && p.slug !== saved.slug ? { ...p, slug: saved.slug } : p))
          }
        })
        .catch((e: unknown) => {
          // Este `.catch` faltava: a recusa do servidor virava um erro solto no
          // console e a pessoa seguia preenchendo seis telas que não estavam
          // sendo gravadas em lugar nenhum.
          if (e instanceof SessaoExpirada) return
          setErroAoSalvar(e instanceof Error ? e.message : 'Não foi possível salvar agora.')
        })
    }, 600)
    return () => clearTimeout(t)
  }, [profile])

  const blockedBio = useMemo(() => (profile ? hasBlockingIssue(profile.bio) : false), [profile])

  if (erro) return <FalhaAoCarregar mensagem={erro} titulo="Não foi possível abrir o assistente" />

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  const set = (patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p))
  const area = profile.areas[0] ?? { id: nextId(), label: '', description: '' }
  const setArea = (label: string) =>
    set({ areas: [{ ...area, label }, ...profile.areas.slice(1)] })

  const oab = parseOab(profile.oabNumber)

  // Requisitos mínimos de cada tela — habilitam "Continuar" sem parede de validação.
  const stepReady: Record<number, boolean> = {
    [WELCOME]: true,
    [WHO]: !!(profile.name.trim() && oab.uf && oab.digits && profile.city.trim() && profile.state),
    [HOW]: !!(area.label.trim() && profile.bio.trim() && !blockedBio),
    [CONTACT]: !!profile.contact.whatsapp,
    [PHOTO]: true,
    [REVIEW]: true,
  }
  const canContinue = stepReady[step]
  const canPublish =
    stepReady[WHO] && stepReady[HOW] && stepReady[CONTACT] && !blockedBio

  const goNext = () => setStep((s) => Math.min(LAST, s + 1))
  const goBack = () => setStep((s) => Math.max(WELCOME, s - 1))

  /**
   * Publicar de verdade — e só comemorar depois que o servidor confirmar.
   *
   * Antes, "Publicar" só marcava o rascunho e trocava de tela; a gravação ficava
   * a cargo do salvamento com atraso de 600ms, que morria junto com a tela se a
   * pessoa saísse antes. Quando ele chegava a rodar e o servidor recusava (texto
   * fora das normas da OAB, sessão vencida), ninguém ficava sabendo: a tela dizia
   * "está no ar" e o perfil continuava despublicado — daí o painel devolver ao
   * assistente de criação, em branco, na visita seguinte.
   */
  async function publish() {
    if (publicando) return
    setPublicando(true)
    setErroAoSalvar(null)
    const paraPublicar: Profile = { ...profile!, published: true }
    setProfile(paraPublicar)
    try {
      const saved = await api.saveDraft(paraPublicar)
      if (!saved?.published) throw new Error('O servidor não confirmou a publicação.')
      setProfile(saved)
      setPublished(true)
    } catch (e) {
      // Falhou: o perfil NÃO está no ar, e a tela tem de dizer isso.
      setProfile((p) => (p ? { ...p, published: false } : p))
      if (!(e instanceof SessaoExpirada)) {
        setErroAoSalvar(e instanceof Error ? e.message : 'Não foi possível publicar agora.')
      }
    } finally {
      setPublicando(false)
    }
  }

  if (published) {
    return (
      <DoneScreen profile={profile} intent={pendingPlan} />
    )
  }

  return (
    <div className="grain flex min-h-dvh flex-col bg-paper-deep">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Marca size={29} />
          advoc.me
        </Link>
        <AccountMenu compact />
      </header>

      {/* Progresso com voz — passo atual, rótulo da etapa e barra segmentada */}
      {step > WELCOME && (
        <div className="mx-auto w-full max-w-4xl px-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
              Passo {step} de 5
            </span>
            <span className="text-[12px] font-medium text-ink-faint">{STEP_META[step].label}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {[WHO, HOW, CONTACT, PHOTO, REVIEW].map((s) => (
              <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/12">
                <motion.span
                  className="block h-full rounded-full bg-burgundy"
                  initial={false}
                  animate={{ scaleX: s <= step ? 1 : 0 }}
                  style={{ transformOrigin: 'left' }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="flex flex-1 flex-col">
        {step === WELCOME ? (
          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-10">
            <WelcomeStep onStart={goNext} />
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-4xl items-start gap-10 px-5 py-8 lg:grid-cols-[1fr_340px]">
            <div className="flex min-w-0 flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-1 flex-col"
                >
            {step === WHO && (
              <StepShell eyebrow={STEP_META[WHO].eyebrow} title="Quem é você?" subtitle="Seus dados básicos de advogado(a).">
                <Field label="Nome completo">
                  <TextInput
                    value={profile.name}
                    autoFocus
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="Marina Sales"
                  />
                </Field>
                <Field label="Número da OAB">
                  <OabNumberInput
                    value={profile.oabNumber}
                    onChange={(oabNumber) => {
                      const p = parseOab(oabNumber)
                      // Preenche o estado a partir da UF da OAB, se ainda vazio.
                      set({ oabNumber, state: profile.state || p.uf })
                    }}
                  />
                </Field>
                {/* A UF já vem preenchida pela seccional da OAB acima, então o
                    campo de cidade abre com a busca restrita ao estado certo —
                    e a escolha grava a grafia oficial do IBGE. */}
                <CidadeUfCampos
                  city={profile.city}
                  state={profile.state}
                  onChange={({ city, state }) => set({ city, state })}
                />
              </StepShell>
            )}

            {step === HOW && (
              <StepShell eyebrow={STEP_META[HOW].eyebrow} title="Como você atua?" subtitle="Sua área principal e uma breve apresentação.">
                <Field label="Área principal">
                  <TextInput
                    value={area.label}
                    autoFocus
                    maxLength={AREA_LABEL_MAX}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Direito de Família"
                  />
                </Field>
                <Field label="Sobre você">
                  <TextArea
                    rows={5}
                    value={profile.bio}
                    onChange={(e) => set({ bio: e.target.value })}
                    placeholder="Escreva algumas linhas ou deixe a IA começar para você…"
                  />
                </Field>
                {/* O gerador abre AQUI, embaixo do botão e do campo — não numa
                    janela por cima. Na criação do perfil isso é o que mantém o
                    ritmo: escreve, gera, aplica e segue, tudo na mesma tela. */}
                {!aiOpen ? (
                  <button
                    type="button"
                    onClick={() => setAiOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border border-brass/40 bg-brass/10 px-4 py-2 text-[13.5px] font-semibold text-brass-deep transition-colors hover:bg-brass/20"
                  >
                    <SparkIcon width={15} height={15} />
                    Gerar bio comigo
                  </button>
                ) : (
                  <AiGenerator
                    kind="bio"
                    name={profile.name}
                    limit={CHAR_LIMITS[profile.plan].bio}
                    onApply={(text) => set({ bio: text })}
                    onClose={() => setAiOpen(false)}
                  />
                )}
                {blockedBio && (
                  <p className="rounded-lg border border-brass/30 bg-brass/[0.08] px-3 py-2 text-[12.5px] leading-relaxed text-brass-deep">
                    Um trecho da bio pode esbarrar nas regras da OAB. Ajuste antes de publicar.
                  </p>
                )}
              </StepShell>
            )}

            {step === CONTACT && (
              <StepShell
                eyebrow={STEP_META[CONTACT].eyebrow}
                title="Como os clientes falam com você?"
                subtitle="O WhatsApp fica no botão principal do perfil."
              >
                <Field label="WhatsApp">
                  <WhatsappInput
                    value={profile.contact.whatsapp ?? ''}
                    onChange={(whatsapp) => set({ contact: { ...profile.contact, whatsapp } })}
                  />
                </Field>
                <Field label="E-mail" hint="opcional">
                  <TextInput
                    type="email"
                    value={profile.contact.email ?? ''}
                    onChange={(e) => set({ contact: { ...profile.contact, email: e.target.value } })}
                    placeholder="voce@escritorio.adv.br"
                  />
                </Field>
              </StepShell>
            )}

            {step === PHOTO && (
              <StepShell eyebrow={STEP_META[PHOTO].eyebrow} title="Sua foto" subtitle="Um rosto aproxima quem chega. Dá para adicionar depois.">
                <div className="py-2">
                  <AvatarUpload
                    name={profile.name}
                    value={profile.avatarUrl}
                    onChange={(avatarUrl) => set({ avatarUrl })}
                    size={112}
                    align="stack"
                  />
                </div>
              </StepShell>
            )}

            {step === REVIEW && (
              <StepShell eyebrow={STEP_META[REVIEW].eyebrow} title="Ficou assim." subtitle="Confira e publique. Você melhora o resto quando quiser.">
                {/* Mobile: sem coluna de prévia, mostra o celular aqui. */}
                <div className="flex justify-center lg:hidden">
                  <PhonePreview profile={profile} />
                </div>
                {/* Desktop: a prévia já está na coluna ao lado — aqui vai o resumo. */}
                <ReviewSummary profile={profile} area={area} />
                {/* Instiga sem travar: mostra o que dá para somar ao perfil. A
                    assinatura em si acontece depois de publicar (o plano é do
                    servidor — ver api.setPlan), na tela de conclusão. */}
                <UnlockMore plan={profile.plan} compact />
              </StepShell>
            )}
                </motion.div>
              </AnimatePresence>

              {/* O que o servidor recusou. Ficava só no console — e a pessoa
                  seguia preenchendo telas que não estavam sendo gravadas. */}
              {erroAoSalvar && (
                <p
                  role="alert"
                  className="mt-6 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-burgundy-deep"
                >
                  {erroAoSalvar}
                </p>
              )}

              {/* Navegação */}
              <div className="mt-8 flex items-center justify-between gap-3">
                {step > WELCOME ? (
                  <button type="button" onClick={goBack} className="btn-ghost">
                    ‹ Voltar
                  </button>
                ) : (
                  <span />
                )}

                {step === REVIEW ? (
                  <button
                    type="button"
                    onClick={() => void publish()}
                    disabled={!canPublish || publicando}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {publicando ? 'Publicando…' : 'Publicar perfil'}
                  </button>
                ) : step === PHOTO ? (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={goNext} className="btn-ghost">
                      Pular por enquanto
                    </button>
                    <button type="button" onClick={goNext} className="btn-primary">
                      Continuar ›
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canContinue}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continuar ›
                  </button>
                )}
              </div>
            </div>

            {/* Prévia ao vivo — o perfil nascendo enquanto se preenche (desktop) */}
            <aside className="hidden lg:block">
              <div className="lg:sticky lg:top-8">
                <PhonePreview profile={profile} />
              </div>
            </aside>
          </div>
        )}
      </main>

    </div>
  )
}

// ---- Telas / peças ----

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="stagger flex flex-1 flex-col items-center justify-center text-center">
      <motion.span
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        // O ladrilho acompanha a marca: era um quadrado em vinho porque a
        // balança desenhada era vinho. Com a logo dourada dentro, o vinho
        // vira uma terceira cor sem motivo.
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brass/10"
      >
        <Marca size={38} />
      </motion.span>
      <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-[12px] font-semibold text-brass-deep">
        <CheckIcon width={13} height={13} strokeWidth={2.4} />
        Dentro das regras da OAB
      </span>
      <h1 className="mt-4 font-display text-[32px] font-semibold leading-[1.05] text-ink sm:text-[40px]">
        Vamos criar seu perfil.
      </h1>
      <div className="rule-brass mx-auto mt-5 w-24" />
      <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-ink-soft">
        Leva menos de 3 minutos. A gente te guia em cada passo — e mostra seu perfil
        nascendo em tempo real.
      </p>
      <button type="button" onClick={onStart} className="btn-primary mt-8">
        Começar
        <ArrowRight width={18} height={18} />
      </button>
      <p className="mt-4 text-[12.5px] text-ink-faint">
        Grátis · sem cartão · publique em minutos
      </p>
    </div>
  )
}

// Rótulos e eyebrow por passo — dão voz ao progresso e identidade editorial.
const STEP_META: Record<number, { label: string; eyebrow: string }> = {
  [WHO]: { label: 'Seus dados', eyebrow: 'Identidade' },
  [HOW]: { label: 'Sua atuação', eyebrow: 'Atuação' },
  [CONTACT]: { label: 'Contato', eyebrow: 'Contato' },
  [PHOTO]: { label: 'Sua foto', eyebrow: 'Imagem' },
  [REVIEW]: { label: 'Revisão', eyebrow: 'Quase lá' },
}

function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 font-display text-[27px] font-semibold leading-[1.1] text-ink">{title}</h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{subtitle}</p>
      {/* stagger: revela os campos em cascata a cada passo */}
      <div className="stagger mt-6 space-y-4">{children}</div>
    </div>
  )
}

// Resumo da revisão (desktop) — confirma o essencial com sobriedade, já que a
// prévia do celular fica na coluna ao lado.
function ReviewSummary({ profile, area }: { profile: Profile; area: { label: string } }) {
  const rows = [
    { label: 'Nome', value: profile.name },
    { label: 'OAB', value: profile.oabNumber },
    { label: 'Onde atua', value: [profile.city, profile.state].filter(Boolean).join(' · ') },
    { label: 'Área principal', value: area.label },
    { label: 'WhatsApp', value: profile.contact.whatsapp },
  ].filter((r) => r.value)

  return (
    <div className="hidden rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card lg:block">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brass/20 text-brass-deep">
          <CheckIcon width={13} height={13} strokeWidth={2.6} />
        </span>
        <p className="text-[13.5px] font-semibold text-ink">Tudo pronto para publicar</p>
      </div>
      <dl className="mt-4 divide-y divide-ink/[0.07]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">{r.label}</dt>
            <dd className="min-w-0 truncate text-right text-[13.5px] text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// Para onde cada item de melhoria leva no editor (espelha o painel).
const FACTOR_DEST: Record<string, string> = {
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

// Tela final — o momento de orgulho vira o momento de upsell. Mostra o perfil no
// ar (rápido), o quão completo está + como melhorar, e a vitrine de planos (todos
// ativáveis grátis em teste). Mobile-first, sóbrio, mas puxando o "levante" do perfil.
function DoneScreen({
  profile,
  intent = null,
}: {
  profile: Profile
  /** plano escolhido na home antes de criar o perfil — vai direto para a assinatura */
  intent?: Exclude<Plan, 'free'> | null
}) {
  const trust = computeTrust(profile)
  const steps = trust.next.slice(0, 3)
  const firstArea = profile.areas.find((a) => a.label.trim())?.label

  return (
    <div className="grain min-h-dvh bg-paper-deep">
      <main className="mx-auto max-w-md px-5 py-8 sm:max-w-xl">
        {/* Celebração enxuta */}
        <div className="flex flex-col items-center text-center">
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brass/20 text-brass-deep"
          >
            <CheckIcon width={30} height={30} strokeWidth={2.4} />
          </motion.span>
          <h1 className="mt-4 font-display text-[27px] font-semibold leading-tight text-ink">
            Seu perfil está no ar.
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
            Já dá para compartilhar. Agora deixe ele ainda mais forte.
          </p>
        </div>

        {/* Prévia rápida do perfil */}
        <div className="mt-6 rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card">
          <div className="flex items-center gap-3.5">
            <Avatar name={profile.name} src={profile.avatarUrl} size={54} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[17px] font-semibold text-ink">{profile.name}</p>
              <p className="truncate text-[12.5px] text-ink-soft">
                {profile.headline || firstArea || 'Advogado(a)'}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">advoc.me/{profile.slug}</p>
            </div>
          </div>
          <Link
            to={`/${profile.slug}`}
            target="_blank"
            className="btn-primary mt-3.5 w-full !py-2.5 text-[14px]"
          >
            Ver meu perfil
            <ArrowRight width={16} height={16} />
          </Link>
        </div>

        {/* Estatística: quão completo + como melhorar */}
        <div className="mt-4 rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-5 sm:text-left">
            <TrustGauge score={trust.score} size={132} />
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-faint">
                Índice de confiança
              </p>
              <p className="mt-1 font-display text-[19px] font-semibold leading-tight text-ink">
                {trust.level}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                Seu perfil está quase lá. Cada item abaixo transmite mais confiança a quem visita.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {steps.map((f) => (
              <Link
                key={f.key}
                to={FACTOR_DEST[f.key] ?? '/painel'}
                className="flex items-center gap-3 rounded-lg border border-ink/10 bg-paper-soft p-2.5 transition-colors hover:border-burgundy/40"
              >
                <span className="flex h-8 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-brass/12 leading-none text-brass-deep">
                  <span className="text-[13px] font-semibold">+{f.points}</span>
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">{f.action}</span>
                {f.plan && (
                  <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                    {PLAN_LABEL[f.plan]}
                  </span>
                )}
                <ArrowRight width={15} height={15} className="shrink-0 text-ink-faint" />
              </Link>
            ))}
          </div>
        </div>

        {/* Vitrine de planos — todos liberados em teste */}
        <div className="mt-8">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-[11.5px] font-semibold text-brass-deep">
              <SparkIcon width={13} height={13} />
              Em teste · todos os planos liberados
            </span>
          </div>
          <h2 className="mt-3 text-center font-display text-[21px] font-semibold text-ink">
            Desbloqueie mais no seu perfil
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-center text-[13.5px] leading-relaxed text-ink-soft">
            Cada tópico é uma melhoria concreta — seu nome sem número, seu domínio e mais. Ative agora,
            sem pagar.
          </p>
          <div className="mt-5">
            <UpgradeTopics profile={profile} initial={intent} />
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link to="/painel" className="btn-ghost">
            Ir para o meu painel
            <ArrowRight width={16} height={16} />
          </Link>
        </div>
      </main>
    </div>
  )
}

