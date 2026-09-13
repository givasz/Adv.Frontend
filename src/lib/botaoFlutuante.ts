// O botão no canto do perfil — qual o advogado escolheu, e se ele aparece.
//
// Um só: o WhatsApp OU o assistente virtual. Dois elementos seguindo a rolagem
// seriam o dobro do que a sobriedade do Prov. 205/2021 já tolera com esforço, e
// disputariam o mesmo canto da tela.
//
// Mora em lib (e não no componente) porque o painel também precisa saber a
// escolha para escrever o resumo da seção, e o painel não carrega o balão.

import type { BotaoFlutuante, Profile } from './types'
import { canUseScheduling } from './plans'

const VALORES: readonly string[] = ['off', 'whatsapp', 'assistant']

/**
 * O que o advogado escolheu. Sem a escolha nova (perfil anterior a ela, ou
 * servidor antigo), vale o balão de antes, que só existia para o assistente.
 * Valor que não é um dos três conta como "não escolheu".
 */
export function botaoFlutuanteEscolhido(p: Pick<Profile, 'floating' | 'assistant'>): BotaoFlutuante {
  if (typeof p.floating === 'string' && VALORES.includes(p.floating)) return p.floating
  return p.assistant?.floating === true ? 'assistant' : 'off'
}

/**
 * Qual botão aparece NESTE perfil agora — ou nenhum.
 *
 *   • plano: só Pro e Max. Quem decide é o servidor (manda 'off' fora deles);
 *     aqui é a segunda camada, para a prévia do editor obedecer também;
 *   • WhatsApp: só com um número que o wa.me aceita — um atalho para lugar
 *     nenhum é um botão quebrado;
 *   • assistente: só com o assistente como modo de agendamento, senão o atalho
 *     levaria a uma conversa que não existe.
 *
 * Função pura e com teste: a decisão de mostrar um elemento que persegue o
 * visitante não pode regredir num refactor de JSX.
 */
export function botaoFlutuante(
  p: Pick<Profile, 'floating' | 'assistant' | 'plan'>,
  opcoes: { schedulingMode: string; temWhatsapp: boolean },
): 'whatsapp' | 'assistant' | null {
  if (!canUseScheduling(p.plan)) return null
  const escolha = botaoFlutuanteEscolhido(p)
  if (escolha === 'whatsapp') return opcoes.temWhatsapp ? 'whatsapp' : null
  if (escolha === 'assistant') return opcoes.schedulingMode === 'assistant' ? 'assistant' : null
  return null
}
