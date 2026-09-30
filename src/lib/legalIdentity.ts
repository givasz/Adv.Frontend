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

// 29/09/2026: a operação passou da VEACCI SERVIÇOS DE T.I LTDA (CNPJ
// 43.563.547/0001-08) para a SELF CODING, constituída em 28/09/2026. Dados do
// comprovante de inscrição no CNPJ emitido em 29/09/2026.
//
// A troca veio junto com a do provedor de pagamento: a conta de cobrança no Asaas
// é da Self Coding, e quem cobra tem de ser quem o contrato diz que vende. Uma
// assinatura faturada num CNPJ enquanto os Termos apontam outro é o tipo de
// divergência que o consumidor usa para contestar a cobrança — e que ele ganha.
//
// O endereço é a sede fiscal registrada no CNPJ. É para lá que vão notificação
// extrajudicial e citação (ver CANAL_SEDE em legalContent.ts).
export const OPERADOR = {
  razaoSocial: 'SELF CODING DESENVOLVIMENTO DE SOFTWARE SOB ENCOMENDA LTDA',
  nomeFantasia: 'advoc.me',
  cnpj: '69.366.280/0001-52',
  /** Logradouro, número, complemento e bairro. Vazio = só município/UF (ver `operadorEndereco`). */
  logradouro: 'Rua Visconde do Rio Branco, 1488, conj. 909, 9º andar, Cond. Universe Life Square, Bloco Com., Centro',
  cep: '80420-210',
  municipio: 'Curitiba',
  uf: 'PR',
} as const

/** "SELF CODING DESENVOLVIMENTO DE SOFTWARE SOB ENCOMENDA LTDA, inscrita no CNPJ sob o nº 69.366.280/0001-52" */
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
  if (!OPERADOR.logradouro) return cidade
  return `${OPERADOR.logradouro}, ${cidade}${OPERADOR.cep ? `, CEP ${OPERADOR.cep}` : ''}`
}

/** Frase completa de identificação, usada na abertura dos Termos e da Privacidade. */
export function operadorIdentificacao(): string {
  return `O advoc.me é operado por ${operadorLinha()}, com sede em ${operadorEndereco()}.`
}

/**
 * Versão vigente dos documentos legais — é a data da revisão, e é o que fica
 * gravado no aceite de cada conta.
 */
export const TERMS_VERSION = '2026-09-29-1'

/** A mesma data por extenso, para exibição no topo de cada documento. */
export const TERMS_UPDATED = '29 de setembro de 2026'

/**
 * POR QUE NÃO HÁ E-MAIL DE CONTATO AQUI.
 *
 * Até 04/09/2026 os sete documentos apontavam `contato@advoc.me` como canal do
 * encarregado (LGPD, art. 41), de dúvidas sobre os Termos e de recebimento de
 * ordem judicial — prometendo resposta em 15 dias. O domínio `advoc.me` não é
 * nosso ainda (o site vive em advocme.netlify.app), então essa caixa não podia
 * existir. E o backend não envia nem recebe e-mail: a Fase 2 do painel (correio)
 * segue pendente.
 *
 * Um canal inventado é pior do que canal nenhum. Quem escreve para um endereço
 * que ninguém lê não fica sem resposta por acaso: fica sem resposta porque a
 * política mentiu, e o descumprimento passa a ser da própria política.
 *
 * O QUE FICOU NO LUGAR — três caminhos, todos existentes:
 *
 *   • titular COM conta → chamado em "Suporte", que tem fila, prazo e registro
 *     dos dois lados (model SupportTicket);
 *   • terceiro que se sente lesado por um perfil → a Denúncia, pública e SEM
 *     conta, no rodapé de todo perfil (`/:slug/denunciar`);
 *   • notificação extrajudicial, ordem judicial e pedido de quem não tem conta
 *     → a SEDE da empresa, identificada acima. Juízo não precisa de e-mail para
 *     citar: precisa de pessoa jurídica determinada e endereço, que é
 *     exatamente o que `OPERADOR` passou a publicar.
 *
 * QUANDO O DOMÍNIO EXISTIR: crie a caixa, confirme que alguém a lê, preencha a
 * constante abaixo e volte a citá-la nos documentos. Enquanto for `null`, o
 * teste em `avisosPublicos.spec.ts` impede que um endereço de e-mail volte a
 * aparecer no texto legal.
 */
//
// 27/09/2026: a caixa existe — contato@selfcoding.com.br, lida pela equipe. Ela
// já aparece fora dos documentos (rodapé da home, índice de /legal). Citá-la
// DENTRO dos Termos e da Privacidade muda o texto aceito, e isso exige versão
// nova em TERMS_VERSION (aqui e em backend/src/legal/termos.ts) e um aceite
// novo de todas as contas — é um passo à parte, de propósito.
export const CONTACT_EMAIL: string | null = 'contato@selfcoding.com.br'
