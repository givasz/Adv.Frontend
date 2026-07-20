import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  GenerateKind,
  ModerationStatus,
  OabStatus,
  Plan,
  PracticeArea,
  Profile,
  SocialKind,
} from '@/lib/types'
import { api } from '@/lib/api'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { allAreas } from '@/lib/mockData'
import { slugify } from '@/lib/brFormat'
import { checkCompliance, OAB_GUIDANCE_BY_FIELD } from '@/lib/oab'
import { validateSocialUrl } from '@/lib/socials'
import { getTheme, isThemeUnlocked, THEMES } from '@/lib/themes'
import { CHAR_LIMITS, NAME_MAX, canUseScheduling } from '@/lib/plans'
import { areaQuota, charQuota, featurePoints, nextPlan, type UpsellFeature } from '@/lib/upsell'
import { PhonePreview } from '@/components/editor/PhonePreview'
import { AiButton, AiGenerator } from '@/components/editor/AiGenerator'
import { Card, Field, TextArea, TextInput, Toggle } from '@/components/editor/fields'
import { InfoTip } from '@/components/editor/InfoTip'
import { PlanBadge } from '@/components/editor/PlanBadge'
import { ThemePicker } from '@/components/editor/ThemePicker'
import { EditorialIdeas } from '@/components/editor/EditorialIdeas'
import { LegalDocsCard } from '@/components/editor/LegalDocsCard'
import { BrandingCard } from '@/components/editor/BrandingCard'
import { SchedulingCard } from '@/components/editor/SchedulingCard'
import { MarginNotes } from '@/components/editor/MarginNotes'
import { UpsellCard } from '@/components/editor/UpsellCard'
import { FeatureUpsellModal } from '@/components/editor/UnlockMore'
import { GhostSlot, LockedFeature, QuotaCounter, TrustPointsChip } from '@/components/editor/upsellBits'
import { OabNumberInput, WhatsappInput } from '@/components/editor/inputs'
import { CheckIcon, ScaleIcon, TrashIcon, CopyIcon } from '@/components/ui/icons'
import { socialMeta } from '@/components/ui/icons'

type AiTarget = { kind: GenerateKind; areaId?: string; areaLabel?: string } | null
type SectionId =
  | 'identidade'
  | 'bio'
  | 'redes'
  | 'agenda'
  | 'aparencia'
  | 'marca'
  | 'oab'
  | 'destaques'
  | 'conteudo'
  | 'analytics'
  | 'qrcode'
  | 'plano'

let uid = 0
const nextId = () => `id-${Date.now()}-${uid++}`

// Cada seção do editor é um passo do assistente, aberto a partir de um card do painel.
// Título e subtítulo conversam com o advogado — nada de "Configurações".
const SECTIONS: Record<SectionId, { title: string; subtitle: string }> = {
  identidade: { title: 'Seu perfil', subtitle: 'Seus dados e como você aparece para quem chega.' },
  bio: { title: 'Sua apresentação', subtitle: 'Poucas linhas sobre você. A IA pode começar.' },
  redes: { title: 'Seus canais', subtitle: 'Por onde os clientes falam com você.' },
  agenda: { title: 'Sua agenda', subtitle: 'Deixe que marquem um horário direto no perfil.' },
  aparencia: { title: 'A cara do perfil', subtitle: 'Escolha um visual que combine com você.' },
  marca: { title: 'Sua marca', subtitle: 'Domínio próprio e identidade sem a marca advoc.me.' },
  oab: { title: 'Confirmar sua OAB', subtitle: 'A gente confere e mostra que seu registro é real.' },
  destaques: { title: 'Seus destaques', subtitle: 'Experiência e formação, sem citar clientes.' },
  conteudo: { title: 'Conteúdo e documentos', subtitle: 'Publique artigos e reúna seus termos legais.' },
  analytics: { title: 'Quem visita você', subtitle: 'Descubra como as pessoas encontram seu perfil.' },
  qrcode: { title: 'Seu cartão digital', subtitle: 'Um QR Code para compartilhar onde quiser.' },
  plano: { title: 'Seu plano', subtitle: 'Troque quando quiser. Mais recursos, mais alcance.' },
}

const SECTION_IDS = Object.keys(SECTIONS) as SectionId[]

export default function Editor() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saved, setSaved] = useState(true)
  const [ai, setAi] = useState<AiTarget>(null)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  // Recurso que motivou o modal de upsell contextual (null = fechado).
  const [upsell, setUpsell] = useState<UpsellFeature | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const sectionParam = searchParams.get('section')
  const section: SectionId = SECTION_IDS.includes(sectionParam as SectionId)
    ? (sectionParam as SectionId)
    : 'identidade'

  useEffect(() => {
    api.getDraft().then(setProfile)
    document.title = 'Editar · advoc.me'
  }, [])

  // salva com debounce quando o rascunho muda
  useEffect(() => {
    if (!profile) return
    setSaved(false)
    const t = setTimeout(() => {
      api.saveDraft(profile).then((saved) => {
        setSaved(true)
        if (saved?.slug) {
          setProfile((p) => (p && p.slug !== saved.slug ? { ...p, slug: saved.slug } : p))
        }
      })
    }, 700)
    return () => clearTimeout(t)
  }, [profile])

  const bioIssues = useMemo(() => (profile ? checkCompliance(profile.bio) : []), [profile])

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  const set = (patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p))
  const applyPlan = (plan: Plan) => {
    const stillOk = isThemeUnlocked(getTheme(profile.theme), plan)
    set({ plan, theme: stillOk ? profile.theme : 'papel' })
  }
  // Login por e-mail desligado na fase de teste: a troca de plano é imediata,
  // sem exigir cadastro. Reativar o gate de conta quando o auth voltar.
  const changePlan = (plan: Plan) => applyPlan(plan)
  const lim = CHAR_LIMITS[profile.plan]

  const oabStatus: OabStatus = profile.oabStatus ?? (profile.oabVerified ? 'verified' : 'none')
  async function requestOab() {
    const res = await api.requestOabCheck()
    set({ oabStatus: res.oabStatus })
  }

  function applyAi(text: string) {
    if (!ai) return
    if (ai.kind === 'bio') set({ bio: text })
    else
      set({
        areas: profile!.areas.map((a) => (a.id === ai.areaId ? { ...a, description: text } : a)),
      })
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
            <span className="hidden text-[12px] text-ink-faint sm:inline" aria-live="polite">
              {saved ? 'Tudo salvo' : 'Salvando…'}
            </span>
            <Link to={`/${profile.slug}`} className="btn-primary !py-2 !px-4 text-[13px]" target="_blank">
              Ver perfil
            </Link>
            <AccountMenu compact />
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
        <div className={`mx-auto w-full max-w-2xl space-y-5 lg:max-w-none ${tab === 'preview' ? 'hidden lg:block' : ''}`}>
          <Link
            to="/painel"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition-colors hover:text-burgundy"
          >
            ‹ Voltar ao painel
          </Link>

          <ModerationBanner status={profile.moderationStatus} note={profile.moderationNote} />

          <div>
            <h2 className="font-display text-[24px] font-semibold leading-tight text-ink">{meta.title}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{meta.subtitle}</p>
          </div>

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
                  onAi={setAi}
                  onUpsell={setUpsell}
                />
              )}

              {section === 'bio' && (
                <Card title="Bio" action={<AiButton onClick={() => setAi({ kind: 'bio' })} />}>
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
                  <MarginNotes issues={bioIssues} />
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
                      onOpen={() => setUpsell('agenda')}
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
                  <ThemePicker
                    value={profile.theme}
                    plan={profile.plan}
                    onChange={(theme) => set({ theme })}
                    onWantUpgrade={() => setUpsell('themes')}
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
                    onChange={(patch) => set({ branding: { ...profile.branding, ...patch } })}
                  />
                </>
              )}

              {section === 'oab' && (
                <Card title="Conferência da OAB">
                  {profile.plan === 'free' ? (
                    <div className="space-y-3 rounded-lg border border-brass/25 bg-brass/[0.06] px-3.5 py-3">
                      <p className="text-[13px] leading-relaxed text-ink-soft">
                        A conferência da OAB e o selo{' '}
                        <span className="font-semibold text-brass-deep">“OAB conferida”</span> fazem
                        parte dos planos pagos.
                      </p>
                      <TrustPointsChip points={featurePoints('oab')} />
                      <button
                        type="button"
                        onClick={() => setUpsell('oab')}
                        className="btn-primary !py-2 !px-4 text-[13px]"
                      >
                        Ver o que muda
                      </button>
                    </div>
                  ) : (
                    <OabVerifyRow status={oabStatus} onRequest={requestOab} />
                  )}
                </Card>
              )}

              {section === 'destaques' && (
                <HighlightsSection profile={profile} set={set} lim={lim} />
              )}

              {section === 'analytics' && <AnalyticsSection profile={profile} />}

              {section === 'qrcode' && <QrSection profile={profile} />}

              {section === 'conteudo' && (
                <>
                  <ArticlesSection profile={profile} set={set} />
                  <EditorialIdeas areas={profile.areas.map((a) => a.label).filter(Boolean)} />
                  <LegalDocsCard profile={profile} />
                </>
              )}

              {section === 'plano' && (
                <Card title="Seu plano">
                  <PlanBadge plan={profile.plan} onChange={changePlan} />
                  <p className="text-[11.5px] leading-relaxed text-ink-faint">
                    Trocar de plano libera mais áreas, temas e recursos. Neste protótipo a troca é
                    imediata; no produto real vem da assinatura ativa.
                  </p>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between gap-3 pt-1">
            <Link to="/painel" className="btn-ghost">
              ‹ Painel
            </Link>
            <button type="button" onClick={() => navigate('/painel')} className="btn-primary">
              Pronto
            </button>
          </div>
        </div>

        {/* Coluna de prévia */}
        <div className={`lg:sticky lg:top-[80px] lg:self-start ${tab === 'edit' ? 'hidden lg:block' : ''}`}>
          <PhonePreview profile={profile} />
        </div>
      </div>

      <AnimatePresence>
        {ai && (
          <AiGenerator
            kind={ai.kind}
            areaLabel={ai.areaLabel}
            name={profile.name}
            onApply={applyAi}
            onClose={() => setAi(null)}
          />
        )}
      </AnimatePresence>

      {/* Modal de upsell focado no recurso que bateu o limite */}
      <AnimatePresence>
        {upsell && (
          <FeatureUpsellModal feature={upsell} plan={profile.plan} onClose={() => setUpsell(null)} />
        )}
      </AnimatePresence>
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
  onAi: (t: AiTarget) => void
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
                const untouched = p.slug === slugify(p.name)
                const slug = p.plan === 'free' || untouched ? slugify(name) : p.slug
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
              <div className="flex items-stretch overflow-hidden rounded-lg border border-ink/15 bg-paper-soft transition-colors focus-within:border-burgundy focus-within:ring-2 focus-within:ring-burgundy/15">
                <span className="flex select-none items-center bg-paper-deep px-3 text-[13px] text-ink-faint">
                  advoc.me/
                </span>
                <input
                  value={profile.slug}
                  onChange={(e) => set({ slug: slugify(e.target.value) })}
                  placeholder="seu-nome"
                  aria-label="Endereço personalizado do perfil"
                  className="w-full bg-transparent px-2 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:outline-none"
                />
              </div>
            )}
          </Field>
        </div>
        <Field label="Foto (URL)" hint="upload no backend real">
          <TextInput
            value={profile.avatarUrl ?? ''}
            onChange={(e) => set({ avatarUrl: e.target.value })}
            placeholder="https://…"
          />
        </Field>
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
      </Card>

      <Card title="Localização e atendimento">
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <Field label="Cidade">
            <TextInput value={profile.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="UF">
            <TextInput
              value={profile.state}
              maxLength={2}
              onChange={(e) => set({ state: e.target.value.toUpperCase() })}
            />
          </Field>
        </div>
        <Field label="Observação de região" hint="opcional">
          <TextInput
            value={profile.regionNote ?? ''}
            onChange={(e) => set({ regionNote: e.target.value })}
            placeholder="Atendimento em toda a Grande SP"
          />
        </Field>
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

function HighlightsSection({
  profile,
  set,
  lim,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  lim: (typeof CHAR_LIMITS)[Plan]
}) {
  return (
    <Card title="Experiência / destaques">
      {profile.highlights.map((h) => (
        <div key={h.id} className="grid gap-2 rounded-lg border border-ink/10 bg-paper-soft p-3">
          <div>
            <TextInput
              value={h.title}
              maxLength={lim.highlightTitle}
              placeholder="12 anos de atuação"
              onChange={(e) =>
                set({ highlights: profile.highlights.map((x) => (x.id === h.id ? { ...x, title: e.target.value } : x)) })
              }
            />
            <div className="mt-1 flex justify-end">
              <QuotaCounter quota={charQuota(profile.plan, 'highlightTitle', h.title.length)} />
            </div>
          </div>
          <div>
            <TextInput
              value={h.detail}
              maxLength={lim.highlightDetail}
              placeholder="Detalhe genérico, sem identificar clientes"
              onChange={(e) =>
                set({ highlights: profile.highlights.map((x) => (x.id === h.id ? { ...x, detail: e.target.value } : x)) })
              }
            />
            <div className="mt-1 flex justify-end">
              <QuotaCounter quota={charQuota(profile.plan, 'highlightDetail', h.detail.length)} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => set({ highlights: profile.highlights.filter((x) => x.id !== h.id) })}
            aria-label="Remover destaque"
            className="inline-flex items-center gap-1.5 justify-self-start rounded-lg border border-ink/10 px-2.5 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:border-burgundy/40 hover:bg-burgundy/[0.06] hover:text-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/20"
          >
            <TrashIcon width={13} height={13} />
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => set({ highlights: [...profile.highlights, { id: nextId(), title: '', detail: '' }] })}
        className="btn-ghost w-full border-dashed"
      >
        + Adicionar destaque
      </button>
    </Card>
  )
}

// Editor de artigos educativos — alimenta a seção "Conteúdo" do perfil público
// (que só existe quando há artigos). Caráter informativo, nunca marketing/captação.
function ArticlesSection({
  profile,
  set,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
}) {
  const articles = profile.articles ?? []
  const update = (id: string, patch: Partial<(typeof articles)[number]>) =>
    set({ articles: articles.map((a) => (a.id === id ? { ...a, ...patch } : a)) })

  return (
    <Card
      title="Conteúdo"
      action={<span className="text-[12px] text-ink-faint">{articles.length} artigo(s)</span>}
    >
      <p className="-mt-1 text-[12px] leading-relaxed text-ink-faint">
        Artigos informativos aparecem no seu perfil e aumentam sua autoridade. Tom educativo, sem
        prometer resultado nem citar clientes.
      </p>
      {articles.map((art) => (
        <div key={art.id} className="grid gap-2 rounded-lg border border-ink/10 bg-paper-soft p-3">
          <TextInput
            value={art.title}
            maxLength={90}
            placeholder="Título do artigo"
            onChange={(e) => update(art.id, { title: e.target.value })}
          />
          <TextArea
            rows={2}
            value={art.summary}
            maxLength={200}
            placeholder="Resumo curto — o que o leitor aprende"
            onChange={(e) => update(art.id, { summary: e.target.value })}
          />
          <div className="flex gap-2">
            <input
              value={art.readingMinutes || ''}
              inputMode="numeric"
              placeholder="min"
              aria-label="Minutos de leitura"
              onChange={(e) =>
                update(art.id, { readingMinutes: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) })
              }
              className="w-20 rounded-lg border border-ink/15 bg-paper px-3 py-2 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
            />
            <TextInput
              value={art.url ?? ''}
              placeholder="Link (opcional) — https://…"
              onChange={(e) => update(art.id, { url: e.target.value || undefined })}
            />
          </div>
          <button
            type="button"
            onClick={() => set({ articles: articles.filter((a) => a.id !== art.id) })}
            aria-label="Remover artigo"
            className="inline-flex items-center gap-1.5 justify-self-start rounded-lg border border-ink/10 px-2.5 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:border-burgundy/40 hover:bg-burgundy/[0.06] hover:text-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/20"
          >
            <TrashIcon width={13} height={13} />
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          set({
            articles: [...articles, { id: nextId(), title: '', summary: '', readingMinutes: 5 }],
          })
        }
        className="btn-ghost w-full border-dashed"
      >
        + Adicionar artigo
      </button>
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

// QR Code / cartão digital — compartilhar funciona para todos; QR personalizado é PRO.
function QrSection({ profile }: { profile: Profile }) {
  const [copied, setCopied] = useState(false)
  const url = `advoc.me/${profile.slug}`
  const copy = () => {
    navigator.clipboard?.writeText(`https://${url}`).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      },
      () => {},
    )
  }
  return (
    <div className="space-y-4">
      <Card title="Seu endereço">
        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 items-center rounded-lg border border-ink/15 bg-paper-soft px-3.5 text-[14px] text-ink">
            {url}
          </div>
          <button type="button" onClick={copy} className="btn-ghost shrink-0">
            <CopyIcon width={15} height={15} />
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <Link to={`/${profile.slug}`} target="_blank" className="btn-ghost w-full">
          Ver meu cartão digital
        </Link>
      </Card>
      {profile.plan === 'free' && (
        <UpsellCard
          plan="pro"
          title="Um QR Code com a sua cara"
          body="Compartilhe seu perfil com um QR Code personalizado — perfeito para cartões, vitrines e assinaturas."
          bullets={['QR Code personalizado', 'Cartão de contato (vCard)', 'Pronto para imprimir']}
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

// Conferência da OAB — feita pela plataforma, nunca auto-declarada pelo advogado.
function OabVerifyRow({ status, onRequest }: { status: OabStatus; onRequest: () => void }) {
  if (status === 'verified') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2.5">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brass/20 text-brass-deep">
          <CheckIcon width={11} height={11} strokeWidth={2.6} />
        </span>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-brass-deep">OAB conferida</span> — o número foi conferido pela
          plataforma. Não é selo oficial da OAB.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-ink/12 bg-paper-soft px-3 py-2.5">
      {status === 'pending' ? (
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-soft">
          <span className="h-2 w-2 rounded-full bg-brass-deep/70" />
          Conferência solicitada · em análise
        </p>
      ) : (
        <div className="flex items-center gap-2">
          {status === 'rejected' && (
            <span className="text-[12.5px] font-medium text-burgundy-deep">Conferência não aprovada.</span>
          )}
          <button type="button" onClick={onRequest} className="text-[13px] font-semibold text-burgundy hover:underline">
            {status === 'rejected' ? 'Solicitar novamente' : 'Solicitar conferência da OAB'}
          </button>
        </div>
      )}
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
        A conferência é feita pela plataforma no cadastro da OAB. Você não pode se marcar como conferido.
      </p>
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
        <p className="mt-1 text-right text-[11px] text-ink-faint">
          {area.description.length}/{descLimit}
        </p>
      </div>
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
