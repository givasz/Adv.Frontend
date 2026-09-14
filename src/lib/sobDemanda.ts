import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

// Página sob demanda que sobrevive a um deploy.
//
// Cada build dá um nome novo a cada pedaço (ReportPage-D0FTHWYk.js) e o deploy
// apaga os antigos. Uma aba aberta ANTES do deploy continua com o código velho,
// que pede os nomes velhos — e o Netlify, sem o arquivo, responde o index.html
// (a regra do SPA) com status 200. O import falha e, sem ninguém para segurar o
// erro, o React desmonta a árvore inteira: sobra o fundo creme do body, com o
// endereço novo na barra e nada na tela. Reproduzido em produção em 13/09/2026,
// em /:slug/denunciar — com deploy quase toda hora, acontecia "às vezes".
//
// A saída é recarregar: o index.html novo aponta para os pedaços novos. Mas UMA
// vez. Se o pedaço falha de novo logo depois da recarga, não é versão velha — é
// rede fora ou deploy quebrado — e recarregar em laço só piscaria a tela. Aí o
// erro segue para a FalhaNaTela, que diz o que houve e dá um botão.
//
// A marca da última recarga fica no sessionStorage (é da aba e morre com ela).
// Sem armazenamento não há marca — e sem marca não recarregamos, porque não
// haveria como saber que já tentamos.

const MARCA = 'advocme:recarga-por-pedaco'

/** Uma falha dentro deste prazo depois da recarga já não é culpa de versão velha. */
export const JANELA_MS = 30_000

/** O que o carregador precisa do navegador — trocável nos testes. */
export interface Ambiente {
  agora(): number
  lerMarca(): number | null
  /** false = não deu para anotar (sessionStorage bloqueado) */
  gravarMarca(quando: number): boolean
  recarregar(): void
}

export function tentarRecarregar(amb: Ambiente): boolean {
  const agora = amb.agora()
  const ultima = amb.lerMarca()
  // `agora >= ultima`: um relógio que voltou não pode travar a recarga para sempre.
  if (ultima !== null && agora >= ultima && agora - ultima < JANELA_MS) return false
  if (!amb.gravarMarca(agora)) return false
  amb.recarregar()
  return true
}

export function carregarComRecarga<T>(importar: () => Promise<T>, amb: Ambiente): Promise<T> {
  return importar().catch((erro: unknown) => {
    // Recarregando, a promessa não se resolve nunca: a página vai embora, e até
    // lá fica o carregador (ou a tela anterior) — não a tela de falha piscando
    // meio segundo antes de a recarga começar.
    if (tentarRecarregar(amb)) return new Promise<T>(() => {})
    throw erro
  })
}

const NAVEGADOR: Ambiente = {
  agora: () => Date.now(),
  lerMarca() {
    try {
      const valor = Number(sessionStorage.getItem(MARCA))
      return valor > 0 ? valor : null
    } catch {
      return null
    }
  },
  gravarMarca(quando) {
    try {
      sessionStorage.setItem(MARCA, String(quando))
      return true
    } catch {
      return false
    }
  },
  recarregar: () => window.location.reload(),
}

/**
 * `React.lazy` que recarrega a página uma vez quando o pedaço sumiu num deploy.
 * Use no lugar de `lazy` — há teste que recusa `lazy(` cru em src/.
 */
export function sobDemanda<T extends ComponentType<any>>(
  importar: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  // Em desenvolvimento não recarrega: ali o import falha por erro de código, e a
  // recarga só esconderia o erro por baixo do overlay do Vite.
  return lazy(() => (import.meta.env.DEV ? importar() : carregarComRecarga(importar, NAVEGADOR)))
}
