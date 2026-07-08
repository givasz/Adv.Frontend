import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import type { GenerateKind, OabStatus, PracticeArea, Profile, SocialKind } from '@/lib/types'
import { api } from '@/lib/api'
import { allAreas } from '@/lib/mockData'
import { checkCompliance, OAB_GUIDANCE, OAB_GUIDANCE_BY_FIELD } from '@/lib/oab'
import { getTheme, isThemeUnlocked, THEMES } from '@/lib/themes'
import { AREA_LIMIT, CHAR_LIMITS, NAME_MAX, OAB_MAX } from '@/lib/plans'
import { PhonePreview } from '@/components/editor/PhonePreview'
import { AiButton, AiGenerator } from '@/components/editor/AiGenerator'
import { Card, Field, TextArea, TextInput, Toggle } from '@/components/editor/fields'
import { InfoTip } from '@/components/editor/InfoTip'
import { PlanBadge } from '@/components/editor/PlanBadge'
import { ThemePicker } from '@/components/editor/ThemePicker'
import { ChevronDown, CheckIcon, ScaleIcon, TrashIcon, XIcon } from '@/components/ui/icons'
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

  useEffect(() => {
    api.getDraft().then(setProfile)
    document.title = 'Editor · advoc.me'
  }, [])

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
            <span className="text-[12px] text-ink-faint" aria-live="polite">
              {saved ? 'Tudo salvo' : 'Salvando…'}
            </span>
            <Link
              to={`/${profile.slug}`}
              className="btn-primary !py-2 !px-4 text-[13px]"
              target="_blank"
            >
              Ver perfil
            </Link>
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
          <Stepper steps={STEPS} current={step} onGo={setStep} />

          {step === 5 && (
            <>
          <PlanBadge
            plan={profile.plan}
            onChange={(plan) => {
              // ao trocar de plano, mantém o tema só se ainda estiver desbloqueado
              const stillOk = isThemeUnlocked(getTheme(profile.theme), plan)
              set({ plan, theme: stillOk ? profile.theme : 'papel' })
            }}
          />

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
                // demo: "assinar" o plano desbloqueia e já aplica o tema
                set({ plan: tier, theme })
              }}
            />
            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              Temas <span className="font-semibold">Pro</span> e{' '}
              <span className="font-semibold">Premium</span> ficam disponíveis conforme o plano.
              Clicar num tema bloqueado simula o upgrade neste protótipo.
            </p>
          </Card>
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número da OAB" hint="ex: OAB/SP 123.456">
                <TextInput
                  value={profile.oabNumber}
                  maxLength={OAB_MAX}
                  onChange={(e) => set({ oabNumber: e.target.value })}
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
            <OabVerifyRow status={oabStatus} onRequest={requestOab} />
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
            <ComplianceHint issues={bioIssues} />
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
            <div className="grid gap-3">
              {(Object.keys(socialMeta) as SocialKind[]).map((kind) => {
                const existing = profile.socials.find((s) => s.kind === kind)
                return (
                  <Field key={kind} label={socialMeta[kind].label}>
                    <TextInput
                      value={existing?.url ?? ''}
                      placeholder={`https://…`}
                      onChange={(e) => {
                        const url = e.target.value
                        const rest = profile.socials.filter((s) => s.kind !== kind)
                        set({ socials: url ? [...rest, { kind, url }] : rest })
                      }}
                    />
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
            <Field
              label="Link de agendamento"
              hint="opcional"
              info={
                <InfoTip
                  title="Qual link usar aqui"
                  align="left"
                  label="Ajuda sobre o link de agendamento"
                  items={[
                    'Cole um link de agendamento — o cliente escolhe um horário livre e marca sozinho, pelo seu perfil.',
                    'Funciona com Calendly (ex.: calendly.com/seu-nome/30min).',
                    'Funciona com o Google: use "Horários de agendamento" (gera um link público de reserva).',
                    'Não use o link de uma agenda compartilhada do Google — ela só mostra a agenda, não deixa marcar.',
                  ]}
                />
              }
            >
              <TextInput
                value={profile.contact.scheduling ?? ''}
                onChange={(e) => set({ contact: { ...profile.contact, scheduling: e.target.value } })}
                placeholder="https://calendly.com/seu-nome/consulta"
              />
            </Field>
            <p className="-mt-2 text-[11.5px] leading-relaxed text-ink-faint">
              Página de agendamento (Calendly ou “Horários de agendamento” do Google) — não a agenda
              compartilhada. Se ficar em branco, o botão “Agendar” não aparece no perfil.
            </p>
          </Card>
          )}

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

// Etapa final: resumo por seção + status de conformidade. Publicar fica no StepNav.
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
  const rows = [
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
  return (
    <Card title="Revisar e publicar">
      <ul className="divide-y divide-ink/10">
        {rows.map((r) => (
          <li key={r.step} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-[13.5px]">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  r.ok ? 'bg-brass/20 text-brass-deep' : 'bg-ink/[0.08] text-ink-faint'
                }`}
              >
                {r.ok ? (
                  <CheckIcon width={12} height={12} strokeWidth={2.6} />
                ) : (
                  <XIcon width={11} height={11} strokeWidth={2.2} />
                )}
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
        ))}
      </ul>

      <div
        className={`rounded-lg border px-3 py-2.5 text-[12.5px] ${
          blocked
            ? 'border-burgundy/30 bg-burgundy/5 text-burgundy-deep'
            : 'border-brass/30 bg-brass/[0.08] text-brass-deep'
        }`}
      >
        {blocked ? (
          <>
            <span className="font-semibold">Conformidade OAB: pendências.</span> Há termos vedados na
            bio ou nas áreas — corrija antes de publicar.
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              {issues
                .filter((i) => i.severity === 'block')
                .slice(0, 4)
                .map((i, idx) => (
                  <li key={idx}>
                    “{i.term}” — {i.reason}
                  </li>
                ))}
            </ul>
          </>
        ) : (
          <span className="font-semibold">Conformidade OAB: OK ✓</span>
        )}
      </div>

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        Ao publicar, o backend roda a mesma checagem (fonte da verdade) e bloqueia texto irregular.
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

function ComplianceHint({ issues }: { issues: ReturnType<typeof checkCompliance> }) {
  if (!issues.length) return null
  const blocked = issues.some((i) => i.severity === 'block')
  return (
    <div
      className={`rounded-lg border p-3 text-[12.5px] ${
        blocked
          ? 'border-burgundy/30 bg-burgundy/5 text-burgundy-deep'
          : 'border-brass/40 bg-brass/10 text-brass-deep'
      }`}
    >
      {issues.map((i, idx) => (
        <p key={idx}>
          <span className="font-semibold">“{i.term}”</span> — {i.reason}
        </p>
      ))}
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
