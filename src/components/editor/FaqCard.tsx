import type { Faq, Profile } from '@/lib/types'
import { FAQ_ANSWER_MAX, FAQ_QUESTION_MAX } from '@/lib/plans'
import { checkCompliance, OAB_GUIDANCE_BY_FIELD } from '@/lib/oab'
import { faqQuota, type UpsellFeature } from '@/lib/upsell'
import { faqIdeas } from '@/lib/faqIdeas'
import { Card, Field, TextArea, TextInput } from './fields'
import { InfoTip } from './InfoTip'
import { MarginNotes } from './MarginNotes'
import { GhostSlot, QuotaCounter } from './upsellBits'
import { AiButton } from './AiGenerator'
import { SparkIcon, TrashIcon } from '@/components/ui/icons'

// Perguntas frequentes do perfil — o advogado responde as dúvidas que mais ouve.
// Recurso pago: 2 no Pro, 5 no Max (ver lib/plans.ts).
//
// Por que FAQ e não artigo: ninguém escreve artigo no meio da semana, mas todo
// advogado já respondeu "quanto tempo demora um inventário?" cem vezes. A pergunta
// é curta, a resposta é curta, e é exatamente o que quem chega ao perfil procura.
//
// Prov. 205/2021: informação jurídica EDUCATIVA é permitida; captação não. Por isso
// pergunta e resposta passam pelo checkCompliance, os limites de texto são curtos
// (resposta longa vira parecer — e parecer no perfil é consulta disfarçada) e as
// sugestões de pergunta são neutras.

let uid = 0
const nextId = () => `fq-${Date.now()}-${uid++}`

export function FaqCard({
  profile,
  set,
  onUpsell,
  onAi,
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  onUpsell: (f: UpsellFeature) => void
  /** abre o gerador de IA para redigir/reforçar a resposta desta pergunta */
  onAi?: (faq: Faq) => void
  /** modo espectro (dentro do cadeado): controles inertes */
  preview?: boolean
}) {
  const list = profile.faqs ?? []
  const quota = faqQuota(profile.plan, list.length)
  const areas = profile.areas.map((a) => a.label).filter(Boolean)
  // `seed` fixo pelo tamanho da lista: as sugestões trocam quando o FAQ cresce,
  // não a cada tecla digitada — sugestão que dança embaixo do dedo não é sugestão.
  const ideas = faqIdeas(areas, list.length, 3, list.map((f) => f.question))

  const patch = (id: string, p: Partial<Faq>) =>
    set({ faqs: list.map((f) => (f.id === id ? { ...f, ...p } : f)) })

  const add = (question = '') =>
    set({ faqs: [...list, { id: nextId(), question, answer: '' }] })

  return (
    <Card title="Perguntas frequentes" action={<QuotaCounter quota={quota} />}>
      <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
        As dúvidas que você mais ouve, respondidas por você. Quem chega ao perfil já sai com uma
        resposta — e com a impressão de que você explica bem.
      </p>

      {list.map((f, i) => {
        const issues = checkCompliance(`${f.question} ${f.answer}`)
        const long = f.answer.length > FAQ_ANSWER_MAX - 40
        return (
          <div key={f.id} className="rounded-lg border border-ink/10 bg-paper-soft/60 p-3.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-3">
                <Field
                  label={`Pergunta ${i + 1}`}
                  hint={`${f.question.length}/${FAQ_QUESTION_MAX}`}
                  info={
                    i === 0 ? (
                      <InfoTip
                        title="O que pode entrar na resposta"
                        align="left"
                        label="Ajuda sobre o FAQ"
                        items={OAB_GUIDANCE_BY_FIELD.faq}
                      />
                    ) : undefined
                  }
                >
                  <TextInput
                    value={f.question}
                    maxLength={FAQ_QUESTION_MAX}
                    disabled={preview}
                    onChange={(e) => patch(f.id, { question: e.target.value })}
                    placeholder="Quanto tempo demora um inventário?"
                  />
                </Field>
                <Field
                  label="Sua resposta"
                  hint={
                    <span className={long ? 'font-semibold text-brass-deep' : undefined}>
                      {f.answer.length}/{FAQ_ANSWER_MAX}
                    </span>
                  }
                  info={
                    onAi && !preview ? (
                      // Rótulo muda com o estado: sem texto a IA rascunha; com texto
                      // ela APOIA o que o advogado escreveu, sem trocar por outro.
                      <AiButton
                        label={f.answer.trim() ? 'Reforçar com IA' : 'Responder com IA'}
                        onClick={() => onAi(f)}
                      />
                    ) : undefined
                  }
                >
                  <TextArea
                    rows={3}
                    value={f.answer}
                    maxLength={FAQ_ANSWER_MAX}
                    disabled={preview}
                    onChange={(e) => patch(f.id, { answer: e.target.value })}
                    placeholder="Em duas ou três frases: como a lei trata isso e o que costuma acontecer na prática."
                  />
                </Field>
              </div>
              {!preview && (
                <button
                  type="button"
                  onClick={() => set({ faqs: list.filter((x) => x.id !== f.id) })}
                  aria-label={`Remover a pergunta ${f.question || i + 1}`}
                  className="shrink-0 rounded-lg p-2 text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-burgundy"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              )}
            </div>
            {/* Pergunta sem resposta não vai para o perfil (o servidor descarta):
                melhor avisar aqui do que deixar o advogado achar que publicou. */}
            {f.question.trim() && !f.answer.trim() && (
              <p className="mt-2 text-[12px] text-ink-faint">
                Esta pergunta só aparece no perfil depois que você responder.
              </p>
            )}
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
          + Adicionar uma pergunta
        </button>
      ) : quota.unlockPlan ? (
        <GhostSlot unlockPlan={quota.unlockPlan} onOpen={() => onUpsell('faq')} />
      ) : (
        <p className="rounded-lg bg-brass/10 px-3 py-2 text-[12.5px] text-brass-deep">
          Você chegou ao máximo de perguntas do maior plano.
        </p>
      )}

      {/* Sugestões: quase todo advogado ouve as mesmas dúvidas, mas ninguém para
          para listá-las. Um toque já cria a pergunta — a resposta é sempre dele. */}
      {!preview && ideas.length > 0 && !quota.atLimit && (
        <div className="rounded-lg border border-brass/25 bg-brass/[0.05] p-3.5">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <SparkIcon width={14} height={14} className="text-brass-deep" />
            Dúvidas que seus clientes costumam ter
          </span>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
            A partir das suas áreas. Toque para começar — quem responde é você.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {ideas.map((idea) => (
              <button
                key={idea.question}
                type="button"
                onClick={() => add(idea.question)}
                className="rounded-full border border-brass/30 bg-paper/70 px-3 py-1.5 text-left text-[12px] font-medium text-ink-soft transition-colors hover:border-brass/60 hover:text-ink"
              >
                {idea.question}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
