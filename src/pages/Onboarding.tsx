import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Plan, Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { sampleProfile } from '@/lib/mockData'
import { hasBlockingIssue } from '@/lib/oab'
import { parseOab } from '@/lib/brFormat'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { AiGenerator } from '@/components/editor/AiGenerator'
import { UnlockMore } from '@/components/editor/UnlockMore'
import { PhonePreview } from '@/components/editor/PhonePreview'
import { Field, TextArea, TextInput } from '@/components/editor/fields'
import { OabNumberInput, WhatsappInput } from '@/components/editor/inputs'
import { SparkIcon, ScaleIcon, ArrowRight, CheckIcon } from '@/components/ui/icons'

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
    oabVerified: false,
    oabStatus: 'none',
    areas: [{ id: nextId(), label: '', description: '' }],
    highlights: [],
    articles: [],
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
  const [step, setStep] = useState(WELCOME)
  const [aiOpen, setAiOpen] = useState(false)
  const [published, setPublished] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    document.title = 'Vamos criar seu perfil · advoc.me'
    api.getDraft().then((d) => setProfile(isUnstarted(d) ? blankEssentials(d) : d))
  }, [])

  // Plano escolhido na landing (?plan=). Aplicado em silêncio ao rascunho.
  // NOTA: login por e-mail desligado na fase de teste — planos pagos NÃO exigem
  // conta por enquanto (o gate de cadastro foi comentado). Reativar depois.
  useEffect(() => {
    if (!profile) return
    const wanted = searchParams.get('plan')
    if (wanted !== 'pro' && wanted !== 'premium') return
    searchParams.delete('plan')
    setSearchParams(searchParams, { replace: true })
    setProfile((p) => (p ? { ...p, plan: wanted as Plan } : p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // Salva o rascunho com debounce (mesmo armazenamento do editor).
  useEffect(() => {
    if (!profile) return
    const t = setTimeout(() => {
      api.saveDraft(profile).then((saved) => {
        if (saved?.slug && saved.slug !== profile.slug) {
          setProfile((p) => (p && p.slug !== saved.slug ? { ...p, slug: saved.slug } : p))
        }
      })
    }, 600)
    return () => clearTimeout(t)
  }, [profile])

  const blockedBio = useMemo(() => (profile ? hasBlockingIssue(profile.bio) : false), [profile])

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

  function publish() {
    set({ published: true })
    setPublished(true)
  }

  if (published) return <DoneScreen slug={profile.slug} />

  return (
    <div className="grain flex min-h-dvh flex-col bg-paper-deep">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <ScaleIcon width={20} height={20} className="text-burgundy" />
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
                <div className="grid grid-cols-[1fr_88px] gap-3">
                  <Field label="Cidade">
                    <TextInput
                      value={profile.city}
                      onChange={(e) => set({ city: e.target.value })}
                      placeholder="São Paulo"
                    />
                  </Field>
                  <Field label="Estado">
                    <TextInput
                      value={profile.state}
                      maxLength={2}
                      onChange={(e) => set({ state: e.target.value.toUpperCase() })}
                      placeholder="SP"
                    />
                  </Field>
                </div>
              </StepShell>
            )}

            {step === HOW && (
              <StepShell eyebrow={STEP_META[HOW].eyebrow} title="Como você atua?" subtitle="Sua área principal e uma breve apresentação.">
                <Field label="Área principal">
                  <TextInput
                    value={area.label}
                    autoFocus
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
                <button
                  type="button"
                  onClick={() => setAiOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border border-brass/40 bg-brass/10 px-4 py-2 text-[13.5px] font-semibold text-brass-deep transition-colors hover:bg-brass/20"
                >
                  <SparkIcon width={15} height={15} />
                  Gerar bio comigo
                </button>
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
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="h-28 w-28 overflow-hidden rounded-full border border-ink/12 bg-paper-soft">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-ink-faint/50">
                        <ScaleIcon width={30} height={30} />
                      </div>
                    )}
                  </div>
                  <Field label="Link da foto">
                    <TextInput
                      value={profile.avatarUrl ?? ''}
                      onChange={(e) => set({ avatarUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </Field>
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
                {/* Instiga, sem travar nem sair do fluxo: tocar aplica o plano ao
                    rascunho e o advogado publica já com os itens a mais. */}
                <UnlockMore plan={profile.plan} compact onPick={(plan) => set({ plan })} />
              </StepShell>
            )}
                </motion.div>
              </AnimatePresence>

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
                    onClick={publish}
                    disabled={!canPublish}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Publicar perfil
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

      <AnimatePresence>
        {aiOpen && (
          <AiGenerator
            kind="bio"
            name={profile.name}
            onApply={(text) => set({ bio: text })}
            onClose={() => setAiOpen(false)}
          />
        )}
      </AnimatePresence>
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
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-burgundy/10 text-burgundy"
      >
        <ScaleIcon width={32} height={32} />
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

function DoneScreen({ slug }: { slug: string }) {
  return (
    <div className="grain flex min-h-dvh flex-col items-center justify-center bg-paper-deep px-5 text-center">
      <motion.span
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 260 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-brass/20 text-brass-deep"
      >
        <CheckIcon width={34} height={34} strokeWidth={2.4} />
      </motion.span>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">Seu perfil está no ar.</h1>
      <div className="rule-brass mx-auto mt-5 w-24" />
      <p className="mt-5 max-w-sm text-[15.5px] leading-relaxed text-ink-soft">
        Pronto para compartilhar. Você melhora o resto quando quiser.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/painel" className="btn-primary">
          Ir para o meu painel
          <ArrowRight width={18} height={18} />
        </Link>
        <Link to={`/${slug}`} className="btn-ghost">
          Ver meu perfil
        </Link>
      </div>
    </div>
  )
}

