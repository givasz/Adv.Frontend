// QUEM SOMOS, E QUAL VERSÃO DOS DOCUMENTOS ESTÁ VALENDO.
//
// Fonte única de duas coisas que os sete documentos de legalContent.ts, o rodapé
// da landing, a tela de cadastro e o backend precisam dizer IGUAL.
//
// 1. A IDENTIFICAÇÃO DO FORNECEDOR
// --------------------------------
// Termos de Uso sem parte identificada é o primeiro argumento para um juiz
// relativizar as cláusulas: o CDC (arts. 6º, III e 31) exige que o consumidor
// saiba com quem contratou, e o Marco Civil (art. 5º, III) define provedor de
// aplicação como pessoa determinada. Um documento que limita responsabilidade
// mas não diz de quem é a responsabilidade limitada trabalha contra si mesmo.
//
// 2. A VERSÃO DOS DOCUMENTOS
// --------------------------
// A versão é a DATA da revisão, no formato ISO. É ela que vai gravada no aceite
// de cada conta (User.termsVersion), e é a comparação entre as duas que faz a
// plataforma pedir um aceite novo quando o texto muda — a promessa do item 13
// dos Termos ("mudanças relevantes são avisadas") deixando de ser promessa.
//
// Duas revisões no mesmo dia: sufixe ("2026-09-04-2"). Nunca reaproveite uma
// versão já publicada com texto diferente — quem aceitou a anterior aceitou
// outra coisa, e o registro passaria a apontar para um documento que não existe.
//
// O backend tem a MESMA constante em src/legal/termos.ts, travada por um teste de
// paridade. O servidor não pode confiar na versão que o navegador manda: seria o
// cliente escolhendo qual contrato assinou.

export const OPERADOR = {
  razaoSocial: 'VEACCI SERVIÇOS DE T.I LTDA — ME',
  nomeFantasia: 'advoc.me',
  cnpj: '43.563.547/0001-08',
  /** Logradouro e número. Vazio enquanto não confirmado — ver `operadorEndereco`. */
  logradouro: '',
  municipio: 'São João do Paraíso',
  uf: 'MG',
} as const

/** "VEACCI SERVIÇOS DE T.I LTDA — ME, CNPJ 43.563.547/0001-08" */
export function operadorLinha(): string {
  return `${OPERADOR.razaoSocial}, inscrita no CNPJ sob o nº ${OPERADOR.cnpj}`
}

/**
 * Endereço para correspondência e citação.
 *
 * Enquanto o logradouro não estiver preenchido, devolve município/UF — que já é
 * mais do que "nada" e não inventa um endereço que não existe. Nenhuma tela
 * precisa saber disso: quem lê a função recebe a melhor forma disponível.
 */
export function operadorEndereco(): string {
  const cidade = `${OPERADOR.municipio}/${OPERADOR.uf}`
  return OPERADOR.logradouro ? `${OPERADOR.logradouro}, ${cidade}` : cidade
}

/** Frase completa de identificação, usada na abertura dos Termos e da Privacidade. */
export function operadorIdentificacao(): string {
  return `O advoc.me é operado por ${operadorLinha()}, com sede em ${operadorEndereco()}.`
}

/**
 * Versão vigente dos documentos legais — é a data da revisão, e é o que fica
 * gravado no aceite de cada conta.
 */
export const TERMS_VERSION = '2026-09-04'

/** A mesma data por extenso, para exibição no topo de cada documento. */
export const TERMS_UPDATED = '4 de setembro de 2026'

/** E-mail único de contato — jurídico, dados pessoais e ordem judicial. */
export const CONTACT_EMAIL = 'contato@advoc.me'
