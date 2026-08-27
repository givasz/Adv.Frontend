// Peças repetidas do painel — campo, aviso, etiqueta de papel, caixa de motivo.
//
// Existem para que as telas novas não repitam trinta classes do Tailwind por
// input. O painel é interno: o valor aqui é a densidade e a legibilidade, não o
// acabamento da página pública.

import type { ReactNode } from 'react'
import type { AdminRole } from '@/lib/adminApi'

export const ROLE_TOM: Record<AdminRole, string> = {
  owner: 'bg-burgundy/10 text-burgundy-deep',
  moderator: 'bg-brass/20 text-brass-deep',
  support: 'bg-ink/[0.07] text-ink-soft',
  readonly: 'bg-ink/[0.05] text-ink-faint',
}

export const ROLE_NOME: Record<AdminRole, string> = {
  owner: 'Responsável',
  moderator: 'Moderação',
  support: 'Suporte',
  readonly: 'Só leitura',
}

export function Etiqueta({ papel }: { papel: AdminRole }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${ROLE_TOM[papel]}`}>
      {ROLE_NOME[papel]}
    </span>
  )
}

export function Campo({
  id,
  label,
  dica,
  children,
}: {
  id: string
  label: string
  dica?: string
  children: ReactNode
}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium text-ink">
        {label}
      </label>
      {children}
      {dica && <p className="mt-1 text-[11.5px] text-ink-faint">{dica}</p>}
    </div>
  )
}

export const entrada =
  'w-full rounded-lg border border-ink/15 bg-paper px-3 py-2.5 text-[13.5px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

export function Aviso({ tom = 'erro', children }: { tom?: 'erro' | 'nota' | 'ok'; children: ReactNode }) {
  const cls =
    tom === 'erro'
      ? 'border-burgundy/30 bg-burgundy/5 text-burgundy-deep'
      : tom === 'ok'
        ? 'border-ink/15 bg-paper-soft text-ink-soft'
        : 'border-brass/40 bg-brass/10 text-brass-deep'
  return (
    <p className={`mb-3 rounded-lg border px-3 py-2 text-[12.5px] ${cls}`} role={tom === 'erro' ? 'alert' : undefined}>
      {children}
    </p>
  )
}

/**
 * A caixa de motivo.
 *
 * Aparece em toda ação que afeta alguém, e não é burocracia: o texto escrito aqui
 * é o que a pessoa afetada lê. Sem ele o servidor recusa a ação — então a tela
 * também recusa, para o "não" chegar antes do clique e não depois.
 */
export function Motivo({
  id,
  valor,
  onChange,
  label = 'Motivo',
  dica = 'É o que a pessoa afetada vai ler. Mínimo de 5 caracteres.',
  linhas = 2,
}: {
  id: string
  valor: string
  onChange: (v: string) => void
  label?: string
  dica?: string
  linhas?: number
}) {
  return (
    <Campo id={id} label={label} dica={dica}>
      <textarea
        id={id}
        rows={linhas}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={entrada}
      />
    </Campo>
  )
}

export function fmtData(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
