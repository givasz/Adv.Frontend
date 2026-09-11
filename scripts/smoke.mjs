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

import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const SLUG = 'marina-sales' // perfil-modelo do mock
const FIRM_SLUG = 'andrade-vieira' // escritório-modelo do mock

// Sessão de mentira + rascunho PUBLICADO, para as rotas que exigem conta.
// O rascunho é essencial: sem `published: true` o painel desvia para /comecar e a
// rota nunca chega a renderizar de verdade — o teste passaria sem testar nada.
//
// ⚠️ A chave é `advocme:user` (o retrato de quem está logado). Ficou tempo demais
// como `advocme:session`, do tempo em que a sessão era um token no localStorage:
// depois que ela virou cookie, a semente parou de logar ninguém e TODA rota
// protegida daqui só testava o redirecionamento para /entrar. Se mudar o nome da
// chave em lib/auth.ts, mude aqui junto.
const SEED = `
try {
  localStorage.setItem('advocme:user', JSON.stringify({
    expiresAt: Date.now() + 3600000,
    remember: true,
    user: { id: 'u1', email: 'smoke@advoc.me', name: 'Smoke', plan: 'premium' },
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
    schedulingMode: 'assistant',
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
  // Esta busca métricas no servidor assim que monta. Sem backend a chamada não
  // acontece (modo local), mas o caminho de renderização é o mesmo — e é o único
  // lugar do editor que desenha gráfico.
  ['/editor?section=analytics', 'editor · quem visita você'],
  // Lista reordenável (framer-motion Reorder) — o único lugar do editor com
  // arrasto, e o que mais tem estado por linha.
  ['/editor?section=redes', 'editor · redes'],
  // Monta o VideoPlayer dentro do editor (prévia inerte) e o seletor de formato.
  ['/editor?section=video', 'editor · vídeo'],
  // A grade do assistente. A conversa em si tem página própria (ver /agenda).
  ['/editor?section=agenda', 'editor · agenda'],
  // A conversa do advogado com o próprio assistente — percorrida em agendaDoAdvogado.
  ['/agenda', 'sua agenda (conversa do advogado)'],
  // Contratos: a mesa de documentos e a conferência PÚBLICA — o documento em
  // si é percorrido de ponta a ponta em contratoDoAdvogado.
  ['/contratos', 'contratos e procurações'],
  ['/contratos/conferir', 'conferir um documento (pública)'],
  ['/suporte', 'suporte'],
  // Sem sessão de propósito: quem foi suspenso não consegue entrar, e é
  // justamente essa pessoa que mais precisa desta página.
  ['/contestar', 'contestar uma decisão'],
  ['/conta/dados', 'seus dados (LGPD)'],
  ['/planos', 'planos'],
  ['/planos?recurso=faq&plano=free', 'planos · recurso'],
  ['/assinar/pro', 'checkout'],
  // Descer de plano. A semente está no Max, então esta rota renderiza de verdade
  // (subir redireciona para o checkout, e aí não haveria tela a conferir).
  ['/plano/mudar/pro', 'mudar de plano · descer'],
  ['/plano/mudar/free', 'mudar de plano · voltar ao Free'],
  ['/legal', 'documentos legais'],
  ['/legal/termos', 'termos'],
  ['/escritorio/editar', 'escritório · editor'],
  [`/escritorio/${FIRM_SLUG}`, 'escritório · página'],
  [`/${SLUG}`, 'perfil público'],
  [`/${SLUG}/agendar`, 'perfil · agendar'],
  [`/${SLUG}/denunciar`, 'perfil · denunciar'],
  [`/${SLUG}/compartilhar`, 'perfil · compartilhar'],
  // Rota escondida do painel (mesmo padrão de App.tsx). Entrou aqui quando a
  // sessão do painel virou cookie: a tela passou a perguntar ao servidor quem
  // está logado ANTES de decidir o que desenhar, e é exatamente esse tipo de
  // mudança que produz tela branca sem erro nenhum no console.
  ['/painel-mod-7fq3k9x2a', 'painel de moderação (login)'],
]

// Ruído conhecido do ambiente de desenvolvimento — não é falha do app.
const IGNORAR = [/favicon/i, /Download the React DevTools/i, /\[vite\]/i]

// Rotas que exigem conta. Cair no login com a sessão semeada é falha: foi o que
// aconteceu, calado, o tempo todo em que a semente usou a chave errada.
const EXIGEM_CONTA =
  /^\/(painel|editor|agenda|suporte|conta|planos|assinar|plano\/mudar|comecar|escritorio\/editar|contratos(?!\/conferir))/

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
    const destino = new URL(pagina.url()).pathname
    if (EXIGEM_CONTA.test(rota) && /^\/(entrar|criar-conta)/.test(destino)) {
      erros.push(`desviou para ${destino} — a sessão semeada não foi reconhecida`)
    }
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

// Painel: entra e percorre TODAS as abas.
//
// Abrir a tela de login não prova nada sobre o que existe do lado de dentro — e
// é lá que moram as telas novas (equipe, histórico, segundo fator). Sem backend
// as listas mostram erro de rede, o que é esperado: o que este passo procura é
// tela branca e erro de runtime, não dado.
async function painelDeModeracao() {
  const { contexto, pagina, erros } = await abrir('/painel-mod-7fq3k9x2a')
  try {
    await pagina.getByLabel('E-mail').fill('admin')
    await pagina.getByLabel('Senha').fill('dev-admin-123')
    await clicar(pagina, 'Entrar')
    // As abas dependem das permissões que o servidor devolve: se nenhuma
    // aparecer, é porque entrar deixou de funcionar.
    await pagina.getByRole('button', { name: 'Denúncias', exact: true }).waitFor({ timeout: ESPERA })

    for (const aba of [
      'Contestações',
      'Suporte',
      'Advogados',
      'Histórico',
      // Levantamentos DESENHA gráficos, e é a única aba onde geometria pode
      // quebrar: divisão por zero num recorte vazio, rótulo colidindo, altura
      // negativa. Nada disso aparece no tsc nem no vitest — só desenhando.
      'Levantamentos',
      'Equipe',
      'Denúncias',
    ]) {
      // Escopo no cabeçalho: as abas convivem com filtros de mesmo nome dentro
      // do conteúdo, e clicar no primeiro que aparecer testaria outra coisa.
      const botao = pagina.locator('header').getByRole('button', { name: aba, exact: true })
      await botao.waitFor({ timeout: ESPERA })
      await botao.click()
      const texto = (await pagina.locator('main').innerText()).trim()
      if (texto.length < 10) erros.push(`aba "${aba}" abriu vazia`)
    }
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

/**
 * O balão de conversa fica DENTRO do celularzinho da home.
 *
 * Ele é `position: fixed`, e isso é uma armadilha que nenhum teste de unidade
 * pega: dentro de um ancestral com `transform` (o ProfileView anima o próprio
 * contêiner na entrada), `fixed` ancora no ancestral e não na janela. Já saiu
 * errado duas vezes — desenhado no fim do documento, e depois flutuando por
 * cima da home inteira, fora da maquete. As duas passavam em tsc e em 469
 * testes, porque as duas dependem de geometria de verdade.
 */
async function balaoNoCelular() {
  const { contexto, pagina, erros } = await abrir('/')
  try {
    const moldura = pagina.locator('[data-moldura-telefone]').first()
    await moldura.waitFor({ timeout: ESPERA })
    const fechar = pagina.locator('[aria-label="Fechar o atalho de conversa"]')

    if (await fechar.isVisible()) erros.push('o balão aparece antes de a pessoa rolar o telefone')

    await pagina
      .locator('[data-moldura-telefone] .overflow-y-auto')
      .first()
      .evaluate((el) => {
        el.scrollTop = 600
      })
    await fechar.waitFor({ timeout: ESPERA })

    const m = await moldura.boundingBox()
    const b = await fechar.boundingBox()
    if (!m || !b) {
      erros.push('não deu para medir o balão')
    } else {
      const dentro =
        b.x >= m.x - 2 &&
        b.x + b.width <= m.x + m.width + 2 &&
        b.y >= m.y - 2 &&
        b.y + b.height <= m.y + m.height + 2
      if (!dentro) erros.push('o balão escapou da moldura do celular')
    }

    // E o balão não pede nada a quem visita — a trava de conformidade, no DOM.
    const campos = await pagina.locator('[data-moldura-telefone] input, [data-moldura-telefone] form').count()
    if (campos) erros.push('apareceu campo de entrada dentro do telefone')
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

/**
 * A conversa do ADVOGADO com o próprio assistente, em /agenda: dizer quais
 * horários já foram marcados por fora.
 *
 * É o mesmo motor de fala das conversas do visitante, mas com o estado vindo do
 * rascunho e voltando para ele a cada marcação — e a conversa RELÊ a grade
 * depois de alterá-la, que é o tipo de laço que só quebra no navegador. Vai até
 * o fim de propósito: o comprovante do último passo é montado a partir do que
 * foi fechado, e só existe ali.
 */
async function agendaDoAdvogado() {
  const { contexto, pagina, erros } = await abrir('/agenda')
  try {
    const conversa = pagina.locator('[data-agenda-chat]')
    await conversa.waitFor({ timeout: ESPERA })
    const dia = conversa
      .locator('button')
      .filter({ hasText: /^(seg|ter|qua|qui|sex|sáb|dom),/i })
      .first()
    await dia.waitFor({ timeout: ESPERA })
    await dia.click()
    const hora = conversa.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first()
    await hora.waitFor({ timeout: ESPERA })
    await hora.click()
    // O compromisso indo para a agenda dele: nome → qual agenda → a agenda abre
    // preenchida. Google e Outlook são LINKS — confere que levam o nome e a hora.
    await clicar(pagina, 'Pôr na minha agenda')
    const campoNome = pagina.getByLabel('Nome do compromisso na sua agenda')
    await campoNome.waitFor({ timeout: ESPERA })
    await campoNome.fill('Reunião — João')
    await clicar(pagina, 'Enviar resposta')
    const google = pagina.getByRole('link', { name: 'Google Agenda', exact: true })
    await google.waitFor({ timeout: ESPERA })
    const urlGoogle = new URL((await google.getAttribute('href')) ?? 'about:blank')
    if (urlGoogle.hostname !== 'calendar.google.com') erros.push(`o link do Google foi para "${urlGoogle.hostname}"`)
    if (urlGoogle.searchParams.get('text') !== 'Reunião — João') erros.push('o link do Google saiu sem o nome')
    if (!/^\d{8}T\d{6}\/\d{8}T\d{6}$/.test(urlGoogle.searchParams.get('dates') ?? '')) {
      erros.push('o link do Google saiu sem dia e hora')
    }
    const outlook = pagina.getByRole('link', { name: 'Outlook', exact: true })
    const urlOutlook = new URL((await outlook.getAttribute('href')) ?? 'about:blank')
    if (urlOutlook.searchParams.get('subject') !== 'Reunião — João' || !urlOutlook.searchParams.get('startdt')) {
      erros.push('o link do Outlook saiu sem nome ou hora')
    }
    // "Outra agenda" é o .ics, e ele tem de SAIR de verdade. O balão dizer
    // "pronto" não prova nada — o download é o produto.
    const [arquivo] = await Promise.all([
      pagina.waitForEvent('download', { timeout: ESPERA }),
      clicar(pagina, 'Outra agenda'),
    ])
    if (!arquivo.suggestedFilename().endsWith('.ics')) {
      erros.push(`o arquivo da agenda saiu como "${arquivo.suggestedFilename()}"`)
    }
    const caminho = await arquivo.path()
    const ics = caminho ? await readFile(caminho, 'utf8') : ''
    // Hora LOCAL flutuante e o nome escapado: é o que a agenda do aparelho lê.
    for (const trecho of ['BEGIN:VCALENDAR', 'DTSTART:', 'SUMMARY:Reunião — João', 'END:VCALENDAR']) {
      if (!ics.includes(trecho)) erros.push(`o .ics saiu sem "${trecho}"`)
    }
    if (/DTSTART:\d{8}T\d{6}Z/.test(ics)) erros.push('o .ics saiu com hora em UTC (Z) em vez de local')

    // O roteiro continua andando depois de mexer na própria fonte de dados. E
    // "Outro dia" LIMPA a oferta da agenda de propósito — o botão não pode
    // oferecer um compromisso que já não é o que está na tela.
    await clicar(pagina, 'Outro dia')
    await pagina.getByLabel('Data do horário marcado').waitFor({ timeout: ESPERA })
    if (await pagina.getByRole('button', { name: 'Pôr na minha agenda', exact: true }).count()) {
      erros.push('a oferta de pôr na agenda sobreviveu à troca de dia')
    }
    // Liberar tem de estar ao alcance de quem acabou de fechar um horário.
    await clicar(pagina, 'Liberar um horário')
    await clicar(pagina, 'Nenhum')
    // Fecha um segundo horário e termina, para o comprovante ser desenhado.
    await conversa
      .locator('button')
      .filter({ hasText: /^(seg|ter|qua|qui|sex|sáb|dom),/i })
      .first()
      .click()
    await conversa.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first().click()
    await clicar(pagina, 'Não, é só isso')
    const comprovante = pagina.getByText('Horários fechados', { exact: true }).first()
    await comprovante.waitFor({ timeout: ESPERA })
    // E o que foi fechado tem de ter chegado ao rascunho — não basta ter falado.
    const guardados = await pagina.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('advocme:profile:draft') ?? '{}')?.assistant?.busy
          ?.length
      } catch {
        return 0
      }
    })
    if (!guardados) erros.push('a conversa marcou horário mas nada foi guardado no rascunho')
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

/**
 * Um documento de ponta a ponta: modelo → dados → revisão → declaração →
 * registro → PDF baixado → conferência pública do MESMO arquivo.
 *
 * Nada disto aparece em tsc nem em vitest: o PDF sai de um import dinâmico, o
 * download depende de gesto do usuário, e a conferência lê o arquivo pelo
 * <input type="file"> — três pontos que só quebram no navegador. O fim do
 * percurso é o que prova o produto: o arquivo baixado, reenviado, é reconhecido.
 */
async function contratoDoAdvogado() {
  const { contexto, pagina, erros } = await abrir('/contratos')
  try {
    await pagina.getByRole('button', { name: /Procuração ad judicia/ }).click()
    await pagina.waitForURL(/\/contratos\/rascunho\//, { timeout: ESPERA })

    await pagina.locator('label', { hasText: /^Advogada$/ }).first().click()
    await pagina.getByLabel(/^Endereço profissional/).fill('Av. Afonso Pena, 1500, Belo Horizonte/MG')
    await pagina.getByLabel(/^Nome completo/).fill('João da Silva')
    await pagina.getByLabel(/^Nacionalidade/).fill('brasileiro')
    await pagina.getByLabel(/^Estado civil/).fill('solteiro')
    await pagina.getByLabel(/^Profissão/).fill('engenheiro')
    await pagina.getByLabel(/^CPF/).fill('52998224725')
    await pagina.getByLabel(/^Endereço completo/).fill('Rua das Flores, 120, Belo Horizonte/MG')
    await clicar(pagina, 'Montar a minuta')

    await pagina.getByText('sem inteligência artificial').waitFor({ timeout: ESPERA })
    const folha = pagina.locator('article[aria-label^="Documento:"]')
    if (!(await folha.innerText()).includes('PROCURAÇÃO') && !(await folha.textContent())?.includes('Procuração')) {
      erros.push('a folha da revisão não mostrou o documento')
    }
    await clicar(pagina, 'Revisei, seguir')

    await pagina.getByLabel(/^Li o documento inteiro/).check()
    await pagina.getByLabel(/^O conteúdo é de minha responsabilidade/).check()
    await clicar(pagina, 'Registrar e gerar o PDF')

    const baixar = pagina.getByRole('button', { name: /^Baixar o PDF/ })
    await baixar.waitFor({ timeout: ESPERA })
    const [arquivo] = await Promise.all([pagina.waitForEvent('download', { timeout: ESPERA }), baixar.click()])
    const nome = arquivo.suggestedFilename()
    if (!/^procuracao-ad-judicia-et-extra-AVM-[0-9A-Z]{4}-[0-9A-Z]{4}\.pdf$/.test(nome)) {
      erros.push(`o PDF saiu como "${nome}"`)
    }
    const caminho = await arquivo.path()
    const bytes = caminho ? await readFile(caminho) : Buffer.alloc(0)
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') erros.push('o arquivo baixado não é um PDF')

    // A conferência pública, com o arquivo que acabou de sair.
    await pagina.goto(BASE + '/contratos/conferir', { waitUntil: 'networkidle', timeout: ESPERA })
    await pagina.locator('input[type="file"]').setInputFiles(caminho)
    await pagina.getByText('Idêntico ao documento registrado').waitFor({ timeout: ESPERA })
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

const CONVERSAS = [
  ['balão de conversa no celular da home', balaoNoCelular],
  ['agenda do advogado (editor)', agendaDoAdvogado],
  ['contrato do advogado, do modelo à conferência', contratoDoAdvogado],
  ['assistente do perfil', conversaDoPerfil],
  ['assistente do escritório', conversaDoEscritorio],
  ['painel de moderação (por dentro)', painelDeModeracao],
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
