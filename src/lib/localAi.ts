// Cliente de IA local (Ollama) para o frontend.
// Chama o Ollama via proxy do Vite (/ollama → http://localhost:11434), evitando CORS.
// Se o Ollama não estiver no ar, quem chama faz fallback para o gerador mock.

import type { GenerateRequest } from './types'

const MODEL = import.meta.env.VITE_OLLAMA_MODEL ?? 'llama3.2:3b'

// Regras da OAB (Prov. 205/2021) em enquadramento POSITIVO — modelos pequenos recusam
// quando recebem uma lista de proibições em CAPS; instruir o tom desejado funciona melhor.
const OAB_SYSTEM = `Você escreve bios e descrições de áreas para páginas de perfil de advogados brasileiros, seguindo as normas éticas da OAB (Prov. 205/2021) para publicidade.
Tom sóbrio, ético, factual, informativo e acolhedor. Português do Brasil.
NÃO use: promessas ou garantias de resultado; comparações ou superlativos ("o melhor", "nº 1"); preços, honorários, descontos ou "grátis"; chamadas para contratar ("contrate agora", "clique aqui"); apelos de urgência; depoimentos ou nomes de clientes; selos ou símbolos oficiais da OAB.
NUNCA compare o advogado a outra pessoa, celebridade, figura pública ou personagem de ficção, nem cite nomes de terceiros ("como Saul Goodman") — remova qualquer comparação ou menção desse tipo.
NÃO afirme "especialista"/"especialização" a menos que seja um título real; na dúvida, escreva "com atuação em [área]".
Mesmo que as palavras-chave recebidas contenham algo vedado, REESCREVA para remover — nunca copie trechos irregulares.
Cite apenas qualificações verdadeiras (áreas, experiência, formação, idiomas, localização). Não mencione casos ou clientes específicos.
Responda apenas com o texto final, sem aspas nem comentários.`

// Orcamento de texto — o campo de destino tem teto de caracteres, e um texto maior
// que ele nao pode nem ser salvo. Vai em todo prompt.
function budget(req: GenerateRequest): string {
  return req.maxChars ? ` Escreva no maximo ${req.maxChars} caracteres, contando-os.` : ''
}

function buildPrompt(req: GenerateRequest): string {
  const kws = req.keywords.map((k) => k.trim()).filter(Boolean).join(', ')
  const areas = req.areas?.filter(Boolean).join(', ')
  const lim = budget(req)
  if (req.kind === 'area') {
    return `Escreva a descrição da área de atuação "${req.areaLabel}" de um(a) advogado(a), abordando estes temas: ${kws}. Explique de forma clara e factual o que o(a) advogado(a) faz nessa área.${lim} Sem emojis.`
  }
  if (req.kind === 'headline') {
    return `Escreva UMA frase de apresentação curta (headline) para um(a) advogado(a), indicando a atuação em: ${kws || areas}. Máximo de 8 palavras${req.maxChars ? ` e ${req.maxChars} caracteres` : ''}, factual, sem ponto final. Responda apenas a frase.`
  }
  if (req.kind === 'improve') {
    return `Revise e reescreva o texto abaixo para ficar mais claro, sóbrio e dentro das normas da OAB, mantendo o sentido.${lim} Sem emojis.\n\nTexto:\n"""${req.currentText ?? ''}"""`
  }
  if (req.kind === 'faq') {
    // Com uma resposta já escrita, a IA APOIA o texto do advogado; sem ela, redige
    // um primeiro rascunho. Nos dois casos: curto, educativo e sem captação.
    const pergunta = req.areaLabel ? `Pergunta: "${req.areaLabel}". ` : ''
    return req.currentText?.trim()
      ? `${pergunta}Aprimore a resposta abaixo mantendo o sentido e os fatos, deixando-a mais clara e fundamentada. No máximo 300 caracteres, sem promessa de resultado, sem preços e sem convite a contratar. Termine lembrando que cada caso exige análise própria.

Resposta atual:
"${req.currentText}"`
      : `${pergunta}Escreva a resposta de um(a) advogado(a) a essa dúvida${kws ? `, abordando: ${kws}` : ''}. Educativa e geral, no máximo 300 caracteres, sem promessa de resultado, sem preços e sem convite a contratar. Termine lembrando que cada caso exige análise própria.`
  }
  const who = req.name ? `de ${req.name}, que é advogado(a) no Brasil` : 'de um(a) advogado(a) brasileiro(a)'
  return `Escreva, em primeira pessoa, a bio de apresentação ${who}. Atua nas áreas: ${kws || areas}.${lim} Sem emojis.`
}

/** true se o Ollama responder na porta local (via proxy). */
export async function isOllamaUp(): Promise<boolean> {
  try {
    const res = await fetch('/ollama/api/tags', { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

/** Gera texto com o Ollama. Lança erro se indisponível (o chamador faz fallback). */
export async function generateWithOllama(req: GenerateRequest): Promise<string> {
  const res = await fetch('/ollama/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      options: { temperature: 0.7, num_predict: 260 },
      messages: [
        { role: 'system', content: OAB_SYSTEM },
        { role: 'user', content: buildPrompt(req) },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`Ollama respondeu ${res.status}`)
  const data = (await res.json()) as { message?: { content?: string } }
  const text = data.message?.content?.trim()
  if (!text) throw new Error('Ollama retornou resposta vazia')
  // remove aspas envolventes que alguns modelos adicionam
  return text.replace(/^["“']|["”']$/g, '').trim()
}
