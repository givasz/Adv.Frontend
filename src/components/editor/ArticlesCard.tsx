import type { Article, Profile } from '@/lib/types'
import { ARTICLE_SUMMARY_MAX, ARTICLE_TITLE_MAX } from '@/lib/plans'
import { checkCompliance, OAB_GUIDANCE_BY_FIELD } from '@/lib/oab'
import { articleQuota, type UpsellFeature } from '@/lib/upsell'
import { editorialIdeas, monthLabel } from '@/lib/editorial'
import { Card, Field, TextArea, TextInput } from './fields'
import { InfoTip } from './InfoTip'
import { MarginNotes } from './MarginNotes'
import { GhostSlot, QuotaCounter } from './upsellBits'
import { AiButton } from './AiGenerator'
import { SparkIcon, TrashIcon } from '@/components/ui/icons'

// Artigos educativos do perfil — recurso do Max que era vendido em três lugares
// da interface sem existir em lugar nenhum. Agora existe: o advogado escreve (ou
// pede um rascunho à IA), o texto passa pela checagem de conformidade e aparece
// numa seção "Conteúdo" do perfil público.
//
// Prov. 205/2021: conteúdo jurídico INFORMATIVO é permitido — captação disfarçada
// de artigo não é. Por isso título e resumo passam pelo checkCompliance, e as
// pautas sugeridas são neutras (calendário editorial em lib/editorial.ts).

let uid = 0
const nextId = () => `ar-${Date.now()}-${uid++}`

const READ_TIMES = [3, 5, 8, 12]

export function ArticlesCard({
  profile,
  set,
  onUpsell,
  onAi,
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  onUpsell: (f: UpsellFeature) => void
  /** abre o gerador de IA para um rascunho de artigo sobre o tema dado */
  onAi?: (topic: string) => void
  /** modo espectro (dentro do cadeado): controles inertes */
  preview?: boolean
}) {
  const list = profile.articles ?? []
  const quota = articleQuota(profile.plan, list.length)
  const areas = profile.areas.map((a) => a.label).filter(Boolean)
  const month = new Date().getMonth()
  const ideas = editorialIdeas(areas, month, 3)

  const patch = (id: string, p: Partial<Article>) =>
    set({ articles: list.map((a) => (a.id === id ? { ...a, ...p } : a)) })

  const add = (title = '') =>
    set({
      articles: [...list, { id: nextId(), title, summary: '', readingMinutes: 5 }],
    })

  return (
    <Card
      title="Artigos do seu perfil"
      action={<QuotaCounter quota={quota} />}
    >
      <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
        Textos informativos sobre as suas áreas. É o que mantém o perfil vivo entre uma visita e
        outra — e o que faz alguém voltar.
      </p>

      {list.map((a, i) => {
        const issues = checkCompliance(`${a.title} ${a.summary}`)
        return (
          <div key={a.id} className="rounded-lg border border-ink/10 bg-paper-soft/60 p-3.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-3">
                <Field
                  label={`Artigo ${i + 1}`}
                  hint={`${a.title.length}/${ARTICLE_TITLE_MAX}`}
                  info={
                    i === 0 ? (
                      <InfoTip
                        title="O que pode entrar aqui"
                        align="left"
                        label="Ajuda sobre artigos"
                        items={OAB_GUIDANCE_BY_FIELD.article}
                      />
                    ) : undefined
                  }
                >
                  <TextInput
                    value={a.title}
                    maxLength={ARTICLE_TITLE_MAX}
                    disabled={preview}
                    onChange={(e) => patch(a.id, { title: e.target.value })}
                    placeholder="Como funciona a guarda compartilhada"
                  />
                </Field>
                <Field
                  label="Resumo"
                  hint={`${a.summary.length}/${ARTICLE_SUMMARY_MAX}`}
                  info={
                    onAi && !preview ? (
                      <AiButton label="Rascunhar" onClick={() => onAi(a.title)} />
                    ) : undefined
                  }
                >
                  <TextArea
                    rows={3}
                    value={a.summary}
                    maxLength={ARTICLE_SUMMARY_MAX}
                    disabled={preview}
                    onChange={(e) => patch(a.id, { summary: e.target.value })}
                    placeholder="Em poucas linhas: o que o leitor entende ao terminar."
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                  <div>
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink">Leitura</span>
                    <div className="flex gap-1.5" role="group" aria-label="Tempo de leitura">
                      {READ_TIMES.map((m) => (
                        <button
                          key={m}
                          type="button"
                          disabled={preview}
                          aria-pressed={a.readingMinutes === m}
                          onClick={() => patch(a.id, { readingMinutes: m })}
                          className={`rounded-full border px-2.5 py-1.5 text-[12.5px] font-medium tabular-nums transition-colors ${
                            a.readingMinutes === m
                              ? 'border-burgundy bg-burgundy/[0.07] text-burgundy'
                              : 'border-ink/15 text-ink-soft hover:border-brass/50'
                          }`}
                        >
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label="Link do texto completo" hint="opcional">
                    <TextInput
                      value={a.url ?? ''}
                      disabled={preview}
                      onChange={(e) => patch(a.id, { url: e.target.value })}
                      placeholder="https://seublog.com.br/guarda-compartilhada"
                    />
                  </Field>
                </div>
              </div>
              {!preview && (
                <button
                  type="button"
                  onClick={() => set({ articles: list.filter((x) => x.id !== a.id) })}
                  aria-label={`Remover o artigo ${a.title || i + 1}`}
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
          onClick={() => add()}
          className="btn-ghost w-full border-dashed"
        >
          + Escrever um artigo
        </button>
      ) : quota.unlockPlan ? (
        <GhostSlot unlockPlan={quota.unlockPlan} onOpen={() => onUpsell('articles')} />
      ) : (
        <p className="rounded-lg bg-brass/10 px-3 py-2 text-[12.5px] text-brass-deep">
          Você chegou ao máximo de artigos do maior plano.
        </p>
      )}

      {/* Calendário editorial: pautas do mês a partir das áreas do perfil. Tira o
          "não sei sobre o que escrever" do caminho — um toque já cria o artigo. */}
      {!preview && ideas.length > 0 && !quota.atLimit && (
        <div className="rounded-lg border border-brass/25 bg-brass/[0.05] p-3.5">
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <SparkIcon width={14} height={14} className="text-brass-deep" />
              Sobre o que escrever em {monthLabel(month)}
            </span>
          </span>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
            Pautas educativas a partir das suas áreas. Toque para começar o artigo.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {ideas.map((idea) => (
              <button
                key={idea.title}
                type="button"
                onClick={() => add(idea.title)}
                className="rounded-full border border-brass/30 bg-paper/70 px-3 py-1.5 text-left text-[12px] font-medium text-ink-soft transition-colors hover:border-brass/60 hover:text-ink"
              >
                {idea.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
