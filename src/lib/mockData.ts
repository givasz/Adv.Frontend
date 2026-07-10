import type { DirectoryResult, Profile } from './types'

export const sampleProfile: Profile = {
  slug: 'marina-sales',
  name: 'Marina Sales',
  oabNumber: 'OAB/SP 214.870',
  oabVerified: true,
  headline: 'Advogada · Direito de Família e Sucessões',
  bio: 'Atuo com escuta e técnica na condução de questões familiares e sucessórias. Meu trabalho busca reduzir o desgaste emocional dos processos, com informação clara sobre direitos e caminhos possíveis em cada etapa.',
  avatarUrl:
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop',
  city: 'São Paulo',
  state: 'SP',
  regionNote: 'Atendimento em toda a Grande São Paulo',
  serviceMode: { inPerson: true, online: true },
  areas: [
    {
      id: 'a1',
      label: 'Direito de Família',
      description:
        'Orientação em divórcio, guarda, pensão alimentícia e regime de bens, com foco em acordos que preservem as relações familiares sempre que possível.',
    },
    {
      id: 'a2',
      label: 'Sucessões e Inventário',
      description:
        'Condução de inventários judiciais e extrajudiciais, planejamento sucessório e testamentos, esclarecendo cada etapa do processo.',
    },
    {
      id: 'a3',
      label: 'Mediação',
      description:
        'Uso de técnicas de mediação para buscar soluções consensuais e reduzir o tempo e o custo emocional dos litígios.',
    },
  ],
  highlights: [
    {
      id: 'h1',
      title: '12 anos de atuação',
      detail: 'Dedicação exclusiva a Direito de Família e Sucessões desde 2013.',
    },
    {
      id: 'h2',
      title: 'Mediadora certificada',
      detail: 'Formação em métodos consensuais de resolução de conflitos.',
    },
  ],
  articles: [
    {
      id: 'art1',
      title: 'Divórcio consensual: quais documentos reunir antes de começar',
      summary:
        'Um panorama informativo dos documentos costumeiramente exigidos e das etapas do procedimento consensual.',
      readingMinutes: 6,
      url: 'https://marinasales.adv.br/artigos/divorcio-consensual-documentos',
    },
    {
      id: 'art2',
      title: 'Inventário judicial e extrajudicial: entenda as diferenças',
      summary:
        'Explicação geral sobre quando cada via é cabível e o que a lei considera para a escolha entre elas.',
      readingMinutes: 8,
      url: 'https://marinasales.adv.br/artigos/inventario-judicial-extrajudicial',
    },
    {
      id: 'art3',
      title: 'Guarda compartilhada: como a lei trata a rotina dos filhos',
      summary:
        'Conceitos básicos sobre convivência, responsabilidades e os critérios que a legislação prioriza.',
      readingMinutes: 5,
    },
  ],
  socials: [
    { kind: 'instagram', url: 'https://instagram.com/marinasales.adv' },
    { kind: 'linkedin', url: 'https://linkedin.com/in/marinasales' },
    { kind: 'youtube', url: 'https://youtube.com/@marinasales' },
    { kind: 'website', url: 'https://marinasales.adv.br' },
  ],
  contact: {
    whatsapp: '5511998877665',
    email: 'contato@marinasales.adv.br',
    scheduling: 'https://calendly.com/marinasales/consulta',
  },
  plan: 'pro',
  theme: 'papel',
  views: 1284,
}

// Conta de exemplo com a AGENDA NATIVA ativada — para demonstração do agendamento.
export const guilhermeSales: Profile = {
  slug: 'guilherme-sales23',
  name: 'Guilherme Sales',
  oabNumber: 'OAB/SP 398.214',
  oabVerified: false,
  oabStatus: 'none',
  headline: 'Advogado · Direito do Trabalho e Previdenciário',
  bio: 'Atuo com orientação clara em questões trabalhistas e previdenciárias. Busco explicar cada etapa do processo e os caminhos possíveis, para que você tome decisões bem informadas sobre seus direitos.',
  avatarUrl:
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
  city: 'São Paulo',
  state: 'SP',
  regionNote: 'Atendimento presencial e online',
  serviceMode: { inPerson: true, online: true },
  areas: [
    {
      id: 'g-a1',
      label: 'Direito do Trabalho',
      description:
        'Orientação sobre verbas rescisórias, horas extras, reconhecimento de vínculo e demais direitos decorrentes da relação de emprego.',
    },
    {
      id: 'g-a2',
      label: 'Direito Previdenciário',
      description:
        'Esclarecimentos sobre aposentadorias, auxílios e benefícios do INSS, com análise dos requisitos previstos em lei.',
    },
  ],
  highlights: [
    {
      id: 'g-h1',
      title: '9 anos de atuação',
      detail: 'Dedicação a causas trabalhistas e previdenciárias desde 2016.',
    },
  ],
  socials: [{ kind: 'linkedin', url: 'https://linkedin.com/in/guilherme-sales' }],
  contact: {
    whatsapp: '5511991234567',
    email: 'contato@guilhermesales.adv.br',
  },
  // Agenda própria do advoc.me ligada (seg–sex, 09h–18h, consultas de 45 min).
  schedulingMode: 'native',
  booking: {
    weekdays: [1, 2, 3, 4, 5],
    startMin: 540,
    endMin: 1080,
    slotMin: 45,
    leadHours: 12,
    horizonDays: 30,
  },
  plan: 'pro',
  theme: 'papel',
  views: 342,
}

// Perfis de exemplo servidos pelo mock (públicos, por slug).
export const exampleProfiles: Profile[] = [sampleProfile, guilhermeSales]

export const directorySeed: DirectoryResult[] = [
  {
    slug: 'marina-sales',
    name: 'Marina Sales',
    oabNumber: 'OAB/SP 214.870',
    oabVerified: true,
    headline: 'Direito de Família e Sucessões',
    city: 'São Paulo',
    state: 'SP',
    avatarUrl: sampleProfile.avatarUrl,
    areas: ['Direito de Família', 'Sucessões e Inventário', 'Mediação'],
  },
  {
    slug: 'rafael-antunes',
    name: 'Rafael Antunes',
    oabNumber: 'OAB/RJ 118.220',
    oabVerified: true,
    headline: 'Direito Trabalhista',
    city: 'Rio de Janeiro',
    state: 'RJ',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
    areas: ['Direito Trabalhista', 'Direito Sindical'],
  },
  {
    slug: 'julia-moreira',
    name: 'Júlia Moreira',
    oabNumber: 'OAB/MG 98.114',
    oabVerified: false,
    headline: 'Direito Empresarial e Contratos',
    city: 'Belo Horizonte',
    state: 'MG',
    avatarUrl:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=400&auto=format&fit=crop',
    areas: ['Direito Empresarial', 'Contratos', 'Startups'],
  },
  {
    slug: 'carlos-tavares',
    name: 'Carlos Tavares',
    oabNumber: 'OAB/SP 187.902',
    oabVerified: true,
    headline: 'Direito Criminal',
    city: 'Campinas',
    state: 'SP',
    avatarUrl:
      'https://images.unsplash.com/photo-1556157382-97eda2d62296?q=80&w=400&auto=format&fit=crop',
    areas: ['Direito Criminal', 'Execução Penal'],
  },
  {
    slug: 'beatriz-lopes',
    name: 'Beatriz Lopes',
    oabNumber: 'OAB/PR 66.340',
    oabVerified: true,
    headline: 'Direito do Consumidor',
    city: 'Curitiba',
    state: 'PR',
    avatarUrl:
      'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?q=80&w=400&auto=format&fit=crop',
    areas: ['Direito do Consumidor', 'Direito Civil'],
  },
  {
    slug: 'diego-fernandes',
    name: 'Diego Fernandes',
    oabNumber: 'OAB/BA 52.117',
    oabVerified: false,
    headline: 'Direito Previdenciário',
    city: 'Salvador',
    state: 'BA',
    avatarUrl:
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=400&auto=format&fit=crop',
    areas: ['Direito Previdenciário', 'BPC/LOAS'],
  },
]

export const allAreas = [
  'Direito de Família',
  'Sucessões e Inventário',
  'Direito Trabalhista',
  'Direito Criminal',
  'Direito Civil',
  'Direito do Consumidor',
  'Direito Empresarial',
  'Direito Previdenciário',
  'Direito Tributário',
  'Direito Imobiliário',
  'Direito Digital',
  'Contratos',
  'Mediação',
]
