// Programa Advocme Parceiros — a ponte com o servidor e os textos da tela.
//
// O servidor é quem decide tudo (backend/src/partners): quem participa, o prazo
// do benefício, o que cada indicação virou. Aqui só se busca e se desenha. Nada do
// programa vai ao perfil público: o link existe apenas no painel do parceiro.
//
// ⚠️ Os textos do programa aguardam revisão jurídica (ver partner-terms.ts no
// backend). Mudou um texto que o advogado ACEITA? Ele mora lá, versionado.

import { aguardarSessao, isAuthenticated } from './auth'
import { apiFetch, TEM_BACKEND } from './http'

export type StatusDoParceiro = 'invited' | 'active' | 'suspended' | 'ended'
export type SituacaoDaIndicacao = 'cadastro' | 'validacao' | 'confirmada' | 'revogada' | 'nao-elegivel'

export const NOME_DO_PROGRAMA = 'Programa Advocme Parceiros'
export const CHAMADA_DO_PROGRAMA = 'Indique o Advocme a outros profissionais e amplie seu acesso ao MAX.'

/** Como o parceiro lê a situação de cada indicação. Nunca há nome de ninguém aqui. */
export const ROTULO_DA_SITUACAO: Record<SituacaoDaIndicacao, string> = {
  cadastro: 'Cadastro realizado',
  validacao: 'Pagamento em validação',
  confirmada: 'Confirmada',
  revogada: 'Revogada',
  'nao-elegivel': 'Não elegível',
}

export interface ResumoDoParceiro {
  status: StatusDoParceiro | null
  benefitUntil: string | null
  activeBenefit: boolean
}

interface Comum {
  programa: string
  chamada: string
  aviso: string
  revisaoJuridicaPendente: boolean
  status: StatusDoParceiro
  planoFinanceiro: 'free' | 'pro' | 'premium'
  benefitUntil: string | null
  activeBenefit: boolean
  avisos: { pro: string | null; fimSemCobranca: string }
  proximaAcao: string
}

export interface PainelConvidado extends Comum {
  status: 'invited'
  regras: { versao: string; itens: string[] }
  beneficioInicialDias: number
  /** MAX dado pelo escritório (sem término): a cortesia não ativa. */
  bloqueio: string | null
  /** Assinatura paga com renovação: o aceite a ENCERRA — a frase vem do servidor e aparece antes do clique. */
  renovacao: string | null
}

export interface Indicacao {
  id: string
  rotulo: string
  data: string | null
  situacao: SituacaoDaIndicacao
  dias: number | null
  validaEm: string | null
}

export interface PainelParticipante extends Comum {
  status: 'active' | 'suspended' | 'ended'
  referralUrl: string | null
  totais: { cadastrados: number; conversoes: number; pendentes: number; revogadas: number }
  indicacoes: { itens: Indicacao[]; proximo: string | null; temMais: boolean }
  beneficios: { tipo: 'initial' | 'manual'; situacao: string; dias: number; data: string | null }[]
}

export type PainelDoParceiro = PainelConvidado | PainelParticipante

/** Só estes estados ganham o atalho no painel. Encerrado fica fora (definitivo). */
export function mostrarNoPainel(status: StatusDoParceiro | null | undefined): boolean {
  return status === 'invited' || status === 'active' || status === 'suspended'
}

/** "21/11/2026", no fuso de Brasília. */
export function dataDoBeneficio(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

/** O link sem o protocolo, como aparece escrito na tela: advoc.me/r/XXXX. */
export function linkLegivel(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

/** A mensagem que o Nest devolve vem embrulhada em JSON. */
async function mensagemDe(res: Response, padrao: string): Promise<string> {
  try {
    const corpo = (await res.json()) as { message?: string | string[] }
    const m = Array.isArray(corpo.message) ? corpo.message[0] : corpo.message
    return m || padrao
  } catch {
    return padrao
  }
}

export class NaoParticipa extends Error {}

/**
 * Captura o link /r/:code. Nunca lança: aceito ou não, a pessoa segue para o
 * cadastro — o programa não pode atrapalhar quem está chegando.
 */
export async function capturarIndicacao(code: string): Promise<boolean> {
  if (!TEM_BACKEND) return false
  try {
    const res = await apiFetch('/api/partners/attribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (!res.ok) return false
    const r = (await res.json()) as { accepted?: unknown }
    return r.accepted === true
  } catch {
    return false
  }
}

/** O resumo leve do painel. Sem conta (ou sem backend): ninguém participa. */
export async function resumoDoParceiro(): Promise<ResumoDoParceiro> {
  const vazio: ResumoDoParceiro = { status: null, benefitUntil: null, activeBenefit: false }
  if (!TEM_BACKEND) return vazio
  await aguardarSessao()
  if (!isAuthenticated()) return vazio
  try {
    const res = await apiFetch('/api/partners/me/resumo')
    if (!res.ok) return vazio
    return (await res.json()) as ResumoDoParceiro
  } catch {
    return vazio
  }
}

export async function painelDoParceiro(cursor?: string): Promise<PainelDoParceiro> {
  if (!TEM_BACKEND) throw new NaoParticipa('O programa só funciona com o servidor ligado.')
  const res = await apiFetch(`/api/partners/me${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
  if (res.status === 404) throw new NaoParticipa(await mensagemDe(res, 'Você não participa do programa.'))
  if (!res.ok) throw new Error(await mensagemDe(res, 'Não foi possível carregar o programa agora.'))
  return (await res.json()) as PainelDoParceiro
}

export async function aceitarProgramaParceiros(termsVersion: string): Promise<PainelDoParceiro> {
  const res = await apiFetch('/api/partners/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accepted: true, termsVersion }),
  })
  if (!res.ok) throw new Error(await mensagemDe(res, 'Não foi possível registrar o aceite agora.'))
  return (await res.json()) as PainelDoParceiro
}

/**
 * O plano que a pessoa PAGA — o que a vitrine de planos precisa mostrar como
 * "atual". Com o Max do programa, `profile.plan` diz Max; mas um Free parceiro
 * que quer contratar o Pro não pode ver "descer para o Pro".
 */
export function planoQueVocePaga(p: {
  plan: 'free' | 'pro' | 'premium'
  subscription?: { plan: 'free' | 'pro' | 'premium'; rebaixado: boolean; status?: string }
  partnerBenefit?: { active: boolean }
}): 'free' | 'pro' | 'premium' {
  if (!p.partnerBenefit?.active) return p.plan
  const s = p.subscription
  if (!s) return 'free'
  return s.rebaixado ? 'free' : s.plan
}

/** A frase da seção de plano para quem tem o acesso adicional ao Max. */
export function avisoDoBeneficioNoPlano(p: {
  partnerBenefit?: { active: boolean; benefitUntil: string | null }
  subscription?: { plan: 'free' | 'pro' | 'premium'; rebaixado: boolean; status?: string }
  plan: 'free' | 'pro' | 'premium'
}): string | null {
  if (!p.partnerBenefit?.active) return null
  const ate = dataDoBeneficio(p.partnerBenefit.benefitUntil)
  const pago = planoQueVocePaga(p)
  const base = `Seu acesso ao MAX vem do ${NOME_DO_PROGRAMA}${ate ? ` até ${ate}` : ''}. `
  // PRO que ainda renova (assinou de novo depois do aceite) segue cobrado; o que
  // foi encerrado no aceite vale só até o fim do período já pago.
  return pago === 'pro' && p.subscription?.status !== 'canceled'
    ? base + 'Seu plano PRO continua sendo cobrado normalmente.'
    : base + 'A cortesia não gera cobrança automática: ao término, sua conta volta ao plano que você paga hoje.'
}
