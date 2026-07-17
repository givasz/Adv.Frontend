import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Plan, Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { sampleProfile } from '@/lib/mockData'
import { hasBlockingIssue } from '@/lib/oab'
import { parseOab } from '@/lib/brFormat'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { AiGenerator } from '@/components/editor/AiGenerator'
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
  const { isAuthed } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    document.title = 'Vamos criar seu perfil · advoc.me'
    api.getDraft().then((d) => setProfile(isUnstarted(d) ? blankEssentials(d) : d))
  }, [])

  // Plano escolhido na landing (?plan=). Planos pagos exigem conta — deslogado vai
  // ao cadastro e volta. Aplicado em silêncio: nenhuma escolha de plano no fluxo.
  useEffect(() => {
    if (!profile) return
    const wanted = searchParams.get('plan')
    if (wanted !== 'pro' && wanted !== 'premium') return
    if (!isAuthed) {
      navigate(`/criar-conta?next=${encodeURIComponent(`/comecar?plan=${wanted}`)}`)
      return
    }
    searchParams.delete('plan')
    setSearchParams(searchParams, { replace: true })
    setProfile((p) => (p ? { ...p, plan: wanted as Plan } : p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isAuthed])

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

      {/* Progresso discreto — só bolinhas, sem número nem jargão */}
      {step > WELCOME && (
        <div className="mx-auto flex w-full max-w-lg items-center gap-1.5 px-5">
          {[WHO, HOW, CONTACT, PHOTO, REVIEW].map((s) => (
            <span
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-burgundy' : 'bg-ink/12'
              }`}
            />
          ))}
        </div>
      )}

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-1 flex-col"
          >
            {step === WELCOME && <WelcomeStep onStart={goNext} />}

            {step === WHO && (
              <StepShell title="Quem é você?" subtitle="Seus dados básicos de advogado(a).">
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
              <StepShell title="Como você atua?" subtitle="Sua área principal e uma breve apresentação.">
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
              <StepShell title="Sua foto" subtitle="Um rosto aproxima quem chega. Dá para adicionar depois.">
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
              <StepShell title="Ficou assim." subtitle="Confira e publique. Você melhora o resto quando quiser.">
                <div className="flex justify-center">
                  <PhonePreview profile={profile} />
                </div>
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

          {step === WELCOME ? null : step === REVIEW ? (
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
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.span
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-burgundy/10 text-burgundy"
      >
        <ScaleIcon width={32} height={32} />
      </motion.span>
      <h1 className="mt-6 font-display text-3xl font-semibold text-ink sm:text-4xl">
        Vamos criar seu perfil.
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
        Leva menos de 3 minutos. A gente te guia em cada passo.
      </p>
      <button type="button" onClick={onStart} className="btn-primary mt-8">
        Começar
        <ArrowRight width={18} height={18} />
      </button>
    </div>
  )
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col">
      <h2 className="font-display text-[26px] font-semibold leading-tight text-ink">{title}</h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{subtitle}</p>
      <div className="mt-6 space-y-4">{children}</div>
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
      <p className="mt-3 max-w-sm text-[15.5px] leading-relaxed text-ink-soft">
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

