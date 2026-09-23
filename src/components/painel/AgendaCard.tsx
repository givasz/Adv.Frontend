import { useMemo } from 'react'
import type { Profile } from '@/lib/types'
import { resolveSchedulingMode } from '@/lib/booking'
import { buildAssistantDays, resolveAssistantConfig } from '@/lib/assistant'
import { comVolta } from '@/components/ui/SubPage'
import { SparkIcon } from '@/components/ui/icons'
import { Atalho } from './pecas'

// A agenda do assistente no painel — o primeiro cartão de "Toda semana".
//
// Todo o resto do painel é obra que se faz UMA vez: a foto, a bio, o vídeo, o
// cartão. Fechar um horário que foi marcado por fora é a única coisa que se
// refaz toda semana, e por isso não pode viver numa lista que some quando o
// passo é cumprido — foi exatamente assim que ela ficou invisível justamente
// para quem já tinha ligado o assistente.
//
// Só aparece com o assistente ligado: sem grade não há horário a fechar, e um
// cartão que não leva a nada é ruído. Mudar os dias e horários mora na linha
// "Agenda" de "Seu perfil".
export function AgendaCard({ profile, coluna }: { profile: Profile; coluna?: boolean }) {
  const cfg = useMemo(() => resolveAssistantConfig(profile.assistant), [profile.assistant])
  // Sempre pela config RESOLVIDA: perfil antigo sem `assistant` gravado cai no
  // padrão — que é o que o visitante enxerga. Contar a partir do campo cru diria
  // "nenhum horário" para quem está oferecendo cinco por dia.
  const dias = useMemo(() => buildAssistantDays(cfg), [cfg])

  if (resolveSchedulingMode(profile) !== 'assistant') return null

  const livres = dias.reduce((n, d) => n + d.times.length, 0)
  const fechados = cfg.busy?.length ?? 0

  return (
    <Atalho
      to={comVolta('/agenda', '/painel')}
      Icone={SparkIcon}
      titulo="Sua agenda"
      texto="Marcou por telefone ou WhatsApp? Feche o horário e o assistente para de oferecê-lo."
      destaque={
        livres > 0
          ? `${livres} ${livres === 1 ? 'horário livre' : 'horários livres'} em ${dias.length} ${dias.length === 1 ? 'dia' : 'dias'}${
              fechados > 0 ? ` · ${fechados} ${fechados === 1 ? 'fechado' : 'fechados'}` : ''
            }`
          : 'Nenhum horário livre agora'
      }
      coluna={coluna}
    />
  )
}
