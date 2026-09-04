// Autenticação de usuário (advogado) — cadastro/login por e-mail.
//
// A sessão vive num COOKIE HttpOnly escrito pelo servidor. Este arquivo nunca vê
// a credencial: ele não consegue lê-la, e é essa a intenção — um script injetado
// na página (XSS) não tem o que roubar, e fechar o navegador não desloga ninguém,
// porque o cookie tem prazo próprio e volta sozinho na próxima visita.
//
// O que fica aqui é só o retrato de quem está logado. Ao abrir o site,
// `/api/auth/me` confirma com o servidor (é a única forma de saber, já que o
// cookie é invisível para o JavaScript) e o retrato é atualizado.
//
// Espelha a camada `api.ts`: funciona em modo MOCK (contas no localStorage, sem
// backend) e em modo REAL (endpoints /api/auth/* do NestJS).
//
// Regra de produto: conta é OPCIONAL no Free (dá pra recuperar/editar depois) e
// OBRIGATÓRIA para assinar um plano pago. O gate vive na UI (ver `requireAccount`).

import { useSyncExternalStore } from 'react'
import { apiFetch, setCsrfToken, TEM_BACKEND } from './http'
import { passwordProblem } from './passwordStrength'
import { TERMS_VERSION } from './legalIdentity'

export interface AuthUser {
  id: string
  email: string
  name?: string
  /** plano do perfil vinculado (informativo) */
  plan?: string
  /**
   * Os Termos mudaram desde o aceite desta conta — ou nunca houve aceite.
   *
   * Quem responde é o servidor, em /login, /signup e /me. A tela NÃO calcula
   * isto comparando versões: a versão vigente é decisão de quem grava, e um
   * front desatualizado (aba aberta desde ontem, cache de service worker) diria
   * "está tudo em dia" sobre um documento que já mudou.
   */
  termsPending?: boolean
  /** Versão dos Termos aceita por esta conta — vazia quando nunca houve aceite. */
  termsVersion?: string
}

export interface Session {
  user: AuthUser
  /** epoch ms — quando a sessão expira (informativo; quem manda é o cookie) */
  expiresAt?: number
  /** o login pediu para ser lembrado? */
  remember?: boolean
}

// Retrato de quem está logado — nome, e-mail, plano. NÃO é credencial: serve
// para a interface já abrir com o cabeçalho certo, em vez de piscar "deslogado"
// enquanto o servidor responde. Quem decide se a sessão vale é o cookie.
const USER_KEY = 'advocme:user'
const ACCOUNTS_KEY = 'advocme:accounts' // só no modo mock

// Modo real (backend) ou mock (localStorage) — a resposta vem de `http.ts`, que
// é a fonte única. Em dev sem backend configurado, mock.
const useReal = TEM_BACKEND

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---- Store reativo ----------------------------------------------------------

function lerRetrato(): Session | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    return s?.user?.id && s.user.email ? s : null
  } catch {
    return null
  }
}

/**
 * O que a interface sabe sobre a sessão AGORA.
 *
 * `conferindo` existe porque o retrato do localStorage é um palpite: quem manda é
 * o cookie, e saber se ele ainda vale custa uma ida ao servidor. Sem esse estado,
 * toda tela protegida decidia no primeiro render — antes da resposta — e mandava
 * para o login quem estava perfeitamente logado (ou, pior, deixava entrar quem
 * não estava mais e caía num perfil em branco).
 */
export interface EstadoSessao {
  session: Session | null
  /** a conferência inicial com o servidor ainda não terminou */
  conferindo: boolean
}

/**
 * Há algum INDÍCIO de sessão neste navegador?
 *
 * O cookie da sessão é HttpOnly (invisível daqui), mas ele nunca anda sozinho: o
 * servidor grava junto o cookie anti-CSRF (`advocme_csrf`), que é legível pelo
 * JS de propósito — e os dois nascem no login, renovam juntos e morrem juntos no
 * logout (backend/src/auth/session.service.ts). A presença dele, ou do retrato
 * local, é o bastante para valer a pena perguntar ao servidor.
 *
 * Sem indício nenhum, NÃO perguntamos: o visitante anônimo de um minisite — o
 * caso que mais importa para a velocidade — deixava um `/api/auth/me` competir
 * em banda com o carregamento do próprio perfil, para ouvir um 401 que já se
 * sabia. O custo do raro falso negativo (cookie CSRF apagado à mão com a sessão
 * viva) é a pessoa entrar de novo — e aí os dois cookies renascem juntos.
 */
function temDicaDeSessao(session: Session | null): boolean {
  if (session) return true
  try {
    // Com e sem o prefixo __Host- — o nome efetivo depende dos atributos com que
    // o backend gravou (ver backend/src/auth/cookies.ts, cookieName).
    return /(?:^|;\s*)(?:__Host-)?advocme_csrf=/.test(document.cookie)
  } catch {
    return false
  }
}

// Um objeto só, trocado por inteiro a cada mudança: `useSyncExternalStore` compara
// por identidade, e devolver um objeto novo a cada leitura entraria em laço.
let estado: EstadoSessao = (() => {
  const session = lerRetrato()
  return { session, conferindo: useReal && temDicaDeSessao(session) }
})()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function snapshot(): EstadoSessao {
  return estado
}

function setEstado(patch: Partial<EstadoSessao>) {
  estado = { ...estado, ...patch }
  emit()
}

function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(USER_KEY, JSON.stringify(s))
    else localStorage.removeItem(USER_KEY)
  } catch {
    /* armazenamento indisponível (aba privativa) — a sessão segue no cookie */
  }
  setEstado({ session: s })
}

/**
 * Rascunhos guardados neste navegador. No modo REAL eles são só um cache do que
 * está no servidor — e cache de conta alheia é vazamento: sem limpar ao sair, o
 * próximo advogado a criar conta no mesmo computador abria o editor com pedaços
 * do perfil de quem usou antes.
 *
 * No modo mock é o contrário: o rascunho É o perfil, e apagá-lo ao sair jogaria
 * fora o trabalho da pessoa. Por isso a limpeza só acontece no modo real.
 */
const CHAVES_DE_RASCUNHO = ['advocme:profile:draft', 'advocme:firm:draft', 'advocme:trust:last']

function limparRascunhosLocais(): void {
  if (!useReal) return
  for (const chave of CHAVES_DE_RASCUNHO) {
    try {
      localStorage.removeItem(chave)
    } catch {
      /* armazenamento indisponível */
    }
  }
}

/**
 * Esquece quem estava logado NESTE navegador, sem falar com o servidor.
 *
 * Para quando não há mais sessão a encerrar do outro lado: a conta foi excluída,
 * ou o cookie venceu e o servidor respondeu 401. Precisa passar por aqui (e não
 * por um `localStorage.removeItem` solto) porque é o store reativo que faz o
 * cabeçalho parar de mostrar a pessoa como logada — e é ele que faz as telas
 * protegidas devolverem a pessoa ao login em vez de desenharem um perfil vazio.
 */
export function esquecerSessaoLocal(): void {
  setCsrfToken(null)
  limparRascunhosLocais()
  setEstado({ session: null, conferindo: false })
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    /* armazenamento indisponível */
  }
}

/** Sessão atual (não reativa) — para uso fora de componentes (ex.: api.ts). */
export function getSession(): Session | null {
  return estado.session
}

export function isAuthenticated(): boolean {
  return !!estado.session
}

/** A conferência inicial com o servidor já terminou? */
export function sessaoConferida(): boolean {
  return !estado.conferindo
}

// ---- Conferência com o servidor ---------------------------------------------

interface RespostaSessao {
  user: AuthUser
  expiresAt?: number
  csrfToken?: string
  remember?: boolean
}

function aplicar(dados: RespostaSessao): Session {
  setCsrfToken(dados.csrfToken ?? null)
  const sessao: Session = {
    user: dados.user,
    expiresAt: dados.expiresAt,
    remember: dados.remember,
  }
  setSession(sessao)
  return sessao
}

/**
 * A frase que a pessoa lê quando o cadastro/entrada é recusado.
 *
 * O Nest recusa com um JSON (`{"message":"E-mail inválido.","statusCode":400}`) e
 * o texto cru desse corpo estava indo direto para a tela — o advogado via a
 * chaveta e o código de status no lugar do motivo.
 */
function mensagemDeErro(corpo: string, padrao: string): string {
  const texto = corpo.trim()
  if (!texto) return padrao
  try {
    const dados = JSON.parse(texto) as { message?: string | string[] }
    const msg = Array.isArray(dados.message) ? dados.message[0] : dados.message
    return msg || padrao
  } catch {
    return texto.startsWith('<') ? padrao : texto
  }
}

/**
 * O cookie da sessão realmente ficou guardado?
 *
 * Entrar responde 200 e devolve a pessoa — mas quem autentica as chamadas
 * seguintes é o cookie, e ele pode simplesmente não ser aceito: com o site num
 * domínio e a API em outro, o cookie é "de terceiros", e o Safari o descarta
 * sempre, o Chrome em parte das configurações. O sintoma era cruel — a pessoa
 * entrava, via o próprio nome no cabeçalho e caía num perfil vazio, como se a
 * conta recém-criada não existisse, porque toda chamada seguinte chegava
 * deslogada.
 *
 * Uma consulta a /auth/me logo depois de entrar transforma isso num aviso claro.
 * Falha de rede aqui não derruba o login: o servidor já disse que a conta é boa.
 */
async function confirmarCookie(): Promise<void> {
  let res: Response
  try {
    res = await apiFetch('/api/auth/me')
  } catch {
    return
  }
  if (res.ok || res.status !== 401) return
  esquecerSessaoLocal()
  throw new Error(
    'Entramos na sua conta, mas seu navegador não guardou a sessão. ' +
      'Isso costuma ser bloqueio de cookies: libere os cookies para este site ' +
      '(ou desative a navegação anônima/proteção contra rastreamento) e tente de novo.',
  )
}

/**
 * Pergunta ao servidor quem está logado neste navegador.
 *
 * É o que faz a sessão sobreviver a fechar e reabrir o navegador: o cookie volta
 * sozinho na primeira chamada e o servidor responde com a pessoa. Também é aqui
 * que a renovação deslizante acontece do outro lado — usar o site empurra o prazo
 * para a frente.
 *
 * Uma chamada por carregamento de página. Não vale a pena evitá-la: é a única
 * forma de saber, e o servidor responde a partir de um cache curto.
 */
export async function revalidarSessao(): Promise<Session | null> {
  if (!useReal) {
    setEstado({ conferindo: false })
    return estado.session
  }
  try {
    const res = await apiFetch('/api/auth/me')
    if (res.ok) {
      const dados = (await res.json()) as RespostaSessao
      const sessao = aplicar(dados)
      setEstado({ conferindo: false })
      return sessao
    }
    // 401 = não há sessão. Qualquer outra falha é do servidor, não da sessão:
    // derrubar o retrato ali seria deslogar alguém por causa de um deploy.
    if (res.status === 401) {
      esquecerSessaoLocal()
      return null
    }
  } catch {
    /* rede fora — mantém o retrato e tenta de novo na próxima */
  }
  setEstado({ conferindo: false })
  return estado.session
}

// A conferência começa junto com o app. Sem `await`: a interface abre com o
// retrato guardado e se corrige em seguida, se for o caso. Sem indício de
// sessão (`conferindo` já nasceu false), não há o que conferir — o visitante
// anônimo não gasta uma ida ao servidor para ouvir que é anônimo.
const conferenciaInicial: Promise<Session | null> = estado.conferindo
  ? revalidarSessao()
  : Promise.resolve(estado.session)

// O ponto cego da dica: o cookie de sessão (HttpOnly, invisível daqui) pode
// estar VIVO com a dica ilegível — limpeza de dados que levou o localStorage e
// poupou cookies, ou o modo VITE_API_DIRECT, em que o cookie CSRF mora no
// domínio da API e esta página nunca o lê. Nesses casos a pessoa apareceria
// deslogada para sempre. A conferência TARDIA cobre isso sem devolver o custo
// ao visitante anônimo: sai bem depois da primeira pintura, fora da disputa de
// banda com o carregamento do perfil — e, se achar uma sessão, o retrato se
// corrige sozinho (o /entrar, inclusive, volta para o destino ao vê-la surgir).
if (useReal && !estado.conferindo && typeof window !== 'undefined') {
  window.setTimeout(() => {
    revalidarSessao().catch(() => undefined)
  }, 2000)
}

/**
 * Espera a conferência inicial terminar.
 *
 * Quem precisa disso é a camada de dados (api.ts): perguntar "tem sessão?" no
 * primeiro instante do app respondia NÃO para todo mundo — a resposta do servidor
 * ainda estava no ar — e o editor caía no rascunho local de um advogado que, na
 * verdade, estava logado. Era assim que um perfil cheio abria em branco, e que o
 * que se digitava depois ia parar no navegador em vez de na conta.
 */
export function aguardarSessao(): Promise<Session | null> {
  return conferenciaInicial
}

// ---- Mock (localStorage) ----------------------------------------------------

interface MockAccount extends AuthUser {
  password: string
}

function loadAccounts(): MockAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function saveAccounts(list: MockAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
}

function mockSession(user: AuthUser, remember: boolean): Session {
  return { user, remember, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 }
}

// ---- API pública ------------------------------------------------------------

// Validação do CADASTRO. O login não passa por aqui de propósito: endurecer a
// regra não pode trancar quem já tem conta com a senha antiga.
function validate(email: string, password: string) {
  if (!EMAIL_RE.test(email)) throw new Error('Informe um e-mail válido.')
  const problema = passwordProblem(password, email)
  if (problema) throw new Error(problema)
}

/**
 * @param aceitouTermos  A caixa marcada na tela de cadastro. Viaja como campo
 *   próprio, e não como "se chegou aqui é porque aceitou": o servidor recusa o
 *   cadastro sem ela (ver backend AuthService.signup), e é essa recusa — não a
 *   caixa — que sustenta a afirmação de que toda conta aceitou os Termos.
 */
export async function signup(
  emailRaw: string,
  password: string,
  name?: string,
  remember = true,
  aceitouTermos = false,
): Promise<Session> {
  const email = emailRaw.trim().toLowerCase()
  validate(email, password)
  if (!aceitouTermos) {
    throw new Error('Aceite os Termos de Uso e a Política de Privacidade para criar a conta.')
  }
  const cleanName = name?.trim() || undefined

  if (useReal) {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: cleanName, remember, aceitouTermos: true }),
    })
    if (!res.ok) throw new Error(mensagemDeErro(await res.text().catch(() => ''), 'Não foi possível criar a conta.'))
    const sessao = aplicar((await res.json()) as RespostaSessao)
    await confirmarCookie()
    return sessao
  }

  const accounts = loadAccounts()
  if (accounts.some((a) => a.email === email)) {
    throw new Error('Já existe uma conta com este e-mail. Faça login.')
  }
  const user: AuthUser = {
    id: `u-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    email,
    name: cleanName,
    // No modo mock não há servidor para carimbar nada — mas o aceite acabou de
    // ser dado nesta tela, então a sessão nasce em dia. Deixar `termsPending`
    // ligado aqui faria o desenvolvimento local pedir reaceite a cada cadastro.
    termsVersion: TERMS_VERSION,
    termsPending: false,
  }
  saveAccounts([...accounts, { ...user, password }])
  const session = mockSession(user, remember)
  setSession(session)
  return session
}

export async function login(
  emailRaw: string,
  password: string,
  remember = true,
): Promise<Session> {
  const email = emailRaw.trim().toLowerCase()

  if (useReal) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    })
    if (!res.ok) throw new Error(mensagemDeErro(await res.text().catch(() => ''), 'E-mail ou senha incorretos.'))
    const sessao = aplicar((await res.json()) as RespostaSessao)
    await confirmarCookie()
    return sessao
  }

  const account = loadAccounts().find((a) => a.email === email)
  if (!account || account.password !== password) {
    throw new Error('E-mail ou senha incorretos.')
  }
  const { password: _pw, ...user } = account
  const session = mockSession(user, remember)
  setSession(session)
  return session
}

/**
 * Sair. Avisa o servidor ANTES de esquecer quem estava logado: é lá que a sessão
 * é apagada e é de lá que vem a ordem de descartar o cookie. Sem esse aviso, sair
 * limparia só a aparência — o cookie continuaria valendo até vencer.
 *
 * A limpeza local acontece de qualquer jeito: se a rede falhar, a pessoa continua
 * saindo daqui.
 */
/**
 * Registra o aceite da versão nova dos Termos para quem já tem conta.
 *
 * Não manda a versão: quem carimba é o servidor. Ao voltar, atualiza o retrato
 * local — senão a faixa de reaceite continuaria na tela até a próxima visita ao
 * /auth/me, e a pessoa clicaria de novo achando que não funcionou.
 */
export async function aceitarTermos(): Promise<void> {
  if (!useReal) {
    marcarAceiteLocal()
    return
  }
  const res = await apiFetch('/api/auth/aceitar-termos', { method: 'POST' })
  if (!res.ok) {
    throw new Error(
      mensagemDeErro(await res.text().catch(() => ''), 'Não foi possível registrar o aceite.'),
    )
  }
  const { termsVersion } = (await res.json()) as { termsVersion?: string }
  marcarAceiteLocal(termsVersion)
}

function marcarAceiteLocal(versao = TERMS_VERSION) {
  const atual = estado.session
  if (!atual) return
  setSession({ ...atual, user: { ...atual.user, termsVersion: versao, termsPending: false } })
}

export async function logout(): Promise<void> {
  const eraReal = useReal && !!estado.session
  // Sair apaga também o rascunho guardado neste navegador (só no modo real, em
  // que ele é cache do servidor): quem entrar depois neste computador começa do
  // zero, e não do perfil de quem saiu.
  esquecerSessaoLocal()
  if (!eraReal) return
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } catch {
    /* rede fora — o cookie expira sozinho no prazo */
  }
}

/**
 * Encerra a sessão de TODOS os aparelhos. Para quando o celular some ou a senha
 * vazou: derruba o que estiver aberto em qualquer lugar, e não só aqui.
 */
export async function logoutEverywhere(): Promise<number> {
  if (!useReal || !estado.session) {
    esquecerSessaoLocal()
    return 0
  }
  const res = await apiFetch('/api/auth/logout-all', { method: 'POST' })
  esquecerSessaoLocal()
  if (!res.ok) throw new Error('Não foi possível encerrar as sessões.')
  const { encerradas } = (await res.json()) as { encerradas: number }
  return encerradas
}

/** Quantos aparelhos estão logados nesta conta agora. */
export async function countOpenSessions(): Promise<number | null> {
  if (!useReal || !estado.session) return null
  try {
    const res = await apiFetch('/api/account/sessions')
    if (!res.ok) return null
    const { abertas } = (await res.json()) as { abertas: number }
    return abertas
  } catch {
    return null
  }
}

// ---- Hook -------------------------------------------------------------------

export function useAuth() {
  const { session, conferindo } = useSyncExternalStore(subscribe, snapshot, snapshot)
  return {
    session,
    user: session?.user ?? null,
    isAuthed: !!session,
    /**
     * Ainda estamos perguntando ao servidor quem está logado. Quem decide acesso
     * (ver RequireAuth em App.tsx) tem de ESPERAR nesse estado — decidir aqui é
     * decidir no escuro, e o erro cai sempre para o lado de expulsar quem entrou.
     */
    conferindo,
    signup,
    login,
    logout,
    logoutEverywhere,
    /**
     * Os Termos mudaram e esta conta ainda não aceitou a versão nova.
     *
     * `false` enquanto a conferência está em curso: mostrar o pedido de aceite
     * antes de /auth/me responder faria a faixa piscar em toda navegação.
     */
    termsPending: !conferindo && !!session?.user?.termsPending,
  }
}
