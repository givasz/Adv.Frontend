// O CAMINHO ATÉ O WHATSAPP — ponto único de montagem e de abertura do link.
//
// O WhatsApp é a porta de saída de quase tudo o que este produto faz: o botão do
// perfil, o formulário de agendamento, o assistente virtual e o assistente do
// escritório. Nenhum deles guarda a mensagem: ela é montada no aparelho de quem
// visita e sai dali direto para o WhatsApp do advogado (ver PrivacyNote e a
// Política de Privacidade). Se o link falha, não há registro em lugar nenhum, não
// há e-mail de aviso e não há como o advogado saber que alguém tentou falar com
// ele. A falha é silenciosa dos dois lados — e por isso vale um arquivo próprio.
//
// Duas coisas quebravam esse caminho, e as duas estavam espalhadas por quatro
// telas que montavam a URL à mão.
//
// ---------------------------------------------------------------------------
// 1. O NÚMERO COM PONTUAÇÃO
//
// `wa.me/<numero>` aceita SÓ DÍGITOS, com DDI e sem "+". O campo do editor já
// grava assim, mas ele não é a única porta: o servidor aceita telefone com
// pontuação (`safePhone` no backend valida formato, não formato de link), e o
// mesmo campo existe no cadastro do escritório. Bastava um `+55 (11) 99000-0000`
// gravado por qualquer caminho para a URL virar
//
//     https://wa.me/+55 (11) 99000-0000?text=...
//
// que não abre conversa nenhuma — em navegador nenhum. O botão continuava lá,
// bonito e clicável, e a mensagem simplesmente não chegava.
//
// ---------------------------------------------------------------------------
// 2. O `target="_blank"` DENTRO DE NAVEGADOR EMBUTIDO
//
// Perfil de advogado é link de bio: ele é aberto de dentro do Instagram, do
// Facebook, do LinkedIn. Esses aplicativos abrem páginas num navegador embutido
// (webview) que NÃO TEM ABAS — e, sem abas, `target="_blank"` costuma ser
// descartado sem erro, sem aviso e sem nada acontecer na tela. Quem tocou no
// botão conclui que o perfil está quebrado.
//
// A correção não é detectar aplicativo por aplicativo pela identificação do
// navegador (lista que envelhece e erra). É perguntar o que de fato importa:
// isto é um dedo numa tela pequena? Se for, a aba nova não serve para nada, mesmo
// num navegador que a suporte — o WhatsApp abre POR CIMA do navegador e o "voltar"
// devolve a pessoa ao perfil. Aba nova no celular só deixa uma aba órfã em branco
// para trás. No computador ela continua fazendo sentido: preserva o perfil aberto
// enquanto o WhatsApp Web carrega ao lado.

import { comoAbrirFora } from './abrirFora'
import { semMeiaLetra } from './textLimit'

/** Teto do E.164 — nenhum número de telefone do mundo passa de 15 dígitos. */
const MAX_DIGITOS = 15
/** Piso: DDD + número, o menor telefone brasileiro utilizável (10 dígitos). */
const MIN_DIGITOS = 10
/** DDI do Brasil. Este produto é brasileiro por definição — OAB, CNA, CFOAB. */
const DDI_BR = '55'

/**
 * Reduz qualquer coisa que alguém tenha gravado como telefone ao formato que o
 * `wa.me` entende: dígitos, com DDI, sem "+".
 *
 * Devolve `''` quando não há como formar um número — e devolver vazio é o ponto:
 * é o que faz o botão sumir em vez de virar um link morto.
 */
export function numeroWhatsapp(bruto: string | undefined | null): string {
  let digitos = String(bruto ?? '').replace(/\D/g, '')
  if (!digitos) return ''

  // "0" de operadora colado na frente ("0 11 9...") é hábito de quem disca de
  // telefone fixo, e sobra na hora de copiar e colar.
  digitos = digitos.replace(/^0+/, '')

  // Dez ou onze dígitos é um número brasileiro SEM o DDI: "11987654321". Sem o
  // 55 na frente o link não abre, e o campo do editor nem sempre é a porta por
  // onde o número entrou (o escritório tem campo próprio, e a API aceita).
  if (digitos.length === MIN_DIGITOS || digitos.length === MIN_DIGITOS + 1) {
    digitos = DDI_BR + digitos
  }

  if (digitos.length < MIN_DIGITOS || digitos.length > MAX_DIGITOS) return ''
  return digitos
}

/**
 * O link pronto, com a mensagem já embutida — ou `undefined` quando o número não
 * serve. Quem chama trata o `undefined` escondendo ou desabilitando o botão:
 * melhor não oferecer do que oferecer e não funcionar.
 *
 * A mensagem passa por `encodeURIComponent`, que é o que transforma as quebras de
 * linha em `%0A`. O WhatsApp preserva as quebras, e é delas que a mensagem do
 * assistente depende para chegar legível.
 */
export function whatsappHref(
  numero: string | undefined | null,
  mensagem?: string,
): string | undefined {
  const wa = numeroWhatsapp(numero)
  if (!wa) return undefined
  // Meia letra de emoji (texto cortado no meio) faz o encodeURIComponent lançar
  // URIError e derrubar a tela que monta o link.
  const texto = semMeiaLetra(mensagem ?? '').trim()
  return `https://wa.me/${wa}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

/**
 * Como abrir o link do WhatsApp: os atributos prontos para espalhar na âncora.
 *
 * No celular, MESMA ABA — o WhatsApp abre por cima e o "voltar" devolve ao
 * perfil. É também o único jeito que funciona dentro do navegador embutido do
 * Instagram e do Facebook, que descarta `_blank` em silêncio.
 *
 * No computador, aba nova: o perfil continua aberto atrás do WhatsApp Web.
 *
 * É a mesma regra de todo link que sai do site (ver abrirFora.ts) — o nome
 * próprio fica porque é o caminho mais importante de todos.
 */
export function comoAbrirWhatsapp(): { target: '_self' | '_blank'; rel: string } {
  return comoAbrirFora()
}

/**
 * O verde do atalho flutuante de WhatsApp — o MESMO em todo tema do perfil.
 *
 * O balão do WhatsApp é um atalho para OUTRO aplicativo, e o visitante o
 * reconhece pela cor antes de ler o rótulo. Pintado com o acento do tema ele
 * virava um botão bege (Marinho), preto (Nanquim) ou sépia (Linho) que ninguém
 * identificava como WhatsApp.
 *
 * Não é o #25D366 da marca: texto branco sobre ele fica em 2:1, e o rótulo do
 * balão é texto de 14 px. Este verde, um tom mais fechado, passa em AA (4,8:1)
 * com a tinta branca e continua sendo, sem dúvida, o verde do WhatsApp. Há
 * teste que confere o contraste (whatsapp.spec.ts).
 */
export const VERDE_WHATSAPP = '#11843f'
export const TINTA_SOBRE_O_VERDE = '#ffffff'
