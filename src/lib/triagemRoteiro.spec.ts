import { describe, expect, it } from 'vitest'
import { roteiroDaConversa, type PerguntaDeTriagem } from './triagem'

// O ROTEIRO que o advogado vê no editor ("Como a conversa vai ficar").
//
// Ele não é a lista de perguntas: tem a abertura, o aviso de segurança e o que
// vem DEPOIS da triagem. Cada passo estrutural aqui precisa aparecer sob a mesma
// condição que o faz aparecer na conversa (AssistantChat) — se os dois
// divergirem, o editor promete um roteiro e o visitante percorre outro.

const MINHAS: PerguntaDeTriagem[] = [
  { id: 'q1', kind: 'escolha', label: 'Qual assunto?', options: ['Família'] },
  { id: 'q2', kind: 'texto-longo', label: 'Conte o que aconteceu.' },
]

const textos = (p: PerguntaDeTriagem[], ctx: { comHorarios: boolean; dosDoisJeitos: boolean }) =>
  roteiroDaConversa(p, ctx).map((x) => x.texto)

describe('o roteiro mostrado ao advogado', () => {
  it('abre pelo aviso de segurança e fecha pelo envio', () => {
    const passos = textos(MINHAS, { comHorarios: true, dosDoisJeitos: true })
    expect(passos[0]).toMatch(/documentos.*senhas/i)
    expect(passos[passos.length - 1]).toMatch(/WhatsApp/)
  })

  it('as perguntas do advogado vêm na ordem dele, e marcadas como dele', () => {
    const roteiro = roteiroDaConversa(MINHAS, { comHorarios: false, dosDoisJeitos: false })
    expect(roteiro.filter((p) => p.minha).map((p) => p.texto)).toEqual([
      'Qual assunto?',
      'Conte o que aconteceu.',
    ])
  })

  it('sem horário aberto, não promete escolher dia — e o fecho muda', () => {
    const comGrade = textos(MINHAS, { comHorarios: true, dosDoisJeitos: false })
    const semGrade = textos(MINHAS, { comHorarios: false, dosDoisJeitos: false })
    expect(comGrade.some((t) => /dia e o horário/i.test(t))).toBe(true)
    expect(semGrade.some((t) => /dia e o horário/i.test(t))).toBe(false)
    expect(comGrade[comGrade.length - 1]).toMatch(/horário só vale/i)
    expect(semGrade[semGrade.length - 1]).toMatch(/analisa e responde/i)
  })

  it('a pergunta de formato só entra quando o perfil atende dos dois jeitos', () => {
    expect(textos(MINHAS, { comHorarios: true, dosDoisJeitos: false })).not.toContain(
      'Presencial ou online',
    )
    expect(textos(MINHAS, { comHorarios: true, dosDoisJeitos: true })).toContain(
      'Presencial ou online',
    )
  })

  // As duas perguntas que o assistente para de fazer quando o advogado as coloca
  // na triagem. É o mesmo par de condições do roteiro de verdade.
  it('o assistente não repete o que a triagem já pergunta', () => {
    const comAmbas: PerguntaDeTriagem[] = [
      ...MINHAS,
      { id: 'q3', kind: 'atendimento', label: 'Prefere vir aqui?' },
      { id: 'q4', kind: 'contato', label: 'Seu primeiro nome?' },
    ]
    const passos = textos(comAmbas, { comHorarios: true, dosDoisJeitos: true })
    expect(passos).not.toContain('Presencial ou online')
    expect(passos).not.toContain('Como posso te chamar?')
    expect(passos).toContain('Prefere vir aqui?')
    expect(passos).toContain('Seu primeiro nome?')
  })

  it('pergunta que a conversa não consegue fazer some do roteiro', () => {
    const meia: PerguntaDeTriagem[] = [
      { id: 'a', kind: 'escolha', label: 'Sem opções ainda' },
      { id: 'b', kind: 'texto', label: '' },
      ...MINHAS,
    ]
    const passos = textos(meia, { comHorarios: false, dosDoisJeitos: false })
    expect(passos).not.toContain('Sem opções ainda')
    expect(passos).toContain('Qual assunto?')
  })

  it('sem pergunta nenhuma, sobra só o que o assistente já fazia', () => {
    const passos = textos([], { comHorarios: true, dosDoisJeitos: true })
    expect(passos.some((p) => /dia e o horário/i.test(p))).toBe(true)
    expect(passos).toContain('Como posso te chamar?')
    expect(roteiroDaConversa([], { comHorarios: true, dosDoisJeitos: true }).every((p) => !p.minha)).toBe(
      true,
    )
  })
})
