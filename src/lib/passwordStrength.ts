// Força de senha — regra ÚNICA para a interface e para a validação do cadastro.
//
// O critério segue a orientação moderna (NIST SP 800-63B): o que protege uma
// conta é COMPRIMENTO e não ser adivinhável — não obrigar maiúscula, número e
// símbolo. Regras de composição só empurram todo mundo para "Senha@123", que é
// exatamente o tipo de senha que os ataques testam primeiro.
//
// Por isso aqui: mínimo de 8, lista de senhas manjadas, repetição, sequência de
// teclado/alfabeto e uso do próprio e-mail ou do nome do site. Senha longa passa
// sem precisar de firula; senha curta precisa ao menos variar os caracteres.

export const PASSWORD_MIN = 8
/** Acima disso é abuso — e alguns algoritmos de hash truncam. */
export const PASSWORD_MAX = 128

// As mais tentadas em ataque de dicionário, incluindo as brasileiras. Comparadas
// já normalizadas (minúsculas, sem acento), então "Senha123" também cai aqui.
const COMUNS = new Set([
  '12345678', '123456789', '1234567890', '123456', 'senha123', 'senha1234',
  'password', 'password1', 'password123', 'qwerty123', 'qwertyui', 'abc12345',
  'advogado', 'advogada', 'advocacia', 'direito1', 'oab12345', 'brasil123',
  'flamengo', 'corinthians', 'saopaulo', 'palmeiras', 'gremio12', 'vasco123',
  'teste123', 'admin123', 'mudar123', 'iloveyou', 'princesa', 'familia1',
  'jesus123', 'deusefiel', 'amordeus', '11223344', '00000000', 'aaaaaaaa',
  'asdfghjk', 'zxcvbnm1', '1q2w3e4r', 'a1b2c3d4', 'naosei123', 'minhasenha',
])

const LINHAS_TECLADO = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890']

export type StrengthLevel = 'fraca' | 'razoavel' | 'boa' | 'forte'

export interface PasswordStrength {
  /** 0 a 4 — 0 e 1 reprovam o cadastro */
  score: number
  level: StrengthLevel
  /** rótulo pronto para a interface */
  label: string
  /** o que está pegando, em ordem de importância — a primeira vira a dica */
  problems: string[]
  /** pode criar conta com esta senha? */
  acceptable: boolean
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Corre uma sequência crescente/decrescente de 4+ caracteres (abcd, 4321). */
function temSequencia(s: string): boolean {
  const t = normalize(s)
  let subindo = 1
  let descendo = 1
  for (let i = 1; i < t.length; i++) {
    const d = t.charCodeAt(i) - t.charCodeAt(i - 1)
    subindo = d === 1 ? subindo + 1 : 1
    descendo = d === -1 ? descendo + 1 : 1
    if (subindo >= 4 || descendo >= 4) return true
  }
  // trechos de linha de teclado (qwer, asdf) — não são sequência de código
  for (const linha of LINHAS_TECLADO) {
    for (let i = 0; i + 4 <= linha.length; i++) {
      const trecho = linha.slice(i, i + 4)
      if (t.includes(trecho) || t.includes([...trecho].reverse().join(''))) return true
    }
  }
  return false
}

/** Quantas classes de caractere a senha usa (minúscula, maiúscula, dígito, símbolo). */
function classes(s: string): number {
  return (
    Number(/[a-z]/.test(s)) +
    Number(/[A-Z]/.test(s)) +
    Number(/\d/.test(s)) +
    Number(/[^a-zA-Z\d]/.test(s))
  )
}

/**
 * Avalia a senha. `email` entra na conta porque senha derivada do próprio
 * e-mail é a primeira coisa que qualquer ataque direcionado tenta.
 */
export function passwordStrength(password: string, email = ''): PasswordStrength {
  const senha = password ?? ''
  const t = normalize(senha)
  const problems: string[] = []

  if (!senha) {
    return { score: 0, level: 'fraca', label: 'Digite uma senha', problems: [], acceptable: false }
  }
  if (senha.length < PASSWORD_MIN) {
    problems.push(`Use ao menos ${PASSWORD_MIN} caracteres.`)
  }
  if (senha.length > PASSWORD_MAX) {
    problems.push(`No máximo ${PASSWORD_MAX} caracteres.`)
  }
  if (COMUNS.has(t)) {
    problems.push('Essa senha é das mais usadas no mundo — troque por outra.')
  }
  if (/^(.)\1+$/.test(senha) || /(.)\1{3,}/.test(senha)) {
    problems.push('Evite repetir o mesmo caractere várias vezes.')
  }
  if (temSequencia(senha)) {
    problems.push('Evite sequências como 1234, abcd ou qwerty.')
  }
  const local = normalize(email.split('@')[0] ?? '')
  if (local.length >= 4 && t.includes(local)) {
    problems.push('Não use o seu e-mail dentro da senha.')
  }
  if (t.includes('advoc') || t.includes('oab')) {
    problems.push('Não use o nome do site nem "OAB" na senha.')
  }
  const nClasses = classes(senha)
  // Senha curta precisa variar; senha longa não precisa — comprimento já basta.
  if (senha.length < 12 && nClasses < 2) {
    problems.push('Misture letras com números ou símbolos.')
  }

  // Pontuação: comprimento manda, variedade complementa, problema derruba.
  let score = 0
  if (senha.length >= PASSWORD_MIN) score += 1
  if (senha.length >= 12) score += 1
  if (senha.length >= 16) score += 1
  if (nClasses >= 2) score += 1
  if (nClasses >= 3) score += 1
  score = Math.min(4, score)
  if (problems.length) score = Math.min(score, 1)

  const level: StrengthLevel =
    score <= 1 ? 'fraca' : score === 2 ? 'razoavel' : score === 3 ? 'boa' : 'forte'
  const label = { fraca: 'Senha fraca', razoavel: 'Senha razoável', boa: 'Senha boa', forte: 'Senha forte' }[
    level
  ]

  return { score, level, label, problems, acceptable: problems.length === 0 && score >= 2 }
}

/** Mensagem única para bloquear o cadastro — a primeira coisa a corrigir. */
export function passwordProblem(password: string, email = ''): string | null {
  const s = passwordStrength(password, email)
  if (s.acceptable) return null
  return s.problems[0] ?? 'Escolha uma senha mais difícil de adivinhar.'
}
