// Programa Advocme Parceiros — a tela.
//
//   • /r/:code vem antes do catch-all /:slug, captura e SEMPRE leva ao cadastro;
//   • a página de chegada não mostra ninguém;
//   • o painel do parceiro tem a cópia obrigatória (software, não cliente), o
//     retorno ao plano financeiro e o aviso do PRO; nunca dado de quem foi indicado;
//   • o atalho do painel só aparece para convidado, ativo e suspenso;
//   • no console, a seção depende de parceiros:ler e as decisões de parceiros:gerir.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { avisoDoBeneficioNoPlano, mostrarNoPainel, planoQueVocePaga, ROTULO_DA_SITUACAO, type PainelConvidado, type PainelParticipante } from './partners'
import { AvisoDeChegada, destinoDoCadastro, seguirParaCadastro } from '@/pages/ReferralPage'
import { PainelDoProgramaParceiros } from '@/components/parceiros/PainelDoProgramaParceiros'
import { CartaoDoProgramaParceiros } from '@/components/painel/ParceirosCard'
import { decisoesPossiveis, FichaDoParceiroView } from '@/components/admin/PartnersTab'
import { secoesDe } from '@/components/admin/Console'
import type { AdminMe, FichaDoParceiro } from './adminApi'

const AVISO =
  'O Programa Advocme Parceiros destina-se exclusivamente à indicação da plataforma Advocme a outros profissionais da advocacia. Não há recompensa por indicação de clientes, causas, consultas, contatos ou contratação de serviços advocatícios.'
const FIM = 'A cortesia não gera cobrança automática. Ao término, sua conta retorna ao plano financeiro que estiver vigente.'
const PRO = 'Seu plano PRO continua sendo cobrado normalmente. O programa amplia temporariamente seu acesso para o MAX.'
const PROIBIDO = /comiss[aã]o|ganhe dinheiro|\blead|venda de causas|ranking/i

const render = (el: JSX.Element) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>)
/** Só o texto que a pessoa lê — sem as classes do Tailwind ('leading-…' não é 'lead'). */
const texto = (html: string) => html.replace(/<[^>]+>/g, ' ')

const comum = {
  programa: 'Programa Advocme Parceiros',
  chamada: 'Indique o Advocme a outros profissionais e amplie seu acesso ao MAX.',
  aviso: AVISO,
  revisaoJuridicaPendente: true,
  planoFinanceiro: 'free' as const,
  benefitUntil: '2026-11-21T15:00:00.000Z',
  activeBenefit: true,
  avisos: { pro: null, fimSemCobranca: FIM },
}

const convidado: PainelConvidado = {
  ...comum,
  status: 'invited',
  benefitUntil: null,
  activeBenefit: false,
  regras: { versao: '2026-10-07', itens: ['O programa existe exclusivamente para a indicação do software Advocme.'] },
  beneficioInicialDias: 45,
  bloqueio: null,
  renovacao: null,
  proximaAcao: 'Leia as regras e aceite para ativar 45 dias de acesso ao MAX.',
}

const ativo: PainelParticipante = {
  ...comum,
  status: 'active',
  referralUrl: 'https://advoc.me/r/AbCdEfGhIjKlMnOpQrStUv',
  totais: { cadastrados: 3, conversoes: 1, pendentes: 1, revogadas: 0 },
  indicacoes: {
    itens: [
      { id: 'refe00000009', rotulo: 'Indicação •••A1B2C3', data: '2026-10-01T12:00:00.000Z', situacao: 'confirmada', dias: 30, validaEm: null },
      { id: 'refe00000008', rotulo: 'Indicação •••D4E5F6', data: '2026-10-02T12:00:00.000Z', situacao: 'validacao', dias: null, validaEm: '2026-10-09T12:00:00.000Z' },
      { id: 'refe00000007', rotulo: 'Indicação •••G7H8I9', data: '2026-10-03T12:00:00.000Z', situacao: 'cadastro', dias: null, validaEm: null },
    ],
    proximo: null,
    temMais: false,
  },
  beneficios: [{ tipo: 'initial', situacao: 'confirmed', dias: 45, data: '2026-10-07T12:00:00.000Z' }],
  proximaAcao: 'Compartilhe seu link com outros profissionais da advocacia.',
}

describe('rotas', () => {
  const app = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8')

  it('/r/:code vem antes do catch-all /:slug, e /parceiros exige conta', () => {
    const r = app.indexOf('path="/r/:code"')
    const slug = app.indexOf('path="/:slug"')
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThan(slug)
    expect(app).toMatch(/path="\/parceiros" element=\{<RequireAuth><PartnersPage \/><\/RequireAuth>\}/)
    expect(app).not.toMatch(/path="\/r\/:code" element=\{<RequireAuth/)
  })
})

describe('chegada pelo link', () => {
  it('leva ao cadastro, com o next só se for caminho interno', () => {
    expect(destinoDoCadastro(null)).toBe('/criar-conta')
    expect(destinoDoCadastro('/planos')).toBe('/criar-conta?next=%2Fplanos')
    expect(destinoDoCadastro('https://golpe.test')).toBe('/criar-conta')
    expect(destinoDoCadastro('//golpe.test')).toBe('/criar-conta')
  })

  it('código inválido, erro de rede ou servidor parado: segue para o cadastro do mesmo jeito', async () => {
    const ir = vi.fn()
    await seguirParaCadastro('qualquer', null, async () => false, ir)
    await seguirParaCadastro('qualquer', null, () => Promise.reject(new Error('rede')), ir)
    await seguirParaCadastro('qualquer', '/planos', () => new Promise<boolean>(() => {}), ir, 10)
    expect(ir.mock.calls.map((c) => c[0])).toEqual(['/criar-conta', '/criar-conta', '/criar-conta?next=%2Fplanos'])
  })

  it('a página de chegada fala do Advocme, e só', () => {
    const html = renderToStaticMarkup(<AvisoDeChegada />)
    expect(html).toContain('advoc.me')
    expect(html).toMatch(/cadastro/)
    expect(html).not.toMatch(/Dr\.|Dra\.|OAB|parceir/i)
  })
})

describe('painel do parceiro', () => {
  it('convidado: regras, aceite e a cópia obrigatória', () => {
    const html = render(<PainelDoProgramaParceiros dados={convidado} />)
    expect(html).toContain('Advocme Parceiros')
    expect(html).toContain('45 dias de acesso ao MAX')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('Aceitar e participar')
    expect(html).toContain(AVISO)
    expect(html).toContain(FIM)
    expect(html).toContain('Compartilhe o Advocme com outro profissional da advocacia.')
    expect(texto(html)).not.toMatch(PROIBIDO)
  })

  it('MAX dado pelo escritório: o bloqueio aparece no lugar do aceite', () => {
    const html = render(
      <PainelDoProgramaParceiros dados={{ ...convidado, bloqueio: 'Seu acesso ao MAX hoje vem do escritório, sem data de término.' }} />,
    )
    expect(html).toContain('vem do escritório')
    expect(html).not.toContain('Aceitar e participar')
  })

  it('assinatura com renovação: diz ANTES do clique que o aceite encerra a renovação', () => {
    const aviso = 'Você tem uma assinatura PRO com renovação. Ao aceitar, a renovação é encerrada: não haverá novas cobranças.'
    const html = render(<PainelDoProgramaParceiros dados={{ ...convidado, renovacao: aviso }} />)
    expect(html).toContain(aviso)
    expect(html).toContain('o encerramento da renovação da minha assinatura')
    expect(html).toContain('Aceitar e participar')
  })

  it('ativo: link, copiar, MAX até a data, contadores e situação de cada indicação — sem dado de ninguém', () => {
    const html = render(<PainelDoProgramaParceiros dados={ativo} />)
    expect(html).toContain('advoc.me/r/AbCdEfGhIjKlMnOpQrStUv')
    expect(html).toContain('Copiar')
    expect(html).toContain('MAX até 21/11/2026')
    for (const n of ['Cadastros', 'Confirmadas', 'Em validação', 'Revogadas']) expect(html).toContain(n)
    expect(html).toContain('Indicação •••A1B2C3')
    expect(html).toContain(ROTULO_DA_SITUACAO.confirmada)
    expect(html).toContain(ROTULO_DA_SITUACAO.validacao)
    expect(html).toContain(ROTULO_DA_SITUACAO.cadastro)
    expect(html).toContain('30 dias')
    expect(texto(html)).not.toMatch(/@|pay_|cus_|sub_/)
    expect(texto(html)).not.toMatch(PROIBIDO)
  })

  it('PRO: diz que a assinatura PRO continua sendo cobrada', () => {
    const html = render(<PainelDoProgramaParceiros dados={{ ...ativo, planoFinanceiro: 'pro', avisos: { pro: PRO, fimSemCobranca: FIM } }} />)
    expect(html).toContain(PRO)
  })

  it('suspenso: explica, e o botão de copiar fica desligado', () => {
    const html = render(
      <PainelDoProgramaParceiros
        dados={{ ...ativo, status: 'suspended', activeBenefit: false, proximaAcao: 'Sua participação está suspensa: o link não registra novas indicações.' }}
      />,
    )
    expect(html).toContain('Sua participação está suspensa')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?Copiar/s)
    expect(html).toContain('Sem acesso adicional ao MAX agora')
  })

  it('cópia: quando a área de transferência falha, a tela diz para copiar à mão', () => {
    const html = render(<PainelDoProgramaParceiros dados={ativo} copiado={false} />)
    expect(html).toContain('copie à mão')
  })
})

describe('atalho no painel', () => {
  it('só para convidado, ativo ou suspenso', () => {
    expect(mostrarNoPainel(null)).toBe(false)
    expect(mostrarNoPainel('ended')).toBe(false)
    expect(render(<CartaoDoProgramaParceiros resumo={{ status: null, benefitUntil: null, activeBenefit: false }} />)).toBe('')
    expect(render(<CartaoDoProgramaParceiros resumo={{ status: 'ended', benefitUntil: null, activeBenefit: false }} />)).toBe('')
    for (const status of ['invited', 'active', 'suspended'] as const) {
      const html = render(<CartaoDoProgramaParceiros resumo={{ status, benefitUntil: '2026-11-21T15:00:00.000Z', activeBenefit: status === 'active' }} />)
      expect(html, status).toContain('href="/parceiros"')
    }
    expect(render(<CartaoDoProgramaParceiros resumo={{ status: 'active', benefitUntil: '2026-11-21T15:00:00.000Z', activeBenefit: true }} />)).toContain(
      'MAX até 21/11/2026',
    )
  })
})

describe('console', () => {
  const me = (permissoes: string[]): AdminMe => ({
    csrfToken: '',
    id: 'a1',
    name: 'Fulano',
    role: 'readonly',
    permissoes,
    totpPendente: false,
    emergencia: false,
    producao: true,
  })

  it('a seção Parceiros aparece só com parceiros:ler', () => {
    expect(secoesDe(me(['painel:abrir'])).some((s) => s.id === 'parceiros')).toBe(false)
    expect(secoesDe(me(['painel:abrir', 'parceiros:ler'])).some((s) => s.id === 'parceiros')).toBe(true)
  })

  const ficha: FichaDoParceiro = {
    id: 'memb00000001',
    status: 'active',
    codigo: 'AbCdEfGhIjKlMnOpQrStUv',
    benefitUntil: '2026-11-21T15:00:00.000Z',
    beneficioAtivo: true,
    termsVersion: '2026-10-07',
    termsAcceptedAt: '2026-10-07T15:00:00.000Z',
    invitedAt: '2026-10-01T15:00:00.000Z',
    activatedAt: '2026-10-07T15:00:00.000Z',
    suspendedAt: null,
    endedAt: null,
    conta: null,
    indicacoes: { itens: [], proximo: null, temMais: false },
    recompensas: [],
    historico: [],
  }

  it('quem só lê não encontra botão de decisão', () => {
    const html = render(<FichaDoParceiroView ficha={ficha} podeGerir={false} executar={async () => {}} />)
    expect(html).not.toMatch(/Suspender|Encerrar|Ajustar dias|Motivo/)
  })

  it('quem gere decide com motivo e confirmação em dois passos', () => {
    const html = render(<FichaDoParceiroView ficha={ficha} podeGerir executar={async () => {}} />)
    expect(html).toContain('Motivo')
    expect(html).toContain('Suspender')
    // O primeiro clique só ESCOLHE a decisão; o "Confirmar…" vem depois.
    expect(html).not.toContain('Confirmar suspensão')
    expect(decisoesPossiveis('active')).toEqual(['suspender', 'ajustar', 'encerrar'])
    expect(decisoesPossiveis('suspended')).toEqual(['reativar', 'ajustar', 'encerrar'])
    expect(decisoesPossiveis('ended')).toEqual([])
  })
})

describe('seção de plano', () => {
  const ate = '2026-11-21T15:00:00.000Z'
  it('a vitrine mostra o plano PAGO: Free parceiro pode contratar, não "descer"', () => {
    expect(planoQueVocePaga({ plan: 'premium', subscription: { plan: 'free', rebaixado: false }, partnerBenefit: { active: true } })).toBe('free')
    expect(planoQueVocePaga({ plan: 'premium', subscription: { plan: 'pro', rebaixado: false }, partnerBenefit: { active: true } })).toBe('pro')
    expect(planoQueVocePaga({ plan: 'premium', subscription: { plan: 'premium', rebaixado: false } })).toBe('premium')
    expect(planoQueVocePaga({ plan: 'free', subscription: { plan: 'pro', rebaixado: true }, partnerBenefit: { active: false } })).toBe('free')
  })

  it('explica o acesso adicional: PRO continua cobrado; Free volta ao que paga, sem cobrança automática', () => {
    const pro = avisoDoBeneficioNoPlano({ plan: 'premium', subscription: { plan: 'pro', rebaixado: false }, partnerBenefit: { active: true, benefitUntil: ate } })
    expect(pro).toMatch(/PRO continua sendo cobrado/)
    // PRO cuja renovação foi encerrada no aceite: não diz que continua cobrado.
    const encerrado = avisoDoBeneficioNoPlano({ plan: 'premium', subscription: { plan: 'pro', rebaixado: false, status: 'canceled' }, partnerBenefit: { active: true, benefitUntil: ate } })
    expect(encerrado).not.toMatch(/continua sendo cobrado/)
    expect(encerrado).toMatch(/não gera cobrança automática/)
    expect(pro).toContain('21/11/2026')
    const free = avisoDoBeneficioNoPlano({ plan: 'premium', subscription: { plan: 'free', rebaixado: false }, partnerBenefit: { active: true, benefitUntil: ate } })
    expect(free).toMatch(/não gera cobrança automática/)
    expect(avisoDoBeneficioNoPlano({ plan: 'free' })).toBeNull()
  })
})
