// O que parece dado pessoal num texto que vai ser GUARDADO (o modelo próprio).
//
// A tela avisa enquanto o advogado escreve; quem RECUSA é o servidor
// (backend/src/contratos/dado-pessoal.ts). Os dois passam pelos mesmos casos —
// dadoPessoal.casos.json — e o teste de cada lado lê esse arquivo.
//
// Pega o que tem FORMA: CPF, CNPJ, e-mail, telefone, CEP, processo, conta, Pix.
// Não pega nome de pessoa — e a tela diz isso, em vez de fingir que confere.
// Não pega lei, artigo, data, percentual nem valor: nada disso identifica alguém.

export type TipoDeDadoPessoal =
  | 'processo'
  | 'cnpj'
  | 'cpf'
  | 'email'
  | 'chave-pix'
  | 'telefone'
  | 'cep'
  | 'conta'

export const ROTULO_DO_DADO: Record<TipoDeDadoPessoal, string> = {
  processo: 'número de processo',
  cnpj: 'CNPJ',
  cpf: 'CPF',
  email: 'e-mail',
  'chave-pix': 'chave Pix',
  telefone: 'telefone',
  cep: 'CEP',
  conta: 'agência ou conta bancária',
}

// A ORDEM importa: o que casa primeiro sai do texto antes do padrão seguinte.
const PADROES: [TipoDeDadoPessoal, RegExp][] = [
  ['processo', /\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/g],
  ['cnpj', /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g],
  ['cpf', /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g],
  ['email', /[^\s@<>(){}[\]"',;:]+@[^\s@<>(){}[\]"',;:]+\.[a-z]{2,}/gi],
  ['chave-pix', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['telefone', /(?:\+?55[\s.-]?)?(?:\(\d{2}\)|\b\d{2})[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g],
  ['cep', /\b\d{5}-\d{3}\b/g],
  [
    'conta',
    /\b(?:ag[êe]ncia|conta(?:\s+corrente|\s+poupan[çc]a)?|c\/c)\s*(?:n[º°o.]*\s*)?:?\s*\d[\d.-]{2,}\d/gi,
  ],
]

export interface DadoPessoalAchado {
  tipo: TipoDeDadoPessoal
  /** o trecho com o miolo escondido — mostra ONDE sem repetir o dado */
  trecho: string
}

function mascarar(tipo: TipoDeDadoPessoal, s: string): string {
  if (tipo === 'email') {
    const [nome, dominio] = s.split('@')
    return `${(nome ?? '').slice(0, 2)}•••@${dominio ?? ''}`
  }
  let digitos = 0
  const total = (s.match(/\d/g) ?? []).length
  return s.replace(/[0-9a-f]/gi, (ch) => {
    if (!/\d/.test(ch)) return tipo === 'chave-pix' ? '•' : ch
    digitos += 1
    return digitos <= 3 || digitos > total - 2 ? ch : '•'
  })
}

export function acharDadosPessoais(texto: string): DadoPessoalAchado[] {
  let resto = (texto ?? '').normalize('NFC')
  const achados: { pos: number; achado: DadoPessoalAchado }[] = []
  for (const [tipo, padrao] of PADROES) {
    resto = resto.replace(new RegExp(padrao.source, padrao.flags), (m: string, ...args: unknown[]) => {
      const pos = args.find((a): a is number => typeof a === 'number') ?? 0
      achados.push({ pos, achado: { tipo, trecho: mascarar(tipo, m.trim()) } })
      return ' '.repeat(m.length)
    })
  }
  return achados.sort((a, b) => a.pos - b.pos).map((a) => a.achado)
}
