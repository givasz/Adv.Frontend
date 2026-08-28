import type { Plan } from './types'
import { PLAN_LABEL } from './upsell'

// O QUE A TELA DIZ SOBRE A COBRANÇA — espelha backend/src/assinatura.ts.
//
// A conta de "quem tem direito a quê" é do SERVIDOR: ele já devolve `profile.plan`
// como o plano VIGENTE, então todo portão do produto continua lendo esse campo e
// não precisa saber que cobrança existe. O que vem para cá é só o necessário para
// a tela contar a verdade ao dono: o que ele contratou, o que está valendo, e até
// quando.
//
// Por que isso importa: quem tem o cartão recusado numa terça precisa saber disso
// numa terça, com prazo e com o que fazer — não descobrir no dia em que a página
// mudar de cara. Uma tela que se cala sobre a cobrança é uma tela que transforma
// um problema de cartão em perda de cliente.

export type PlanStatus = 'active' | 'past_due' | 'canceled' | 'paused'

export interface Subscription {
  /** o plano CONTRATADO (pode ser maior que o vigente, se a cobrança falhou) */
  plan: Plan
  status: PlanStatus
  /** o acesso pago está de pé só por carência/mês já pago? */
  cortesia: boolean
  /** o vigente já é menor que o contratado? */
  rebaixado: boolean
  /** até quando o plano contratado ainda vale (ISO) — null = sem prazo */
  validoAte: string | null
  currentPeriodEnd: string | null
  graceUntil: string | null
  /** rebaixamento pedido, esperando o fim do período pago */
  planScheduled: Plan | null
}

/** Quantos dias inteiros faltam para a data (0 = hoje/já passou). */
export function diasAte(iso: string | null, agora: Date = new Date()): number {
  if (!iso) return 0
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return 0
  return Math.max(0, Math.ceil((d - agora.getTime()) / (24 * 60 * 60 * 1000)))
}

export function dataCurta(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

/** Gravidade do aviso — decide a cor e a insistência da tarja. */
export type TomDoAviso = 'info' | 'atencao' | 'urgente'

export interface AvisoDeCobranca {
  tom: TomDoAviso
  titulo: string
  texto: string
  /** rótulo do botão de ação, quando há uma ação óbvia */
  acao?: string
  /** para onde o botão leva */
  destino?: string
}

/**
 * O aviso que o painel mostra — ou `null` quando não há nada a dizer.
 *
 * Uma regra de redação vale para todos: dizer O QUE ACONTECE e QUANDO, nunca só
 * que "há um problema". "Atualize seu pagamento" sem data é um susto; "seu perfil
 * continua no ar até 4 de setembro" é uma informação com a qual dá para agir.
 *
 * E nada de linguagem de cobrança agressiva: o público é advogado, o produto é a
 * página profissional dele, e a régua de comunicação do projeto não muda porque o
 * assunto virou dinheiro.
 */
export function avisoDeCobranca(
  s: Subscription | undefined,
  agora: Date = new Date(),
): AvisoDeCobranca | null {
  if (!s || s.plan === 'free') return null
  const nome = PLAN_LABEL[s.plan]

  // Já rebaixado: o prazo acabou. É o único caso em que a tarja fala no passado.
  if (s.rebaixado) {
    return {
      tom: 'urgente',
      titulo: `Seu ${nome} está suspenso`,
      texto:
        'Sua página continua no ar, mas os recursos do plano estão desligados. ' +
        'Nada foi apagado: assim que o pagamento entrar, tudo volta exatamente como estava.',
      acao: 'Reativar plano',
      destino: `/assinar/${s.plan}`,
    }
  }

  if (s.status === 'past_due') {
    const faltam = diasAte(s.validoAte, agora)
    return {
      tom: faltam <= 2 ? 'urgente' : 'atencao',
      titulo: 'Não conseguimos confirmar seu pagamento',
      texto:
        `Seu ${nome} segue ativo até ${dataCurta(s.validoAte)}` +
        (faltam > 0 ? ` (${faltam} ${faltam === 1 ? 'dia' : 'dias'})` : '') +
        '. Depois disso os recursos do plano ficam desligados — e voltam sozinhos quando o pagamento entrar.',
      acao: 'Atualizar pagamento',
      destino: '/conta',
    }
  }

  if (s.status === 'canceled') {
    return {
      tom: 'atencao',
      titulo: `Seu ${nome} termina em ${dataCurta(s.validoAte)}`,
      texto:
        'Você cancelou, e o que já foi pago continua valendo até lá. ' +
        'Mudou de ideia? Voltar agora não cobra nada a mais.',
      acao: 'Continuar com o plano',
      destino: `/assinar/${s.plan}`,
    }
  }

  if (s.status === 'paused') {
    return {
      tom: 'info',
      titulo: 'Cobrança suspensa',
      texto:
        'Enquanto houver uma medida da moderação em aberto, a assinatura não é cobrada. ' +
        'O prazo do seu plano também fica parado — você não perde os dias.',
    }
  }

  // Rebaixamento agendado: ativo, mas com data marcada para mudar.
  if (s.planScheduled) {
    return {
      tom: 'info',
      titulo: `Mudança para o ${PLAN_LABEL[s.planScheduled]} em ${dataCurta(s.currentPeriodEnd)}`,
      texto:
        `Você continua com o ${nome} até lá — o mês já está pago. ` +
        'Depois dessa data, os recursos que só o plano maior tem ficam guardados, não apagados.',
      acao: 'Cancelar a mudança',
      destino: `/assinar/${s.plan}`,
    }
  }

  return null
}
