// Municípios brasileiros — a base que faz o campo "Cidade" parar de aceitar
// qualquer coisa.
//
// O campo era um input livre: "São Paolo", "Sao paulo", "SP capital" e "Sâo
// Paulo" entravam iguais, e todos viravam a mesma promessa quebrada em três
// lugares diferentes — o texto de SEO ("Advogado(a) em São Paolo"), o endereço
// do mapa e a busca do diretório, que compara texto e não encontra quem
// escreveu diferente. Nada disso é erro do advogado: é o campo que não ajudava.
//
// A base é o IBGE, gerada para dentro do pacote (ver scripts/gen-municipios.mjs
// para o porquê de não ser uma chamada de rede). Este arquivo é a parte que
// PENSA: carregar sob demanda, normalizar e procurar.
//
// A grafia oficial é a que fica gravada. Quem digitar "sao paulo" e escolher a
// sugestão grava "São Paulo" — o acento vem da base, não da pessoa.

/** Uma cidade da base, sempre com a UF junto: "Bom Jesus" existe em nove UFs. */
export interface Municipio {
  nome: string
  uf: string
}

// A base inteira é ~74 KB de texto. Ela NÃO entra no pacote principal: quem a
// pede é o campo de cidade, com import dinâmico, e só quando ele é montado.
let carregando: Promise<Record<string, string>> | null = null
let base: Record<string, string> | null = null

/**
 * Carrega a base (uma vez por sessão do navegador).
 *
 * Devolve a MESMA promessa enquanto o carregamento está em curso: dois campos
 * de cidade na mesma tela — o editor tem prévia ao lado — pediriam o pedaço
 * duas vezes se cada um começasse o seu.
 */
export function carregarMunicipios(): Promise<Record<string, string>> {
  if (base) return Promise.resolve(base)
  carregando ??= import('./municipios.data').then((m) => {
    base = m.MUNICIPIOS_POR_UF
    return base
  })
  return carregando
}

/** A base já carregada, ou `null` se ela ainda não chegou. */
export function municipiosCarregados(): Record<string, string> | null {
  return base
}

/**
 * Texto comparável: minúsculo, sem acento, sem pontuação e com um espaço só.
 *
 * É o que permite "sao jose do rio preto" encontrar "São José do Rio Preto", e
 * "moji-mirim" encontrar "Mogi Mirim". Sem isso o autocompletar só ajudaria
 * quem já sabe escrever o nome — que é justamente quem não precisa dele.
 */
export function normalizarNome(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Índice por UF, montado na primeira consulta e guardado: normalizar 5.571
// nomes a cada tecla digitada seria trabalho refeito à toa.
const indice = new Map<string, { nome: string; chave: string }[]>()

function indiceDaUf(dados: Record<string, string>, uf: string) {
  const existente = indice.get(uf)
  if (existente) return existente
  const bruto = dados[uf]
  const linha = bruto
    ? bruto.split('|').map((nome) => ({ nome, chave: normalizarNome(nome) }))
    : []
  indice.set(uf, linha)
  return linha
}

/** Todos os municípios de uma UF, em ordem alfabética. UF desconhecida → lista vazia. */
export function municipiosDaUf(dados: Record<string, string>, uf: string): string[] {
  return indiceDaUf(dados, (uf ?? '').toUpperCase()).map((m) => m.nome)
}

/**
 * Sugestões para o que a pessoa está digitando.
 *
 * Com UF escolhida, procura só nela. SEM UF, procura no Brasil inteiro e a
 * escolha preenche as duas coisas — é o caminho mais curto para quem sabe a
 * cidade e não pensa na sigla ("Campinas" já diz SP).
 *
 * Quem começa com o termo vem antes de quem só o contém: digitando "santos",
 * a cidade de Santos precede "Aparecida dos Santos". Dentro de cada grupo a
 * ordem é alfabética — a da base — porque qualquer outra seria um critério
 * nosso de destaque, e destaque não é coisa que se invente numa lista de
 * cidades.
 */
export function buscarMunicipios(
  dados: Record<string, string>,
  termo: string,
  uf?: string,
  limite = 8,
): Municipio[] {
  const chave = normalizarNome(termo)
  const ufs = uf ? [uf.toUpperCase()] : Object.keys(dados)
  // Sem nada digitado e sem UF não há o que sugerir: a lista seria os 5.571
  // municípios em ordem alfabética, que não ajuda ninguém.
  if (!chave && !uf) return []

  const comeca: Municipio[] = []
  const contem: Municipio[] = []
  for (const sigla of ufs) {
    for (const m of indiceDaUf(dados, sigla)) {
      // Campo vazio com UF escolhida: a lista é a própria UF, do começo. Aqui o
      // corte é seguro — não existe candidato melhor mais adiante no alfabeto.
      if (!chave) {
        comeca.push({ nome: m.nome, uf: sigla })
        if (comeca.length >= limite) return comeca
        continue
      }
      if (m.chave.startsWith(chave)) comeca.push({ nome: m.nome, uf: sigla })
      else if (m.chave.includes(chave)) contem.push({ nome: m.nome, uf: sigla })
    }
  }
  // A varredura é inteira de propósito: cortar no primeiro grupo cheio
  // esconderia um "começa com" que só apareceria numa UF seguinte. São 5.571
  // comparações de string sobre um índice já normalizado — abaixo de um
  // milissegundo, e roda a cada tecla sem que ninguém perceba.
  return [...comeca, ...contem].slice(0, limite)
}

/**
 * A grafia oficial de um nome digitado, ou `null` se ele não está na base.
 *
 * Devolver a grafia (e não só um booleano) é o que deixa "sao paulo" digitado à
 * mão, sem passar pela lista, ser gravado como "São Paulo" na hora de salvar.
 */
export function cidadeOficial(
  dados: Record<string, string>,
  uf: string,
  nome: string,
): string | null {
  const chave = normalizarNome(nome)
  if (!chave) return null
  const achou = indiceDaUf(dados, (uf ?? '').toUpperCase()).find((m) => m.chave === chave)
  return achou ? achou.nome : null
}

/** A cidade existe nessa UF? Comparação tolerante a acento e caixa. */
export function cidadeExiste(dados: Record<string, string>, uf: string, nome: string): boolean {
  return cidadeOficial(dados, uf, nome) !== null
}

/**
 * Em quais UFs existe uma cidade com este nome.
 *
 * Serve ao caso em que a pessoa digitou a cidade certa e a UF errada: em vez de
 * só dizer "não encontramos", o campo consegue dizer onde ela fica.
 */
export function ufsComCidade(dados: Record<string, string>, nome: string): string[] {
  const chave = normalizarNome(nome)
  if (!chave) return []
  return Object.keys(dados)
    .filter((uf) => indiceDaUf(dados, uf).some((m) => m.chave === chave))
    .sort()
}
