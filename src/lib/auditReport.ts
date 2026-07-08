// Relatório de auditoria de conformidade — abre uma versão para impressão/PDF que
// registra QUE regras estavam vigentes na data, o status do perfil e os itens
// verificados. Funciona como "seguro": prova documental caso o advogado seja
// questionado sobre uma publicação (ver REGRAS.md §4 — Registro e auditoria).

import { POLICY_VERSION, RULESET_REV, type checkCompliance } from './oab'
import type { Profile } from './types'

type Issues = ReturnType<typeof checkCompliance>

const CHECKS = [
  'Promessa ou garantia de resultado',
  'Autoengrandecimento e comparação (superlativos)',
  'Menção a preços, honorários ou descontos',
  'Oferta de serviço gratuito como isca',
  'Chamada direta à contratação (CTA)',
  'Uso de selo, logotipo ou símbolo oficial da OAB',
  'Exposição de casos ou clientes (sigilo)',
  'Depoimentos e lista de clientes',
  'Ranking ou prêmio pago',
  'Apelo de urgência',
  'Brindes e sorteios como isca',
]

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function reportHtml(profile: Profile, issues: Issues, dateStr: string): string {
  const blocking = issues.filter((i) => i.severity === 'block')
  const warns = issues.filter((i) => i.severity === 'warn')
  const status = blocking.length
    ? { label: 'Pendências de conformidade', color: '#7a2e2e' }
    : warns.length
      ? { label: 'Em conformidade — com sugestões de revisão', color: '#8a6a2b' }
      : { label: 'Em conformidade', color: '#2b6a3a' }

  const findings = [...blocking, ...warns]
  const findingsHtml = findings.length
    ? `<ul>${findings
        .map(
          (i) =>
            `<li><strong>${i.severity === 'block' ? 'Ajustar' : 'Sugestão'}:</strong> “${esc(
              i.term,
            )}” — ${esc(i.reason)}</li>`,
        )
        .join('')}</ul>`
    : '<p class="ok">Nenhum termo vedado foi detectado no conteúdo público do perfil.</p>'

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório de conformidade — ${esc(profile.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 14px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; color: #211c17; max-width: 720px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .08em; color: #6b6357; border-bottom: 1px solid #e5ded0; padding-bottom: 6px; margin: 28px 0 12px; }
  .muted { color: #6b6357; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; color: #fff; font-weight: 600; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 0; vertical-align: top; }
  td:first-child { color: #6b6357; width: 180px; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin: 4px 0; }
  .ok { color: #2b6a3a; }
  .checks li { list-style: '✓  '; }
  footer { margin-top: 32px; border-top: 1px solid #e5ded0; padding-top: 12px; font-size: 11.5px; color: #8a8175; }
  @media print { body { margin: 0; } }
</style></head><body>
  <h1>Relatório de conformidade publicitária</h1>
  <p class="muted">Gerado por advoc.me em ${esc(dateStr)}</p>

  <h2>Perfil</h2>
  <table>
    <tr><td>Advogado(a)</td><td>${esc(profile.name)}</td></tr>
    <tr><td>Inscrição</td><td>${esc(profile.oabNumber)}</td></tr>
    <tr><td>Localidade</td><td>${esc([profile.city, profile.state].filter(Boolean).join('/') || '—')}</td></tr>
    <tr><td>Endereço do perfil</td><td>advoc.me/${esc(profile.slug)}</td></tr>
  </table>

  <h2>Política vigente</h2>
  <table>
    <tr><td>Norma aplicada</td><td>${esc(POLICY_VERSION)} do CFOAB</td></tr>
    <tr><td>Revisão do conjunto de regras</td><td>rev. ${RULESET_REV}</td></tr>
    <tr><td>Data da verificação</td><td>${esc(dateStr)}</td></tr>
  </table>

  <h2>Resultado</h2>
  <p><span class="badge" style="background:${status.color}">${status.label}</span></p>
  ${findingsHtml}

  <h2>Itens verificados</h2>
  <ul class="checks">${CHECKS.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>

  <footer>
    Este relatório registra as regras vigentes e o resultado da verificação automática na data
    indicada. Tem caráter informativo e não constitui aconselhamento jurídico nem manifestação da
    OAB. A verificação é uma heurística de apoio; a responsabilidade pelo conteúdo publicado é do(a)
    advogado(a).
  </footer>
  <script>window.onload = function(){ setTimeout(function(){ window.print() }, 300) }</script>
</body></html>`
}

/** Abre o relatório em nova aba e dispara a impressão (o usuário salva como PDF). */
export function openAuditReport(profile: Profile, issues: Issues): boolean {
  const dateStr = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
  const html = reportHtml(profile, issues, dateStr)
  const win = window.open('', '_blank')
  if (!win) return false // bloqueado por popup
  win.document.write(html)
  win.document.close()
  return true
}
