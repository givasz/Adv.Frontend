// O aviso que aparece ANTES de descer de plano.
//
// Duas coisas não podem falhar aqui:
//
//  1. A lista fala do PERFIL REAL. Avisar que "o vídeo sai" a quem nunca gravou um
//     vídeo é ruído, e ruído faz a lista inteira deixar de ser lida — inclusive as
//     linhas que importavam.
//  2. A lista promete o DESTINO certo do conteúdo. "Fica guardado" e "é apagado"
//     são promessas diferentes; hoje, nesta plataforma, a resposta é sempre a
//     primeira, e a tela não pode dizer outra coisa.

import { describe, expect, it } from 'vitest'
import type { Profile } from './types'
import { mudancasAoDescer } from './rebaixamento'

function perfil(p: Partial<Profile> = {}): Profile {
  return {
    slug: 'marina-sales',
    name: 'Marina Sales',
    oabNumber: 'OAB/SP 123.456',
    headline: '',
    bio: '',
    city: 'São Paulo',
    state: 'SP',
    serviceMode: { inPerson: true, online: true },
    areas: [],
    socials: [],
    contact: {},
    plan: 'premium',
    theme: 'papel',
    ...p,
  } as Profile
}

const juntos = (l: string[]) => l.join(' | ')

describe('o endereço público', () => {
  // Foi a primeira GARANTIA da lista enquanto o endereço não mudava nunca. Virou
  // a primeira PERDA quando o endereço limpo passou a ser um recurso pago que
  // volta ao padrão do Free — e é a única perda do rebaixamento que quebra algo
  // fora da plataforma: o QR impresso, o link na assinatura de e-mail, o Google.
  //
  // O que a tela não pode fazer é calar sobre isso, nem anunciar como imediato o
  // que tem uma semana de prazo. As duas metades da frase importam.

  it('ao voltar ao Free é a PRIMEIRA perda da lista, com o prazo junto', () => {
    const { perde, mantem } = mudancasAoDescer(perfil(), 'free')
    expect(perde[0]).toContain('marina-sales')
    expect(perde[0]).toMatch(/número no fim/i)
    expect(perde[0]).toMatch(/7 dias/)
    expect(perde[0]).toMatch(/avisada no painel/i)
    // E não pode aparecer, na mesma tela, prometendo que continua o mesmo.
    expect(juntos(mantem)).not.toMatch(/endereço.*continua o mesmo/i)
  })

  it('quem já está numerado não perde endereço nenhum — a garantia volta', () => {
    const { perde, mantem } = mudancasAoDescer(perfil({ slug: 'marina-sales-4827' }), 'free')
    expect(juntos(perde)).not.toMatch(/número no fim/i)
    expect(mantem[0]).toContain('marina-sales-4827')
    expect(mantem[0]).toMatch(/continua o mesmo/i)
  })

  it('descer de Max para Pro não mexe no endereço: o Pro também tem nome limpo', () => {
    const { perde, mantem } = mudancasAoDescer(perfil({ plan: 'premium' }), 'pro')
    expect(juntos(perde)).not.toMatch(/endereço/i)
    expect(mantem[0]).toContain('marina-sales')
  })
})

describe('a lista fala do perfil real', () => {
  it('quem não tem vídeo não lê sobre vídeo', () => {
    const { perde } = mudancasAoDescer(perfil({ plan: 'premium' }), 'free')
    expect(juntos(perde)).not.toMatch(/vídeo/i)
  })

  it('quem tem vídeo lê que ele fica GUARDADO', () => {
    const { perde } = mudancasAoDescer(
      perfil({ plan: 'premium', videoUrl: 'https://youtu.be/abc' }),
      'free',
    )
    expect(juntos(perde)).toMatch(/vídeo de apresentação sai do perfil.*guardado/i)
  })

  it('conta quantas áreas continuam aparecendo, não quantas somem', () => {
    const areas = Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, label: `Área ${i}`, description: '' }))
    const { perde } = mudancasAoDescer(perfil({ plan: 'premium', areas }), 'free')
    // O Free entrega UMA área desde 04/09/2026 — e a frase precisa concordar:
    // "1 continuam aparecendo" faria a tela inteira parecer descuidada.
    expect(juntos(perde)).toMatch(/suas 6 áreas.*a principal continua aparecendo.*guardadas/i)
  })

  it('no Free sobra UMA pergunta — as outras ficam guardadas', () => {
    // Antes o Free tinha zero e a frase era "saem do perfil". Agora sobra uma, e
    // dizer o que RESTA é mais útil do que dizer o que sai.
    const faqs = [
      { id: 'f1', question: 'Quanto custa?', answer: 'Depende.' },
      { id: 'f2', question: 'Demora?', answer: 'Depende.' },
    ]
    const { perde } = mudancasAoDescer(perfil({ plan: 'pro', faqs }), 'free')
    expect(juntos(perde)).toMatch(/das suas 2 perguntas.*uma continua aparecendo.*guardadas/i)
  })

  it('do Max para o Pro, diz quantas perguntas sobrevivem', () => {
    const faqs = Array.from({ length: 5 }, (_, i) => ({ id: `f${i}`, question: `q${i}?`, answer: 'a' }))
    const { perde } = mudancasAoDescer(perfil({ plan: 'premium', faqs }), 'pro')
    expect(juntos(perde)).toMatch(/das suas 5 perguntas.*2 continuam aparecendo/i)
  })

  it('o assistente virtual é nomeado pelo que é, não como "agendamento"', () => {
    const { perde } = mudancasAoDescer(
      perfil({ plan: 'pro', schedulingMode: 'assistant' }),
      'free',
    )
    expect(juntos(perde)).toMatch(/assistente virtual sai do perfil/i)
  })

  it('quem já tinha o agendamento desligado não lê sobre agendamento', () => {
    const { perde } = mudancasAoDescer(perfil({ plan: 'pro', schedulingMode: 'off' }), 'free')
    expect(juntos(perde)).not.toMatch(/agendar|assistente/i)
  })

  it('tema pago volta ao neutro, e a tela diz qual tema era', () => {
    const { perde } = mudancasAoDescer(perfil({ plan: 'premium', theme: 'obsidian' }), 'free')
    expect(juntos(perde)).toMatch(/tema .+ volta ao tema neutro/i)
  })

  it('tema que o plano de destino já libera não entra na lista', () => {
    const { perde } = mudancasAoDescer(perfil({ plan: 'premium', theme: 'papel' }), 'free')
    expect(juntos(perde)).not.toMatch(/tema/i)
  })
})

describe('texto longo não é apresentado como perda', () => {
  it('a bio continua no ar; o que muda é o teto para AUMENTÁ-LA', () => {
    // Dizer "sua bio será cortada" assustaria à toa: ela não é cortada em lugar
    // nenhum — só não pode crescer mais.
    const { perde, mantem } = mudancasAoDescer(perfil({ plan: 'premium', bio: 'x'.repeat(900) }), 'free')
    expect(juntos(perde)).not.toMatch(/bio/i)
    expect(juntos(mantem)).toMatch(/bio de 900 caracteres continua no ar/i)
  })
})

describe('a promessa de fundo', () => {
  it('toda lista termina dizendo que nada é apagado', () => {
    const { mantem } = mudancasAoDescer(perfil({ plan: 'premium' }), 'pro')
    expect(juntos(mantem)).toMatch(/nada é apagado|nada é apagado:/i)
  })

  it('e que a página segue publicada', () => {
    const { mantem } = mudancasAoDescer(perfil(), 'free')
    expect(juntos(mantem)).toMatch(/segue publicada/i)
  })
})
