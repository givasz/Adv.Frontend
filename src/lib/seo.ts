// SEO do perfil aplicado NO NAVEGADOR — a segunda metade da dupla.
//
// A primeira metade é lib/ogTags.ts, que monta as mesmas tags como HTML e é
// servida pela edge function ANTES da página existir (netlify/edge-functions/
// perfil.ts). Aquela é a que os robôs de prévia leem; esta é a que mantém o
// <head> correto enquanto a pessoa navega dentro do app, onde não há recarga de
// página e portanto nenhuma nova visita ao servidor.
//
// As duas escrevem as MESMAS tags, com o MESMO texto, porque a lista sai de uma
// função só (`tagsDoPerfil`). Antes de existir a edge function, este era o único
// lugar — e por isso era o único lugar onde o texto podia estar certo sem que
// ninguém percebesse que a prévia estava errada.
//
// O texto gerado é FACTUAL e informativo ("Advogada de Direito de Família em São
// Paulo/SP") — descrição geográfica/de área é permitida pelo Prov. 205/2021. Não
// injetamos superlativos, promessas nem CTA.

import type { Profile } from './types'
import {
  MANAGED,
  seoDescription,
  seoTitle,
  tagsDoPerfil,
  type TagDeCabecalho,
} from './ogTags'

export { seoTitle, seoDescription }

/**
 * Aplica o SEO do perfil ao <head> e devolve uma função de limpeza (para o
 * useEffect do React remover ao trocar de perfil).
 *
 * `meta` e `link` são ATUALIZADOS quando já existem — inclusive os que não são
 * nossos. É o caso da `<meta name="description">` estática do index.html: criar
 * outra ao lado deixaria a página com duas descrições concorrentes, e o buscador
 * escolheria uma das duas sem critério que possamos prever. O mesmo vale para as
 * tags que a edge function já serviu no HTML: elas carregam a marca
 * `data-advocme-seo`, então são encontradas e reaproveitadas em vez de somarem.
 */
export function applyProfileSeo(p: Profile, url = window.location.href): () => void {
  const criadas: Element[] = []
  const restaurar: (() => void)[] = []

  for (const tag of tagsDoPerfil(p, url, window.location.origin)) {
    aplicar(tag, criadas, restaurar)
  }

  return () => {
    // Os JSON-LD e o que criamos do zero saem; o que existia antes volta ao valor
    // anterior. Sair de um perfil não pode deixar a página seguinte descrevendo o
    // advogado que a pessoa acabou de fechar.
    criadas.forEach((n) => n.remove())
    restaurar.forEach((f) => f())
  }
}

function aplicar(tag: TagDeCabecalho, criadas: Element[], restaurar: (() => void)[]) {
  if (tag.tipo === 'title') {
    const anterior = document.title
    document.title = tag.texto
    restaurar.push(() => {
      document.title = anterior
    })
    return
  }

  if (tag.tipo === 'ld') {
    // Dado estruturado é sempre nosso e sempre novo — não há o que atualizar.
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.setAttribute(MANAGED, '')
    el.textContent = JSON.stringify(tag.dados)
    document.head.appendChild(el)
    criadas.push(el)
    return
  }

  const seletor =
    tag.tipo === 'meta' ? `meta[${tag.attr}="${tag.chave}"]` : `link[rel="${tag.rel}"]`
  const valor = tag.tipo === 'meta' ? tag.valor : tag.href
  const campo = tag.tipo === 'meta' ? 'content' : 'href'

  const existente = document.head.querySelector(seletor)
  if (existente) {
    const anterior = existente.getAttribute(campo)
    existente.setAttribute(campo, valor)
    restaurar.push(() => {
      if (anterior === null) existente.removeAttribute(campo)
      else existente.setAttribute(campo, anterior)
    })
    return
  }

  const el = document.createElement(tag.tipo)
  if (tag.tipo === 'meta') el.setAttribute(tag.attr, tag.chave)
  else el.setAttribute('rel', tag.rel)
  el.setAttribute(campo, valor)
  el.setAttribute(MANAGED, '')
  document.head.appendChild(el)
  criadas.push(el)
}
