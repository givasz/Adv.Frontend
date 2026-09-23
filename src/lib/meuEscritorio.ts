// O escritório de quem administra, pedido uma vez por carregamento.
//
// O painel pessoal pede o escritório em dois lugares (a troca de painel no alto e
// o cartão do escritório embaixo). Dois pedidos iguais no mesmo carregamento não
// se pagam: o segundo pega carona no primeiro enquanto ele está em voo. Mora fora
// de lib/escritorioPainel.ts para a lógica pura de lá ter teste sem a rede.

import { api } from './api'
import type { Firm } from './escritorio'

let emVoo: Promise<Firm | null> | null = null

export function carregarMeuEscritorio(): Promise<Firm | null> {
  if (!emVoo) {
    emVoo = api
      .getMyFirm()
      .catch(() => null)
      .finally(() => {
        // Solta logo depois de responder: a próxima tela (ou a volta do editor)
        // tem de ver o que mudou, não o retrato de antes.
        setTimeout(() => (emVoo = null), 0)
      })
  }
  return emVoo
}
