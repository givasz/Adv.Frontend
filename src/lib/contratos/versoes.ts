// Revisão de cada modelo de documento e da declaração de revisão.
//
// ⚠️ PARIDADE com backend/src/contratos/modelos.ts — o teste de lá lê ESTE
// arquivo. Mexeu no texto-base de um modelo (uma cláusula, uma palavra que muda
// sentido)? Troque a data aqui e lá. O registro de cada documento carimba a
// revisão usada, e é por ela que se sabe, anos depois, de que texto ele partiu.
//
// Fica num arquivo à parte, sem nada além das constantes, para o teste do backend
// não depender de ler a lógica dos modelos.

export const VERSOES_DOS_MODELOS = {
  honorarios: '2026-09-10',
  procuracao: '2026-09-10',
  substabelecimento: '2026-09-10',
  hipossuficiencia: '2026-09-10',
}

export type ModeloId = keyof typeof VERSOES_DOS_MODELOS

/**
 * Revisão das duas frases que o advogado confirma antes de registrar. Elas
 * vivem logo abaixo, e trocar uma palavra delas é trocar o que foi declarado.
 */
export const DECLARACAO_DE_REVISAO_VERSAO = '2026-09-10'

export const DECLARACOES = {
  revisei:
    'Li o documento inteiro e revisei cada cláusula, os nomes, os números e as datas.',
  responsabilidade:
    'O conteúdo é de minha responsabilidade profissional: a plataforma forneceu só o modelo.',
} as const
