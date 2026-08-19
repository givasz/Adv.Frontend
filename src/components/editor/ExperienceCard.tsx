import type { Highlight, Profile } from '@/lib/types'
import { CHAR_LIMITS } from '@/lib/plans'
import { checkCompliance, OAB_GUIDANCE_BY_FIELD } from '@/lib/oab'
import { featurePoints, highlightQuota, type UpsellFeature } from '@/lib/upsell'
import { Card, Field, TextArea, TextInput } from './fields'
import { InfoTip } from './InfoTip'
import { MarginNotes } from './MarginNotes'
import { GhostSlot, QuotaCounter } from './upsellBits'
import { TrashIcon } from '@/components/ui/icons'

// Destaques de experiência — o que sustenta a autoridade do advogado sem cair em
// autoengrandecimento: tempo de atuação, formação, atuação em tribunais.
//
// Este card existia como PROMESSA (era vendido nos planos e o backend já
// guardava a tabela Highlight), mas não havia por onde preencher. Agora tem.
//
// Conformidade: o texto passa pelo mesmo checkCompliance da bio — nada de
// "melhor", "líder", número de vitórias, nome de cliente ou caso concreto.

let uid = 0
const nextId = () => `hl-${Date.now()}-${uid++}`

const EXAMPLES = [
  { title: '15 anos de atuação', detail: 'Atuação contínua em Direito de Família desde 2010.' },
  { title: 'Mestrado em Direito Civil', detail: 'Universidade Federal, com pesquisa em direito sucessório.' },
  { title: 'Atuação em tribunais superiores', detail: 'Sustentação oral em recursos no STJ.' },
]

export function ExperienceCard({
  profile,
  set,
  onUpsell,
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  onUpsell: (f: UpsellFeature) => void
  /** modo espectro (dentro do cadeado): controles inertes */
  preview?: boolean
}) {
  const list = profile.highlights
  // Mesma mecânica de cota das áreas (contador + slot fantasma), com o teto de
  // destaques por plano — a regra mora em plans.ts, não aqui.
  const quota = highlightQuota(profile.plan, list.length)
  const lim = CHAR_LIMITS[profile.plan]
  const patch = (id: string, p: Partial<Highlight>) =>
    set({ highlights: list.map((h) => (h.id === id ? { ...h, ...p } : h)) })

  return (
    <Card title="Seus destaques" action={<QuotaCounter quota={quota} />}>
      <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
        Fatos verificáveis sobre a sua trajetória — tempo de atuação, formação, onde você atua.
        Aparecem em cards curtos logo abaixo da sua apresentação.
      </p>

      {list.map((h, i) => {
        const issues = checkCompliance(`${h.title} ${h.detail}`)
        return (
          <div key={h.id} className="rounded-lg border border-ink/10 bg-paper-soft/60 p-3.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-3">
                <Field
                  label={`Destaque ${i + 1}`}
                  hint={`${h.title.length}/${lim.highlightTitle}`}
                  info={
                    i === 0 ? (
                      <InfoTip
                        title="O que pode entrar aqui"
                        align="left"
                        label="Ajuda sobre destaques de experiência"
                        items={OAB_GUIDANCE_BY_FIELD.highlight}
                      />
                    ) : undefined
                  }
                >
                  <TextInput
                    value={h.title}
                    maxLength={lim.highlightTitle}
                    disabled={preview}
                    onChange={(e) => patch(h.id, { title: e.target.value })}
                    placeholder={EXAMPLES[i % EXAMPLES.length].title}
                  />
                </Field>
                <Field label="Detalhe" hint={`${h.detail.length}/${lim.highlightDetail}`}>
                  <TextArea
                    rows={2}
                    value={h.detail}
                    maxLength={lim.highlightDetail}
                    disabled={preview}
                    onChange={(e) => patch(h.id, { detail: e.target.value })}
                    placeholder={EXAMPLES[i % EXAMPLES.length].detail}
                  />
                </Field>
              </div>
              {!preview && (
                <button
                  type="button"
                  onClick={() => set({ highlights: list.filter((x) => x.id !== h.id) })}
                  aria-label={`Remover o destaque ${h.title || i + 1}`}
                  className="shrink-0 rounded-lg p-2 text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-burgundy"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              )}
            </div>
            <MarginNotes issues={issues} />
          </div>
        )
      })}

      {!quota.atLimit ? (
        <button
          type="button"
          disabled={preview}
          onClick={() => set({ highlights: [...list, { id: nextId(), title: '', detail: '' }] })}
          className="btn-ghost w-full border-dashed"
        >
          + Adicionar destaque
        </button>
      ) : quota.unlockPlan ? (
        <GhostSlot
          unlockPlan={quota.unlockPlan}
          points={featurePoints('highlights')}
          onOpen={() => onUpsell('highlights')}
        />
      ) : (
        <p className="rounded-lg bg-brass/10 px-3 py-2 text-[12.5px] text-brass-deep">
          Você chegou ao máximo de destaques do maior plano.
        </p>
      )}
    </Card>
  )
}
