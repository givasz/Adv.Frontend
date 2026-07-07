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
  socials: [
    { kind: 'instagram', url: 'https://instagram.com/marinasales.adv' },
    { kind: 'linkedin', url: 'https://linkedin.com/in/marinasales' },
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
