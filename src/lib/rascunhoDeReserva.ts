// Rascunho de reserva montado no navegador, quando a IA não respondeu (backend
// fora, proxy cortou, ou o Ollama local caiu em desenvolvimento).
//
// ⚠️ Mesma promessa do safeTemplate do backend (backend/src/ai/ai.service.ts):
// NUNCA devolve texto reprovado. Até 12/09/2026 as palavras-chave entravam cruas,
// e "a melhor advogada" + "garanto resultado" viravam "Dedico minha atuação a a
// melhor advogada e garanto resultado". Agora:
//   1. só entra item que passa LIMPO na checagem (nem aviso) e que não é
//      currículo — curso, escola, anos, OAB não são "área de atuação";
//   2. o texto montado é conferido de novo; reprovado, sai o neutro, sem nada do pedido.

import { checkCompliance, hasBlockingIssue } from './oab'
import type { GenerateKind, GenerateRequest } from './types'

// Versão enxuta do fatos.ts do backend: aqui só se decide se um ITEM digitado é
// currículo, para não escrevê-lo como área. Texto sem acento, porque `\b` é ASCII.
const PARECE_CURRICULO =
  /\d|\b(universidade|faculdade|pontificia|puc\w*|usp|unicamp|unesp|fgv|mackenzie|pos-? ?gradua\w*|especializ\w*|especialista|mba|mestr\w*|doutor\w*|formad[oa]|graduad[oa]|bacharel\w*|oab|professor\w*|autor[a]?|premi\w*)\b/

function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[­‐-―−]/g, '-')
    .toLowerCase()
}

function itensSeguros(itens: (string | undefined)[] | undefined): string[] {
  return (itens ?? [])
    .map((k) =>
      (k ?? '')
        .replace(/\b(como|igual a|tipo|feito)\b.*/i, '') // corta comparações a terceiros
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter((k) => k && checkCompliance(k).length === 0 && !PARECE_CURRICULO.test(semAcento(k)))
}

/** "a, b e c". */
function juntar(itens: string[]): string {
  return itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}` : (itens[0] ?? '')
}

/** Nada do que a pessoa digitou entra aqui — passa na checagem por construção (há teste). */
export const RASCUNHO_NEUTRO: Record<GenerateKind, string> = {
  bio: 'Sou advogado(a). Meu trabalho une técnica e escuta para orientar cada pessoa sobre seus direitos e os caminhos possíveis, com informação transparente do início ao fim.',
  area: 'Atuo nesta área oferecendo orientação clara sobre direitos e alternativas em cada etapa, buscando o caminho mais adequado a cada situação.',
  headline: 'Advogado(a) · Direito',
  improve:
    'Advogado(a) inscrito(a) na OAB. O trabalho é conduzido de forma técnica e informativa, orientando cada pessoa sobre seus direitos e os caminhos possíveis.',
  faq: 'De forma geral, a resposta depende de requisitos e prazos previstos em lei, que mudam conforme a situação de cada pessoa. O caminho costuma começar por reunir os documentos e verificar qual regra se aplica. Cada caso exige análise própria.',
}

export function draftText(req: GenerateRequest): string {
  const texto = montar(req)
  return hasBlockingIssue(texto) ? RASCUNHO_NEUTRO[req.kind] : texto
}

function montar(req: GenerateRequest): string {
  const temas = itensSeguros(req.keywords)
  const areas = itensSeguros(req.areas)
  const atuacao = juntar(areas.length ? areas : temas)

  if (req.kind === 'area') {
    const area = itensSeguros([req.areaLabel])[0]
    const foco = juntar(temas)
    return `${area ? `Atuo em ${area}` : 'Atuo nesta área'}${foco ? ` com foco em ${foco}` : ''}. Ofereço orientação clara sobre direitos e alternativas em cada etapa, buscando o caminho mais adequado a cada situação. O objetivo é que você compreenda o processo e tome decisões bem informadas.`
  }

  if (req.kind === 'headline') {
    return `Advogado(a) · ${itensSeguros([req.areaLabel])[0] || areas[0] || temas[0] || 'Direito'}`
  }

  if (req.kind === 'improve') {
    // O próprio texto só volta se não tiver vedação: o rascunho de reserva não pode
    // ser o caminho pelo qual um texto reprovado reaparece no editor.
    const atual = req.currentText?.trim()
    if (atual && !hasBlockingIssue(atual)) return atual
    return `Advogado(a) inscrito(a) na OAB${atuacao ? `, com atuação em ${atuacao}` : ''}. O trabalho é conduzido de forma técnica e informativa, orientando cada pessoa sobre seus direitos e os caminhos possíveis.`
  }

  if (req.kind === 'faq') {
    // A pergunta chega em `areaLabel`; antes ela virava sujeito ("De forma geral,
    // Qual o prazo...? segue requisitos"). Reserva é ponto de partida, não resposta.
    return RASCUNHO_NEUTRO.faq
  }

  const nome = itensSeguros([req.name?.split(' ')[0]])[0]
  const abertura = nome ? `Sou ${nome}, advogado(a)` : 'Sou advogado(a)'
  return `${abertura}${atuacao ? ` com atuação em ${atuacao}` : ''}. Meu trabalho une técnica e escuta para orientar cada pessoa sobre seus direitos e os caminhos possíveis, com informação transparente do início ao fim. Acredito em uma advocacia próxima, que reduz a insegurança de quem precisa de apoio jurídico.`
}
