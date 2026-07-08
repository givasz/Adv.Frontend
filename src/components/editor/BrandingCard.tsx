import type { Branding, Plan } from '@/lib/types'
import { Card, Field, TextInput, Toggle } from './fields'
import { LockIcon } from '@/components/ui/icons'

// Identidade própria (white-label) — recurso do plano Premium/Escritório. Domínio
// próprio, cor de destaque e ocultar a marca "advoc.me". Não altera as regras de
// conformidade: o conteúdo segue sujeito ao Prov. 205/2021.
export function BrandingCard({
  plan,
  branding,
  onChange,
}: {
  plan: Plan
  branding?: Branding
  onChange: (patch: Partial<Branding>) => void
}) {
  const b = branding ?? {}
  const locked = plan !== 'premium'

  if (locked) {
    return (
      <Card title="Identidade própria">
        <div className="flex items-start gap-2.5 rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-3">
          <LockIcon width={16} height={16} className="mt-0.5 shrink-0 text-brass-deep" />
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-brass-deep">Recurso Premium.</span> Use domínio
            próprio, uma cor de destaque personalizada e oculte a marca advoc.me. Faça upgrade para
            liberar.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card title="Identidade própria">
      <Field label="Nome do escritório" hint="aparece no rodapé no lugar de advoc.me">
        <TextInput
          value={b.brandName ?? ''}
          onChange={(e) => onChange({ brandName: e.target.value })}
          placeholder="Silva & Associados"
        />
      </Field>

      <Field label="Domínio próprio" hint="configuração de DNS no plano real">
        <div className="flex items-stretch overflow-hidden rounded-lg border border-ink/15 bg-paper-soft transition-colors focus-within:border-burgundy focus-within:ring-2 focus-within:ring-burgundy/15">
          <span className="flex select-none items-center bg-paper-deep px-3 text-[13px] text-ink-faint">
            https://
          </span>
          <input
            value={b.customDomain ?? ''}
            onChange={(e) => onChange({ customDomain: e.target.value.trim() })}
            placeholder="silva.adv.br"
            aria-label="Domínio próprio"
            className="w-full bg-transparent px-2 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:outline-none"
          />
        </div>
      </Field>

      <div className="flex items-center gap-3">
        <label className="text-[13px] font-medium text-ink" htmlFor="accent-color">
          Cor de destaque
        </label>
        <input
          id="accent-color"
          type="color"
          value={b.accent ?? '#96743f'}
          onChange={(e) => onChange({ accent: e.target.value })}
          className="h-8 w-12 cursor-pointer rounded border border-ink/15 bg-transparent"
        />
        {b.accent && (
          <button
            type="button"
            onClick={() => onChange({ accent: undefined })}
            className="text-[12px] font-medium text-ink-faint hover:text-burgundy"
          >
            restaurar
          </button>
        )}
      </div>

      <Toggle
        checked={!!b.hideWatermark}
        onChange={(v) => onChange({ hideWatermark: v })}
        label="Ocultar “criado com advoc.me”"
      />

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        A identidade própria muda só a aparência e a marca. As verificações de conformidade com a
        OAB continuam valendo igualmente.
      </p>
    </Card>
  )
}
