// Link de terceiro que vai virar `href` — Instagram, LinkedIn, site, agenda.
//
// React NÃO bloqueia `href="javascript:..."`: ele só avisa no console durante o
// desenvolvimento e renderiza o link assim mesmo. Numa página de perfil pública,
// isso é execução de script na nossa origem — com acesso ao localStorage de quem
// estiver visitando, sessão inclusive.
//
// O backend já recusa esquemas estranhos na GRAVAÇÃO (backend/src/security/
// sanitize.ts). Esta é a segunda camada, que vale para o que já está gravado e
// para o modo mock (localStorage), onde não passa servidor nenhum.

/** Devolve o link se ele for http/https; senão `undefined` (o elemento não vira link). */
export function safeHref(url?: string | null): string | undefined {
  if (typeof url !== 'string') return undefined
  const bruto = url.trim()
  if (!bruto) return undefined
  // Sem esquema, assume https — é o que a pessoa quis dizer ao colar
  // "instagram.com/fulano", e impede que o campo vire um caminho da nossa origem.
  const candidato = /^[a-z][a-z0-9+.-]*:/i.test(bruto) ? bruto : `https://${bruto}`
  try {
    const u = new URL(candidato)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}
