import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { resolveSchedulingMode } from '@/lib/booking'
import { buildAssistantDays, resolveAssistantConfig } from '@/lib/assistant'
import { comVolta } from '@/components/ui/SubPage'
import { ArrowRight, CalendarIcon, SparkIcon } from '@/components/ui/icons'

// A agenda no painel — em destaque, e no alto.
//
// Todo o resto do painel é obra que se faz UMA vez: a foto, a bio, o vídeo, o
// cartão. Fechar um horário que foi marcado por fora é a única coisa que se
// refaz toda semana, e por isso não pode viver numa lista que some quando o
// passo é cumprido — foi exatamente assim que ela ficou invisível justamente
// para quem já tinha ligado o assistente.
//
// Só aparece com o assistente ligado: sem grade não há horário a fechar, e um
// cartão que não leva a nada é ruído.
export function AgendaCard({ profile }: { profile: Profile }) {
  const cfg = useMemo(() => resolveAssistantConfig(profile.assistant), [profile.assistant])
  // Sempre pela config RESOLVIDA: perfil antigo sem `assistant` gravado cai no
  // padrão — que é o que o visitante enxerga. Contar a partir do campo cru diria
  // "nenhum horário" para quem está oferecendo cinco por dia.
  const dias = useMemo(() => buildAssistantDays(cfg), [cfg])

  if (resolveSchedulingMode(profile) !== 'assistant') return null

  const livres = dias.reduce((n, d) => n + d.times.length, 0)
  const fechados = cfg.busy?.length ?? 0

  return (
    <section className="mt-6 overflow-hidden rounded-xl2 border border-burgundy/20 bg-paper shadow-card">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-burgundy/[0.08] text-burgundy"
          aria-hidden
        >
          <SparkIcon width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-semibold leading-tight text-ink">
            Sua agenda
          </h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
            {livres > 0 ? (
              <>
                Seu assistente está oferecendo{' '}
                <span className="font-semibold text-ink">
                  {livres} {livres === 1 ? 'horário' : 'horários'}
                </span>{' '}
                em {dias.length} {dias.length === 1 ? 'dia' : 'dias'}.
              </>
            ) : (
              <>Seu assistente não tem horário livre para oferecer agora.</>
            )}{' '}
            {fechados > 0 && (
              <span className="text-ink-faint">
                {fechados} {fechados === 1 ? 'fechado' : 'fechados'} por você.
              </span>
            )}
          </p>
        </div>
        <Link
          to={comVolta('/agenda', '/painel')}
          className="btn-primary w-full !py-3 sm:w-auto sm:!px-5"
        >
          <CalendarIcon width={17} height={17} />
          Marcar um horário
          <ArrowRight width={15} height={15} />
        </Link>
      </div>
      <p className="border-t border-ink/10 bg-paper-soft/70 px-5 py-2.5 text-[12px] leading-relaxed text-ink-faint">
        Marcou uma reunião por telefone ou pelo WhatsApp? Conte ao assistente e ele para de
        oferecer aquele horário — só naquele dia.
      </p>
    </section>
  )
}
