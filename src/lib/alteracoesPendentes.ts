// Cópia de segurança do que NÃO conseguiu ser salvo.
//
// O editor grava no servidor com debounce. Quando a gravação falha — a sessão
// caiu, a rede sumiu, o servidor recusou — o texto só existe na memória da
// tela, e qualquer coisa que a derrube (o login para onde a sessão caída manda,
// um recarregar, o navegador matando a aba em segundo plano) o leva junto.
//
// Aqui ele ganha um lugar: o sessionStorage. É de propósito o sessionStorage e
// não o localStorage — morre com a aba, nunca aparece em outra aba nem em
// outro aparelho, e não vira uma segunda "fonte" do perfil competindo com o
// servidor (a regra da casa: com conta, o perfil vem só do servidor). É só o
// bilhete "isto aqui ainda não foi gravado", que o editor oferece restaurar na
// próxima abertura e apaga assim que uma gravação dá certo.

export interface Pendente<T> {
  dados: T
  /** quando foi guardado (Date.now()) */
  quando: number
}

const PREFIXO = 'advocme:pendente:'

/** O bastante de um Storage para ler, gravar e apagar — o teste passa um Map. */
export type Armazem = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function armazemPadrao(): Armazem | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    // Acesso negado (privacidade, cookies bloqueados): sem cópia, sem quebrar.
    return null
  }
}

export function guardarPendente<T>(chave: string, dados: T, store: Armazem | null = armazemPadrao()): void {
  try {
    store?.setItem(PREFIXO + chave, JSON.stringify({ dados, quando: Date.now() } satisfies Pendente<T>))
  } catch {
    /* cota cheia ou acesso negado: a cópia é conforto, não requisito */
  }
}

export function lerPendente<T>(chave: string, store: Armazem | null = armazemPadrao()): Pendente<T> | null {
  try {
    const bruto = store?.getItem(PREFIXO + chave)
    if (!bruto) return null
    const p = JSON.parse(bruto) as Partial<Pendente<T>> | null
    if (!p || typeof p !== 'object' || typeof p.quando !== 'number' || !('dados' in p)) return null
    return p as Pendente<T>
  } catch {
    return null
  }
}

export function limparPendente(chave: string, store: Armazem | null = armazemPadrao()): void {
  try {
    store?.removeItem(PREFIXO + chave)
  } catch {
    /* idem */
  }
}

/** "14h32" — a hora em que a cópia foi guardada, para o aviso de restauração. */
export function horaDaCopia(quando: number): string {
  const d = new Date(quando)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}h${mm}`
}
