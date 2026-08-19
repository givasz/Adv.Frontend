import type { Plan } from '@/lib/types'
import type { ThemeId } from '@/lib/themes'
import { THEMES, getTheme, isThemeUnlocked } from '@/lib/themes'
import { PLAN_LABEL } from '@/lib/upsell'
import { CheckSeal, LockIcon } from '@/components/ui/icons'

// Tema travado pode ser EXPERIMENTADO, só não pode ser salvo.
//
// Antes, tocar num tema de plano pago abria direto o modal de upsell — pedia a
// assinatura antes de a pessoa ver o que estava comprando. Agora o toque aplica o
// tema à prévia na hora: o advogado vê o próprio perfil, com o próprio nome e a
// própria foto, vestido com o tema. A trava continua existindo — ela só mudou de
// lugar: está no salvar (o rascunho nunca recebe o tema travado), não no olhar.

export function ThemePicker({
  value,
  trying = null,
  plan,
  onChange,
  onTry,
}: {
  /** tema salvo no perfil */
  value: ThemeId
  /** tema em experimentação (não salvo) — null quando não há nenhum */
  trying?: ThemeId | null
  plan: Plan
  /** tema liberado no plano → aplica e salva */
  onChange: (id: ThemeId) => void
  /** tema travado → só entra na prévia */
  onTry: (id: ThemeId, tier: 'pro' | 'premium') => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {THEMES.map((t) => {
        const unlocked = isThemeUnlocked(t, plan)
        const isTrying = trying === t.id
        // Enquanto um tema travado está em prova, o salvo perde o anel de
        // seleção e ganha só a etiqueta "seu tema" — assim fica claro o que está
        // valendo de verdade e para onde voltar.
        const selected = value === t.id && !trying
        const isSaved = value === t.id && !!trying
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => (unlocked ? onChange(t.id) : onTry(t.id, t.tier as 'pro' | 'premium'))}
            aria-pressed={selected || isTrying}
            aria-label={
              unlocked ? t.name : `${t.name} — experimentar (tema do ${PLAN_LABEL[t.tier as 'pro' | 'premium']})`
            }
            className={`group relative overflow-hidden rounded-xl2 border p-0 text-left transition-all ${
              isTrying
                ? 'border-brass ring-2 ring-brass/30'
                : selected
                  ? 'border-burgundy ring-2 ring-burgundy/20'
                  : 'border-ink/12 hover:border-ink/30'
            }`}
          >
            {/* Amostra visual do tema */}
            <div
              className="relative flex h-20 flex-col justify-end gap-1.5 p-3"
              style={{ background: t.swatch.bg }}
            >
              <span className="h-2 w-10 rounded-full" style={{ background: t.swatch.accent }} />
              <span
                className="h-1.5 w-16 rounded-full opacity-40"
                style={{ background: t.swatch.text }}
              />
              <span
                className="h-1.5 w-12 rounded-full opacity-25"
                style={{ background: t.swatch.text }}
              />

              {!unlocked && !isTrying && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/45 backdrop-blur-[1px]">
                  {/* O cadeado diz a verdade (não dá para salvar), mas o hover/foco
                      convida a ver — é o convite que vende. */}
                  <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-burgundy group-hover:hidden group-focus-visible:hidden">
                    <LockIcon width={11} height={11} strokeWidth={2} />
                    {PLAN_LABEL[t.tier as 'pro' | 'premium']}
                  </span>
                  <span className="hidden rounded-full bg-paper px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-burgundy group-hover:inline group-focus-visible:inline">
                    Experimentar
                  </span>
                </span>
              )}
              {isTrying && (
                <span className="absolute right-2 top-2 rounded-full bg-brass px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">
                  Na prévia
                </span>
              )}
              {selected && (
                <span className="absolute right-2 top-2 text-burgundy">
                  <CheckSeal width={18} height={18} />
                </span>
              )}
              {isSaved && (
                <span className="absolute right-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                  Seu tema
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
