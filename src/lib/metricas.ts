// As métricas do perfil, do lado de quem lê: o próprio advogado.
//
// O servidor é quem conta (backend/src/analytics); aqui é a ponte, mais os
// rótulos em português dos tipos de evento — que são chaves técnicas no banco
// ('rede:instagram') e precisam virar frase antes de aparecer numa tela.

import { apiFetch, TEM_BACKEND } from './http'
import { getSession } from './auth'

/** Espelha ResumoDeMetricas em backend/src/analytics/analytics.service.ts. */
export interface Metricas {
  janelaDias: number
  visitas: { total: number; janela: number }
  cliques: { evento: string; total: number }[]
  contatos: number
  taxaDeContato: number | null
  porDia: { dia: string; visitas: number; contatos: number }[]
  porHora: number[]
  detalhado: boolean
}

const VAZIO: Metricas = {
  janelaDias: 30,
  visitas: { total: 0, janela: 0 },
  cliques: [],
  contatos: 0,
  taxaDeContato: null,
  porDia: [],
  porHora: [],
  detalhado: false,
}

/**
 * O resumo do próprio perfil.
 *
 * Sem backend (modo local), devolve o resumo vazio em vez de estourar: no
 * navegador não existe visitante nenhum para contar, e a tela sabe dizer isso.
 */
export async function carregarMetricas(): Promise<Metricas> {
  if (!TEM_BACKEND || !getSession()) return VAZIO
  const res = await apiFetch('/api/analytics/me')
  if (!res.ok) throw new Error('Não foi possível carregar as visitas agora.')
  return (await res.json()) as Metricas
}

/** Como cada tipo de acontecimento se chama para quem lê a tela. */
export function rotuloDoEvento(evento: string): string {
  const fixos: Record<string, string> = {
    whatsapp: 'Conversar no WhatsApp',
    agendamento: 'Agendar uma consulta',
    assistente: 'Assistente de agendamento',
    email: 'E-mail',
    cartao: 'Salvou o contato',
  }
  if (fixos[evento]) return fixos[evento]
  if (evento.startsWith('rede:')) {
    const rede = evento.slice(5)
    const nomes: Record<string, string> = {
      instagram: 'Instagram',
      linkedin: 'LinkedIn',
      facebook: 'Facebook',
      youtube: 'YouTube',
      tiktok: 'TikTok',
      website: 'Site',
    }
    return nomes[rede] ?? rede
  }
  return evento
}

/**
 * A hora de maior movimento, em texto — ou null quando não há movimento que
 * sustente a afirmação.
 *
 * O piso de 5 visitas não é capricho: com duas visitas no mês, dizer "seu horário
 * de pico é 14h" é inventar um padrão a partir de ruído. O advogado leria isso
 * como informação e poderia decidir alguma coisa com ela.
 */
export function horarioDePico(porHora: number[]): string | null {
  const total = porHora.reduce((a, b) => a + b, 0)
  if (total < 5) return null
  let melhor = 0
  for (let h = 1; h < porHora.length; h++) if (porHora[h] > porHora[melhor]) melhor = h
  if (porHora[melhor] === 0) return null
  const fim = (melhor + 1) % 24
  return `${String(melhor).padStart(2, '0')}h–${String(fim).padStart(2, '0')}h`
}

/** "seg", "ter"… para o eixo do gráfico de dias. */
export function diaCurto(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, (m ?? 1) - 1, d ?? 1)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
