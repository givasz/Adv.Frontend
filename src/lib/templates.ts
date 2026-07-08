// Biblioteca de textos-modelo pré-redigidos em conformidade com o Prov. 205/2021.
//
// São pontos de partida sóbrios e informativos — sem promessa de resultado, preço,
// superlativo, CTA ou apelo de urgência. Ainda assim, TODO texto aplicado passa pelo
// checkCompliance() do editor/AiGenerator (guarda-corpo), então um modelo nunca é
// "liberado e esquecido": ele é revalidado na hora de aplicar e ao publicar.

export interface TextTemplate {
  id: string
  label: string
  text: string
}

// Modelos de BIO — genéricos, o advogado ajusta com seus dados.
export const BIO_TEMPLATES: TextTemplate[] = [
  {
    id: 'bio-sobrio',
    label: 'Sóbrio e direto',
    text: 'Advogado(a) inscrito(a) na OAB, com atuação voltada à orientação clara sobre direitos e caminhos possíveis em cada situação. O trabalho une técnica jurídica e escuta, para que cada pessoa compreenda o processo e tome decisões bem informadas.',
  },
  {
    id: 'bio-experiencia',
    label: 'Foco em experiência',
    text: 'Com anos de exercício da advocacia, dedico-me a acompanhar cada caso com atenção às particularidades de quem procura orientação jurídica. Busco explicar de forma acessível as etapas do processo e as alternativas disponíveis, sempre dentro dos princípios éticos da profissão.',
  },
  {
    id: 'bio-consultivo',
    label: 'Consultivo e preventivo',
    text: 'Atuo em consultoria e no acompanhamento de questões jurídicas, com ênfase na prevenção de conflitos e na organização de documentos e contratos. Meu objetivo é oferecer informação transparente para apoiar decisões seguras no dia a dia.',
  },
  {
    id: 'bio-educativo',
    label: 'Educativo',
    text: 'Além da atuação profissional, produzo conteúdo educativo sobre temas do Direito, para ampliar o acesso à informação jurídica de forma responsável. Acredito em uma advocacia próxima, que esclarece direitos e deveres com linguagem simples.',
  },
]

// Modelos de DESCRIÇÃO DE ÁREA por área de atuação. A chave é o rótulo da área.
const AREA_TEMPLATES: Record<string, string[]> = {
  'Direito de Família': [
    'Orientação em divórcio, guarda, pensão alimentícia e regime de bens, com foco em acordos que preservem as relações familiares sempre que possível.',
    'Acompanhamento em questões de união estável, reconhecimento e dissolução, esclarecendo direitos patrimoniais e deveres de cada parte.',
  ],
  'Sucessões e Inventário': [
    'Condução de inventários judiciais e extrajudiciais, planejamento sucessório e testamentos, esclarecendo cada etapa do procedimento.',
    'Orientação sobre partilha de bens, herança e regularização de patrimônio, com informação clara sobre prazos e documentos necessários.',
  ],
  'Direito Trabalhista': [
    'Orientação a trabalhadores e empregadores sobre direitos e obrigações da relação de trabalho, verbas rescisórias e acordos.',
    'Acompanhamento de questões trabalhistas na esfera consultiva e contenciosa, com atenção à legislação vigente e à negociação.',
  ],
  'Direito Criminal': [
    'Atuação na defesa técnica em procedimentos criminais, com acompanhamento em todas as fases e orientação sobre direitos do acusado.',
    'Orientação em inquéritos e processos criminais, esclarecendo cada etapa e as alternativas processuais cabíveis.',
  ],
  'Direito Civil': [
    'Atuação em responsabilidade civil, obrigações e contratos, com orientação sobre direitos e caminhos para a solução de conflitos.',
    'Acompanhamento em questões cíveis do cotidiano, buscando soluções consensuais sempre que possível.',
  ],
  'Direito do Consumidor': [
    'Orientação sobre relações de consumo, cobranças indevidas e vícios de produtos e serviços, com foco na proteção dos direitos do consumidor.',
    'Acompanhamento em conflitos de consumo na via administrativa e judicial, esclarecendo prazos e possibilidades.',
  ],
  'Direito Empresarial': [
    'Consultoria a empresas em contratos, societário e organização de atividades, com ênfase na prevenção de riscos jurídicos.',
    'Acompanhamento de questões empresariais no dia a dia do negócio, da constituição às relações comerciais.',
  ],
  'Direito Previdenciário': [
    'Orientação sobre aposentadorias, benefícios por incapacidade e revisões, esclarecendo requisitos e documentos necessários.',
    'Acompanhamento de requerimentos junto ao INSS e na via judicial, com informação clara sobre cada etapa.',
  ],
  'Direito Tributário': [
    'Consultoria em questões tributárias, planejamento e revisão de obrigações fiscais, com atenção à legislação aplicável.',
    'Acompanhamento em discussões administrativas e judiciais sobre tributos, esclarecendo alternativas e prazos.',
  ],
  'Direito Imobiliário': [
    'Orientação em compra, venda e locação de imóveis, regularização de documentos e questões de posse e propriedade.',
    'Acompanhamento em contratos imobiliários e conflitos relacionados, com foco na segurança jurídica da negociação.',
  ],
  'Direito Digital': [
    'Orientação sobre proteção de dados, relações na internet e responsabilidade digital, à luz da LGPD e da legislação vigente.',
    'Acompanhamento em questões de privacidade, conteúdo online e contratos digitais, com informação clara sobre direitos.',
  ],
  Contratos: [
    'Elaboração e revisão de contratos, com atenção à clareza das cláusulas e à prevenção de conflitos futuros.',
    'Orientação sobre direitos e obrigações contratuais, buscando equilíbrio e segurança para as partes.',
  ],
  Mediação: [
    'Uso de técnicas de mediação para buscar soluções consensuais e reduzir o tempo e o desgaste dos litígios.',
    'Condução de acordos por meios consensuais, com foco no diálogo e na preservação das relações.',
  ],
}

const AREA_FALLBACK = (area: string): string[] => [
  `Atuação em ${area}, com orientação clara sobre direitos e os caminhos possíveis em cada situação.`,
  `Acompanhamento em questões de ${area} na esfera consultiva e contenciosa, sempre dentro dos princípios éticos da profissão.`,
]

/** Retorna modelos de descrição para uma área (por rótulo), com fallback genérico. */
export function areaTemplates(areaLabel: string): TextTemplate[] {
  const key = areaLabel.trim()
  const texts = AREA_TEMPLATES[key] ?? AREA_FALLBACK(key || 'sua área')
  return texts.map((text, i) => ({ id: `area-${i}`, label: `Modelo ${i + 1}`, text }))
}

/** Modelos disponíveis para um alvo do gerador (bio ou área). */
export function templatesFor(kind: 'bio' | 'area', areaLabel?: string): TextTemplate[] {
  return kind === 'bio' ? BIO_TEMPLATES : areaTemplates(areaLabel ?? '')
}
