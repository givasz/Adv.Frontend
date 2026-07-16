// Campos mascarados compartilhados pelo onboarding e pelo editor (BR).
import { composeOab, formatOabDigits, maskBrLocal, parseOab, UF_LIST } from '@/lib/brFormat'

// Campo de OAB: seletor de UF (seccional) + número com máscara (ponto de milhar
// automático, máx. 6 dígitos). Guarda como "OAB/UF 123.456". Começa vazio.
export function OabNumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

// Campo de WhatsApp com máscara BR: prefixo fixo +55 e parte local "(DD) 99887-7665".
// Guarda apenas dígitos com DDI ("5511998877665") — formato usado no link do wa.me.
export function WhatsappInput({
  value,
  onChange,
}: {
  value: string
  onChange: (digits: string) => void
}) {
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
