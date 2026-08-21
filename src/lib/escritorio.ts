// Modelo de domínio da PÁGINA INSTITUCIONAL DE ESCRITÓRIO (sociedade de advogados).
// Autocontido e mockado — trocável depois por API real. Todo texto de exemplo respeita
// o Prov. 205/2021 e o CED da OAB: sem promessa de resultado, ranking, exposição de
// clientes/casos, urgência ou linguagem de venda.

/** Advogado integrante do escritório (card do grid + mini-perfil interno). */
export interface FirmLawyer {
  id: string
  name: string
  /** ex.: "OAB/SP 214.870" */
  oabNumber: string
  /** número de OAB conferido pela plataforma (marca informativa, não endosso da OAB) */
  oabVerified: boolean
  /** área principal — usada no card e na ordenação neutra */
  area: string
  /** bio curta e sóbria, sem tom promocional */
  bio: string
  avatarUrl?: string
  /** LinkedIn PESSOAL do advogado (separado das redes institucionais) */
  linkedin?: string
  /** WhatsApp do advogado — usado quando o escritório encaminha o pedido a ele */
  whatsapp?: string
}

/** Papel dentro da sociedade. `owner` responde pelo faturamento; `admin` também
 *  edita a página e convida; `member` cuida apenas do próprio perfil. */
export type FirmMemberRole = 'owner' | 'admin' | 'member'

/** Estado do vínculo: convidado (não aparece na página) ou ativo (aparece). */
export type FirmMemberState = 'invited' | 'active'

/**
 * Pessoa ligada ao escritório, na visão de QUEM ADMINISTRA. São duas naturezas na
 * mesma lista porque para o dono são a mesma coisa ("gente que eu chamei"):
 *   • `membership` → já tem conta; o perfil é dela e continua dela se sair.
 *   • `invite`     → convite por e-mail para quem ainda não tem conta.
 */
export interface FirmMember {
  id: string
  kind: 'membership' | 'invite'
  /** nome do perfil; no convite por e-mail, o próprio e-mail */
  name: string
  email?: string
  oabNumber?: string
  oabVerified?: boolean
  area?: string
  role: FirmMemberRole
  status: FirmMemberState
  /** endereço do perfil individual, quando já existe */
  profileSlug?: string
}

/** Convite recebido por um advogado — o que aparece no painel dele. */
export interface FirmInvite {
  id: string
  role: FirmMemberRole
  firm: { name: string; slug: string; city: string; state: string }
}

/** Área de atuação do escritório — alimenta a triagem do WhatsApp. */
export interface FirmArea {
  id: string
  label: string
}

/** Redes e contato INSTITUCIONAIS (do escritório, não de cada advogado). */
export interface FirmContact {
  phone?: string
  email?: string
  /** apenas dígitos, formato internacional: 5511999999999 */
  whatsapp?: string
  instagram?: string
  linkedin?: string
}

export interface Firm {
  slug: string
  /** razão/nome da sociedade */
  name: string
  /** registro da SOCIEDADE de advogados na OAB (não confundir com a OAB individual) */
  oabRegistry: string
  /** registro da sociedade conferido pela plataforma */
  oabVerified: boolean
  /** monograma exibido quando não há logo (ex.: "AV") */
  monogram: string
  /** frase institucional curta e sóbria (nunca promocional) */
  tagline: string
  /** texto institucional sobre o escritório */
  about: string
  city: string
  state: string
  contact: FirmContact
  areas: FirmArea[]
  lawyers: FirmLawyer[]
  /** cor de destaque do escritório (white-label) — herdada pela página. Hex. */
  brandAccent?: string
  /** domínio próprio (informativo no protótipo) */
  customDomain?: string
  /**
   * Para onde o assistente virtual manda o pedido:
   *   'institutional' (padrão) → WhatsApp do escritório, que mantém o controle do
   *                              atendimento — o que a maioria quer;
   *   'lawyer'                 → WhatsApp do advogado escolhido, com volta ao
   *                              institucional quando não há escolha ou número.
   */
  assistantRoute?: 'institutional' | 'lawyer'
  // ---- Gestão: só vem em /firms/me (editor). A página pública não recebe. ----
  /** membros e convites pendentes, em ordem alfabética (nunca por senioridade) */
  members?: FirmMember[]
  /** assentos ocupados x contratados (base do plano + extras) */
  seats?: { purchased: number; used: number }
  /** mensalidade calculada pelo servidor para os assentos em uso */
  monthlyPrice?: number
}

export const sampleFirm: Firm = {
  slug: 'andrade-vieira',
  name: 'Andrade & Vieira Sociedade de Advogados',
  oabRegistry: 'OAB/SP 12.345 (Sociedade)',
  oabVerified: true,
  monogram: 'AV',
  tagline: 'Advocacia empresarial e contenciosa desde 2004.',
  about:
    'Sociedade de advogados dedicada à atuação empresarial, trabalhista, previdenciária e de família. ' +
    'Nosso trabalho é orientado por informação clara, técnica e acompanhamento próximo em cada etapa dos processos.',
  city: 'São Paulo',
  state: 'SP',
  contact: {
    phone: '+55 11 3000-0000',
    email: 'contato@andradevieira.adv.br',
    whatsapp: '5511990000000',
    instagram: 'https://instagram.com/andradevieira.adv',
    linkedin: 'https://linkedin.com/company/andradevieira',
  },
  // Mesmos rótulos das áreas dos advogados: no backend as áreas do escritório são
  // DERIVADAS das áreas deles (ver firms.service.toApi), e o assistente usa a área
  // escolhida para filtrar quem atua nela. Rótulos diferentes aqui fariam o exemplo
  // se comportar diferente do escritório real.
  areas: [
    { id: 'emp', label: 'Direito Empresarial' },
    { id: 'fam', label: 'Direito de Família' },
    { id: 'prev', label: 'Direito Previdenciário' },
    { id: 'trab', label: 'Direito Trabalhista' },
  ],
  // Ordem NEUTRA (alfabética na exibição) — sem hierarquia por senioridade/destaque.
  lawyers: [
    {
      id: 'l1',
      name: 'Beatriz Andrade',
      oabNumber: 'OAB/SP 198.402',
      oabVerified: true,
      area: 'Direito Empresarial',
      bio: 'Atua em contratos empresariais, societário e consultoria preventiva para pequenas e médias empresas.',
      avatarUrl:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop',
      linkedin: 'https://linkedin.com/in/beatriz-andrade',
    },
    {
      id: 'l2',
      name: 'Camila Nunes',
      oabNumber: 'OAB/SP 231.155',
      oabVerified: true,
      area: 'Direito de Família',
      bio: 'Dedica-se a divórcio, guarda e sucessões, com foco em condução técnica e acordos quando possível.',
      avatarUrl:
        'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?q=80&w=400&auto=format&fit=crop',
      linkedin: 'https://linkedin.com/in/camila-nunes',
    },
    {
      id: 'l3',
      name: 'Eduardo Vieira',
      oabNumber: 'OAB/SP 156.708',
      oabVerified: true,
      area: 'Direito Previdenciário',
      bio: 'Orienta segurados em aposentadorias, benefícios por incapacidade e revisões, esclarecendo cada etapa.',
      avatarUrl:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=400&auto=format&fit=crop',
      linkedin: 'https://linkedin.com/in/eduardo-vieira',
    },
    {
      id: 'l4',
      name: 'Rafael Costa',
      oabNumber: 'OAB/SP 205.331',
      oabVerified: false,
      area: 'Direito Trabalhista',
      bio: 'Atua em relações de trabalho, rescisões e demandas trabalhistas na esfera judicial e extrajudicial.',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
      linkedin: 'https://linkedin.com/in/rafael-costa',
    },
  ],
}

/** Ordenação neutra dos advogados (alfabética por nome). */
export function lawyersInNeutralOrder(firm: Firm): FirmLawyer[] {
  return [...firm.lawyers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/** Busca um escritório mockado por slug (placeholder de API). */
export function getFirm(slug: string): Firm | null {
  return slug === sampleFirm.slug ? sampleFirm : null
}

// ---- Helpers de edição/criação ----

/** Slug a partir do nome da sociedade. */
export function slugifyFirm(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'escritorio'
  )
}

// Palavras genéricas ignoradas ao montar o monograma.
const FIRM_STOPWORDS = new Set(['sociedade', 'advogados', 'advocacia', 'advogadas', 'de', 'e', 'do', 'da'])

/** Monograma (até 3 letras) a partir do nome — ex.: "Andrade & Vieira" → "AV". */
export function monogramFrom(name: string): string {
  const words = name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !FIRM_STOPWORDS.has(w.toLowerCase()))
  const letters = words.slice(0, 3).map((w) => w[0]?.toUpperCase() ?? '')
  return letters.join('') || (name.trim()[0]?.toUpperCase() ?? '')
}

/** Escritório vazio para começar do zero no editor. */
export function blankFirm(): Firm {
  return {
    slug: '',
    name: '',
    oabRegistry: '',
    oabVerified: false,
    monogram: '',
    tagline: '',
    about: '',
    city: '',
    state: '',
    contact: {},
    areas: [],
    lawyers: [],
    assistantRoute: 'institutional',
  }
}

let lid = 0
/** id local para novos advogados no editor. */
export function nextLawyerId(): string {
  return `firm-l-${Date.now()}-${lid++}`
}
