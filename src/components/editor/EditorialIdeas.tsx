import { editorialIdeas, monthLabel } from '@/lib/editorial'
import { Card } from './fields'
import { SparkIcon } from '@/components/ui/icons'

// Calendário editorial — sugestões mensais de temas EDUCATIVOS para as áreas do
// perfil, para manter o perfil ativo sem esforço de criação. Pautas neutras; o
// texto que o advogado vier a publicar continua sujeito ao checkCompliance().
export function EditorialIdeas({ areas }: { areas: string[] }) {
  const month = new Date().getMonth()
  const ideas = editorialIdeas(areas, month)

  return (
    <Card
      title="Ideias de conteúdo"
      action={<span className="text-[12px] text-ink-faint">{monthLabel(month)}</span>}
    >
      <p className="-mt-1 text-[12px] leading-relaxed text-ink-faint">
        Pautas educativas para este mês, a partir das suas áreas. Conteúdo informativo mantém o
        perfil ativo dentro das regras da OAB.
      </p>
      <ul className="mt-1 grid gap-2">
        {ideas.map((idea) => (
          <li
            key={idea.title}
            className="flex items-start gap-2.5 rounded-lg border border-ink/10 bg-paper-soft px-3 py-2.5"
          >
            <SparkIcon width={15} height={15} className="mt-0.5 shrink-0 text-brass-deep" />
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium leading-snug text-ink">{idea.title}</p>
              <p className="text-[11.5px] text-ink-faint">{idea.area}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
