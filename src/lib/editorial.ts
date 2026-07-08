// Calendário editorial — sugestões de temas de conteúdo EDUCATIVO por área.
//
// Conteúdo educativo é permitido (e incentivado) pelo Prov. 205/2021, desde que
// informativo e sem captação. As sugestões abaixo são pautas neutras ("explique
// como funciona X"), nunca chamadas comerciais. O texto final que o advogado
// publicar continua sujeito ao checkCompliance().

export interface EditorialIdea {
  area: string
  title: string
}

const IDEAS_BY_AREA: Record<string, string[]> = {
  'Direito de Família': [
    'Como funciona a guarda compartilhada, na prática',
    'Diferenças entre divórcio judicial e extrajudicial',
    'O que considerar ao definir a pensão alimentícia',
  ],
  'Sucessões e Inventário': [
    'Inventário judicial x extrajudicial: quando cabe cada um',
    'O que é planejamento sucessório e para quem faz sentido',
    'Prazos e documentos para abrir um inventário',
  ],
  'Direito Trabalhista': [
    'Quais verbas compõem a rescisão do contrato de trabalho',
    'Home office e direitos: o que diz a legislação',
    'Como funciona o acordo trabalhista extrajudicial',
  ],
  'Direito Criminal': [
    'Quais são os direitos de quem é investigado',
    'A diferença entre inquérito e ação penal',
    'O que significa audiência de custódia',
  ],
  'Direito do Consumidor': [
    'Prazos para reclamar de produto ou serviço com defeito',
    'Cobrança indevida: como agir passo a passo',
    'Direito de arrependimento nas compras online',
  ],
  'Direito Empresarial': [
    'Principais cuidados ao redigir um contrato social',
    'Como proteger a empresa em contratos comerciais',
    'Aspectos jurídicos de abrir uma sociedade',
  ],
  'Direito Previdenciário': [
    'Como identificar o momento certo de se aposentar',
    'Documentos essenciais para requerer um benefício',
    'O que é o benefício por incapacidade',
  ],
  'Direito Imobiliário': [
    'Cuidados jurídicos ao comprar um imóvel',
    'O que verificar antes de assinar um contrato de locação',
    'Regularização de imóvel: por onde começar',
  ],
  'Direito Digital': [
    'LGPD na prática: o que muda para pequenas empresas',
    'Seus direitos diante de vazamento de dados',
    'Contratos digitais: o que dá para assinar online',
  ],
}

const GENERIC_IDEAS = (area: string): string[] => [
  `Perguntas frequentes sobre ${area}`,
  `Mitos e verdades em ${area}`,
  `Um guia introdutório de ${area} para quem nunca precisou`,
]

// Rótulos de mês (0-index) — o índice do mês vem de fora (sem Date.now no runtime).
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/**
 * Sugestões de conteúdo para as áreas do perfil. Retorna até `limit` ideias,
 * intercalando as áreas do advogado. `seed` (ex.: mês atual) só rotaciona a
 * ordem para as sugestões variarem sem depender de aleatoriedade.
 */
export function editorialIdeas(areas: string[], seed = 0, limit = 6): EditorialIdea[] {
  const base = areas.length ? areas : ['sua área de atuação']
  const out: EditorialIdea[] = []
  let round = 0
  while (out.length < limit && round < 6) {
    for (const area of base) {
      const pool = IDEAS_BY_AREA[area] ?? GENERIC_IDEAS(area)
      const idx = (round + seed) % pool.length
      const title = pool[idx]
      if (title && !out.some((o) => o.title === title)) out.push({ area, title })
      if (out.length >= limit) break
    }
    round++
  }
  return out
}

export function monthLabel(monthIndex: number): string {
  return MONTHS[((monthIndex % 12) + 12) % 12]
}
