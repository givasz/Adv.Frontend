// O CHECKOUT PAGO DE PONTA A PONTA — navegador de verdade, backend local, sandbox
// do Asaas. Não roda no smoke: precisa de servidor e de chave do sandbox.
//
// Três cenários, cada um com uma conta nova:
//   1. cartão de teste aprovado  → a tela mostra "Plano ativado" e o perfil vira Max
//   2. cartão de teste recusado  → a mensagem do Asaas aparece e o CVV some do campo
//   3. Pix                       → o QR Code aparece; quando o aviso de pagamento
//                                  chega ao servidor, a tela abre o plano sozinha
//
// O aviso do Pix é SIMULADO (um POST no webhook com o token local), porque o
// sandbox do Asaas não alcança uma máquina de desenvolvimento sem túnel. O formato
// da cobrança real já foi conferido em backend/src/billing/asaas.sandbox.spec.ts.
//
// COMO RODAR (três terminais):
//
//   backend:  PORT=3334 DATABASE_URL=file:./e2e.db FRONTEND_ORIGIN=http://localhost:5200 \
//             ASAAS_AMBIENTE=sandbox ASAAS_API_KEY='$aact_…' ASAAS_WEBHOOK_TOKEN=<qualquer> \
//             node dist/main.js
//             (banco criado antes com: DATABASE_URL=file:./e2e.db npx prisma db push
//              --schema prisma/schema.dev.prisma --skip-generate)
//   front:    VITE_USE_REAL_API=true VITE_PAGAMENTO_ONLINE=true \
//             VITE_DEV_API=http://localhost:3334 npx vite --port 5200
//   teste:    ASAAS_WEBHOOK_TOKEN=<o mesmo> ASAAS_API_KEY='$aact_…' node scripts/checkout-e2e.mjs
//
// No fim, apaga no sandbox os clientes e assinaturas que criou.

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'backend')

const BASE = process.argv[2] ?? 'http://localhost:5200'
const API = process.argv[3] ?? 'http://localhost:3334'
const TOKEN = process.env.ASAAS_WEBHOOK_TOKEN
const CHAVE = process.env.ASAAS_API_KEY
if (!TOKEN || !CHAVE) {
  console.error('Defina ASAAS_WEBHOOK_TOKEN e ASAAS_API_KEY (a do SANDBOX).')
  process.exit(1)
}
const ESPERA = 30000
const MARCA = `Teste E2E ${Date.now()}`
const H = { access_token: CHAVE, 'User-Agent': 'advoc.me' }
const SANDBOX = 'https://api-sandbox.asaas.com/v3'

function cpf() {
  let n
  do n = [...Array(9)].map(() => Math.floor(Math.random() * 10))
  while (new Set(n).size === 1)
  const dv = (a) => {
    const r = (a.reduce((t, v, i) => t + v * (a.length + 1 - i), 0) * 10) % 11
    return r === 10 ? 0 : r
  }
  n.push(dv(n))
  n.push(dv(n))
  return n.join('')
}

/**
 * Assinar exige e-mail confirmado quando o correio está ligado — e em
 * desenvolvimento ele está (modo "console": o e-mail sai no log do servidor). Em
 * vez de pescar o link no log, o teste marca a confirmação direto no banco
 * DESCARTÁVEL do teste. O cenário 1 confere antes que o botão começa bloqueado.
 */
function confirmarEmail(email) {
  const codigo =
    "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();" +
    `p.user.update({where:{email:${JSON.stringify(email)}},data:{emailVerifiedAt:new Date()}}).then(()=>p.$disconnect())`
  execFileSync('node', ['-e', codigo], {
    cwd: BACKEND,
    env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'file:./e2e.db' },
    stdio: 'inherit',
  })
}

/** Recarrega até o botão de pagar liberar (a sessão do servidor tem cache curto). */
async function esperarBotaoLiberado(pagina, nome) {
  const fim = Date.now() + ESPERA
  for (;;) {
    await pagina.reload({ waitUntil: 'networkidle' })
    if (await pagina.getByRole('button', { name: nome }).isEnabled()) return
    if (Date.now() > fim) throw new Error('o botão de pagar não liberou depois de confirmar o e-mail')
    await pagina.waitForTimeout(1500)
  }
}

const navegador = await chromium.launch()
const falhas = []

/** Conta nova, com perfil, logada neste contexto do navegador. */
async function contaNova(rotulo) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } })
  const pagina = await contexto.newPage()
  const erros = []
  pagina.on('pageerror', (e) => erros.push(String(e)))
  await pagina.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  const email = `e2e-${rotulo}-${Date.now()}@example.com`
  const r = await pagina.evaluate(
    async ({ email, nome }) => {
      const cad = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Senha-Forte-E2E-2026!x', name: nome, remember: true, aceitouTermos: true }),
      })
      if (!cad.ok) return { erro: `cadastro ${cad.status} ${await cad.text()}` }
      const me = await (await fetch('/api/auth/me')).json()
      const csrf = me.csrf ?? me.csrfToken ?? decodeURIComponent((document.cookie.match(/advocme_csrf=([^;]+)/) ?? [])[1] ?? '')
      const perfil = await fetch('/api/profiles/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ name: nome }),
      })
      if (!perfil.ok) return { erro: `perfil ${perfil.status} ${await perfil.text()}` }
      return { ok: true }
    },
    { email, nome: `${MARCA} ${rotulo}` },
  )
  if (r.erro) throw new Error(r.erro)
  return { contexto, pagina, erros, email }
}

async function meuPerfil(pagina) {
  return pagina.evaluate(async () => (await fetch('/api/profiles/me')).json())
}

async function preencherCartao(pagina, numero) {
  await pagina.getByLabel('CPF ou CNPJ').fill(cpf())
  await pagina.getByLabel('Número do cartão').fill(numero)
  await pagina.getByLabel('Nome impresso no cartão').fill('TESTE E2E')
  await pagina.getByLabel('Validade').fill('1230')
  await pagina.getByLabel('Código de segurança').fill('123')
  await pagina.getByLabel('CEP').fill('80420210')
  await pagina.getByLabel('Número', { exact: true }).fill('1488')
  await pagina.getByLabel('Telefone').fill('41999999999')
}

async function cenario(nome, corpo) {
  try {
    const erros = await corpo()
    if (erros.length) throw new Error(erros.join(' | '))
    console.log(`✓ ${nome}`)
  } catch (e) {
    falhas.push(nome)
    console.log(`✗ ${nome}\n    ${String(e).split('\n').slice(0, 4).join(' | ')}`)
  }
}

await cenario('cartão aprovado abre o Max na hora', async () => {
  const { contexto, pagina, erros, email } = await contaNova('aprovado')
  await pagina.goto(BASE + '/assinar/premium', { waitUntil: 'networkidle' })
  if (await pagina.getByRole('button', { name: /Pagar R\$ 49,00/ }).isEnabled()) {
    erros.push('o botão de pagar estava liberado com o e-mail ainda não confirmado')
  }
  confirmarEmail(email)
  await esperarBotaoLiberado(pagina, /Pagar R\$ 49,00/)
  await preencherCartao(pagina, '4444 4444 4444 4444')
  await pagina.getByRole('button', { name: /Pagar R\$ 49,00/ }).click()
  await pagina.getByText('Plano ativado').first().waitFor({ timeout: ESPERA })
  const p = await meuPerfil(pagina)
  if (p.plan !== 'premium') erros.push(`perfil ficou em "${p.plan}", esperado premium`)
  await contexto.close()
  return erros
})

await cenario('cartão recusado mostra a mensagem do Asaas e apaga o CVV', async () => {
  const { contexto, pagina, erros, email } = await contaNova('recusado')
  await pagina.goto(BASE + '/assinar/pro', { waitUntil: 'networkidle' })
  confirmarEmail(email)
  await esperarBotaoLiberado(pagina, /Pagar R\$ 29,00/)
  await preencherCartao(pagina, '5184 0197 4037 3151')
  await pagina.getByRole('button', { name: /Pagar R\$ 29,00/ }).click()
  await pagina.getByRole('alert').filter({ hasText: /não autorizada/i }).waitFor({ timeout: ESPERA })
  if ((await pagina.getByLabel('Código de segurança').inputValue()) !== '') erros.push('o CVV continuou no campo')
  const p = await meuPerfil(pagina)
  if (p.plan !== 'free') erros.push(`perfil virou "${p.plan}" com cartão recusado`)
  await contexto.close()
  return erros
})

await cenario('Pix mostra o QR Code e abre o plano quando o pagamento é avisado', async () => {
  const { contexto, pagina, erros, email } = await contaNova('pix')
  await pagina.goto(BASE + '/assinar/pro', { waitUntil: 'networkidle' })
  confirmarEmail(email)
  await esperarBotaoLiberado(pagina, /Pagar R\$ 29,00/)
  await pagina.getByRole('radio', { name: /Pix/ }).click()
  await pagina.getByLabel('CPF ou CNPJ').fill(cpf())
  await pagina.getByRole('button', { name: /Gerar Pix de R\$ 29,00/ }).click()
  await pagina.getByRole('img', { name: 'QR Code do Pix' }).waitFor({ timeout: ESPERA })
  const perfil = await meuPerfil(pagina)
  if (perfil.plan !== 'free') erros.push('o plano abriu antes de o Pix ser pago')
  // O aviso que o Asaas mandaria quando o Pix caísse — montado com a COBRANÇA
  // REAL que o checkout criou no sandbox, só com o status trocado para pago. Assim
  // o que se testa é o formato de verdade, com o externalReference que o próprio
  // checkout gravou.
  const cliente = ((await (await fetch(`${SANDBOX}/customers?limit=100`, { headers: H })).json()).data ?? []).find(
    (c) => c.name === `${MARCA} pix`,
  )
  if (!cliente) throw new Error('o cliente do Pix não apareceu no sandbox')
  const [assinatura] = (await (await fetch(`${SANDBOX}/subscriptions?customer=${cliente.id}`, { headers: H })).json()).data ?? []
  const [cobranca] = (await (await fetch(`${SANDBOX}/subscriptions/${assinatura.id}/payments`, { headers: H })).json()).data ?? []
  if (cobranca.billingType !== 'PIX') erros.push(`a cobrança no sandbox é ${cobranca.billingType}, não PIX`)
  const aviso = await fetch(`${API}/api/billing/asaas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'asaas-access-token': TOKEN },
    body: JSON.stringify({
      id: `evt_e2e_${Date.now()}`,
      event: 'PAYMENT_RECEIVED',
      dateCreated: new Date().toISOString(),
      payment: { ...cobranca, status: 'RECEIVED' },
    }),
  })
  const resposta = await aviso.json()
  if (!resposta.applied) erros.push(`o webhook não aplicou: ${JSON.stringify(resposta)}`)
  // A tela relê o perfil a cada 5 s: tem de trocar sozinha.
  await pagina.getByText('Plano ativado').first().waitFor({ timeout: ESPERA })
  await contexto.close()
  return erros
})

await navegador.close()

// Limpeza no sandbox: tudo o que este teste criou.
const clientes = (await (await fetch(`${SANDBOX}/customers?limit=100`, { headers: H })).json()).data ?? []
let apagados = 0
for (const c of clientes.filter((c) => (c.name ?? '').startsWith(MARCA))) {
  const subs = (await (await fetch(`${SANDBOX}/subscriptions?customer=${c.id}`, { headers: H })).json()).data ?? []
  for (const s of subs) await fetch(`${SANDBOX}/subscriptions/${s.id}`, { method: 'DELETE', headers: H })
  await fetch(`${SANDBOX}/customers/${c.id}`, { method: 'DELETE', headers: H })
  apagados++
}
console.log(`\nlimpeza: ${apagados} cliente(s) de teste apagado(s) no sandbox`)

if (falhas.length) {
  console.log(`${falhas.length} de 3 cenários quebrados.`)
  process.exit(1)
}
console.log('Os 3 cenários do checkout pago passaram.')
