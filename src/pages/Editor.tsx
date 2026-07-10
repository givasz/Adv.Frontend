import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
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
import { useAuth } from '@/lib/auth'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { allAreas } from '@/lib/mockData'
import { resolveSchedulingMode } from '@/lib/booking'
import { checkCompliance, OAB_GUIDANCE, OAB_GUIDANCE_BY_FIELD, policyOutdated, RULESET_REV } from '@/lib/oab'
import { validateSocialUrl } from '@/lib/socials'
import { openAuditReport } from '@/lib/auditReport'
import { getTheme, isThemeUnlocked, THEMES } from '@/lib/themes'
import { AREA_LIMIT, CHAR_LIMITS, NAME_MAX } from '@/lib/plans'
import { PhonePreview } from '@/components/editor/PhonePreview'
import { AiButton, AiGenerator } from '@/components/editor/AiGenerator'
import { Card, Field, TextArea, TextInput, Toggle } from '@/components/editor/fields'
import { InfoTip } from '@/components/editor/InfoTip'
import { PlanBadge } from '@/components/editor/PlanBadge'
import { ThemePicker } from '@/components/editor/ThemePicker'
import { ProtectionIntro } from '@/components/editor/ProtectionIntro'
import { PolicyUpdateBanner } from '@/components/editor/PolicyUpdateBanner'
import { EditorialIdeas } from '@/components/editor/EditorialIdeas'
import { LegalDocsCard } from '@/components/editor/LegalDocsCard'
import { BrandingCard } from '@/components/editor/BrandingCard'
import { SchedulingCard } from '@/components/editor/SchedulingCard'
import { MarginNotes } from '@/components/editor/MarginNotes'
import { CalendarIcon, ChevronDown, CheckIcon, DotIcon, InfoIcon, ScaleIcon, TrashIcon, XIcon } from '@/components/ui/icons'
import { socialMeta } from '@/components/ui/icons'

type AiTarget = { kind: GenerateKind; areaId?: string; areaLabel?: string } | null

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

let uid = 0
const nextId = () => `id-${Date.now()}-${uid++}`

// ---- OAB: UF (seccional) + número com máscara ----
const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

// Formata só os dígitos com ponto de milhar: "123456" → "123.456". Máx. 6 dígitos.
function formatOabDigits(d: string): string {
  const clean = d.replace(/\D/g, '').slice(0, 6)
  return clean.length <= 3 ? clean : `${clean.slice(0, clean.length - 3)}.${clean.slice(-3)}`
}
// Extrai UF e dígitos de "OAB/SP 123.456".
function parseOab(v: string): { uf: string; digits: string } {
  const m = /OAB\/([A-Za-z]{2})\s*([\d.]*)/.exec(v || '')
  return m ? { uf: m[1].toUpperCase(), digits: m[2].replace(/\D/g, '') } : { uf: '', digits: '' }
}
// Recompõe "OAB/UF 123.456". Vazio se não houver UF.
function composeOab(uf: string, digits: string): string {
  if (!uf) return ''
  const num = formatOabDigits(digits)
  return num ? `OAB/${uf} ${num}` : `OAB/${uf}`
}

// Máscara de telefone BR (parte local, sem DDI): "(11) 99887-7665".
function maskBrLocal(local: string): string {
  const d = local.replace(/\D/g, '').slice(0, 11)
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  if (!ddd) return ''
  let out = `(${ddd}`
  if (d.length >= 2) out += ') '
  if (rest) {
    const split = rest.length > 8 ? 5 : 4 // 9 dígitos (celular) → 5-4; senão 4-4
    out += rest.length > 4 ? `${rest.slice(0, split)}-${rest.slice(split)}` : rest
  }
  return out.trimEnd()
}

export default function Editor() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saved, setSaved] = useState(true)
  const [ai, setAi] = useState<AiTarget>(null)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [step, setStep] = useState(0)
  const [pendingBookings, setPendingBookings] = useState(0)
  const { isAuthed } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Manda para a página de cadastro (conta é obrigatória nos planos pagos) e volta
  // ao editor já aplicando o plano escolhido via ?plan=.
  const gotoSignupForPlan = (plan: Plan) =>
    navigate(`/criar-conta?next=${encodeURIComponent(`/editor?plan=${plan}`)}`)

  useEffect(() => {
    api.getDraft().then(setProfile)
    document.title = 'Editor · advoc.me'
  }, [])

  // Contador de solicitações pendentes — alimenta o badge do link "Agenda".
  useEffect(() => {
    api
      .getMyBookings()
      .then((list) => setPendingBookings(list.filter((b) => b.status === 'pending').length))
      .catch(() => setPendingBookings(0))
  }, [])

  // Consome ?plan=pro|premium (vindo da Landing): aplica o plano escolhido ou,
  // se deslogado, abre o cadastro (conta é obrigatória nos planos pagos).
  useEffect(() => {
    if (!profile) return
    const wanted = searchParams.get('plan')
    if (wanted !== 'pro' && wanted !== 'premium') return
    // Deslogado → vai criar conta (mantém o ?plan= no next para reaplicar ao voltar).
    if (!isAuthed) {
      gotoSignupForPlan(wanted)
      return
    }
    searchParams.delete('plan') // consome para não reaplicar
    setSearchParams(searchParams, { replace: true })
    const stillOk = isThemeUnlocked(getTheme(profile.theme), wanted)
    setProfile((p) => (p ? { ...p, plan: wanted, theme: stillOk ? p.theme : 'papel' } : p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isAuthed, searchParams, setSearchParams])

  // salva com debounce quando o rascunho muda
  useEffect(() => {
    if (!profile) return
    setSaved(false)
    const t = setTimeout(() => {
      api.saveDraft(profile).then((saved) => {
        setSaved(true)
        // No modo real, o backend resolve o slug definitivo (nomes iguais / perk do Max).
        // Sincroniza de volta só o slug, sem sobrescrever edições em andamento.
        if (saved?.slug) {
          setProfile((p) => (p && p.slug !== saved.slug ? { ...p, slug: saved.slug } : p))
        }
      })
    }, 700)
    return () => clearTimeout(t)
  }, [profile])

  const bioIssues = useMemo(() => (profile ? checkCompliance(profile.bio) : []), [profile])
  // Conformidade de todo o conteúdo público (bio + descrições de áreas) — usada na revisão.
  const reviewIssues = useMemo(
    () =>
      profile
        ? [profile.bio, ...profile.areas.map((a) => a.description)].flatMap((t) => checkCompliance(t))
        : [],
    [profile],
  )

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  const set = (patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p))
  // Aplica o plano de fato — mantém o tema só se ainda estiver desbloqueado no novo plano.
  const applyPlan = (plan: Plan) => {
    const stillOk = isThemeUnlocked(getTheme(profile.theme), plan)
    set({ plan, theme: stillOk ? profile.theme : 'papel' })
  }
  // Troca de plano: assinar um plano PAGO exige conta. Deslogado → abre o cadastro
  // e segura o plano escolhido; aplica após entrar. Free nunca exige conta.
  const changePlan = (plan: Plan) => {
    if (plan !== 'free' && !isAuthed) {
      gotoSignupForPlan(plan)
      return
    }
    applyPlan(plan)
  }
  const schedulingMode = resolveSchedulingMode(profile)
  const areaLimit = AREA_LIMIT[profile.plan]
  const lim = CHAR_LIMITS[profile.plan] // limites de caracteres do plano atual

  // Wizard: uma etapa por vez (a última é a revisão/publicação).
  const STEPS = ['Identidade', 'Bio', 'Atuação', 'Localização', 'Contato', 'Aparência', 'Revisar']
  const lastStep = STEPS.length - 1
  const goNext = () => setStep((s) => Math.min(lastStep, s + 1))
  const goBack = () => setStep((s) => Math.max(0, s - 1))
  const blockedToPublish = reviewIssues.some((i) => i.severity === 'block')

  // Estado de conferência da OAB (deriva de oabVerified em rascunhos antigos).
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

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper-deep">
      <h1 className="sr-only">Editor de perfil — advoc.me</h1>
      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            advoc.me
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-[12px] text-ink-faint sm:inline" aria-live="polite">
              {saved ? 'Tudo salvo' : 'Salvando…'}
            </span>
            {schedulingMode === 'native' && (
              <Link
                to="/agenda"
                className="relative inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-burgundy/50"
              >
                <CalendarIcon width={16} height={16} className="text-burgundy" />
                Agenda
                {pendingBookings > 0 && (
                  <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-burgundy px-1 text-[11px] font-bold text-paper-soft">
                    {pendingBookings}
                  </span>
                )}
              </Link>
            )}
            <Link
              to={`/${profile.slug}`}
              className="btn-primary !py-2 !px-4 text-[13px]"
              target="_blank"
            >
              Ver perfil
            </Link>
            <AccountMenu compact />
          </div>
        </div>
      </header>

      {/* Alternância mobile */}
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
        <div
          className={`mx-auto w-full max-w-2xl space-y-5 lg:max-w-none ${
            tab === 'preview' ? 'hidden lg:block' : ''
          }`}
        >
          <ProtectionIntro />

          {/* Plano atual — sempre visível e trocável a qualquer momento */}
          <div>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                Seu plano
              </span>
              <span className="text-[11px] text-ink-faint">troque quando quiser</span>
            </div>
            <PlanBadge plan={profile.plan} onChange={changePlan} />
          </div>

          <Stepper steps={STEPS} current={step} onGo={setStep} />

          <ModerationBanner status={profile.moderationStatus} note={profile.moderationNote} />

          {policyOutdated(profile.policyRevChecked) && (
            <PolicyUpdateBanner
              reviewCount={reviewIssues.length}
              onReviewed={() => set({ policyRevChecked: RULESET_REV })}
            />
          )}

          {step === 5 && (
            <>
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
              onWantUpgrade={(theme, tier) => {
                // "Assinar" o plano exige conta: deslogado → página de cadastro.
                if (!isAuthed) {
                  gotoSignupForPlan(tier)
                  return
                }
                set({ plan: tier, theme })
              }}
            />
            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              Temas <span className="font-semibold">Pro</span> e{' '}
              <span className="font-semibold">Premium</span> ficam disponíveis conforme o plano.
              Clicar num tema bloqueado simula o upgrade neste protótipo.
            </p>
          </Card>

          <BrandingCard
            plan={profile.plan}
            branding={profile.branding}
            onChange={(patch) => set({ branding: { ...profile.branding, ...patch } })}
          />
            </>
          )}

          {step === 0 && (
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
                    // Free: endereço sempre segue o nome. Pro/Max: só segue enquanto não
                    // for personalizado (ou seja, enquanto o slug ainda espelhar o nome).
                    const untouched = p.slug === slugify(p.name)
                    const slug = p.plan === 'free' || untouched ? slugify(name) : p.slug
                    return { ...p, name, slug }
                  })
                }}
              />
            </Field>
            <div className="grid gap-4">
              <Field label="Número da OAB" hint="UF + número">
                <OabNumberInput
                  value={profile.oabNumber}
                  onChange={(oabNumber) => set({ oabNumber })}
                />
              </Field>
              <Field
                label="Endereço do perfil"
                hint={profile.plan === 'free' ? 'gerado do nome' : 'personalizável'}
              >
                {profile.plan === 'free' ? (
                  <TextInput
                    value={`advoc.me/${profile.slug}`}
                    readOnly
                    className="!bg-paper-deep text-ink-faint"
                  />
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
            <p className="-mt-1 text-[11.5px] leading-relaxed text-ink-faint">
              {profile.plan === 'free' ? (
                <>
                  No <span className="font-semibold">Free</span>, o endereço vem do seu nome +{' '}
                  <span className="font-medium">números</span> (ex.: <span className="font-medium">marina-sales-4827</span>).
                  A partir do <span className="font-semibold">Pro</span> você pode{' '}
                  <span className="font-medium">editar</span> e deixar limpo (se disponível); no{' '}
                  <span className="font-semibold">Max</span>, ainda ganha domínio próprio.
                </>
              ) : (
                <span className="text-brass-deep">
                  Você pode personalizar o endereço. Se estiver disponível, ele fica exatamente como você
                  digitou; se já estiver em uso, adicionamos um número. O endereço final é confirmado ao salvar.
                </span>
              )}
            </p>
            {/* Conferência de OAB é recurso dos planos pagos — no Free não aparece. */}
            {profile.plan !== 'free' && <OabVerifyRow status={oabStatus} onRequest={requestOab} />}
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
          )}

          {step === 1 && (
          <Card
            title="Bio"
            action={<AiButton onClick={() => setAi({ kind: 'bio' })} />}
          >
            <Field
              label="Sobre você"
              hint={`${profile.bio.length}/${lim.bio}`}
              info={<InfoTip items={OAB_GUIDANCE_BY_FIELD.bio} title="O que a OAB permite na bio" />}
            >
              <TextArea
                rows={4}
                value={profile.bio}
                maxLength={lim.bio}
                onChange={(e) => set({ bio: e.target.value })}
                placeholder="Escreva ou gere com IA…"
              />
            </Field>
            <MarginNotes issues={bioIssues} />
          </Card>
          )}

          {step === 3 && (
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
          )}

          {step === 2 && (
          <Card
            title="Áreas de atuação"
            action={
              <span className="text-[12px] text-ink-faint">
                {profile.areas.length}/{areaLimit}
              </span>
            }
          >
            {profile.areas.map((area) => (
              <AreaEditor
                key={area.id}
                area={area}
                descLimit={lim.areaDesc}
                onChange={(patch) =>
                  set({
                    areas: profile.areas.map((a) => (a.id === area.id ? { ...a, ...patch } : a)),
                  })
                }
                onRemove={() => set({ areas: profile.areas.filter((a) => a.id !== area.id) })}
                onAi={() => setAi({ kind: 'area', areaId: area.id, areaLabel: area.label })}
              />
            ))}
            {profile.areas.length < areaLimit ? (
              <button
                type="button"
                onClick={() =>
                  set({
                    areas: [...profile.areas, { id: nextId(), label: '', description: '' }],
                  })
                }
                className="btn-ghost w-full border-dashed"
              >
                + Adicionar área
              </button>
            ) : (
              <p className="rounded-lg bg-brass/10 px-3 py-2 text-[12.5px] text-brass-deep">
                Limite do plano {profile.plan.toUpperCase()} atingido. Faça upgrade para mais áreas.
              </p>
            )}
          </Card>
          )}

          {step === 4 && (
          <Card title="Redes e contato">
            <p className="-mt-1 flex items-start gap-2 rounded-lg bg-brass/[0.08] px-3 py-2 text-[11.5px] leading-relaxed text-brass-deep">
              <InfoIcon width={14} height={14} className="mt-0.5 shrink-0" />
              <span>
                Use apenas <span className="font-semibold">canais profissionais</span> — o perfil que
                você divulga como advogado(a), não o pessoal. É o que o Provimento 205/2021 exige dos
                links de contato.
              </span>
            </p>
            <div className="grid gap-3">
              {(Object.keys(socialMeta) as SocialKind[]).map((kind) => {
                const existing = profile.socials.find((s) => s.kind === kind)
                const check = validateSocialUrl(kind, existing?.url ?? '')
                const warn = check.status === 'invalid' || check.status === 'mismatch'
                return (
                  <Field key={kind} label={socialMeta[kind].label}>
                    <TextInput
                      value={existing?.url ?? ''}
                      placeholder={`https://…`}
                      aria-invalid={warn}
                      onChange={(e) => {
                        const url = e.target.value
                        const rest = profile.socials.filter((s) => s.kind !== kind)
                        set({ socials: url ? [...rest, { kind, url }] : rest })
                      }}
                    />
                    {warn && (
                      <p className="mt-1 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-brass-deep">
                        <InfoIcon width={13} height={13} className="mt-0.5 shrink-0" />
                        {check.message}
                      </p>
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
            <div className="rule-brass my-1" />
            <div>
              <span className="mb-2 block text-[13px] font-semibold text-ink">Agendamento</span>
              <SchedulingCard profile={profile} set={set} />
            </div>
          </Card>
          )}

          {step === 4 && <LegalDocsCard profile={profile} />}

          {step === 2 && (
          <Card title="Experiência / destaques">
            {profile.highlights.map((h) => (
              <div key={h.id} className="grid gap-2 rounded-lg border border-ink/10 bg-paper-soft p-3">
                <TextInput
                  value={h.title}
                  maxLength={lim.highlightTitle}
                  placeholder="12 anos de atuação"
                  onChange={(e) =>
                    set({
                      highlights: profile.highlights.map((x) =>
                        x.id === h.id ? { ...x, title: e.target.value } : x,
                      ),
                    })
                  }
                />
                <TextInput
                  value={h.detail}
                  maxLength={lim.highlightDetail}
                  placeholder="Detalhe genérico, sem identificar clientes"
                  onChange={(e) =>
                    set({
                      highlights: profile.highlights.map((x) =>
                        x.id === h.id ? { ...x, detail: e.target.value } : x,
                      ),
                    })
                  }
                />
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
              onClick={() =>
                set({ highlights: [...profile.highlights, { id: nextId(), title: '', detail: '' }] })
              }
              className="btn-ghost w-full border-dashed"
            >
              + Adicionar destaque
            </button>
          </Card>
          )}

          {step === 2 && <EditorialIdeas areas={profile.areas.map((a) => a.label).filter(Boolean)} />}

          {step === 6 && (
            <ReviewStep
              profile={profile}
              issues={reviewIssues}
              blocked={blockedToPublish}
              onEdit={setStep}
            />
          )}

          {(step === 1 || step === 2) && <OabHelp />}

          <StepNav
            step={step}
            lastStep={lastStep}
            blocked={blockedToPublish}
            published={!!profile.published}
            slug={profile.slug}
            onBack={goBack}
            onNext={goNext}
            onPublish={() => set({ published: true })}
          />
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
    </div>
  )
}

// Aviso de moderação — mostrado ao dono quando o perfil recebeu aviso, censura
// parcial ou restrição por decisão do moderador (denúncias avaliadas).
function ModerationBanner({
  status,
  note,
}: {
  status?: ModerationStatus
  note?: string
}) {
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
    <div
      className={`rounded-xl2 border px-4 py-3 ${
        meta.danger
          ? 'border-burgundy/30 bg-burgundy/[0.06]'
          : 'border-brass/30 bg-brass/[0.08]'
      }`}
    >
      <p className={`text-[13px] font-semibold ${meta.danger ? 'text-burgundy-deep' : 'text-brass-deep'}`}>
        {meta.title}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{meta.body}</p>
      {note && (
        <p className="mt-2 rounded-lg bg-paper/70 px-3 py-2 text-[12.5px] leading-relaxed text-ink">
          <span className="font-medium text-ink-faint">Moderador:</span> {note}
        </p>
      )}
    </div>
  )
}

// Barra de progresso do wizard — segmentos clicáveis + rótulo da etapa atual.
function Stepper({
  steps,
  current,
  onGo,
}: {
  steps: string[]
  current: number
  onGo: (i: number) => void
}) {
  return (
    <div className="rounded-xl2 border border-ink/10 bg-paper p-3 shadow-card">
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => onGo(i)}
            aria-label={`Ir para ${s}`}
            aria-current={i === current}
            title={s}
            className="group -my-2 flex-1 py-2"
          >
            <span
              className={`block h-1.5 rounded-full transition-colors ${
                i <= current ? 'bg-burgundy' : 'bg-ink/15 group-hover:bg-ink/25'
              }`}
            />
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between">
        <span className="font-display text-[15px] font-semibold text-ink">
          {current + 1}. {steps[current]}
        </span>
        <span className="text-[12px] text-ink-faint">
          Passo {current + 1} de {steps.length}
        </span>
      </div>
    </div>
  )
}

// Navegação Voltar / Próximo — na última etapa vira Publicar (ou "Ver perfil" se já publicado).
function StepNav({
  step,
  lastStep,
  blocked,
  published,
  slug,
  onBack,
  onNext,
  onPublish,
}: {
  step: number
  lastStep: number
  blocked: boolean
  published: boolean
  slug: string
  onBack: () => void
  onNext: () => void
  onPublish: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <button
        type="button"
        onClick={onBack}
        disabled={step === 0}
        className="btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
      >
        ‹ Voltar
      </button>
      {step < lastStep ? (
        <button type="button" onClick={onNext} className="btn-primary">
          Próximo ›
        </button>
      ) : published ? (
        <Link to={`/${slug}`} target="_blank" className="btn-primary">
          Perfil publicado · Ver
        </Link>
      ) : (
        <button
          type="button"
          onClick={onPublish}
          disabled={blocked}
          title={blocked ? 'Corrija as pendências de conformidade antes de publicar' : undefined}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Publicar perfil
        </button>
      )}
    </div>
  )
}

// Conferência da OAB — feita pela plataforma, nunca auto-declarada pelo advogado.
// Ver docs/oab-verificacao-escalonamento.md.
function OabVerifyRow({ status, onRequest }: { status: OabStatus; onRequest: () => void }) {
  if (status === 'verified') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2.5">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brass/20 text-brass-deep">
          <CheckIcon width={11} height={11} strokeWidth={2.6} />
        </span>
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-brass-deep">OAB conferida</span> — o número foi conferido
          pela plataforma. Não é selo oficial da OAB.
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
            <span className="text-[12.5px] font-medium text-burgundy-deep">
              Conferência não aprovada.
            </span>
          )}
          <button
            type="button"
            onClick={onRequest}
            className="text-[13px] font-semibold text-burgundy hover:underline"
          >
            {status === 'rejected' ? 'Solicitar novamente' : 'Solicitar conferência da OAB'}
          </button>
        </div>
      )}
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
        A conferência é feita pela plataforma no CNA da OAB. Você não pode se marcar como conferido.
      </p>
    </div>
  )
}

// Campo de WhatsApp com máscara BR: prefixo fixo +55 e parte local "(DD) 99887-7665".
// Guarda apenas dígitos com DDI ("5511998877665") — formato usado no link do wa.me.
// Campo de OAB: seletor de UF (seccional) + número com máscara (ponto de milhar
// automático, máx. 6 dígitos). Guarda como "OAB/UF 123.456". Começa vazio.
function OabNumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { uf, digits } = parseOab(value)
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex shrink-0 items-stretch overflow-hidden rounded-lg border border-ink/15 bg-paper-soft transition-colors focus-within:border-burgundy focus-within:ring-2 focus-within:ring-burgundy/15">
        <span className="flex select-none items-center bg-paper-deep px-2.5 text-[13px] font-medium text-ink-faint">
          OAB/
        </span>
        <select
          value={uf}
          onChange={(e) => onChange(composeOab(e.target.value, digits))}
          aria-label="Estado (UF) da OAB"
          className="bg-transparent py-2.5 pl-2 pr-2.5 text-[14px] font-medium text-ink focus:outline-none"
        >
          <option value="">UF</option>
          {UF_LIST.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <input
        value={formatOabDigits(digits)}
        onChange={(e) => onChange(composeOab(uf, e.target.value))}
        inputMode="numeric"
        placeholder="123.456"
        aria-label="Número de inscrição na OAB"
        disabled={!uf}
        className="w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  )
}

function WhatsappInput({ value, onChange }: { value: string; onChange: (digits: string) => void }) {
  const local = value.startsWith('55') ? value.slice(2) : value
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-ink/15 bg-paper-soft transition-colors focus-within:border-burgundy focus-within:ring-2 focus-within:ring-burgundy/15">
      <span className="flex select-none items-center gap-1 border-r border-ink/10 bg-paper-deep px-3 text-[14px] font-medium text-ink-faint">
        🇧🇷 +55
      </span>
      <input
        value={maskBrLocal(local)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
          onChange(digits ? `55${digits}` : '')
        }}
        inputMode="numeric"
        placeholder="(11) 99887-7665"
        aria-label="Número de WhatsApp com DDD"
        className="w-full bg-transparent px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:outline-none"
      />
    </div>
  )
}

// Estado NEUTRO de um item do checklist — evita o "semáforo" (vermelho/amarelo/verde)
// que parece alarme de erro. 'pending' usa grafite neutro, não vermelho.
type CheckTone = 'ok' | 'review' | 'pending'

const CHECK_UI: Record<
  CheckTone,
  { Icon: (p: React.ComponentProps<typeof CheckIcon>) => JSX.Element; chip: string; label: string }
> = {
  ok: { Icon: CheckIcon, chip: 'bg-brass/20 text-brass-deep', label: 'ok' },
  review: { Icon: InfoIcon, chip: 'bg-brass/10 text-brass-deep', label: 'revisar' },
  pending: { Icon: DotIcon, chip: 'bg-ink/[0.07] text-ink-faint', label: 'pendente' },
}

// Etapa final: progresso + checklist neutro (pendente/revisar/ok) + detalhe de conformidade.
function ReviewStep({
  profile,
  issues,
  blocked,
  onEdit,
}: {
  profile: Profile
  issues: ReturnType<typeof checkCompliance>
  blocked: boolean
  onEdit: (step: number) => void
}) {
  const sections: { step: number; label: string; ok: boolean; value: string }[] = [
    { step: 0, label: 'Identidade', ok: !!(profile.name && profile.oabNumber), value: profile.name || '—' },
    {
      step: 1,
      label: 'Bio',
      ok: profile.bio.trim().length > 0,
      value: profile.bio ? `${profile.bio.length} caracteres` : 'vazio',
    },
    {
      step: 2,
      label: 'Atuação',
      ok: profile.areas.length > 0 && profile.areas.every((a) => a.label.trim()),
      value: `${profile.areas.length} área(s)`,
    },
    {
      step: 3,
      label: 'Localização',
      ok: !!(profile.city && profile.state),
      value: [profile.city, profile.state].filter(Boolean).join('/') || '—',
    },
    {
      step: 4,
      label: 'Contato',
      ok: !!(profile.contact.whatsapp || profile.contact.email || profile.socials.length),
      value: profile.contact.whatsapp
        ? 'WhatsApp'
        : profile.contact.email
          ? 'E-mail'
          : profile.socials.length
            ? 'Redes'
            : 'nenhum',
    },
  ]

  const blockIssues = issues.filter((i) => i.severity === 'block')
  const warnIssues = issues.filter((i) => i.severity === 'warn')
  const compTone: CheckTone = blocked ? 'pending' : warnIssues.length ? 'review' : 'ok'

  const rows: { key: string; step: number; label: string; tone: CheckTone; value: string }[] = [
    ...sections.map((r) => ({
      key: `s${r.step}`,
      step: r.step,
      label: r.label,
      tone: (r.ok ? 'ok' : 'pending') as CheckTone,
      value: r.value,
    })),
    {
      key: 'compliance',
      step: 1,
      label: 'Conformidade OAB',
      tone: compTone,
      value: blocked ? 'há termos vedados' : warnIssues.length ? 'revisar o tom' : 'sem pendências',
    },
  ]

  const total = rows.length
  const done = rows.filter((r) => r.tone === 'ok').length
  const remaining = total - done
  const pct = Math.round((done / total) * 100)

  return (
    <Card title="Revisar e publicar">
      {/* Barra de progresso — motiva concluir sem "nota" fria */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-ink">
            {remaining === 0
              ? 'Perfil completo e em conformidade'
              : `Falta${remaining > 1 ? 'm' : ''} ${remaining} ite${remaining > 1 ? 'ns' : 'm'}`}
          </span>
          <span className="text-[12px] font-medium text-ink-faint">
            {done}/{total}
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do perfil"
        >
          <div
            className="h-full rounded-full bg-brass-deep transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="divide-y divide-ink/10">
        {rows.map((r) => {
          const ui = CHECK_UI[r.tone]
          return (
            <li key={r.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-[13.5px]">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ui.chip}`}
                  title={ui.label}
                >
                  <ui.Icon width={12} height={12} strokeWidth={2.4} />
                </span>
                <span className="font-medium text-ink">{r.label}</span>
                <span className="truncate text-ink-faint">· {r.value}</span>
              </span>
              <button
                type="button"
                onClick={() => onEdit(r.step)}
                className="shrink-0 text-[12.5px] font-medium text-burgundy hover:underline"
              >
                editar
              </button>
            </li>
          )
        })}
      </ul>

      {/* Detalhe de conformidade — tom neutro, sem alarme vermelho */}
      {(blockIssues.length > 0 || warnIssues.length > 0) && (
        <div className="rounded-lg border border-ink/12 bg-ink/[0.03] px-3 py-2.5 text-[12.5px] text-ink-soft">
          {blockIssues.length > 0 ? (
            <p className="font-semibold text-ink">
              Itens pendentes de conformidade — ajuste antes de publicar:
            </p>
          ) : (
            <p className="font-semibold text-ink">Sugestões de revisão (não bloqueiam a publicação):</p>
          )}
          <ul className="mt-1.5 space-y-1">
            {[...blockIssues, ...warnIssues].slice(0, 5).map((i, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <DotIcon width={12} height={12} className="mt-0.5 shrink-0 text-ink-faint" />
                <span>
                  “{i.term}” — {i.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (!openAuditReport(profile, issues)) {
            alert('Não foi possível abrir o relatório. Permita pop-ups para este site e tente de novo.')
          }
        }}
        className="btn-ghost w-full"
      >
        Exportar relatório de conformidade (PDF)
      </button>

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        Ao publicar, o backend roda a mesma checagem (fonte da verdade) e bloqueia texto irregular.
        O relatório registra as regras vigentes na data — guarde como comprovante.
      </p>
    </Card>
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
        <InfoTip
          items={OAB_GUIDANCE_BY_FIELD.area}
          title="O que a OAB permite na área"
          align="left"
        />
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

function OabHelp() {
  return (
    <details className="group overflow-hidden rounded-xl2 border border-brass/25 bg-gradient-to-br from-brass/[0.08] to-brass/[0.02] open:shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-brass/[0.05] [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl2 bg-brass/15 text-brass-deep">
          <ScaleIcon width={18} height={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-semibold leading-tight text-brass-deep">
            O que a OAB permite exibir?
          </span>
          <span className="mt-0.5 block text-[12px] text-ink-faint">Guia rápido de conformidade</span>
        </span>
        <ChevronDown
          width={18}
          height={18}
          className="shrink-0 text-brass-deep/70 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>

      <div className="border-t border-brass/15 px-4 pb-4 pt-3.5">
        <ul className="space-y-2.5">
          {OAB_GUIDANCE.map((g, i) => {
            const avoid = /^(Evite|Não|Nao)/.test(g)
            return (
              <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
                <span
                  className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                    avoid ? 'bg-ink/[0.06] text-ink-faint' : 'bg-brass/[0.18] text-brass-deep'
                  }`}
                  aria-hidden
                >
                  {avoid ? (
                    <XIcon width={11} height={11} strokeWidth={2.4} />
                  ) : (
                    <CheckIcon width={11} height={11} strokeWidth={2.6} />
                  )}
                </span>
                <span>{g}</span>
              </li>
            )
          })}
        </ul>
        <p className="mt-3.5 border-t border-brass/10 pt-3 text-[11.5px] leading-relaxed text-ink-faint">
          Baseado no Provimento 205/2021 do CFOAB. Não constitui aconselhamento jurídico.
        </p>
      </div>
    </details>
  )
}
