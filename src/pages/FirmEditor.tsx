import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { checkCompliance } from '@/lib/oab'
import {
  blankFirm,
  lawyersInNeutralOrder,
  monogramFrom,
  nextLawyerId,
  type Firm,
  type FirmLawyer,
} from '@/lib/escritorio'
import { FIRM_PRICING, firmMonthlyPrice } from '@/lib/plans'
import { Card, Field, TextArea, TextInput } from '@/components/editor/fields'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { ScaleIcon, TrashIcon } from '@/components/ui/icons'

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export default function FirmEditor() {
  const [firm, setFirm] = useState<Firm | null>(null)
  const [saved, setSaved] = useState(true)

  useEffect(() => {
    document.title = 'Editor do escritório · advoc.me'
    api.getMyFirm().then((f) => setFirm(f ?? blankFirm()))
  }, [])

  // Salva com debounce quando há nome (sociedade precisa de nome para existir).
  useEffect(() => {
    if (!firm || !firm.name.trim()) return
    setSaved(false)
    const t = setTimeout(() => {
      api.saveFirm(firm).then((s) => {
        setSaved(true)
        if (s?.slug && s.slug !== firm.slug) {
          setFirm((p) => (p ? { ...p, slug: s.slug } : p))
        }
      })
    }, 700)
    return () => clearTimeout(t)
  }, [firm])

  const issues = useMemo(
    () =>
      firm
        ? [firm.tagline, firm.about, ...firm.lawyers.map((l) => l.bio)].flatMap((t) =>
            checkCompliance(t || ''),
          )
        : [],
    [firm],
  )

  if (!firm) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  const set = (patch: Partial<Firm>) => setFirm((p) => (p ? { ...p, ...patch } : p))
  const setContact = (patch: Partial<Firm['contact']>) =>
    setFirm((p) => (p ? { ...p, contact: { ...p.contact, ...patch } } : p))

  const setLawyer = (id: string, patch: Partial<FirmLawyer>) =>
    set({ lawyers: firm.lawyers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })
  const addLawyer = () =>
    set({
      lawyers: [
        ...firm.lawyers,
        { id: nextLawyerId(), name: '', oabNumber: '', oabVerified: false, area: '', bio: '', avatarUrl: '', linkedin: '' },
      ],
    })
  const removeLawyer = (id: string) => set({ lawyers: firm.lawyers.filter((l) => l.id !== id) })

  const seatsUsed = firm.lawyers.length
  const seatsPurchased = Math.max(FIRM_PRICING.includedSeats, seatsUsed)
  const price = firmMonthlyPrice(seatsPurchased)

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper-deep">
      <h1 className="sr-only">Editor do escritório — advoc.me</h1>
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            advoc.me
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-[12px] text-ink-faint sm:inline" aria-live="polite">
              {!firm.name.trim() ? 'Dê um nome à sociedade' : saved ? 'Tudo salvo' : 'Salvando…'}
            </span>
            {firm.slug && (
              <Link to={`/escritorio/${firm.slug}`} target="_blank" className="btn-primary !py-2 !px-4 text-[13px]">
                Ver página
              </Link>
            )}
            <AccountMenu compact />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div className="rounded-xl2 border border-brass/25 bg-brass/[0.06] px-4 py-3 text-[13px] text-ink-soft">
          <span className="font-semibold text-brass-deep">Plano Escritório.</span> Página institucional
          da sociedade + um perfil para cada advogado. O grid é sempre <strong>alfabético</strong> (sem
          hierarquia — Prov. 205/2021).
        </div>

        {/* Sociedade */}
        <Card title="A sociedade">
          <Field label="Nome da sociedade">
            <TextInput
              value={firm.name}
              maxLength={90}
              placeholder="Andrade & Vieira Sociedade de Advogados"
              onChange={(e) => {
                const name = e.target.value
                setFirm((p) => {
                  if (!p) return p
                  const autoMono = !p.monogram || p.monogram === monogramFrom(p.name)
                  return { ...p, name, monogram: autoMono ? monogramFrom(name) : p.monogram }
                })
              }}
            />
          </Field>
          <div className="grid grid-cols-[1fr_88px] gap-3">
            <Field label="Registro da sociedade na OAB" hint="≠ OAB individual">
              <TextInput
                value={firm.oabRegistry}
                maxLength={40}
                placeholder="OAB/SP 12.345 (Sociedade)"
                onChange={(e) => set({ oabRegistry: e.target.value })}
              />
            </Field>
            <Field label="Monograma" hint="logo">
              <TextInput
                value={firm.monogram}
                maxLength={3}
                onChange={(e) => set({ monogram: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>
          <p className="-mt-1 text-[11.5px] leading-relaxed text-ink-faint">
            A conferência do registro da sociedade é feita pela plataforma (não é selo oficial da OAB).
            Cada advogado tem sua própria conferência de OAB individual.
          </p>
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <Field label="Cidade">
              <TextInput value={firm.city} onChange={(e) => set({ city: e.target.value })} />
            </Field>
            <Field label="UF">
              <select
                value={firm.state}
                onChange={(e) => set({ state: e.target.value })}
                aria-label="UF da sociedade"
                className="w-full rounded-lg border border-ink/15 bg-paper-soft px-2 py-2.5 text-[14px] text-ink focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
              >
                <option value="">UF</option>
                {UF_LIST.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Field>
          </div>
          {firm.slug && (
            <Field label="Endereço da página" hint="gerado do nome">
              <TextInput value={`advoc.me/escritorio/${firm.slug}`} readOnly className="!bg-paper-deep text-ink-faint" />
            </Field>
          )}
        </Card>

        {/* Apresentação */}
        <Card title="Apresentação">
          <Field label="Frase institucional" hint={`${firm.tagline.length}/120`}>
            <TextInput
              value={firm.tagline}
              maxLength={120}
              placeholder="Advocacia empresarial e contenciosa desde 2004."
              onChange={(e) => set({ tagline: e.target.value })}
            />
          </Field>
          <Field label="Sobre o escritório" hint={`${firm.about.length}/1000`}>
            <TextArea
              rows={4}
              value={firm.about}
              maxLength={1000}
              placeholder="Texto institucional sóbrio: áreas de atuação e forma de trabalho, sem promessas, comparações ou captação."
              onChange={(e) => set({ about: e.target.value })}
            />
          </Field>
          <ComplianceHint issues={issues} />
        </Card>

        {/* Marca (white-label) */}
        <Card title="Marca própria (white-label)">
          <Field label="Cor de destaque" hint="aplica na página">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={firm.brandAccent || '#96743f'}
                onChange={(e) => set({ brandAccent: e.target.value })}
                aria-label="Cor de destaque do escritório"
                className="h-10 w-14 cursor-pointer rounded-lg border border-ink/15 bg-paper-soft"
              />
              <TextInput
                value={firm.brandAccent ?? ''}
                placeholder="#96743f"
                onChange={(e) => set({ brandAccent: e.target.value })}
                className="max-w-[140px]"
              />
              {firm.brandAccent && (
                <button
                  type="button"
                  onClick={() => set({ brandAccent: undefined })}
                  className="text-[12.5px] font-medium text-ink-faint hover:text-burgundy"
                >
                  limpar
                </button>
              )}
            </div>
          </Field>
          <Field label="Domínio próprio" hint="informativo no protótipo">
            <TextInput
              value={firm.customDomain ?? ''}
              placeholder="andradevieira.adv.br"
              onChange={(e) => set({ customDomain: e.target.value || undefined })}
            />
          </Field>
        </Card>

        {/* Contato institucional */}
        <Card title="Contato institucional">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Telefone">
              <TextInput
                value={firm.contact.phone ?? ''}
                placeholder="+55 11 3000-0000"
                onChange={(e) => setContact({ phone: e.target.value || undefined })}
              />
            </Field>
            <Field label="E-mail">
              <TextInput
                type="email"
                value={firm.contact.email ?? ''}
                placeholder="contato@escritorio.adv.br"
                onChange={(e) => setContact({ email: e.target.value || undefined })}
              />
            </Field>
            <Field label="WhatsApp" hint="só dígitos, com DDI">
              <TextInput
                value={firm.contact.whatsapp ?? ''}
                placeholder="5511990000000"
                inputMode="numeric"
                onChange={(e) => setContact({ whatsapp: e.target.value.replace(/\D/g, '') || undefined })}
              />
            </Field>
            <Field label="Instagram">
              <TextInput
                value={firm.contact.instagram ?? ''}
                placeholder="https://instagram.com/…"
                onChange={(e) => setContact({ instagram: e.target.value || undefined })}
              />
            </Field>
            <Field label="LinkedIn">
              <TextInput
                value={firm.contact.linkedin ?? ''}
                placeholder="https://linkedin.com/company/…"
                onChange={(e) => setContact({ linkedin: e.target.value || undefined })}
              />
            </Field>
          </div>
        </Card>

        {/* Advogados */}
        <Card
          title="Advogados da sociedade"
          action={
            <span className="text-[12px] font-medium text-ink-faint">
              {seatsUsed}/{seatsPurchased} assentos · R$ {price}/mês
            </span>
          }
        >
          <p className="text-[12.5px] leading-relaxed text-ink-faint">
            Inclui {FIRM_PRICING.includedSeats} advogados; a partir do {FIRM_PRICING.includedSeats + 1}º,
            + R$ {FIRM_PRICING.extraSeatPrice}/mês por advogado. Exibidos em ordem alfabética.
          </p>
          {lawyersInNeutralOrder(firm).map((l) => (
            <LawyerEditor
              key={l.id}
              lawyer={l}
              onChange={(patch) => setLawyer(l.id, patch)}
              onRemove={() => removeLawyer(l.id)}
            />
          ))}
          <button type="button" onClick={addLawyer} className="btn-ghost w-full border-dashed">
            + Adicionar advogado
          </button>
        </Card>
      </div>
    </div>
  )
}

function LawyerEditor({
  lawyer,
  onChange,
  onRemove,
}: {
  lawyer: FirmLawyer
  onChange: (patch: Partial<FirmLawyer>) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-ink/10 bg-paper-soft p-3">
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <input
          value={lawyer.name}
          placeholder="Nome do advogado"
          onChange={(e) => onChange({ name: e.target.value })}
          aria-label="Nome do advogado"
          className="rounded-lg border border-ink/15 bg-paper px-3 py-2 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />
        <input
          value={lawyer.oabNumber}
          placeholder="OAB/SP 123.456"
          onChange={(e) => onChange({ oabNumber: e.target.value })}
          aria-label="Número da OAB do advogado"
          className="rounded-lg border border-ink/15 bg-paper px-3 py-2 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />
      </div>
      <input
        value={lawyer.area}
        placeholder="Área principal (ex.: Direito de Família)"
        onChange={(e) => onChange({ area: e.target.value })}
        aria-label="Área principal do advogado"
        className="rounded-lg border border-ink/15 bg-paper px-3 py-2 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
      />
      <textarea
        rows={2}
        value={lawyer.bio}
        maxLength={280}
        placeholder="Bio curta e sóbria — o que faz na área, sem promessas ou captação."
        onChange={(e) => onChange({ bio: e.target.value })}
        aria-label="Bio do advogado"
        className="resize-none rounded-lg border border-ink/15 bg-paper px-3 py-2 text-[14px] leading-relaxed focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
      />
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <input
          value={lawyer.avatarUrl ?? ''}
          placeholder="Foto (URL)"
          onChange={(e) => onChange({ avatarUrl: e.target.value || undefined })}
          aria-label="URL da foto do advogado"
          className="rounded-lg border border-ink/15 bg-paper px-3 py-2 text-[13px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />
        <input
          value={lawyer.linkedin ?? ''}
          placeholder="LinkedIn (URL)"
          onChange={(e) => onChange({ linkedin: e.target.value || undefined })}
          aria-label="LinkedIn do advogado"
          className="rounded-lg border border-ink/15 bg-paper px-3 py-2 text-[13px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover advogado"
        className="inline-flex items-center gap-1.5 justify-self-start rounded-lg border border-ink/10 px-2.5 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:border-burgundy/40 hover:bg-burgundy/[0.06] hover:text-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/20"
      >
        <TrashIcon width={13} height={13} />
        Remover
      </button>
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
      <p className="mb-1 font-semibold">{blocked ? 'Ajuste necessário (OAB)' : 'Atenção (OAB)'}</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {issues.slice(0, 5).map((i, idx) => (
          <li key={idx}>
            <span className="font-medium">“{i.term}”</span> — {i.reason}
          </li>
        ))}
      </ul>
    </div>
  )
}
