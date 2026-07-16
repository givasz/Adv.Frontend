// Suíte de conformidade OAB — valida o motor de regras (Prov. 205/2021 + CED).
// Cada categoria pedida é coberta com exemplos REAIS (proibidos → devem sinalizar;
// permitidos → não podem gerar falso-positivo). Ver docs/motor-de-conformidade.md.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CATEGORIES,
  checkCompliance,
  complianceStatus,
  computeRulesetFingerprint,
  hasBlockingIssue,
  policyOutdated,
  RULES,
  RULESET_REV,
  type ComplianceIssue,
} from './oab'

/** Ids das regras que dispararam para um texto. */
const idsFor = (text: string): string[] => checkCompliance(text).map((i) => i.ruleId)

describe('checkCompliance — formato do apontamento', () => {
  it('produz um apontamento completo e explicativo (não apenas "bloqueado")', () => {
    const issues = checkCompliance('Resultado 100% garantido no seu processo')
    expect(issues.length).toBeGreaterThan(0)
    const issue = issues[0]
    const required: (keyof ComplianceIssue)[] = [
      'ruleId',
      'category',
      'severity',
      'version',
      'matchedText',
      'explanation',
      'suggestion',
    ]
    for (const key of required) {
      expect(issue[key], `campo ${String(key)} presente`).toBeTruthy()
    }
    // aliases de retrocompatibilidade continuam funcionando
    expect(issue.term).toBe(issue.matchedText)
    expect(issue.reason).toBeTruthy()
    // a explicação diz POR QUÊ e a sugestão diz COMO corrigir
    expect(issue.explanation.length).toBeGreaterThan(20)
    expect(issue.suggestion.length).toBeGreaterThan(10)
  })

  it('texto vazio ou sóbrio não gera apontamentos', () => {
    expect(checkCompliance('')).toEqual([])
    expect(
      checkCompliance(
        'Maria Silva é advogada inscrita na OAB/SP, com atuação em direito de família e sucessões. Formada pela USP, atua há dez anos orientando pessoas e empresas.',
      ),
    ).toEqual([])
    expect(complianceStatus('Advogado dedicado ao direito criminal')).toBe('ok')
  })
})

// ---- Cobertura por categoria (exemplos reais) ------------------------------
// Mapeia cada bloco pedido a um ruleId e severidade esperada.
const CATEGORY_CASES: {
  titulo: string
  ruleId: string
  severity: 'block' | 'warn'
  proibidos: string[]
  permitidos: string[]
}[] = [
  {
    titulo: 'promessas de resultado',
    ruleId: 'promise-result',
    severity: 'block',
    proibidos: [
      'Resultado 100% garantido no seu processo',
      'Sucesso garantido em ações trabalhistas',
      'Ofereço a certeza de ganho na sua causa',
      'Garanto a vitória no seu divórcio',
    ],
    permitidos: [
      'Atuação em ações trabalhistas e previdenciárias',
      'Acompanho cada etapa do processo com transparência',
    ],
  },
  {
    titulo: 'comparações e superlativos',
    ruleId: 'superlative-comparison',
    severity: 'block',
    proibidos: [
      'O melhor advogado criminalista da cidade',
      'Escritório nº 1 em direito tributário',
      'Referência nacional em recuperação judicial',
      'O único advogado especialista da região',
    ],
    permitidos: [
      'Advogado dedicado ao direito criminal',
      'Atuação consolidada em direito tributário',
    ],
  },
  {
    titulo: 'mercantilização / linguagem de venda',
    ruleId: 'commercialization',
    severity: 'warn',
    proibidos: [
      'O melhor custo-benefício em assessoria jurídica',
      'Invista no seu direito e não fique no prejuízo',
      'Aproveite a oportunidade, vagas limitadas',
    ],
    permitidos: [
      'Orientação jurídica clara sobre seus direitos',
      'Explico as alternativas possíveis em cada caso',
    ],
  },
  {
    titulo: 'preços e honorários',
    ruleId: 'price-fee',
    severity: 'block',
    proibidos: [
      'Consulta a partir de R$ 200',
      'Honorários acessíveis para todos',
      'Confira nossa tabela de valores',
    ],
    permitidos: ['Atendimento mediante agendamento', 'Entre em contato para conhecer o trabalho'],
  },
  {
    titulo: 'descontos e formas de pagamento',
    ruleId: 'discount-payment',
    severity: 'block',
    proibidos: [
      'Desconto especial para novos clientes',
      'Parcelamos seus honorários em até 12x',
      'Aceitamos cartão e pix',
    ],
    permitidos: ['Atuação em direito do consumidor', 'Fale comigo para agendar um atendimento'],
  },
  {
    titulo: 'gratuidade como isca',
    ruleId: 'free-bait',
    severity: 'block',
    proibidos: [
      'Primeira consulta gratuita, agende já',
      'Faço a análise do seu caso sem custo',
      'Avaliação gratuita do seu processo',
    ],
    permitidos: ['Atendo mediante agendamento prévio', 'Esclareço dúvidas sobre a área de atuação'],
  },
  {
    titulo: 'apelo de urgência',
    ruleId: 'urgency-appeal',
    severity: 'warn',
    proibidos: [
      'Não perca tempo, ligue agora',
      'Últimas vagas para atendimento',
      'Atendimento 24h, agende já',
    ],
    permitidos: [
      'Estou à disposição para agendar um atendimento',
      'Atendo com horário marcado',
    ],
  },
  {
    titulo: 'chamada direta à contratação (CTA)',
    ruleId: 'cta-hire',
    severity: 'block',
    proibidos: ['Contrate agora mesmo', 'Clique aqui e agende sua consulta', 'Feche seu contrato hoje'],
    permitidos: ['Enviar mensagem', 'Falar no WhatsApp', 'Agendar um atendimento'],
  },
  {
    titulo: 'depoimentos e lista de clientes',
    ruleId: 'testimonials-clientlist',
    severity: 'block',
    proibidos: [
      'Veja os depoimentos de clientes satisfeitos',
      'Nossos clientes incluem grandes empresas',
      'Trabalhamos com Petrobras',
    ],
    permitidos: ['Atuação para pessoas físicas e empresas', 'Experiência em contratos empresariais'],
  },
  {
    titulo: 'quebra de sigilo (caso/cliente identificável)',
    ruleId: 'client-case-secrecy',
    severity: 'block',
    proibidos: [
      'Ganhei o caso do João contra o banco',
      'Meu cliente Pedro ganhou a ação',
      'No caso Silva vs Estado obtivemos liminar',
    ],
    permitidos: [
      'Atuo em ações contra instituições financeiras',
      'Experiência em demandas cíveis e de consumo',
    ],
  },
  {
    titulo: 'uso indevido da OAB',
    ruleId: 'oab-symbol',
    severity: 'block',
    proibidos: [
      'Advogado aprovado pela OAB',
      'Perfil com selo oficial da OAB',
      'Escritório verificado pela OAB',
    ],
    permitidos: ['Inscrito na OAB/SP sob nº 123.456', 'OAB conferida pela plataforma'],
  },
]

describe.each(CATEGORY_CASES)('categoria: $titulo', ({ ruleId, severity, proibidos, permitidos }) => {
  it.each(proibidos)('bloqueia/alerta: %s', (texto) => {
    expect(idsFor(texto), `esperava a regra ${ruleId}`).toContain(ruleId)
    const issue = checkCompliance(texto).find((i) => i.ruleId === ruleId)!
    expect(issue.severity).toBe(severity)
    if (severity === 'block') expect(hasBlockingIssue(texto)).toBe(true)
  })

  it.each(permitidos)('permite: %s', (texto) => {
    expect(idsFor(texto), `não deveria disparar ${ruleId}`).not.toContain(ruleId)
  })
})

// ---- Consistência interna: os exemplos embutidos em cada regra são coerentes --
describe('coerência dos exemplos declarados em cada regra', () => {
  it.each(RULES.map((r) => [r.id, r] as const))(
    '%s: examplesForbidden disparam e examplesAllowed não',
    (_id, rule) => {
      for (const bad of rule.examplesForbidden) {
        expect(idsFor(bad), `"${bad}" deveria disparar ${rule.id}`).toContain(rule.id)
      }
      for (const good of rule.examplesAllowed) {
        expect(idsFor(good), `"${good}" não deveria disparar ${rule.id}`).not.toContain(rule.id)
      }
    },
  )

  it('toda categoria usada existe em CATEGORIES', () => {
    for (const rule of RULES) {
      expect(CATEGORIES[rule.category], `categoria ${rule.category}`).toBeTruthy()
    }
  })
})

describe('status agregado e monitor normativo', () => {
  it('block prevalece sobre warn e ok', () => {
    expect(complianceStatus('Consulta grátis e não perca tempo')).toBe('block')
    expect(complianceStatus('Não perca tempo')).toBe('warn')
    expect(complianceStatus('Atuação em direito civil')).toBe('ok')
  })

  it('policyOutdated sinaliza revisão anterior à vigente', () => {
    expect(policyOutdated(RULESET_REV)).toBe(false)
    expect(policyOutdated(RULESET_REV - 1)).toBe(true)
    expect(policyOutdated(undefined)).toBe(true)
  })
})

// ---- TRAVA DE PARIDADE front/back -----------------------------------------
describe('trava de paridade do ruleset', () => {
  it('o fingerprint das regras bate com docs/oab-ruleset.lock', () => {
    const lock = readFileSync(
      new URL('../../../docs/oab-ruleset.lock', import.meta.url),
      'utf8',
    ).trim()
    expect(computeRulesetFingerprint()).toBe(lock)
  })
})
