// PIXEL DA META — medição dos anúncios do próprio advoc.me.
//
// O código que a Meta manda colar no <head> não serve aqui, por dois motivos:
//
//   1. O CSP (netlify.toml, `script-src 'self'`) bloqueia <script> inline em
//      silêncio. Colado no index.html, o pixel simplesmente não rodaria.
//   2. O index.html é o MESMO arquivo de todo perfil de advogado (a borda só troca
//      as meta tags). Colado lá, o pixel mandaria à Meta cada visita de quem
//      procura um advogado — dado de terceiro que orbita o sigilo, que a Política
//      de Privacidade promete não coletar.
//
// Por isso o script só é buscado nas ROTAS_COM_PIXEL. Uma vez carregado ele fica
// na memória da aba, mas não envia nada sozinho: o rastreio automático de troca
// de rota e a coleta automática de botões e formulários vão desligados abaixo, e
// o PageView só é disparado pelo PixelDaMeta nas rotas da lista.
//
// AVISO, NÃO PEDIDO (decisão do dono do produto em 07/10/2026). Até então o
// pixel esperava o "Aceitar"; quem ignorava o aviso — a maioria — não era
// medido, e os anúncios ficavam sem número. Agora ele carrega na hora nas rotas
// da lista, com base no legítimo interesse (LGPD, art. 7º, IX), e o aviso
// informa e oferece "Recusar". Recusar é oposição: o pixel para de enviar e o
// cookie _fbp é apagado. O guia de cookies da ANPD prefere consentimento para
// cookie de publicidade; a escolha foi feita sabendo disso, e as Políticas de
// Cookies e de Privacidade descrevem exatamente este comportamento.

export const META_PIXEL_ID = '978105135326195'

/**
 * Onde o pixel pode medir: as páginas de venda e de entrada da plataforma.
 * NUNCA perfil (`/:slug`), escritório, agendamento ou denúncia — é a página do
 * advogado e o visitante dela não é cliente nosso. Também fora: entrar (quem já
 * é cliente) e o checkout (ninguém de fora lendo a página onde se digita cartão).
 */
export const ROTAS_COM_PIXEL = ['/', '/criar-conta', '/comecar', '/planos'] as const

export function rotaComPixel(pathname: string): boolean {
  const limpo = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return (ROTAS_COM_PIXEL as readonly string[]).includes(limpo)
}

// ---------------------------------------------------------------------------
// Consentimento — guardado só neste navegador. Sem escolha = sem pixel.

const CHAVE = 'advocme_cookies_publicidade'
export type Escolha = 'aceito' | 'recusado'

export function escolhaDeCookies(): Escolha | null {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'aceito' || v === 'recusado' ? v : null
  } catch {
    return null
  }
}

const ouvintes = new Set<() => void>()

export function ouvirEscolha(fn: () => void): () => void {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export function gravarEscolha(escolha: Escolha) {
  try {
    localStorage.setItem(CHAVE, escolha)
  } catch {
    // Navegador sem armazenamento: a escolha vale só para esta aba.
  }
  if (typeof window !== 'undefined') {
    if (escolha === 'recusado') revogar()
    else window.fbq?.('consent', 'grant')
  }
  ouvintes.forEach((fn) => fn())
}

// ---------------------------------------------------------------------------
// O pixel em si — o mesmo trecho da Meta, como módulo e não como inline.

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  push: Fbq
  loaded: boolean
  version: string
  disablePushState?: boolean
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

let iniciado = false

function carregar() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true

  if (!window.fbq) {
    const n = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args)
      else n.queue.push(args)
    } as Fbq
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    window.fbq = n
    if (!window._fbq) window._fbq = n

    const s = document.createElement('script')
    s.async = true
    s.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(s)
  }

  const fbq = window.fbq!
  // Numa SPA a Meta conta sozinha cada pushState — inclusive a ida da home para
  // um perfil de exemplo. Desligado: quem decide o que é visita é rotaComPixel.
  fbq.disablePushState = true
  // Sem coleta automática de cliques, rótulos de botão e campos de formulário.
  fbq('set', 'autoConfig', false, META_PIXEL_ID)
  fbq('consent', 'grant')
  fbq('init', META_PIXEL_ID)
}

// A última página contada. Trocar a escolha refaz o efeito do PixelDaMeta na
// MESMA página — e o "Entendi" contava a home duas vezes em menos de 2 s, o que
// a extensão de diagnóstico acusou como evento duplicado. Uma página só conta
// de novo quando a pessoa sai dela e volta.
let ultimaContada: string | null = null

function revogar() {
  ultimaContada = null
  window.fbq?.('consent', 'revoke')
  // O _fbp é gravado pela Meta no domínio do site (com e sem o ponto inicial,
  // conforme o navegador); apaga nas formas possíveis.
  if (typeof document === 'undefined') return
  const dominio = location.hostname.replace(/^www\./, '')
  for (const d of ['', `; domain=${dominio}`, `; domain=.${dominio}`]) {
    document.cookie = `_fbp=; Max-Age=0; path=/${d}`
  }
}

/** Registra a visita da página atual — nas rotas da lista, salvo recusa. */
export function registrarVisita(pathname: string) {
  if (escolhaDeCookies() === 'recusado') return
  if (!rotaComPixel(pathname)) {
    ultimaContada = null
    return
  }
  if (pathname === ultimaContada) return
  ultimaContada = pathname
  carregar()
  // `trackSingle`, e não `track`: com o disablePushState ligado, o fbevents
  // descarta todo PageView de `track` depois do primeiro da carga — a segunda
  // página visitada na mesma aba sumia (conferido no navegador em 07/10/2026).
  window.fbq?.('trackSingle', META_PIXEL_ID, 'PageView')
}

// ---------------------------------------------------------------------------
// Conversões — os eventos padrão da Meta pelos quais a campanha otimiza.
//
// Só três momentos, todos da conta de quem está se tornando cliente — nunca de
// um visitante de perfil:
//   • CompleteRegistration — a conta foi criada (e-mail e senha, ou Google);
//   • InitiateCheckout     — abriu o formulário de assinatura de um plano;
//   • Subscribe            — o pagamento foi confirmado e o plano abriu.
// Vai só o nome do evento e, na assinatura, o valor do plano em reais. Nada de
// e-mail, nome ou identificador: a correspondência avançada fica desligada.

export type Conversao = 'CompleteRegistration' | 'InitiateCheckout' | 'Subscribe'

export function registrarConversao(
  evento: Conversao,
  {
    valor,
    soSeJaCarregado = false,
  }: {
    /** Valor mensal do plano, em reais. */
    valor?: number
    /**
     * Não busca o script se ele ainda não veio. É o caso da tela do cartão: o
     * pixel não é carregado do zero onde se digita número de cartão; se a pessoa
     * chegou de uma página de venda, ele já está na aba e o evento sai.
     */
    soSeJaCarregado?: boolean
  } = {},
) {
  if (escolhaDeCookies() === 'recusado') return
  if (soSeJaCarregado && !iniciado) return
  carregar()
  if (valor === undefined) window.fbq?.('trackSingle', META_PIXEL_ID, evento)
  else window.fbq?.('trackSingle', META_PIXEL_ID, evento, { value: valor, currency: 'BRL' })
}
