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
  it('a PRIMEIRA garantia é que o endereço não muda', () => {
    // É o que está impresso no cartão de visita, colado no QR e indexado no
    // Google. Se a tela não disser isso, a pessoa presume o contrário.
    const { mantem } = mudancasAoDescer(perfil(), 'free')
    expect(mantem[0]).toContain('advoc.me/marina-sales')
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
    expect(juntos(perde)).toMatch(/suas 6 áreas.*2 continuam aparecendo.*guardadas/i)
  })

  it('no Free, as perguntas frequentes saem inteiras — e o texto fica guardado', () => {
    const faqs = [
      { id: 'f1', question: 'Quanto custa?', answer: 'Depende.' },
      { id: 'f2', question: 'Demora?', answer: 'Depende.' },
    ]
    const { perde } = mudancasAoDescer(perfil({ plan: 'pro', faqs }), 'free')
    expect(juntos(perde)).toMatch(/2 perguntas frequentes saem do perfil.*guardado/i)
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
