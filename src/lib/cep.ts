// Consulta de CEP, do lado de quem digita.
//
// Fina de propósito: quem faz a consulta é o nosso servidor (ver
// backend/src/geo/geo.service.ts para o porquê de não sair do navegador). Aqui
// mora só o que o campo precisa saber — e a decisão de nunca atrapalhar:
// CEP não encontrado, servidor fora do ar ou app rodando sem backend dão todos
// no mesmo resultado, `null`, e o endereço continua editável à mão.

import { apiFetch, TEM_BACKEND } from './http'

export interface CepEncontrado {
  cep: string
  rua: string
  bairro: string
  cidade: string
  uf: string
}

const cache = new Map<string, CepEncontrado | null>()

/** O endereço de um CEP, ou `null` quando ele não existe ou a consulta falhou. */
export async function buscarCep(bruto: string): Promise<CepEncontrado | null> {
  const digitos = (bruto ?? '').replace(/\D/g, '')
  if (digitos.length !== 8 || !TEM_BACKEND) return null
  // Apagar e redigitar o último número é o gesto mais comum deste campo; sem
  // isto ele viraria uma consulta nova a cada ida e volta.
  if (cache.has(digitos)) return cache.get(digitos) ?? null
  try {
    const res = await apiFetch(`/api/geo/cep/${digitos}`)
    const achado = res.ok ? ((await res.json()) as CepEncontrado) : null
    cache.set(digitos, achado)
    return achado
  } catch {
    // Falha de rede NÃO é guardada: a próxima tentativa tem de poder dar certo.
    return null
  }
}
