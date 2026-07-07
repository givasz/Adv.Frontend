import type { Plan } from '@/lib/types'

const plans: { id: Plan; label: string; note: string }[] = [
  { id: 'free', label: 'Free', note: '2 áreas · marca d’água' },
  { id: 'pro', label: 'Pro', note: '6 áreas · sem marca · analytics' },
  { id: 'premium', label: 'Premium', note: 'domínio próprio · todos os temas' },
]

/** Simula troca de plano no editor (no produto real vem da assinatura ativa) */
export function PlanBadge({ plan, onChange }: { plan: Plan; onChange: (p: Plan) => void }) {
  return (
    <div className="rounded-xl2 border border-ink/10 bg-paper p-1.5 shadow-card">
      <div className="grid grid-cols-3 gap-1.5">
        {plans.map((p) => {
          const active = p.id === plan
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={`rounded-lg px-2 py-2 text-left transition-colors ${
                active ? 'bg-burgundy text-paper-soft' : 'hover:bg-ink/[0.04]'
              }`}
            >
              <span className="block text-[13px] font-semibold">{p.label}</span>
              <span className={`block text-[10.5px] leading-tight ${active ? 'text-paper/80' : 'text-ink-faint'}`}>
                {p.note}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
