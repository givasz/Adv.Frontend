import { Link } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { avisoDeCobranca, avisoDeEndereco, type AvisoDeCobranca, type TomDoAviso } from '@/lib/assinatura'
import { profileUrlLabel } from '@/lib/publicUrl'
import { ClockIcon } from '@/components/ui/icons'

// A tarja que conta a verdade sobre a cobrança — no painel e no editor.
//
// Sem ela, o único jeito de descobrir que a cobrança falhou era a página mudar de
// cara sozinha. Uma tela que se cala sobre o pagamento transforma um problema de
// cartão vencido em cliente perdido: a pessoa não sabe o que houve, presume que o
// produto quebrou, e vai embora sem nunca ter decidido ir.
//
// Regras de redação (ver lib/assinatura.ts, onde o texto é montado):
//   • sempre dizer O QUE ACONTECE e QUANDO — "atualize seu pagamento" sozinho é um
//     susto; "sua página continua no ar até 4 de setembro" dá o que fazer;
//   • sempre dizer que nada é apagado, porque é verdade e é a dúvida real;
//   • nunca linguagem de cobrança agressiva. O público é advogado e o assunto é a
//     página profissional dele.

const ESTILO: Record<TomDoAviso, { caixa: string; icone: string }> = {
  info: { caixa: 'border-ink/15 bg-paper-soft/70', icone: 'text-ink-faint' },
  atencao: { caixa: 'border-brass/50 bg-brass/[0.10]', icone: 'text-brass-deep' },
  urgente: { caixa: 'border-burgundy/40 bg-burgundy/[0.07]', icone: 'text-burgundy' },
}

export function AvisoCobranca({ profile, className = '' }: { profile: Profile; className?: string }) {
  // Dois assuntos diferentes, e por isso duas tarjas em vez de uma que muda de
  // texto: a cobrança fala do PLANO (o que está desligado, até quando), e o
  // endereço fala de algo que quebra FORA daqui (o QR impresso, o link no
  // Google). Na prática só uma aparece por vez — o prazo do endereço só começa
  // quando o plano já caiu, e aí o aviso de cobrança já se calou.
  const avisos = [
    avisoDeCobranca(profile.subscription),
    avisoDeEndereco(profile.subscription, profileUrlLabel(profile.slug)),
  ].filter((a): a is AvisoDeCobranca => a !== null)

  if (avisos.length === 0) return null

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {avisos.map((aviso) => (
        <Tarja key={aviso.titulo} aviso={aviso} />
      ))}
    </div>
  )
}

function Tarja({ aviso }: { aviso: AvisoDeCobranca }) {
  const estilo = ESTILO[aviso.tom]

  return (
    <div
      // `role="status"` e não `alert`: o leitor de tela anuncia sem interromper o
      // que a pessoa está fazendo. Cobrança é importante, não é emergência.
      role="status"
      className={`flex flex-col gap-3 rounded-xl2 border px-4 py-3.5 sm:flex-row sm:items-center ${estilo.caixa}`}
    >
      <ClockIcon width={18} height={18} className={`shrink-0 ${estilo.icone}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink">{aviso.titulo}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{aviso.texto}</p>
      </div>
      {aviso.acao && aviso.destino && (
        <Link
          to={aviso.destino}
          className="shrink-0 rounded-full border border-ink/20 bg-paper px-4 py-2 text-center text-[12.5px] font-semibold text-ink transition-colors hover:border-burgundy/40 hover:text-burgundy"
        >
          {aviso.acao}
        </Link>
      )}
    </div>
  )
}
