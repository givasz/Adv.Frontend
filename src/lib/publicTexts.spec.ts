// Trava da COBERTURA da conformidade: garante que todo texto que o visitante lê
// passa pelo motor de regras. O buraco que originou esta suíte foi a frase de
// apresentação (`headline`), que ficou de fora da checagem em todos os lugares —
// dava para publicar "O melhor criminalista de SP" logo abaixo do nome.

import { describe, expect, it } from 'vitest'
import { blockingFields, publicIssues, publicStatus, publicTexts } from './oab'

/** Perfil sóbrio e completo — nenhum campo deve gerar apontamento. */
const limpo = {
  headline: 'Advogada · Direito de Família e Sucessões',
  bio: 'Atuo em direito de família há doze anos, orientando cada pessoa sobre direitos e caminhos possíveis.',
  regionNote: 'Atendimento em toda a Grande São Paulo',
  videoCaption: 'Uma apresentação de dois minutos sobre a minha atuação',
  areas: [{ label: 'Direito de Família', description: 'Divórcio, guarda e pensão alimentícia.' }],
  faqs: [{ question: 'Como funciona a guarda compartilhada?', answer: 'As decisões são tomadas pelos dois pais.' }],
  branding: { brandName: 'Sales Advocacia' },
  assistant: { greeting: 'Olá! Posso ajudar a marcar um horário.' },
}

describe('publicTexts — inventário do que o visitante lê', () => {
  it('cobre TODOS os campos públicos do perfil', () => {
    const labels = publicTexts(limpo).map((t) => t.label)
    expect(labels).toEqual(
      expect.arrayContaining([
        'Frase de apresentação',
        'Apresentação',
        'Observação de atendimento',
        'Nome da área de atuação',
        'Descrição da área de atuação',
        'Pergunta frequente',
        'Resposta da pergunta frequente',
        'Legenda do vídeo',
        'Abertura do assistente',
        'Nome no rodapé do perfil',
      ]),
    )
  })

  it('descarta vazios e ausentes sem quebrar', () => {
    expect(publicTexts({})).toEqual([])
    expect(publicTexts({ headline: '   ', bio: '', areas: [], faqs: null })).toEqual([])
  })

  it('um perfil sóbrio não gera apontamento nenhum', () => {
    expect(publicIssues(limpo)).toEqual([])
    expect(publicStatus(limpo)).toBe('ok')
    expect(blockingFields(limpo)).toEqual([])
  })
})

// Um caso por campo: se algum deixar de ser conferido, o teste correspondente cai.
describe('publicStatus — cada campo público bloqueia por conta própria', () => {
  const VEDADO = 'Sucesso garantido no seu processo'
  const CASOS: [string, object][] = [
    ['Frase de apresentação', { headline: VEDADO }],
    ['Apresentação', { bio: VEDADO }],
    ['Observação de atendimento', { regionNote: VEDADO }],
    ['Nome da área de atuação', { areas: [{ label: VEDADO }] }],
    ['Descrição da área de atuação', { areas: [{ label: 'Cível', description: VEDADO }] }],
    ['Pergunta frequente', { faqs: [{ question: VEDADO }] }],
    ['Resposta da pergunta frequente', { faqs: [{ question: 'E aí?', answer: VEDADO }] }],
    ['Legenda do vídeo', { videoCaption: VEDADO }],
    ['Abertura do assistente', { assistant: { greeting: VEDADO } }],
    ['Nome no rodapé do perfil', { branding: { brandName: VEDADO } }],
  ]

  it.each(CASOS)('%s bloqueia a publicação', (label, perfil) => {
    expect(publicStatus(perfil)).toBe('block')
    expect(blockingFields(perfil)).toContain(label)
  })
})

describe('blockingFields — o erro diz ONDE está o problema', () => {
  it('lista cada campo travado, sem repetir', () => {
    const campos = blockingFields({
      headline: 'O melhor advogado da cidade',
      bio: 'Resultado 100% garantido',
      areas: [
        { label: 'Cível', description: 'Consulta grátis' },
        { label: 'Penal', description: 'Consulta grátis' },
      ],
    })
    expect(campos).toEqual([
      'Frase de apresentação',
      'Apresentação',
      'Descrição da área de atuação',
    ])
  })
})
