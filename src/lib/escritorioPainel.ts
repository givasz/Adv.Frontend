// O PAINEL DO ESCRITÓRIO em lógica pura — o que falta na página, o resumo de
// cada parte do editor e como cada advogado atende. Mora aqui (e não na página)
// para ter teste: "o que falta" é o tipo de lista que apodrece em silêncio
// quando um campo novo entra no editor e ninguém lembra do painel.
//
// Só lê o que /firms/me já devolve a quem administra; nada aqui vai ao servidor.

import { firmAlcancaAdvogado, firmRecebeSemPreferencia } from './assistant'
import type { Firm, FirmLawyer, FirmMember } from './escritorio'

/** As âncoras dos cartões do editor do escritório (FirmEditor usa as mesmas). */
export const ANCORA_DO_ESCRITORIO = {
  sociedade: 'sociedade',
  sede: 'sede',
  apresentacao: 'apresentacao',
  marca: 'marca',
  contato: 'contato',
  assistente: 'assistente',
  advogados: 'advogados',
} as const
export type AncoraDoEscritorio = keyof typeof ANCORA_DO_ESCRITORIO

/** Endereço do editor já rolado até o cartão. */
export function editorDoEscritorio(ancora?: AncoraDoEscritorio): string {
  return ancora ? `/escritorio/editar#${ANCORA_DO_ESCRITORIO[ancora]}` : '/escritorio/editar'
}

// ---------------------------------------------------------------------------
// O que falta na página
// ---------------------------------------------------------------------------

export interface FaltaDoEscritorio {
  key: string
  /** o que fazer, no imperativo curto */
  acao: string
  /** o que muda para quem visita a página */
  porque: string
  ancora: AncoraDoEscritorio
}

const temTexto = (v?: string) => !!v && v.trim().length > 0

/**
 * A conversa da página tem para onde terminar quando o visitante NÃO escolhe
 * advogado? É a caixa da sociedade ou um WhatsApp institucional que o wa.me
 * aceite — a mesma regra que a conversa usa (lib/assistant.ts), para o painel
 * nunca dizer "tudo certo" enquanto a página termina sem saída. Mesmo
 * delegando aos advogados, quem chega sem preferência cai aqui.
 */
export function conversaSemDestino(firm: Firm): boolean {
  return !firmRecebeSemPreferencia(firm)
}

/** Os assuntos que a conversa oferece: área principal de cada advogado + os escritos à mão. */
export function assuntosDaConversa(firm: Firm): string[] {
  const vistos = new Set<string>()
  const todos = [...(firm.lawyers ?? []).map((l) => l.area ?? ''), ...(firm.extraAreas ?? [])]
  return todos
    .map((a) => a.trim())
    .filter((a) => {
      const chave = a.toLowerCase()
      if (!a || vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Tudo que ainda falta, do mais grave para o mais cosmético. */
export function faltasDoEscritorio(firm: Firm): { faltas: FaltaDoEscritorio[]; pct: number; total: number } {
  const itens: (FaltaDoEscritorio & { feito: boolean })[] = [
    {
      key: 'destino',
      acao: 'Dizer para onde vão os pedidos',
      porque: 'Sem WhatsApp institucional nem caixa ligada, a conversa da página termina sem saída.',
      ancora: 'assistente',
      feito: !conversaSemDestino(firm),
    },
    {
      key: 'advogados',
      acao: 'Adicionar os advogados',
      porque: 'A página mostra cada integrante, em ordem alfabética.',
      ancora: 'advogados',
      feito: (firm.lawyers?.length ?? 0) > 0 || (firm.members?.length ?? 0) > 0,
    },
    {
      key: 'registro',
      acao: 'Informar o registro da sociedade na OAB',
      porque: 'Quem visita confere que a sociedade existe.',
      ancora: 'sociedade',
      feito: temTexto(firm.oabRegistry),
    },
    {
      key: 'contato',
      acao: 'Informar um contato institucional',
      porque: 'Telefone, e-mail ou WhatsApp do escritório, além dos de cada advogado.',
      ancora: 'contato',
      feito: temTexto(firm.contact?.whatsapp) || temTexto(firm.contact?.phone) || temTexto(firm.contact?.email),
    },
    {
      key: 'about',
      acao: 'Contar sobre o escritório',
      porque: 'O texto institucional é o que apresenta a sociedade.',
      ancora: 'apresentacao',
      feito: temTexto(firm.about),
    },
    {
      key: 'tagline',
      acao: 'Escrever a frase institucional',
      porque: 'Aparece logo abaixo do nome, no alto da página.',
      ancora: 'apresentacao',
      feito: temTexto(firm.tagline),
    },
    {
      key: 'sede',
      acao: 'Informar o endereço da sede',
      porque: 'Com o endereço, a página abre o mapa até a porta.',
      ancora: 'sede',
      feito: temTexto(firm.address?.rua),
    },
    {
      key: 'assuntos',
      acao: 'Definir os assuntos da conversa',
      porque: 'O assistente pergunta o assunto a quem chega; sem nenhum, a pergunta some.',
      ancora: 'assistente',
      feito: assuntosDaConversa(firm).length > 0,
    },
    {
      key: 'logo',
      acao: 'Enviar o logo',
      porque: 'Sem logo, a página mostra as iniciais da sociedade.',
      ancora: 'sociedade',
      feito: temTexto(firm.logoUrl),
    },
  ]
  const feitos = itens.filter((i) => i.feito).length
  return {
    faltas: itens.filter((i) => !i.feito).map(({ feito: _f, ...i }) => i),
    pct: Math.round((feitos / itens.length) * 100),
    total: itens.length,
  }
}

// ---------------------------------------------------------------------------
// Resumo de cada parte do editor
// ---------------------------------------------------------------------------

export interface ParteDoEscritorio {
  ancora: AncoraDoEscritorio
  titulo: string
  texto: string
  /** falta algo que depende só de quem administra */
  pendente: boolean
}

export function partesDoEscritorio(firm: Firm): ParteDoEscritorio[] {
  const c = firm.contact ?? {}
  const canais = [
    temTexto(c.whatsapp) && 'WhatsApp',
    temTexto(c.phone) && 'telefone',
    temTexto(c.email) && 'e-mail',
    temTexto(c.instagram) && 'Instagram',
    temTexto(c.linkedin) && 'LinkedIn',
  ].filter(Boolean) as string[]
  const assuntos = assuntosDaConversa(firm)
  const local = [firm.city, firm.state].filter(Boolean).join('/')
  const a = firm.address
  const oculto = a?.publico === false

  return [
    {
      ancora: 'sociedade',
      titulo: 'A sociedade',
      texto:
        [
          temTexto(firm.oabRegistry) ? firm.oabRegistry : 'Sem registro na OAB',
          temTexto(firm.logoUrl) ? 'com logo' : 'sem logo',
          local,
        ]
          .filter(Boolean)
          .join(' · '),
      pendente: !temTexto(firm.oabRegistry) || !temTexto(firm.logoUrl),
    },
    {
      ancora: 'sede',
      titulo: 'Endereço da sede',
      texto: temTexto(a?.rua)
        ? `${a!.rua}${a!.numero ? `, ${a!.numero}` : ''}${oculto ? ' · oculto na página' : ''}`
        : 'Sem endereço.',
      pendente: !temTexto(a?.rua),
    },
    {
      ancora: 'apresentacao',
      titulo: 'Apresentação',
      texto: temTexto(firm.tagline)
        ? firm.tagline
        : temTexto(firm.about)
          ? 'Sem frase institucional.'
          : 'Sem frase e sem texto institucional.',
      pendente: !temTexto(firm.tagline) || !temTexto(firm.about),
    },
    {
      ancora: 'contato',
      titulo: 'Contato institucional',
      texto: canais.length ? capitalizar(canais.join(', ')) : 'Nenhum canal do escritório.',
      pendente: !(temTexto(c.whatsapp) || temTexto(c.phone) || temTexto(c.email)),
    },
    {
      ancora: 'assistente',
      titulo: 'Assistente virtual',
      texto: `${firm.assistantRoute === 'lawyer' ? 'Para o advogado escolhido' : 'Para o escritório'} · ${
        firm.meetingInboxEnabled ? 'pedidos na caixa' : 'pedidos pelo WhatsApp'
      } · ${assuntos.length} ${assuntos.length === 1 ? 'assunto' : 'assuntos'}`,
      pendente: conversaSemDestino(firm) || assuntos.length === 0,
    },
    {
      ancora: 'marca',
      titulo: 'Marca própria',
      texto: [
        temTexto(firm.brandAccent) ? 'Cor própria na página' : 'Cor padrão',
        temTexto(firm.customDomain) ? `domínio ${firm.customDomain} (em preparo)` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      pendente: false,
    },
  ]
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------
// Como cada advogado atende
// ---------------------------------------------------------------------------

export interface AtendimentoDoAdvogado {
  /** o perfil é de alguém com conta (e a linha vira link) */
  comConta: boolean
  /** os horários DELE são oferecidos na conversa da página */
  agenda: boolean
  /** as perguntas de triagem DELE valem pela página */
  triagem: boolean
  /** recebe pedidos na caixa do painel, não no WhatsApp */
  caixa: boolean
  /** tem WhatsApp para onde o escritório pode encaminhar */
  whatsapp: boolean
  /**
   * Um pedido feito escolhendo ESTE advogado chega a alguém. Falso só quando
   * nem o escritório recebe nem ele tem caixa ou WhatsApp — a pessoa escolheria
   * o nome dele e a conversa terminaria sem saída.
   */
  alcancavel: boolean
}

/**
 * Cruza a linha da gestão (FirmMember) com o card público (FirmLawyer) pelo
 * endereço do perfil. Quem não tem perfil (listado, convite pendente) não tem
 * atendimento próprio: a conversa pergunta dia e período, como sempre.
 */
export function atendimentoDe(member: FirmMember, firm: Firm): AtendimentoDoAdvogado {
  const lawyers: FirmLawyer[] = firm.lawyers ?? []
  const l = member.profileSlug ? lawyers.find((x) => x.slug === member.profileSlug) : undefined
  return {
    comConta: member.kind === 'membership' && member.status === 'active',
    agenda: !!l?.agenda,
    triagem: !!l?.triagem,
    caixa: !!l?.meetingInbox,
    whatsapp: temTexto(l?.whatsapp),
    alcancavel: firmAlcancaAdvogado(firm, { whatsapp: l?.whatsapp, meetingInbox: l?.meetingInbox }),
  }
}

/** Como a gestão chama cada estado — o mesmo vocabulário do editor. */
export function rotuloDoEstado(m: FirmMember): string {
  if (m.status === 'active') return m.role === 'owner' ? 'Dono' : m.role === 'admin' ? 'Administra' : 'Ativo'
  if (m.status === 'invited') return 'Convite enviado'
  return 'Sem conta'
}
