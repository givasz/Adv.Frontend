// Fumaça: abre TODAS as rotas num navegador de verdade e falha se alguma quebrar.
//
// Existe por causa de uma tela branca em produção: um hook depois de uma saída
// antecipada (React #310) passou por tsc, por 215 testes e pelo build — porque
// nenhum deles chega a RENDERIZAR a página. Só abrindo o app pega esse tipo de
// erro, e é barato demais não fazer.
//
// Uso:  node scripts/smoke.mjs [http://localhost:5173]
// Sobe o dev server antes (npm run dev). Sai com código 1 se algo quebrar.

import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const SLUG = 'marina-sales' // perfil-modelo do mock

// Sessão de mentira + rascunho PUBLICADO, para as rotas que exigem conta.
// O rascunho é essencial: sem `published: true` o painel desvia para /comecar e a
// rota nunca chega a renderizar de verdade — o teste passaria sem testar nada.
const SEED = `
try {
  localStorage.setItem('advocme:session', JSON.stringify({
    token: 'smoke',
    expiresAt: Date.now() + 3600000,
    user: { id: 'u1', email: 'smoke@advoc.me', name: 'Smoke' },
  }))
  localStorage.setItem('advocme:profile:draft', JSON.stringify({
    slug: 'ana-smoke-1234',
    name: 'Ana Smoke',
    oabNumber: 'OAB/MG 123.456',
    oabVerified: false,
    oabStatus: 'none',
    headline: 'Advogada · Família',
    bio: 'Atuo em Direito de Família e Sucessões, com orientação clara em cada etapa.',
    city: 'Belo Horizonte',
    state: 'MG',
    serviceMode: { inPerson: true, online: true },
    areas: [{ id: 'a1', label: 'Direito de Família', description: '' }],
    faqs: [{ id: 'f1', question: 'Quanto tempo demora?', answer: 'Depende do caso.' }],
    socials: [],
    contact: { whatsapp: '5531999999999' },
    schedulingMode: 'off',
    plan: 'premium',
    theme: 'papel',
    views: 3,
    published: true,
  }))
} catch {}
`

const ROTAS = [
  ['/', 'landing'],
  ['/entrar', 'login'],
  ['/criar-conta', 'cadastro'],
  ['/painel', 'painel'],
  ['/painel?assinou=pro', 'painel após assinar'],
  ['/editor', 'editor'],
  ['/editor?section=faq', 'editor · FAQ'],
  ['/editor?section=aparencia', 'editor · aparência'],
  ['/editor?section=plano', 'editor · plano'],
  ['/suporte', 'suporte'],
  ['/planos', 'planos'],
  ['/planos?recurso=faq&plano=free', 'planos · recurso'],
  ['/assinar/pro', 'checkout'],
  ['/legal', 'documentos legais'],
  ['/legal/termos', 'termos'],
  [`/${SLUG}`, 'perfil público'],
  [`/${SLUG}/agendar`, 'perfil · agendar'],
  [`/${SLUG}/denunciar`, 'perfil · denunciar'],
  [`/${SLUG}/compartilhar`, 'perfil · compartilhar'],
]

// Ruído conhecido do ambiente de desenvolvimento — não é falha do app.
const IGNORAR = [/favicon/i, /Download the React DevTools/i, /\[vite\]/i]

const navegador = await chromium.launch()
const falhas = []

for (const [rota, nome] of ROTAS) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } })
  await contexto.addInitScript(SEED)
  const pagina = await contexto.newPage()
  const erros = []
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !IGNORAR.some((re) => re.test(m.text()))) erros.push(m.text())
  })
  pagina.on('pageerror', (e) => erros.push(String(e)))

  try {
    await pagina.goto(BASE + rota, { waitUntil: 'networkidle', timeout: 20000 })
    // Tela branca não emite erro sozinha: conferimos que sobrou conteúdo visível.
    const texto = (await pagina.locator('body').innerText()).trim()
    if (texto.length < 20) erros.push(`tela em branco (${texto.length} caracteres visíveis)`)
  } catch (e) {
    erros.push(String(e))
  }

  if (erros.length) {
    falhas.push({ rota, nome, erros })
    console.log(`✗ ${nome}  ${rota}`)
    for (const e of erros) console.log(`    ${e.split('\n')[0]}`)
  } else {
    console.log(`✓ ${nome}  ${rota}`)
  }
  await contexto.close()
}

await navegador.close()

if (falhas.length) {
  console.log(`\n${falhas.length} de ${ROTAS.length} rotas quebradas.`)
  process.exit(1)
}
console.log(`\n${ROTAS.length} rotas abriram sem erro.`)
