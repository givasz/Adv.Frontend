import type { Plan } from '@/lib/types'
import type { ThemeId } from '@/lib/themes'
import { THEMES, getTheme, isThemeUnlocked } from '@/lib/themes'
import { CheckSeal, LockIcon } from '@/components/ui/icons'

const tierLabel: Record<'pro' | 'premium', string> = { pro: 'Pro', premium: 'Premium' }

export function ThemePicker({
  value,
  plan,
  onChange,
  onWantUpgrade,
}: {
  value: ThemeId
  plan: Plan
  onChange: (id: ThemeId) => void
  onWantUpgrade: (id: ThemeId, tier: 'pro' | 'premium') => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {THEMES.map((t) => {
        const unlocked = isThemeUnlocked(t, plan)
        const selected = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              unlocked ? onChange(t.id) : onWantUpgrade(t.id, t.tier as 'pro' | 'premium')
            }
            aria-pressed={selected}
            className={`group relative overflow-hidden rounded-xl2 border p-0 text-left transition-all ${
              selected
                ? 'border-burgundy ring-2 ring-burgundy/20'
                : 'border-ink/12 hover:border-ink/30'
            }`}
          >
            {/* Amostra visual do tema */}
            <div
              className="relative flex h-20 flex-col justify-end gap-1.5 p-3"
              style={{ background: t.swatch.bg }}
            >
              <span
                className="h-2 w-10 rounded-full"
                style={{ background: t.swatch.accent }}
              />
              <span
                className="h-1.5 w-16 rounded-full opacity-40"
                style={{ background: t.swatch.text }}
              />
              <span
                className="h-1.5 w-12 rounded-full opacity-25"
                style={{ background: t.swatch.text }}
              />

              {!unlocked && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/45 backdrop-blur-[1px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-burgundy">
                    <LockIcon width={11} height={11} strokeWidth={2} />
                    {tierLabel[t.tier as 'pro' | 'premium']}
                  </span>
                </span>
              )}
              {selected && (
                <span className="absolute right-2 top-2 text-burgundy">
                  <CheckSeal width={18} height={18} />
                </span>
              )}
            </div>

            <div className="bg-paper px-3 py-2">
              <p className="text-[13px] font-semibold text-ink">{t.name}</p>
              <p className="text-[10.5px] leading-tight text-ink-faint">{t.blurb}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export { getTheme }
