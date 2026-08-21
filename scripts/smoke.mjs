// Fumaça: abre TODAS as rotas num navegador de verdade e falha se alguma quebrar.
//
// Existe por causa de uma tela branca em produção: um hook depois de uma saída
// antecipada (React #310) passou por tsc, por 215 testes e pelo build — porque
// nenhum deles chega a RENDERIZAR a página. Só abrindo o app pega esse tipo de
// erro, e é barato demais não fazer.
//
// Depois das rotas, percorre as duas CONVERSAS do assistente (perfil e escritório)
// até o link de WhatsApp. Abrir a página não prova que o roteiro anda: o motor da
// conversa é compartilhado pelos dois e uma quebra nele passaria batida por aqui.
//
// Uso:  node scripts/smoke.mjs [http://localhost:5173]
// Sobe o dev server antes (npm run dev). Sai com código 1 se algo quebrar.

import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const SLUG = 'marina-sales' // perfil-modelo do mock
const FIRM_SLUG = 'andrade-vieira' // escritório-modelo do mock

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
  ['/editor?section=cartao', 'editor · cartão de visita'],
  ['/suporte', 'suporte'],
  ['/conta/dados', 'seus dados (LGPD)'],
  ['/planos', 'planos'],
  ['/planos?recurso=faq&plano=free', 'planos · recurso'],
  ['/assinar/pro', 'checkout'],
  ['/legal', 'documentos legais'],
  ['/legal/termos', 'termos'],
  ['/escritorio/editar', 'escritório · editor'],
  [`/escritorio/${FIRM_SLUG}`, 'escritório · página'],
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

// ---- Conversas do assistente ------------------------------------------------

// Abre uma página nova já com a sessão semeada, vigiando erros de runtime.
async function abrir(rota) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } })
  await contexto.addInitScript(SEED)
  const pagina = await contexto.newPage()
  const erros = []
  pagina.on('pageerror', (e) => erros.push(String(e)))
  await pagina.goto(BASE + rota, { waitUntil: 'networkidle', timeout: 20000 })
  return { contexto, pagina, erros }
}

const ESPERA = 20000
const clicar = async (pagina, nome) => {
  const b = pagina.getByRole('button', { name: nome, exact: true })
  await b.waitFor({ timeout: ESPERA })
  await b.click()
}

// Perfil: dia → horário → formato → assunto livre → nome → WhatsApp.
async function conversaDoPerfil() {
  const { contexto, pagina, erros } = await abrir(`/${SLUG}/agendar`)
  try {
    const dia = pagina.locator('button').filter({ hasText: /^(seg|ter|qua|qui|sex|sáb|dom),/i }).first()
    await dia.waitFor({ timeout: ESPERA })
    await dia.click()
    const hora = pagina.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first()
    await hora.waitFor({ timeout: ESPERA })
    await hora.click()
    await clicar(pagina, 'Online')
    await clicar(pagina, 'Outro assunto')
    const assunto = pagina.getByLabel('Assunto da conversa')
    await assunto.waitFor({ timeout: ESPERA })
    await assunto.fill('Revisão de contrato')
    await clicar(pagina, 'Enviar resposta')
    const nome = pagina.getByLabel('Seu nome')
    await nome.waitFor({ timeout: ESPERA })
    await nome.fill('Visitante Smoke')
    await clicar(pagina, 'Enviar resposta')
    const link = pagina.getByRole('link', { name: /Enviar no WhatsApp/ })
    await link.waitFor({ timeout: ESPERA })
    const href = decodeURIComponent((await link.getAttribute('href')) ?? '')
    if (!href.includes('Visitante Smoke')) erros.push('a mensagem final não levou as respostas')
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

// Escritório: assunto → advogado → formato → período → nome → WhatsApp.
async function conversaDoEscritorio() {
  const { contexto, pagina, erros } = await abrir(`/escritorio/${FIRM_SLUG}`)
  try {
    await clicar(pagina, 'Falar com o escritório')
    await clicar(pagina, 'Direito de Família')
    // "Tanto faz" vem primeiro de propósito: escolher advogado é opcional e a
    // plataforma não indica ninguém (Prov. 205/2021 veda ranking).
    await pagina.getByRole('button', { name: 'Tanto faz', exact: true }).waitFor({ timeout: ESPERA })
    await clicar(pagina, 'Camila Nunes')
    await clicar(pagina, 'Online')
    await clicar(pagina, 'Esta semana, de manhã')
    const nome = pagina.getByLabel('Seu nome')
    await nome.waitFor({ timeout: ESPERA })
    await nome.fill('Visitante Smoke')
    await clicar(pagina, 'Enviar resposta')
    // Com encaminhamento direto o botão NOMEIA quem recebe ("Enviar para Camila
    // Nunes") — daí o /Enviar/ solto em vez do rótulo fixo.
    const link = pagina.getByRole('link', { name: /Enviar/ })
    await link.waitFor({ timeout: ESPERA })
    const href = decodeURIComponent((await link.getAttribute('href')) ?? '')
    if (!href.includes('Advogado(a): Camila Nunes')) erros.push('o pedido não levou o advogado escolhido')
    // O escritório-modelo encaminha para o advogado escolhido: o link tem de ser o
    // WhatsApp dela, não o institucional.
    if (!href.startsWith('https://wa.me/5511990000002')) {
      erros.push('o pedido não foi para o WhatsApp da advogada escolhida')
    }
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

const CONVERSAS = [
  ['assistente do perfil', conversaDoPerfil],
  ['assistente do escritório', conversaDoEscritorio],
]

for (const [nome, percorrer] of CONVERSAS) {
  const erros = await percorrer()
  if (erros.length) {
    falhas.push({ rota: nome, nome, erros })
    console.log(`✗ ${nome}`)
    for (const e of erros) console.log(`    ${e}`)
  } else {
    console.log(`✓ ${nome}`)
  }
}

await navegador.close()

const total = ROTAS.length + CONVERSAS.length
if (falhas.length) {
  console.log(`\n${falhas.length} de ${total} verificações quebradas.`)
  process.exit(1)
}
console.log(`\n${ROTAS.length} rotas abriram sem erro e as ${CONVERSAS.length} conversas do assistente foram até o fim.`)
