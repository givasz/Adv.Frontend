import type { DirectoryResult, Profile } from './types'

export const sampleProfile: Profile = {
  slug: 'marina-sales',
  name: 'Marina Sales',
  oabNumber: 'OAB/SP 214.870',
  oabVerified: true,
  headline: 'Advogada · Cível, Família, Trabalho e Consumidor',
  bio: 'Atuo com escuta e técnica na condução de questões cíveis, trabalhistas, de família e de consumo. Meu trabalho busca reduzir o desgaste dos processos, com informação clara sobre direitos e caminhos possíveis em cada etapa.',
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
        'Divórcio, guarda, pensão alimentícia e regime de bens, com foco em acordos que preservem as relações sempre que possível.',
    },
    {
      id: 'a2',
      label: 'Direito do Trabalho',
      description:
        'Orientação a empregados e empregadores sobre rescisões, verbas, jornada e demais direitos da relação de trabalho.',
    },
    {
      id: 'a3',
      label: 'Direito do Consumidor',
      description:
        'Cobranças indevidas, produtos e serviços com defeito, negativação e problemas em contratos de consumo.',
    },
    {
      id: 'a4',
      label: 'Direito Civil e Contratos',
      description:
        'Elaboração e revisão de contratos, responsabilidade civil e indenizações, buscando segurança jurídica em cada acordo.',
    },
    {
      id: 'a5',
      label: 'Direito Previdenciário',
      description:
        'Aposentadorias, auxílios e revisões de benefícios junto ao INSS, com explicação clara de requisitos e prazos.',
    },
  ],
  highlights: [
    {
      id: 'h1',
      title: '15 anos de atuação',
      detail: 'Advocacia em Direito de Família e Sucessões desde 2010, em São Paulo.',
    },
    {
      id: 'h2',
      title: 'Mestrado em Direito Civil',
      detail: 'Pesquisa em direito sucessório e planejamento patrimonial familiar.',
    },
    {
      id: 'h3',
      title: 'Mediadora certificada',
      detail: 'Formação em mediação de conflitos familiares pelo Tribunal de Justiça.',
    },
  ],
  // Perfil-modelo (Max): 5 perguntas frequentes, no limite do plano. Respostas
  // curtas, educativas e com o lembrete de análise individual — o exemplo que o
  // advogado vê é o padrão que ele vai copiar.
  faqs: [
    {
      id: 'fq1',
      question: 'Como funciona a guarda compartilhada?',
      answer:
        'Na guarda compartilhada, as decisões sobre a vida da criança são tomadas pelos dois pais, e o convívio é dividido de forma equilibrada — o que não significa tempo idêntico. Cada família define o arranjo possível, e o caso concreto precisa ser analisado.',
    },
    {
      id: 'fq2',
      question: 'Quanto tempo demora um inventário?',
      answer:
        'Depende da via. Havendo consenso, herdeiros capazes e documentação em ordem, o inventário pode ser feito em cartório e costuma ser mais rápido que o judicial. Prazos variam conforme a documentação de cada família.',
    },
    {
      id: 'fq3',
      question: 'Preciso ir ao fórum para me divorciar?',
      answer:
        'Nem sempre. Com acordo entre as partes e sem filhos menores ou incapazes, o divórcio pode ser feito em cartório, com assistência de advogado. Havendo divergência, o caminho é judicial.',
    },
    {
      id: 'fq4',
      question: 'O que muda em cada regime de bens?',
      answer:
        'O regime define o que entra na partilha. Na comunhão parcial, divide-se o adquirido durante o casamento; na universal, praticamente todo o patrimônio; na separação total, cada um mantém o seu. A escolha depende do planejamento de cada casal.',
    },
    {
      id: 'fq5',
      question: 'Quais documentos levar na primeira conversa?',
      answer:
        'Documento de identidade, certidões relacionadas ao tema (casamento, nascimento, óbito) e o que existir por escrito sobre a situação. Com isso já é possível entender o cenário e indicar os caminhos.',
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
  // Perfil-modelo com o ASSISTENTE VIRTUAL ligado — é ele que a home demonstra.
  schedulingMode: 'assistant',
  assistant: {
    days: [
      { weekday: 1, times: ['09:00', '10:00', '14:00', '15:00'] },
      { weekday: 2, times: ['14:00', '15:00', '16:00'] },
      { weekday: 3, times: ['09:00', '10:00', '11:00', '14:00'] },
      { weekday: 4, times: ['14:00', '15:00', '16:00', '17:00'] },
      { weekday: 5, times: ['09:00', '10:00', '11:00'] },
    ],
    durationMin: 45,
    leadHours: 2,
    horizonDays: 14,
    greeting: '',
  },
  plan: 'premium',
  theme: 'papel',
  // Identidade própria (white-label do Max) — o exemplo público demonstra o topo
  // da escada: nome do escritório no rodapé, sem a marca advoc.me.
  branding: {
    brandName: 'Sales Advocacia',
    hideWatermark: true,
    customDomain: 'marinasales.adv.br',
  },
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
      title: '10 anos em Direito do Trabalho',
      detail: 'Atuação contínua em reclamatórias trabalhistas e assessoria a empregados.',
    },
    {
      id: 'g-h2',
      title: 'Pós-graduação em Direito Previdenciário',
      detail: 'Especialização com foco em benefícios por incapacidade e revisões do INSS.',
    },
  ],
  socials: [{ kind: 'linkedin', url: 'https://linkedin.com/in/guilherme-sales' }],
  contact: {
    whatsapp: '5511991234567',
    email: 'contato@guilhermesales.adv.br',
  },
  // Agenda própria do advoc.me ligada (seg–sex, 09h–18h, consultas de 45 min).
  schedulingMode: 'whatsapp',
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
