// O aviso de que alguém tocou num botão do perfil.
//
// A tela "Quem visita você" prometia, no cartão de upsell do Pro, "botões e links
// mais clicados". Nada registrava clique nenhum: o único acontecimento gravado
// era a visita, e nem ela era lida (o contador vinha de `Profile.views`, uma
// coluna que ninguém incrementava — a tela mostrava 0 para todo mundo, sempre).
// Este arquivo é a metade que faltava.
//
// ---------------------------------------------------------------------------
// TRÊS DECISÕES QUE VALEM MAIS QUE O CÓDIGO
//
// 1. `sendBeacon`, não `fetch`. Quase todo evento daqui acontece no instante em
//    que a pessoa SAI da página: tocar no WhatsApp navega para outro aplicativo.
//    Um `fetch` disparado nesse momento é cancelado pelo navegador junto com o
//    documento, e o clique mais importante do produto seria justamente o único
//    que nunca chegaria. `sendBeacon` entrega a requisição depois da página
//    morrer — foi feito para isto.
//
// 2. Nunca atrapalha. Não devolve promessa, não lança, não espera resposta. A
//    pessoa tocou em "WhatsApp": o que ela precisa é que o WhatsApp abra. Se a
//    métrica falhar, ela falha calada.
//
// 3. Nada de visitante. Não mandamos nada além do tipo do evento — sem
//    identificador, sem cookie, sem impressão digital de navegador. Ver
//    backend/src/analytics/eventos.ts para o porquê inteiro.
// ---------------------------------------------------------------------------

import { API_BASE, TEM_BACKEND } from './http'

/** Espelha EVENTOS em backend/src/analytics/eventos.ts. */
export type Evento =
  | 'view'
  | 'whatsapp'
  | 'agendamento'
  | 'assistente'
  | 'email'
  | 'cartao'
  | 'endereco'
  | `rede:${string}`

/**
 * Registra um acontecimento no perfil público. Dispara e esquece.
 *
 * `view` NÃO passa por aqui: a visita é gravada pelo servidor quando ele monta a
 * resposta do perfil (profiles.service.ts). Contar do lado do navegador exigiria
 * confiar em quem chama — e uma rota pública que aceita "some mais uma visita"
 * é um contador que qualquer um infla.
 */
export function registrarEvento(slug: string, evento: Exclude<Evento, 'view'>): void {
  if (!TEM_BACKEND || !slug) return
  try {
    const url = `${API_BASE}/api/profiles/${encodeURIComponent(slug)}/evento`
    const corpo = JSON.stringify({ evento })

    // `sendBeacon` só existe em navegador e pode recusar (fila cheia, aba em
    // fundo); nesses casos o `fetch` com `keepalive` faz o mesmo papel.
    const enviou =
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(url, new Blob([corpo], { type: 'application/json' }))

    if (!enviou) {
      void fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: corpo,
        keepalive: true,
        // Sem cookie: é rota pública e não há nada de sessão a mandar junto.
        credentials: 'omit',
      }).catch(() => {})
    }
  } catch {
    // Métrica nunca quebra a página.
  }
}

/**
 * Handler de clique pronto para um link do perfil.
 *
 * Devolve `undefined` na PRÉVIA (editor) — lá os links não navegam e contar
 * cliques do próprio dono enquanto ele edita encheria o relatório dele com ele
 * mesmo, que é a forma mais rápida de o número perder a credibilidade.
 */
export function cliqueDoPerfil(
  slug: string | undefined,
  evento: Exclude<Evento, 'view'>,
  preview: boolean,
): ((e: React.MouseEvent) => void) | undefined {
  if (preview) return (e: React.MouseEvent) => e.preventDefault()
  if (!slug) return undefined
  return () => registrarEvento(slug, evento)
}
