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
Cite apenas qualificações verdadeiras (áreas, experiência, formação, idiomas, localização). Não mencione casos ou clientes específicos.
Responda apenas com o texto final, sem aspas nem comentários.`

function buildPrompt(req: GenerateRequest): string {
  const kws = req.keywords.map((k) => k.trim()).filter(Boolean).join(', ')
  if (req.kind === 'area') {
    return `Escreva a descrição da área de atuação "${req.areaLabel}" de um(a) advogado(a), abordando estes temas: ${kws}. Explique de forma clara e factual o que o(a) advogado(a) faz nessa área. No máximo 3 frases, sem emojis.`
  }
  const who = req.name ? `de ${req.name}, que é advogado(a) no Brasil` : 'de um(a) advogado(a) brasileiro(a)'
  return `Escreva, em primeira pessoa, a bio de apresentação ${who}. Atua nas áreas: ${kws}. No máximo 3 frases, sem emojis.`
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
