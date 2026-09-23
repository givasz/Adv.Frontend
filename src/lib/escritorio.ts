// Modelo de domínio da PÁGINA INSTITUCIONAL DE ESCRITÓRIO (sociedade de advogados).
// Autocontido e mockado — trocável depois por API real. Todo texto de exemplo respeita
// o Prov. 205/2021 e o CED da OAB: sem promessa de resultado, ranking, exposição de
// clientes/casos, urgência ou linguagem de venda.

import type { Endereco } from './endereco'
import type { TriagemConfig } from './triagem'
import type { AssistantConfig } from './types'

/** Advogado integrante do escritório (card do grid + mini-perfil interno). */
export interface FirmLawyer {
  id: string
  /**
   * Endereço do perfil individual. VAZIO no advogado que o escritório listou à
   * mão e ainda não tem conta — é assim que o card sabe não virar link, e que a
   * caixa de solicitações sabe que não há painel para onde encaminhar.
   */
  slug?: string
  name: string
  /** ex.: "OAB/SP 214.870" */
  oabNumber: string
  /** área principal — usada no card e na ordenação neutra */
  area: string
  /** bio curta e sóbria, sem tom promocional */
  bio: string
  avatarUrl?: string
  /** LinkedIn PESSOAL do advogado (separado das redes institucionais) */
  linkedin?: string
  /** WhatsApp do advogado — usado quando o escritório encaminha o pedido a ele */
  whatsapp?: string
  /**
   * A agenda do assistente do PRÓPRIO advogado (dias, horários, ocupados), quando
   * ele usa o assistente no perfil. Com ela, a conversa do escritório oferece os
   * horários livres dele; sem ela, pergunta dia e período. O servidor só manda
   * para quem ligou o assistente e tem plano que permite.
   */
  agenda?: AssistantConfig
  /**
   * As perguntas de triagem que ELE escreveu no próprio perfil, quando valem
   * (plano Max, interruptor ligado, ao menos uma pergunta respondível).
   *
   * Sem isto, escolher um advogado pela página da sociedade pulava a triagem
   * inteira que o mesmo advogado faz no perfil dele: duas portas para a mesma
   * pessoa, com qualidade de informação diferente. O servidor é quem decide se
   * vale (profiles/agenda-publica.ts) — aqui só se lê.
   */
  triagem?: TriagemConfig
  /**
   * Ele recebe pedidos no PAINEL em vez de no WhatsApp? Quando sim, a conversa
   * do escritório termina no formulário de solicitação, como a do perfil dele —
   * antes, entrar por aqui ignorava a caixa que ele tinha ligado e jogava tudo
   * no WhatsApp.
   */
  meetingInbox?: boolean
}

/** Grade de exemplo, a mesma forma que o editor grava (faixas + horários). */
function gradeDeExemplo(inicio: string, fim: string, horarios: string[]): AssistantConfig {
  return {
    days: [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      times: [...horarios],
      faixas: [{ inicio, fim }],
    })),
    durationMin: 60,
    leadHours: 2,
    horizonDays: 14,
    busy: [],
  }
}

/** Papel dentro da sociedade. `owner` responde pelo faturamento; `admin` também
 *  edita a página e convida; `member` cuida apenas do próprio perfil. */
export type FirmMemberRole = 'owner' | 'admin' | 'member'

/**
 * Estado do vínculo, do mais frouxo ao mais forte:
 *
 *   listed  → o ESCRITÓRIO inseriu o advogado e ele ainda não tem conta. Aparece
 *             na página da sociedade, mas não acessa nada — quem respondeu por
 *             ele foi quem o listou.
 *   invited → já existe um e-mail associado e um convite à espera de resposta.
 *   active  → aceitou; o perfil dele assume o lugar no grid.
 */
export type FirmMemberState = 'listed' | 'invited' | 'active'

/**
 * Pessoa ligada ao escritório, na visão de QUEM ADMINISTRA. São duas naturezas na
 * mesma lista porque para o dono são a mesma coisa ("gente que eu chamei"):
 *   • `membership` → já tem conta; o perfil é dela e continua dela se sair.
 *   • `invite`     → convite por e-mail para quem ainda não tem conta.
 *   • `roster`     → o escritório inseriu à mão, sem conta e sem convite. É o que
 *                    faz a página ficar pronta no mesmo dia, em vez de esperar
 *                    cada advogado se cadastrar.
 */
export interface FirmMember {
  id: string
  kind: 'membership' | 'invite' | 'roster'
  /** nome do perfil; no convite por e-mail, o próprio e-mail */
  name: string
  email?: string
  oabNumber?: string
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
  /** monograma exibido quando não há logo (ex.: "AV") */
  monogram: string
  /**
   * Logo do escritório — imagem enviada pelo dono, guardada como data URI (o
   * mesmo caminho da foto do advogado; ver components/escritorio/LogoUpload).
   *
   * A coluna existia no banco desde o começo e nada a preenchia: o editor não
   * oferecia o campo e o backend não gravava. Todo escritório era duas letras num
   * círculo, sem caminho para trocar. Vazio = usa o monograma.
   */
  logoUrl?: string
  /** frase institucional curta e sóbria (nunca promocional) */
  tagline: string
  /** texto institucional sobre o escritório */
  about: string
  city: string
  state: string
  /**
   * Endereço da sede. O escritório é o caso em que ele mais falta: uma
   * sociedade tem porta física, e a página institucional existia dizendo só a
   * cidade. Ver lib/endereco.ts.
   */
  address?: Endereco
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
  /** Frase de abertura do assistente institucional. Vazio = a fala padrão. */
  assistantGreeting?: string
  /**
   * Assuntos escritos por quem administra, ALÉM dos derivados da área principal
   * de cada advogado. A lista que a conversa oferece é a soma das duas: só as
   * derivadas deixavam sem pergunta de assunto o escritório cujos membros ainda
   * não preencheram área, e sem nada que o dono pudesse fazer a respeito.
   */
  extraAreas?: string[]
  /**
   * Os pedidos da página institucional chegam à caixa do escritório em vez de
   * sair pelo WhatsApp. Desligado por padrão: ligar é passar a GUARDAR dado de
   * visitante, e a escolha é de quem responde pelo escritório.
   */
  meetingInboxEnabled?: boolean
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
  monogram: 'AV',
  tagline: 'Advocacia empresarial e contenciosa desde 2004.',
  about:
    'Sociedade de advogados dedicada à atuação empresarial, trabalhista, previdenciária e de família. ' +
    'Nosso trabalho é orientado por informação clara, técnica e acompanhamento próximo em cada etapa dos processos.',
  city: 'São Paulo',
  state: 'SP',
  address: {
    cep: '04538133',
    rua: 'Av. Brigadeiro Faria Lima',
    numero: '3900',
    complemento: '10º andar',
    bairro: 'Itaim Bibi',
    publico: true,
  },
  // O exemplo encaminha DIRETO para o advogado escolhido — é o que a opção
  // 'lawyer' faz, e sem isso a demonstração nunca mostrava o encaminhamento.
  // Sem escolha (ou sem número dele), volta para o WhatsApp institucional.
  assistantRoute: 'lawyer',
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
      area: 'Direito Empresarial',
      bio: 'Atua em contratos empresariais, societário e consultoria preventiva para pequenas e médias empresas.',
      avatarUrl:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop',
      linkedin: 'https://linkedin.com/in/beatriz-andrade',
      whatsapp: '5511990000001',
      // Usa a agenda do assistente: a conversa do escritório oferece os horários dela.
      agenda: gradeDeExemplo('09:00', '12:00', ['09:00', '10:00', '11:00']),
      // E recebe no PAINEL, não no WhatsApp: escolhendo-a, a conversa termina no
      // formulário de solicitação. Com a Camila no WhatsApp e ela na caixa, o
      // exemplo mostra os DOIS caminhos — e é a caixa do advogado valendo também
      // na página da sociedade, que era o que faltava.
      meetingInbox: true,
      // E a triagem DELA: quem a escolhe pela página do escritório responde às
      // mesmas perguntas que responderia no perfil dela. Enunciados factuais, sem
      // promessa e sem pedir detalhe do caso (Prov. 205/2021 e a guarda de dados
      // do aviso de privacidade).
      triagem: {
        enabled: true,
        questions: [
          {
            id: 'e1',
            kind: 'escolha',
            label: 'A empresa já foi formalizada?',
            options: [
              { id: 'sim', texto: 'Sim' },
              { id: 'nao', texto: 'Ainda não' },
            ],
          },
          {
            id: 'e2',
            kind: 'escolha',
            label: 'Existe prazo ou audiência marcada?',
            options: [
              { id: 'p-sim', texto: 'Sim' },
              { id: 'p-nao', texto: 'Não' },
              { id: 'p-nsei', texto: 'Não sei' },
            ],
          },
        ],
      },
    },
    {
      id: 'l2',
      name: 'Camila Nunes',
      oabNumber: 'OAB/SP 231.155',
      area: 'Direito de Família',
      bio: 'Dedica-se a divórcio, guarda e sucessões, com foco em condução técnica e acordos quando possível.',
      avatarUrl:
        'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?q=80&w=400&auto=format&fit=crop',
      linkedin: 'https://linkedin.com/in/camila-nunes',
      whatsapp: '5511990000002',
      agenda: gradeDeExemplo('14:00', '18:00', ['14:00', '15:00', '16:00', '17:00']),
      // Sem caixa de propósito: escolhendo-a, o pedido sai pelo WhatsApp DELA —
      // é a demonstração do encaminhamento direto (assistantRoute 'lawyer').
    },
    {
      id: 'l3',
      name: 'Eduardo Vieira',
      oabNumber: 'OAB/SP 156.708',
      area: 'Direito Previdenciário',
      bio: 'Orienta segurados em aposentadorias, benefícios por incapacidade e revisões, esclarecendo cada etapa.',
      avatarUrl:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=400&auto=format&fit=crop',
      linkedin: 'https://linkedin.com/in/eduardo-vieira',
      whatsapp: '5511990000003',
    },
    {
      id: 'l4',
      name: 'Rafael Costa',
      oabNumber: 'OAB/SP 205.331',
      area: 'Direito Trabalhista',
      bio: 'Atua em relações de trabalho, rescisões e demandas trabalhistas na esfera judicial e extrajudicial.',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
      linkedin: 'https://linkedin.com/in/rafael-costa',
      // Sem WhatsApp de propósito: o exemplo também mostra a volta ao institucional
      // quando o advogado escolhido não informou número.
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

/**
 * O escritório é a fixture de demonstração da home? A página precisa saber para se
 * rotular: sociedade, advogados e números de OAB são inventados, e um número de
 * inscrição fictício exibido sem aviso — ainda que só linkado ao CNA — seria
 * informação enganosa. Mesmo tratamento dos perfis-exemplo (ver pages/PublicProfile).
 */
export function isExampleFirm(slug: string): boolean {
  return slug === sampleFirm.slug
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
    monogram: '',
    tagline: '',
    about: '',
    city: '',
    state: '',
    contact: {},
    areas: [],
    lawyers: [],
    assistantRoute: 'institutional',
    assistantGreeting: '',
    extraAreas: [],
    meetingInboxEnabled: false,
  }
}

let lid = 0
/** id local para novos advogados no editor. */
export function nextLawyerId(): string {
  return `firm-l-${Date.now()}-${lid++}`
}
