// O que um botão de perfil de EXEMPLO faria — dito em uma frase, sem sair daqui.
//
// Os perfis-modelo (marina-sales, guilherme-sales23) são pessoa e dados
// FICTÍCIOS, e isso inclui o WhatsApp, o e-mail e as redes. Um número inventado
// pode perfeitamente pertencer a alguém de verdade: o botão do exemplo, tocado
// por um visitante curioso na home, mandaria uma mensagem a um estranho — e as
// redes levariam a perfis que não são de ninguém nosso. Tocar e nada acontecer
// também não servia: parecia botão quebrado, na vitrine do produto.
//
// Então, num exemplo, nenhum botão sai da página. Ele diz o que faria num perfil
// de verdade e fica onde está (ver components/profile/AvisoDeExemplo).
//
// Módulo puro, sem React: a frase é testada sem navegador (exemplo.spec.ts) e
// entra no caminho crítico do perfil sem peso.
import type { Evento } from './eventos'

/**
 * O `href` de um link de exemplo, no lugar do destino real.
 *
 * Âncora vazia, e não "sem href": `<a>` sem href deixa de ser link para o
 * teclado e para o leitor de tela. E mesmo que alguém abra em nova aba ou copie
 * o endereço, o que sai é a própria página — nunca o número inventado.
 */
export const HREF_DE_EXEMPLO = '#exemplo'

/** O que o toque dispara. Os eventos do perfil, mais o link do CNA. */
export type AcaoDeExemplo = Exclude<Evento, 'view'> | 'cna'

/**
 * A frase do aviso: o que ESTE botão faria num perfil de verdade.
 *
 * `rotuloDaRede` é o nome já exibido no ladrilho ("Instagram", "LinkedIn") —
 * vem de quem chama porque o mapa de redes mora junto com os ícones, e este
 * módulo não pode importar componente.
 */
export function oQueAconteceria(
  acao: AcaoDeExemplo,
  primeiroNome: string,
  rotuloDaRede?: string,
): string {
  const de = primeiroNome.trim() ? `de ${primeiroNome.trim()}` : 'do profissional'
  const inicio = 'Num perfil de verdade, este botão'

  if (acao.startsWith('rede:')) {
    const tipo = acao.slice('rede:'.length)
    if (tipo === 'website' || tipo === 'site') return `${inicio} abriria o site ${de}.`
    const rotulo = rotuloDaRede?.trim()
    return rotulo
      ? `${inicio} abriria a página ${de} no ${rotulo}.`
      : `${inicio} abriria uma rede social ${de}.`
  }

  switch (acao) {
    case 'whatsapp':
      return `${inicio} abriria o WhatsApp ${de}, com a mensagem pronta.`
    case 'agendamento':
      return `${inicio} abriria a agenda online ${de}.`
    case 'assistente':
      return `${inicio} abriria a conversa para marcar um horário.`
    case 'email':
      return `${inicio} abriria o seu e-mail para escrever ${primeiroNome.trim() ? `a ${primeiroNome.trim()}` : 'ao profissional'}.`
    case 'endereco':
      return `${inicio} mostraria o endereço do escritório no mapa.`
    case 'cartao':
      return `${inicio} salvaria o cartão de contato ${de}.`
    case 'cna':
      return 'Num perfil de verdade, este link abriria a consulta pública do CNA, da OAB, para conferir a inscrição.'
    default:
      return `${inicio} levaria para fora desta página.`
  }
}
