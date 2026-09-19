import { describe, expect, it } from 'vitest'
import {
  fontesPossiveis,
  ligarResposta,
  mapaDaTriagem,
  podeTrocarComAProxima,
  type ItemDoMapa,
  type PerguntaDeTriagem,
  type PerguntaNoMapa,
  type RamoNoMapa,
} from './triagem'

// O FLUXOGRAMA que o advogado vê no lugar da prévia do celular.
//
// Ele não é a lista de perguntas: tem a abertura, o aviso de segurança e o que
// vem DEPOIS da triagem, e desenha quem recebe qual pergunta. Cada passo
// estrutural precisa aparecer sob a mesma condição que o faz aparecer na
// conversa (AssistantChat) — se os dois divergirem, o editor promete um caminho
// e o visitante percorre outro.

const CTX = { comHorarios: false, dosDoisJeitos: false }

const MINHAS: PerguntaDeTriagem[] = [
  { id: 'q1', kind: 'escolha', label: 'Qual assunto?', options: [{ id: 'o1', texto: 'Família' }] },
  { id: 'q2', kind: 'texto-longo', label: 'Conte o que aconteceu.' },
]

const textos = (p: PerguntaDeTriagem[], ctx = CTX) => {
  const m = mapaDaTriagem(p, ctx)
  return [m.inicio.texto, ...m.depois.map((d) => d.texto)]
}

/** O fluxograma achatado: "n" para pergunta, "[n:resposta …]" para ramo. */
function desenho(itens: ItemDoMapa[]): string {
  return itens
    .map((i) =>
      i.tipo === 'pergunta'
        ? String(i.numero)
        : `[${i.numero}=${i.opcoes.map((o) => o.texto).join('|')}: ${desenho(i.itens)}]`,
    )
    .join(' ')
}

const perguntas = (itens: ItemDoMapa[]): PerguntaNoMapa[] =>
  itens.flatMap((i) => (i.tipo === 'pergunta' ? [i] : perguntas(i.itens)))

describe('o começo e o fim do fluxograma', () => {
  it('abre pelo aviso de segurança e fecha pelo envio', () => {
    const passos = textos(MINHAS, { comHorarios: true, dosDoisJeitos: true })
    expect(passos[0]).toMatch(/documentos.*senhas/i)
    expect(passos[passos.length - 1]).toMatch(/WhatsApp/)
  })

  it('sem horário aberto, não promete escolher dia — e o fecho muda', () => {
    const comGrade = textos(MINHAS, { comHorarios: true, dosDoisJeitos: false })
    const semGrade = textos(MINHAS)
    expect(comGrade.some((t) => /dia e o horário/i.test(t))).toBe(true)
    expect(semGrade.some((t) => /dia e o horário/i.test(t))).toBe(false)
    expect(comGrade[comGrade.length - 1]).toMatch(/horário só vale/i)
    expect(semGrade[semGrade.length - 1]).toMatch(/WhatsApp, sem horário/i)
  })

  it('a pergunta de formato só entra quando o perfil atende dos dois jeitos', () => {
    expect(textos(MINHAS, { comHorarios: true, dosDoisJeitos: false })).not.toContain('Presencial ou online')
    expect(textos(MINHAS, { comHorarios: true, dosDoisJeitos: true })).toContain('Presencial ou online')
  })

  it('o assistente não repete o que a triagem já pergunta', () => {
    const comAmbas: PerguntaDeTriagem[] = [
      ...MINHAS,
      { id: 'q3', kind: 'atendimento', label: 'Prefere vir aqui?' },
      { id: 'q4', kind: 'contato', label: 'Seu primeiro nome?' },
    ]
    const passos = textos(comAmbas, { comHorarios: true, dosDoisJeitos: true })
    expect(passos).not.toContain('Presencial ou online')
    expect(passos).not.toContain('Como posso te chamar?')
  })

  it('sem pergunta nenhuma, sobra só o que o assistente já fazia', () => {
    const m = mapaDaTriagem([], { comHorarios: true, dosDoisJeitos: true })
    expect(m.itens).toEqual([])
    expect(m.depois.map((d) => d.texto)).toContain('Como posso te chamar?')
  })
})

describe('as perguntas que o assistente faz sozinho, tiradas pelo advogado', () => {
  const CHEIO = { comHorarios: true, dosDoisJeitos: true }

  it('cada uma diz que etapa é; a abertura e o envio não são etapa nenhuma', () => {
    const m = mapaDaTriagem(MINHAS, CHEIO)
    expect(m.depois.map((p) => p.etapa)).toEqual(['horario', 'formato', 'nome', undefined])
    expect(m.inicio).not.toHaveProperty('etapa')
  })

  it('a tirada continua na lista, marcada — é de lá que sai o "Devolver"', () => {
    const m = mapaDaTriagem(MINHAS, { ...CHEIO, semEtapas: ['formato', 'nome'] })
    expect(m.depois.filter((p) => p.removida).map((p) => p.texto)).toEqual([
      'Presencial ou online',
      'Como posso te chamar?',
    ])
    expect(m.depois.filter((p) => !p.removida).map((p) => p.etapa)).toEqual(['horario', undefined])
  })

  it('sem dia e horário, o fecho é o de pedido de contato', () => {
    const m = mapaDaTriagem(MINHAS, { ...CHEIO, semEtapas: ['horario'] })
    expect(m.depois[m.depois.length - 1].texto).toMatch(/WhatsApp, sem horário/i)
  })

  it('sem dia e horário, o pedido no painel informa que o advogado define a data antes de confirmar', () => {
    const m = mapaDaTriagem(MINHAS, { ...CHEIO, semEtapas: ['horario'], destino: 'painel' })
    expect(m.depois.find((p) => p.etapa === 'horario')?.removida).toBe(true)
    expect(m.depois[m.depois.length - 1].texto).toMatch(/Solicitações, sem horário.*define a data e confirma na agenda/i)
  })

  it('tirar uma etapa que nem seria feita não inventa passo', () => {
    const m = mapaDaTriagem(MINHAS, { comHorarios: false, dosDoisJeitos: false, semEtapas: ['horario', 'formato'] })
    expect(m.depois.map((p) => p.etapa)).toEqual(['nome', undefined])
  })
})

describe('as perguntas no fluxograma', () => {
  it('numa triagem em fila, nenhum ramo', () => {
    expect(desenho(mapaDaTriagem(MINHAS, CTX).itens)).toBe('1 2')
  })

  it('pergunta que a conversa não consegue fazer não aparece, e a numeração segue a lista', () => {
    const meia: PerguntaDeTriagem[] = [
      { id: 'a', kind: 'escolha', label: 'Sem opções ainda' },
      { id: 'b', kind: 'texto', label: '' },
      ...MINHAS,
    ]
    // "Editar a pergunta 3" é a de "Qual assunto?" — o fluxograma diz o mesmo número.
    expect(desenho(mapaDaTriagem(meia, CTX).itens)).toBe('3 4')
  })
})

describe('os ramos', () => {
  const ASSUNTO: PerguntaDeTriagem = {
    id: 'assunto',
    kind: 'escolha',
    label: 'Qual assunto?',
    options: [
      { id: 'fam', texto: 'Família' },
      { id: 'trab', texto: 'Trabalhista' },
      { id: 'ja', texto: 'Já sei', encerra: true },
    ],
  }
  const t = (id: string, extra: Partial<PerguntaDeTriagem> = {}): PerguntaDeTriagem => ({
    id,
    kind: 'texto',
    label: id,
    ...extra,
  })
  const se = (pergunta: string, ...opcoes: string[]) => ({ condicao: { pergunta, opcoes } })

  it('a pergunta que depende de uma resposta entra num ramo com a resposta e a origem', () => {
    const m = mapaDaTriagem([ASSUNTO, t('filhos', se('assunto', 'fam')), t('relato')], CTX)
    expect(desenho(m.itens)).toBe('1 [1=Família: 2] 3')
    const ramo = m.itens[1] as RamoNoMapa
    expect(ramo.pergunta).toBe('assunto')
    expect(ramo.opcoes).toEqual([{ id: 'fam', texto: 'Família' }])
  })

  it('perguntas seguidas com a MESMA condição dividem o ramo', () => {
    const m = mapaDaTriagem([ASSUNTO, t('a', se('assunto', 'fam')), t('b', se('assunto', 'fam'))], CTX)
    expect(desenho(m.itens)).toBe('1 [1=Família: 2 3]')
  })

  it('condições diferentes, ramos lado a lado', () => {
    const m = mapaDaTriagem([ASSUNTO, t('a', se('assunto', 'fam')), t('b', se('assunto', 'trab'))], CTX)
    expect(desenho(m.itens)).toBe('1 [1=Família: 2] [1=Trabalhista: 3]')
  })

  it('a pergunta que depende de outra de DENTRO do ramo se aninha nele', () => {
    const m = mapaDaTriagem(
      [
        ASSUNTO,
        { id: 'ainda', kind: 'sim-nao', label: 'Ainda trabalha lá?', ...se('assunto', 'trab') },
        t('desde', se('ainda', 'sim')),
        t('relato'),
      ],
      CTX,
    )
    expect(desenho(m.itens)).toBe('1 [1=Trabalhista: 2 [2=Sim: 3]] 4')
  })

  it('uma pergunta feita a todos fecha o ramo, e uma condição distante abre outro onde ela está', () => {
    const m = mapaDaTriagem([ASSUNTO, t('a', se('assunto', 'fam')), t('b'), t('c', se('assunto', 'fam'))], CTX)
    expect(desenho(m.itens)).toBe('1 [1=Família: 2] 3 [1=Família: 4]')
  })

  it('cada resposta diz quais perguntas abre, e qual encerra', () => {
    const m = mapaDaTriagem(
      [ASSUNTO, t('a', se('assunto', 'fam')), t('b', se('assunto', 'fam', 'trab'))],
      CTX,
    )
    const [assunto] = perguntas(m.itens)
    expect(assunto.respostas).toEqual([
      { id: 'fam', texto: 'Família', encerra: false, abre: [2, 3] },
      { id: 'trab', texto: 'Trabalhista', encerra: false, abre: [3] },
      { id: 'ja', texto: 'Já sei', encerra: true, abre: [] },
    ])
  })

  it('a pergunta que ninguém alcança é marcada', () => {
    const m = mapaDaTriagem([ASSUNTO, t('orfa', se('assunto', 'ja')), t('todos')], CTX)
    const [, orfa, todos] = perguntas(m.itens)
    expect(orfa.inalcancavel).toBe(true)
    expect(todos.inalcancavel).toBe(false)
  })
})

describe('ligar uma resposta a uma pergunta', () => {
  const base: PerguntaDeTriagem[] = [
    {
      id: 'a',
      kind: 'escolha',
      label: 'Assunto',
      options: [
        { id: 'o1', texto: 'Um' },
        { id: 'o2', texto: 'Dois' },
      ],
    },
    { id: 'b', kind: 'sim-nao', label: 'Tem processo?', options: [{ id: 'sim', texto: 'Sim' }, { id: 'nao', texto: 'Não' }] },
    { id: 'c', kind: 'texto', label: 'Conte' },
  ]
  const condicaoDe = (lista: PerguntaDeTriagem[], id: string) => lista.find((q) => q.id === id)?.condicao

  it('ligar cria a condição na pergunta de destino', () => {
    expect(condicaoDe(ligarResposta(base, 'a', 'o1', 'c', true), 'c')).toEqual({ pergunta: 'a', opcoes: ['o1'] })
  })

  it('ligar outra resposta da mesma pergunta soma', () => {
    const uma = ligarResposta(base, 'a', 'o1', 'c', true)
    expect(condicaoDe(ligarResposta(uma, 'a', 'o2', 'c', true), 'c')).toEqual({ pergunta: 'a', opcoes: ['o1', 'o2'] })
  })

  it('ligar a resposta de OUTRA pergunta troca a dependência', () => {
    const uma = ligarResposta(base, 'a', 'o1', 'c', true)
    expect(condicaoDe(ligarResposta(uma, 'b', 'sim', 'c', true), 'c')).toEqual({ pergunta: 'b', opcoes: ['sim'] })
  })

  it('desligar a última resposta devolve a pergunta a todo mundo', () => {
    const uma = ligarResposta(base, 'a', 'o1', 'c', true)
    const solta = ligarResposta(uma, 'a', 'o1', 'c', false)
    expect(solta.find((q) => q.id === 'c')).not.toHaveProperty('condicao')
  })

  it('desligar a resposta de uma pergunta de que ela não depende não mexe em nada', () => {
    const uma = ligarResposta(base, 'a', 'o1', 'c', true)
    expect(ligarResposta(uma, 'b', 'sim', 'c', false)).toEqual(uma)
  })

  it('não liga para trás nem para a própria pergunta', () => {
    expect(ligarResposta(base, 'b', 'sim', 'a', true)).toBe(base)
    expect(ligarResposta(base, 'a', 'o1', 'a', true)).toBe(base)
  })
})

describe('de quem uma pergunta pode depender', () => {
  it('só das anteriores que têm resposta escrita para escolher', () => {
    const lista: PerguntaDeTriagem[] = [
      { id: 'a', kind: 'texto', label: 'Nome da empresa' },
      { id: 'b', kind: 'escolha', label: 'Assunto', options: [{ id: 'o1', texto: 'Um ' }, { id: 'o2', texto: '' }] },
      { id: 'c', kind: 'sim-nao', label: '', options: [{ id: 'sim', texto: 'Sim' }, { id: 'nao', texto: 'Não' }] },
      { id: 'd', kind: 'texto', label: 'Conte' },
    ]
    expect(fontesPossiveis(lista, 3)).toEqual([
      { id: 'b', numero: 2, rotulo: '2. Assunto', opcoes: [{ id: 'o1', texto: 'Um' }] },
      {
        id: 'c',
        numero: 3,
        rotulo: '3. Pergunta sem enunciado',
        opcoes: [
          { id: 'sim', texto: 'Sim' },
          { id: 'nao', texto: 'Não' },
        ],
      },
    ])
    expect(fontesPossiveis(lista, 0)).toEqual([])
  })
})

describe('trocar perguntas de lugar', () => {
  it('não deixa a dependente passar para cima daquela de que precisa', () => {
    const lista: PerguntaDeTriagem[] = [
      { id: 'a', kind: 'sim-nao', label: 'Tem processo?' },
      { id: 'b', kind: 'texto', label: 'Qual?', condicao: { pergunta: 'a', opcoes: ['sim'] } },
      { id: 'c', kind: 'texto', label: 'Conte' },
    ]
    expect(podeTrocarComAProxima(lista, 0)).toBe(false)
    expect(podeTrocarComAProxima(lista, 1)).toBe(true)
    expect(podeTrocarComAProxima(lista, 2)).toBe(false)
  })
})
