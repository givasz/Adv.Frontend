import { Link } from 'react-router-dom'
import type { BotaoFlutuante, Profile } from '@/lib/types'
import { resolveSchedulingMode } from '@/lib/booking'
import { botaoFlutuanteEscolhido } from '@/lib/botaoFlutuante'
import { editorPath } from '@/lib/editorSections'
import { whatsappHref } from '@/lib/whatsapp'
import { SparkIcon, WhatsappIcon } from '@/components/ui/icons'

// A escolha do botão no canto do perfil: o WhatsApp, o assistente, ou nenhum.
//
// Antes só existia o balão do assistente, num interruptor escondido dentro da
// configuração do assistente — quem não usava o assistente não tinha como pôr um
// atalho no canto, e quem usava não sabia que ele existia. Aqui a escolha é uma
// seção própria, com cartão no painel.

const OPCOES: { key: BotaoFlutuante; label: string; hint: string }[] = [
  {
    key: 'off',
    label: 'Nenhum',
    hint: 'Sem atalho no canto. Os botões de contato continuam no corpo da página.',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    hint: '“Conversar no WhatsApp” acompanha a rolagem e abre a conversa com você.',
  },
  {
    key: 'assistant',
    label: 'Assistente virtual',
    hint: '“Agendar uma conversa” abre o assistente, que oferece os horários da sua grade.',
  },
]

export function BotaoFlutuanteCard({
  profile,
  set,
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  /** modo espectro (dentro do cadeado): controles inertes, só para o advogado ver */
  preview?: boolean
}) {
  const escolhido = botaoFlutuanteEscolhido(profile)
  const temWhatsapp = !!whatsappHref(profile.contact.whatsapp)
  const assistenteLigado = resolveSchedulingMode(profile) === 'assistant'

  return (
    <div className={`space-y-4 ${preview ? 'pointer-events-none select-none' : ''}`}>
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        Um atalho discreto no canto do seu perfil. Ele só aparece depois que a pessoa rola a
        página e some de vez quando ela fecha. Escolha um — ou nenhum.
      </p>

      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Botão flutuante do perfil">
        {OPCOES.map((o) => {
          const ativo = escolhido === o.key
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => set({ floating: o.key })}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                ativo
                  ? 'border-burgundy bg-burgundy/[0.06] ring-1 ring-burgundy/30'
                  : 'border-ink/15 bg-paper-soft hover:border-ink/30'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                {o.key === 'whatsapp' && <WhatsappIcon width={13} height={13} className="text-brass-deep" />}
                {o.key === 'assistant' && <SparkIcon width={13} height={13} className="text-brass-deep" />}
                {o.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{o.hint}</span>
            </button>
          )
        })}
      </div>

      {/* Escolhido, mas sem o que ele precisa: a pessoa escolheu e não vê nada
          no perfil. Sem este aviso, parece defeito. */}
      {escolhido === 'whatsapp' && !temWhatsapp && (
        <p className="rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-brass-deep">
          O botão só aparece com o seu número de WhatsApp.{' '}
          <Link to={editorPath('redes', 'whatsapp')} className="font-semibold underline underline-offset-4">
            Informar o WhatsApp
          </Link>
        </p>
      )}
      {escolhido === 'assistant' && !assistenteLigado && (
        <p className="rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-brass-deep">
          O assistente está desligado, e sem ele o botão não aparece.{' '}
          <Link to={editorPath('agenda')} className="font-semibold underline underline-offset-4">
            Ligar o assistente em Sua agenda
          </Link>
        </p>
      )}

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        O texto do botão é fixo e não pede nada a quem visita: quem escreve é a pessoa, no WhatsApp
        dela.
      </p>
    </div>
  )
}
