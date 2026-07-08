// Motivos de denúncia e diretrizes ao denunciante.
// Espelha backend/src/moderation/moderation.constants.ts. Os motivos derivam
// das vedações do REGRAS.md (Provimento 205/2021 + Código de Ética).

import type { ReportReason } from './types'

export interface ReasonMeta {
  id: ReportReason
  label: string
  /** ajuda curta que aparece sob o motivo */
  hint: string
}

export const REPORT_REASONS: ReasonMeta[] = [
  {
    id: 'oab_invalid',
    label: 'Número de OAB falso ou que não confere',
    hint: 'O número da OAB parece inexistente, de outra pessoa ou inválido.',
  },
  {
    id: 'result_promise',
    label: 'Promessa ou garantia de resultado',
    hint: '“Ganho garantido”, “100% de êxito”, “resultado assegurado”. (Prov. 205/2021, Art. 6º)',
  },
  {
    id: 'pricing',
    label: 'Divulgação de preços, honorários ou descontos',
    hint: 'Valores, promoções, parcelamento, “consulta grátis”. (Prov. 205/2021, Art. 3º)',
  },
  {
    id: 'self_aggrandizement',
    label: 'Autoengrandecimento ou comparação',
    hint: '“O melhor advogado”, “nº 1”, “líder de mercado”. (Prov. 205/2021, Art. 3º, IV)',
  },
  {
    id: 'solicitation',
    label: 'Captação de clientela / mercantilização',
    hint: '“Contrate agora”, apelo de urgência, sorteios, brindes. (CED, Art. 46)',
  },
  {
    id: 'client_exposure',
    label: 'Exposição de cliente ou caso (quebra de sigilo)',
    hint: 'Nomes de clientes, casos identificáveis, depoimentos. (CED, Art. 42)',
  },
  {
    id: 'impersonation',
    label: 'Perfil falso ou se passando por outra pessoa',
    hint: 'Identidade, foto ou nome de terceiro usados sem ser o titular.',
  },
  {
    id: 'offensive',
    label: 'Conteúdo ofensivo, discriminatório ou ilegal',
    hint: 'Linguagem ofensiva, discriminação ou qualquer conteúdo ilícito.',
  },
  {
    id: 'other',
    label: 'Outro (descreva abaixo)',
    hint: 'Explique objetivamente o que viola as regras.',
  },
]

export const REASON_LABEL: Record<ReportReason, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.id, r.label]),
) as Record<ReportReason, string>

/** Aviso mostrado ao denunciante antes de escrever (diretrizes de uso responsável). */
export const REPORT_GUIDELINES = {
  title: 'Antes de denunciar, leia com atenção',
  intro:
    'Use este canal para relatar conteúdo que viola as normas de publicidade da advocacia (Provimento 205/2021 da OAB e Código de Ética). A denúncia é analisada por um moderador.',
  do: [
    'Seja objetivo: aponte qual trecho ou seção do perfil viola as regras.',
    'Descreva fatos, não opiniões pessoais ou desavenças particulares.',
    'Se puder, copie o texto exato que considera irregular.',
  ],
  dont: [
    'Não use o canal para ofender, difamar ou fazer acusações sem base.',
    'Não envie dados pessoais de terceiros nem informações sigilosas.',
    'Denúncias falsas ou de má-fé podem ser desconsideradas.',
  ],
  outcome:
    'Se procedente, o moderador pode retirar o perfil do ar, censurar apenas a parte irregular ou enviar um aviso ao titular. Nada é publicado com seu nome — o e-mail é opcional e só serve para retorno.',
}
