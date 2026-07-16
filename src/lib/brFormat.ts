// Helpers de formatação BR reutilizados pelo onboarding e pelo editor.
// (Pure functions, sem JSX — o objetivo é não repetir máscara em vários lugares.)

/** Gera um slug a partir de um texto: minúsculas, sem acento, hífens. */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

// ---- OAB: UF (seccional) + número com máscara ----
export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

/** Formata só os dígitos com ponto de milhar: "123456" → "123.456". Máx. 6 dígitos. */
export function formatOabDigits(d: string): string {
  const clean = d.replace(/\D/g, '').slice(0, 6)
  return clean.length <= 3 ? clean : `${clean.slice(0, clean.length - 3)}.${clean.slice(-3)}`
}

/** Extrai UF e dígitos de "OAB/SP 123.456". */
export function parseOab(v: string): { uf: string; digits: string } {
  const m = /OAB\/([A-Za-z]{2})\s*([\d.]*)/.exec(v || '')
  return m ? { uf: m[1].toUpperCase(), digits: m[2].replace(/\D/g, '') } : { uf: '', digits: '' }
}

/** Recompõe "OAB/UF 123.456". Vazio se não houver UF. */
export function composeOab(uf: string, digits: string): string {
  if (!uf) return ''
  const num = formatOabDigits(digits)
  return num ? `OAB/${uf} ${num}` : `OAB/${uf}`
}

/** Máscara de telefone BR (parte local, sem DDI): "(11) 99887-7665". */
export function maskBrLocal(local: string): string {
  const d = local.replace(/\D/g, '').slice(0, 11)
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  if (!ddd) return ''
  let out = `(${ddd}`
  if (d.length >= 2) out += ') '
  if (rest) {
    const split = rest.length > 8 ? 5 : 4 // 9 dígitos (celular) → 5-4; senão 4-4
    out += rest.length > 4 ? `${rest.slice(0, split)}-${rest.slice(split)}` : rest
  }
  return out.trimEnd()
}
