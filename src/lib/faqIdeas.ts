// Sugestões de PERGUNTAS para o FAQ do perfil, por área de atuação.
//
// Tirar o "não sei o que colocar" do caminho é metade do recurso: quase todo
// advogado ouve as mesmas cinco dúvidas na primeira conversa, mas ninguém para
// para listá-las. Aqui elas já vêm escritas na voz de quem pergunta.
//
// As sugestões são apenas a PERGUNTA — a resposta é sempre do advogado (com ou
// sem apoio da IA) e passa pelo checkCompliance como qualquer texto do perfil.
// Nenhuma pergunta sugere promessa de resultado, urgência ou preço: responder
// dúvida de forma educativa é permitido pelo Prov. 205/2021; captação não é.

export interface FaqIdea {
  area: string
  question: string
}

const QUESTIONS_BY_AREA: Record<string, string[]> = {
  'Direito de Família': [
    'Como funciona a guarda compartilhada?',
    'Como é definido o valor da pensão alimentícia?',
    'Qual a diferença entre divórcio judicial e em cartório?',
  ],
  'Sucessões e Inventário': [
    'Quando o inventário pode ser feito em cartório?',
    'Quais documentos são necessários para abrir um inventário?',
    'O que é testamento e quem pode fazer um?',
  ],
  'Direito Trabalhista': [
    'Quais verbas eu recebo quando sou demitido?',
    'Trabalhar em home office muda os meus direitos?',
    'Como funciona o acordo trabalhista?',
  ],
  'Direito Criminal': [
    'Quais são os direitos de quem está sendo investigado?',
    'Qual a diferença entre inquérito e processo?',
    'O que acontece em uma audiência de custódia?',
  ],
  'Direito do Consumidor': [
    'Qual o prazo para reclamar de um produto com defeito?',
    'Fui cobrado por algo que não comprei. O que fazer?',
    'Posso desistir de uma compra feita pela internet?',
  ],
  'Direito Empresarial': [
    'O que precisa constar em um contrato social?',
    'Como formalizar uma sociedade entre sócios?',
    'Quais cuidados tomar antes de assinar um contrato comercial?',
  ],
  'Direito Previdenciário': [
    'Como sei se já posso me aposentar?',
    'Quais documentos preciso reunir para pedir um benefício?',
    'O que é o benefício por incapacidade?',
  ],
  'Direito Imobiliário': [
    'O que verificar antes de comprar um imóvel?',
    'O que olhar em um contrato de aluguel?',
    'Como regularizar um imóvel que está em nome de outra pessoa?',
  ],
  'Direito Digital': [
    'O que a LGPD exige de uma empresa pequena?',
    'Meus dados vazaram. Quais são os meus direitos?',
    'Contrato assinado pela internet tem validade?',
  ],
}

const GENERIC = (area: string): string[] => [
  `Em que situações preciso de um advogado de ${area}?`,
  `Quais documentos levar na primeira conversa sobre ${area}?`,
  `Como funciona o atendimento em ${area}, do início ao fim?`,
]

/**
 * Perguntas sugeridas a partir das áreas do perfil, intercalando as áreas para
 * quem atua em mais de uma. `seed` só rotaciona a ordem (sem aleatoriedade, para
 * a mesma tela não mudar a cada render), e `usadas` remove o que já está no FAQ.
 */
export function faqIdeas(areas: string[], seed = 0, limit = 3, usadas: string[] = []): FaqIdea[] {
  const base = areas.filter(Boolean).length ? areas.filter(Boolean) : ['sua área']
  const ja = new Set(usadas.map((q) => q.trim().toLowerCase()))
  const out: FaqIdea[] = []
  let round = 0
  while (out.length < limit && round < 6) {
    for (const area of base) {
      const pool = QUESTIONS_BY_AREA[area] ?? GENERIC(area)
      const question = pool[(round + seed) % pool.length]
      if (
        question &&
        !ja.has(question.toLowerCase()) &&
        !out.some((o) => o.question === question)
      ) {
        out.push({ area, question })
      }
      if (out.length >= limit) break
    }
    round++
  }
  return out
}
