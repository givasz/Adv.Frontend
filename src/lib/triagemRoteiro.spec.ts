import { describe, expect, it } from 'vitest'
import { destinosPossiveis, roteiroDaConversa, type PerguntaDeTriagem } from './triagem'

// O ROTEIRO que o advogado vê no editor ("Como a conversa vai ficar").
//
// Ele não é a lista de perguntas: tem a abertura, o aviso de segurança e o que
// vem DEPOIS da triagem. Cada passo estrutural aqui precisa aparecer sob a mesma
// condição que o faz aparecer na conversa (AssistantChat) — se os dois
// divergirem, o editor promete um roteiro e o visitante percorre outro.

const MINHAS: PerguntaDeTriagem[] = [
  { id: 'q1', kind: 'escolha', label: 'Qual assunto?', options: [{ id: 'o1', texto: 'Família' }] },
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

// ---- Os CAMINHOS no roteiro -------------------------------------------------
//
// É a parte que responde "mostre o fluxo exato": com ramificação, uma fila
// numerada mente. Cada pergunta passa a trazer, ao lado, para onde cada resposta
// leva — e só quando ALGUMA delas desvia, senão vira ruído.

describe('o roteiro mostra para onde cada resposta leva', () => {
  const COM_DESVIO: PerguntaDeTriagem[] = [
    {
      id: 'q1',
      kind: 'escolha',
      label: 'Qual assunto?',
      options: [
        { id: 'o1', texto: 'Família', proxima: 'q3' },
        { id: 'o2', texto: 'Trabalhista' },
      ],
    },
    { id: 'q2', kind: 'texto', label: 'Só para quem é trabalhista' },
    { id: 'q3', kind: 'texto-longo', label: 'Conte o que aconteceu.' },
  ]

  it('numa triagem em FILA, nenhum ramo é desenhado', () => {
    const roteiro = roteiroDaConversa(MINHAS, { comHorarios: false, dosDoisJeitos: false })
    expect(roteiro.every((p) => !p.ramos)).toBe(true)
  })

  it('com desvio, a pergunta traz cada resposta e o destino dela', () => {
    const roteiro = roteiroDaConversa(COM_DESVIO, { comHorarios: false, dosDoisJeitos: false })
    const primeira = roteiro.find((p) => p.texto === 'Qual assunto?')
    expect(primeira?.ramos).toEqual([
      { opcao: 'Família', destino: 'pergunta 3 · Conte o que aconteceu.', desvia: true },
      { opcao: 'Trabalhista', destino: 'pergunta 2 · Só para quem é trabalhista', desvia: false },
    ])
  })

  it('as perguntas do advogado são numeradas como na lista do editor', () => {
    const roteiro = roteiroDaConversa(COM_DESVIO, { comHorarios: false, dosDoisJeitos: false })
    expect(roteiro.filter((p) => p.minha).map((p) => p.numero)).toEqual([1, 2, 3])
    expect(roteiro.filter((p) => !p.minha).every((p) => p.numero === undefined)).toBe(true)
  })

  it('“encerrar a triagem” aparece como o que vem depois dela', () => {
    const encerra: PerguntaDeTriagem[] = [
      {
        id: 'q1',
        kind: 'escolha',
        label: 'Qual assunto?',
        options: [
          { id: 'o1', texto: 'Já sei o que preciso', proxima: 'fim' },
          { id: 'o2', texto: 'Tenho dúvidas' },
        ],
      },
      { id: 'q2', kind: 'texto-longo', label: 'Conte o que aconteceu.' },
    ]
    const comGrade = roteiroDaConversa(encerra, { comHorarios: true, dosDoisJeitos: false })
    expect(comGrade[1].ramos?.[0].destino).toBe('direto para os horários')
    const semGrade = roteiroDaConversa(encerra, { comHorarios: false, dosDoisJeitos: false })
    expect(semGrade[1].ramos?.[0].destino).toBe('direto para o envio')
  })

  it('pergunta sem opções que desvia vira uma linha só', () => {
    const pula: PerguntaDeTriagem[] = [
      { id: 'q1', kind: 'texto', label: 'Uma coisa', proxima: 'q3' },
      { id: 'q2', kind: 'texto', label: 'Outra coisa' },
      { id: 'q3', kind: 'texto', label: 'A terceira' },
    ]
    const roteiro = roteiroDaConversa(pula, { comHorarios: false, dosDoisJeitos: false })
    expect(roteiro[1].ramos).toEqual([
      { opcao: 'Depois desta', destino: 'pergunta 3 · A terceira', desvia: true },
    ])
  })

  it('a pergunta que ninguém alcança é marcada', () => {
    const orfa: PerguntaDeTriagem[] = [
      {
        id: 'q1',
        kind: 'escolha',
        label: 'Qual assunto?',
        options: [
          { id: 'o1', texto: 'A', proxima: 'q3' },
          { id: 'o2', texto: 'B', proxima: 'q3' },
        ],
      },
      { id: 'q2', kind: 'texto', label: 'Ninguém chega aqui' },
      { id: 'q3', kind: 'texto', label: 'Todo mundo chega aqui' },
    ]
    const roteiro = roteiroDaConversa(orfa, { comHorarios: false, dosDoisJeitos: false })
    expect(roteiro.find((p) => p.texto === 'Ninguém chega aqui')?.inalcancavel).toBe(true)
    expect(roteiro.find((p) => p.texto === 'Todo mundo chega aqui')?.inalcancavel).toBeUndefined()
  })
})

describe('os destinos que o editor oferece', () => {
  it('só perguntas POSTERIORES, mais o fim da triagem', () => {
    const lista: PerguntaDeTriagem[] = [
      { id: 'a', kind: 'texto', label: 'Primeira' },
      { id: 'b', kind: 'texto', label: 'Segunda' },
      { id: 'c', kind: 'texto', label: 'Terceira' },
    ]
    expect(destinosPossiveis(lista, 0).map((d) => d.valor)).toEqual(['b', 'c', 'fim'])
    expect(destinosPossiveis(lista, 1).map((d) => d.valor)).toEqual(['c', 'fim'])
    // Na última só resta encerrar — e é por isso que a tela não mostra o seletor.
    expect(destinosPossiveis(lista, 2).map((d) => d.valor)).toEqual(['fim'])
  })

  it('o rótulo traz a posição e o enunciado, para dar para escolher de olho', () => {
    const lista: PerguntaDeTriagem[] = [
      { id: 'a', kind: 'texto', label: 'Primeira' },
      { id: 'b', kind: 'texto', label: 'Segunda' },
      { id: 'c', kind: 'texto', label: '' },
    ]
    expect(destinosPossiveis(lista, 0).map((d) => d.rotulo)).toEqual([
      '2. Segunda',
      '3. Pergunta sem enunciado',
      'Encerrar a triagem',
    ])
  })
})
