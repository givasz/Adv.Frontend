import type { Profile } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'
import {
  CalendarIcon,
  CheckIcon,
  MailIcon,
  PinIcon,
  ScaleIcon,
  socialMeta,
  SparkIcon,
  WhatsappIcon,
} from '@/components/ui/icons'

// A MINIATURA de cada passo do painel.
//
// O painel tinha um problema de identidade: todo card era a mesma caixa com o
// mesmo chip de pontos e a mesma seta. "Conectar suas redes" e "Adicionar um
// e-mail" eram graficamente indistinguíveis, então a lista virava ruído e nada
// dava vontade de clicar.
//
// A correção não é enfeitar: é cada card mostrar A COISA. Redes exibem os logos
// reais das redes (nas cores das marcas, como já aparecem no perfil); foto mostra
// o avatar do próprio advogado; WhatsApp mostra o glifo verde do botão que vai
// nascer no perfil. A miniatura é uma amostra do resultado, não um ícone
// decorativo — é isso que faz a lista parecer o produto e não um formulário.
//
// Todas as artes ocupam a MESMA caixa de 52px (56 no sm), com `shrink-0`: a
// variedade é interna, o ritmo da coluna continua firme e nada estoura no 320px.

const BOX = 'relative flex h-[52px] w-[52px] shrink-0 items-center justify-center sm:h-14 sm:w-14'

// Moldura de papel — o fundo comum que costura as miniaturas ao timbre do produto.
function Plate({ children, tint = 'brass' }: { children: React.ReactNode; tint?: 'brass' | 'ink' }) {
  return (
    <span
      className={`${BOX} overflow-hidden rounded-xl2 border ${
        tint === 'brass' ? 'border-brass/25 bg-brass/[0.07]' : 'border-ink/10 bg-paper-deep/60'
      }`}
      aria-hidden
    >
      {children}
    </span>
  )
}

// Linhas de texto fantasma — usadas onde o passo produz TEXTO (bio, resposta).
function Lines({ widths, className = '' }: { widths: number[]; className?: string }) {
  return (
    <span className={`flex w-full flex-col items-center gap-[3px] px-2.5 ${className}`}>
      {widths.map((w, i) => (
        <span
          key={i}
          className="h-[3px] rounded-full bg-ink/25"
          style={{ width: `${w}%` }}
        />
      ))}
    </span>
  )
}

/** Redes que o perfil ainda NÃO tem — as que faltam aparecem cheias, as que já
 *  existem ficam esmaecidas. A arte muda conforme o perfil evolui. */
function SocialArt({ profile }: { profile: Profile }) {
  const have = new Set(profile.socials.map((s) => s.kind))
  const show = (['instagram', 'linkedin', 'website', 'youtube'] as const).slice(0, 4)
  return (
    <Plate>
      <span className="grid grid-cols-2 gap-[5px]">
        {show.map((kind) => {
          const meta = socialMeta[kind]
          const Icon = meta.Icon
          const connected = have.has(kind)
          return (
            <Icon
              key={kind}
              width={15}
              height={15}
              className={connected ? 'opacity-25' : ''}
              style={meta.color ? { color: meta.color } : { color: 'var(--tw-prose-body, #6b6155)' }}
            />
          )
        })}
      </span>
    </Plate>
  )
}

export function StepArt({ factorKey, profile }: { factorKey: string; profile: Profile }) {
  switch (factorKey) {
    case 'redes':
      return <SocialArt profile={profile} />

    case 'foto':
      // O próprio avatar do advogado, com a marca de "falta a foto" no canto.
      return (
        <span className={BOX} aria-hidden>
          <Avatar name={profile.name || 'A'} src={profile.avatarUrl} size={46} />
          {!profile.avatarUrl && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-paper bg-burgundy text-[12px] font-bold leading-none text-paper-soft">
              +
            </span>
          )}
        </span>
      )

    case 'whatsapp':
      return (
        <Plate>
          <WhatsappIcon width={26} height={26} style={{ color: '#25D366' }} />
        </Plate>
      )

    case 'email':
      return (
        <Plate tint="ink">
          <MailIcon width={22} height={22} className="text-ink-soft" />
        </Plate>
      )

    case 'frase':
      // Tipografia como assunto: a frase de apresentação é uma linha de display.
      return (
        <Plate>
          <span className="flex flex-col items-center gap-1">
            <span className="font-display text-[19px] font-semibold leading-none text-ink">Aa</span>
            <span className="h-px w-7 bg-brass/70" />
          </span>
        </Plate>
      )

    case 'bio':
      return (
        <Plate tint="ink">
          <Lines widths={[86, 100, 70]} />
        </Plate>
      )

    case 'faq':
      return (
        <Plate tint="ink">
          <span className="flex w-full flex-col items-center gap-[3px] px-2.5">
            <span className="h-[4px] w-[60%] rounded-full bg-brass/70" />
            <Lines widths={[100, 88, 96, 62]} />
          </span>
        </Plate>
      )

    case 'area1':
    case 'area2': {
      // Dois tiles de área, com a barrinha de acento que o perfil usa de verdade.
      // O segundo entra pontilhado quando o passo é justamente adicionar a
      // segunda área.
      const second = factorKey === 'area2'
      return (
        <Plate>
          <span className="flex flex-col items-center gap-[5px]">
            <span className="flex h-[13px] w-8 items-center gap-[3px] rounded-[3px] bg-ink/10 px-1">
              <span className="h-2 w-[2px] shrink-0 rounded-full bg-burgundy" />
              <span className="h-[3px] flex-1 rounded-full bg-ink/25" />
            </span>
            <span
              className={`flex h-[13px] w-8 items-center gap-[3px] rounded-[3px] px-1 ${
                second ? 'border border-dashed border-brass/70' : 'bg-ink/10'
              }`}
            >
              <span
                className={`h-2 w-[2px] shrink-0 rounded-full ${second ? 'bg-brass/70' : 'bg-burgundy'}`}
              />
              <span
                className={`h-[3px] flex-1 rounded-full ${second ? 'bg-brass/40' : 'bg-ink/25'}`}
              />
            </span>
          </span>
        </Plate>
      )
    }

    case 'cidade':
      return (
        <Plate tint="ink">
          <PinIcon width={22} height={22} className="text-burgundy" />
        </Plate>
      )

    case 'oab':
      return (
        <Plate>
          <span className="flex flex-col items-center gap-0.5">
            <ScaleIcon width={18} height={18} className="text-burgundy" />
            <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-brass-deep">
              OAB
            </span>
          </span>
        </Plate>
      )

    case 'oab_conferida':
      return (
        <Plate>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brass/25">
            <CheckIcon width={16} height={16} strokeWidth={2.6} className="text-brass-deep" />
          </span>
        </Plate>
      )

    case 'agenda':
      return (
        <Plate>
          <CalendarIcon width={22} height={22} className="text-burgundy" />
        </Plate>
      )

    case 'nome':
      return (
        <Plate tint="ink">
          <Lines widths={[70, 45]} />
        </Plate>
      )

    default:
      return (
        <Plate>
          <SparkIcon width={20} height={20} className="text-brass-deep" />
        </Plate>
      )
  }
}

/**
 * A frase que diz POR QUE o passo vale a pena — o que muda para quem visita.
 * Sem isto, a lista é um punhado de comandos ("Adicionar foto") sem consequência,
 * e um comando sem consequência não convence ninguém a clicar.
 */
export const STEP_HINT: Record<string, string> = {
  nome: 'É a primeira coisa que aparece no seu perfil.',
  cidade: 'Quem procura advogado procura por cidade antes de tudo.',
  oab: 'O número de inscrição é o que separa um perfil sério de um anúncio.',
  bio: 'Poucas linhas sobre você — a IA escreve o rascunho.',
  whatsapp: 'Vira o botão principal do seu perfil.',
  area1: 'Define para quem o seu perfil faz sentido.',
  foto: 'Perfis com rosto passam muito mais confiança.',
  frase: 'A linha sob o seu nome que resume o que você faz.',
  redes: 'Instagram, LinkedIn e site reunidos em um lugar só.',
  email: 'Um canal formal, para quem prefere não usar WhatsApp.',
  area2: 'Cada área a mais é uma porta a mais para quem busca por assunto.',
  faq: 'As dúvidas que você mais ouve, respondidas por você.',
  oab_conferida: 'A plataforma confere seu registro e mostra isso no perfil.',
  agenda: 'Deixe que marquem um horário sem trocar dezenas de mensagens.',
}
