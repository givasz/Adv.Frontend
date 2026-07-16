// Verificação de conformidade com o Provimento 205/2021 do CFOAB (publicidade advocatícia).
// MOTOR DE REGRAS VERSIONADO — heurística client-side para feedback imediato.
// NÃO é aconselhamento jurídico; é um guarda-corpo para reduzir violações óbvias.
//
// As regras (dados/regex) vivem em ./oab.rules.ts — este arquivo contém apenas a
// LÓGICA de avaliação + as orientações de UI. Documentação: docs/motor-de-conformidade.md.
//
// ⚠️ MANTER EM SINCRONIA com backend/src/oab/compliance.ts (+ oab.rules.ts). O
// backend é a fonte da verdade que bloqueia a publicação; a trava de paridade
// garante que os conjuntos de regras não divirjam (ver oab.rules.spec.ts).

import {
  CATEGORIES,
  computeRulesetFingerprint,
  POLICY_VERSION,
  RULES,
  RULESET_REV,
  type Rule,
  type RuleCategory,
  type Severity,
} from './oab.rules'

export { CATEGORIES, POLICY_VERSION, RULES, RULESET_REV, computeRulesetFingerprint }
export type { Rule, RuleCategory, Severity }

/**
 * Apontamento de conformidade — explica EXATAMENTE por quê um trecho foi sinalizado.
 * `term`/`reason` são aliases mantidos por retrocompatibilidade dos consumidores.
 */
export interface ComplianceIssue {
  /** identificador estável da regra que disparou */
  ruleId: string
  /** categoria da vedação */
  category: RuleCategory
  /** gravidade: 'block' impede publicação; 'warn' apenas alerta */
  severity: Severity
  /** versão da política aplicada */
  version: string
  /** trecho do texto que casou com a regra */
  matchedText: string
  /** explicação didática: por que é vedado */
  explanation: string
  /** sugestão de correção acionável */
  suggestion: string
  // ---- aliases (retrocompatibilidade) ----
  /** @deprecated use matchedText */
  term: string
  /** @deprecated use explanation; motivo curto (cabeçalho) */
  reason: string
}

function toIssue(rule: Rule, matchedText: string): ComplianceIssue {
  return {
    ruleId: rule.id,
    category: rule.category,
    severity: rule.severity,
    version: rule.version,
    matchedText,
    explanation: rule.explanation,
    suggestion: rule.suggestion,
    term: matchedText,
    reason: rule.reason,
  }
}

export function checkCompliance(text: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!text) return issues
  for (const rule of RULES) {
    const match = text.match(rule.test)
    if (match) issues.push(toIssue(rule, match[0]))
  }
  return issues
}

export function hasBlockingIssue(text: string): boolean {
  return checkCompliance(text).some((i) => i.severity === 'block')
}

/**
 * Monitor de mudanças normativas: true quando o perfil foi conferido sob uma
 * revisão anterior do conjunto de regras. Nesse caso o editor reavalia o conteúdo
 * e avisa o advogado ao reabrir o editor. `undefined` = perfil antigo, nunca
 * carimbado → considera desatualizado para forçar uma revisão.
 */
export function policyOutdated(policyRevChecked?: number): boolean {
  return (policyRevChecked ?? 0) < RULESET_REV
}

export type ComplianceStatus = 'ok' | 'warn' | 'block'

/** Status agregado de um texto sob a política vigente. */
export function complianceStatus(text: string): ComplianceStatus {
  const issues = checkCompliance(text)
  if (issues.some((i) => i.severity === 'block')) return 'block'
  if (issues.length > 0) return 'warn'
  return 'ok'
}

export const OAB_GUIDANCE = [
  'Informe suas áreas de atuação — mas sem prometer resultados ("ganho garantido", "100% de êxito").',
  'Evite linguagem de mercado: "o melhor", "nº 1", "preço imbatível", "promoção", honorários e descontos.',
  'Não use selos, logotipos ou símbolos oficiais da OAB, nem "aprovado pela OAB".',
  'Não exponha casos de forma que identifique clientes. Mantenha o sigilo profissional.',
  'Evite CTAs de contratação ("contrate agora", "clique e agende") e apelos de urgência.',
  'Descreva a experiência de forma sóbria e informativa, não persuasiva ou sensacionalista.',
]

// Orientações contextuais por campo do editor — usadas pelo botão de ajuda (InfoTip).
// Frases iniciadas por "Evite"/"Não" são renderizadas com marcador de "evitar" (✕);
// as demais, com marcador de "permitido" (✓). Ver Prov. 205/2021 e REGRAS.md.
export const OAB_GUIDANCE_BY_FIELD: Record<string, string[]> = {
  bio: OAB_GUIDANCE,
  headline: [
    'Use uma frase curta e informativa (ex.: "Advogada · Direito de Família").',
    'Evite superlativos e comparações ("o melhor", "nº 1", "referência").',
    'Não inclua chamadas de contratação nem apelos de urgência.',
  ],
  area: [
    'Descreva de forma factual o que você faz nessa área de atuação.',
    'Evite prometer resultados ("êxito garantido") ou linguagem de venda.',
    'Não cite casos, processos ou clientes específicos (sigilo profissional).',
    'Não mencione preços, honorários, descontos ou "consulta grátis".',
  ],
  name: [
    'Use seu nome civil / profissional conforme a inscrição na OAB.',
    'Não use nome fantasia ou marca no lugar do nome do advogado.',
  ],
}
