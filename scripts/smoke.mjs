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
    triage: {
      enabled: true,
      questions: [
        {
          id: 'st1',
          kind: 'escolha',
          label: 'Qual assunto você deseja tratar?',
          options: [
            { id: 'so1', texto: 'Direito de Família' },
            { id: 'so2', texto: 'Outro assunto' },
          ],
        },
        // A pergunta do processo só é feita a quem respondeu "Outro assunto". O
        // percurso sempre toca na primeira opção ("Direito de Família"), então a
        // conversa tem de PULAR esta — e termina com DUAS respostas, não três.
        {
          id: 'st2',
          kind: 'sim-nao',
          label: 'Você já possui processo sobre esse assunto?',
          condicao: { pergunta: 'st1', opcoes: ['so2'] },
        },
        { id: 'st3', kind: 'texto-longo', label: 'Conte brevemente o que aconteceu.' },
      ],
    },
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
  // A volta do Google. Com o código de recusa na URL a tela desenha a frase sem
  // perguntar ao servidor — o percurso com o Google de verdade não cabe aqui, e
  // as travas dele estão em backend/src/auth/google.spec.ts e google-conta.spec.ts.
  ['/entrar/google?erro=cancelado', 'entrar com o Google (volta cancelada)'],
  // Os links que chegam por e-mail. Sem o token no endereço, as duas de link
  // mostram o caminho de volta — é esse desenho que se confere aqui (o percurso
  // com token precisa do servidor, e é coberto em backend/src/auth/recuperacao.spec.ts).
  ['/esqueci-senha', 'esqueci minha senha'],
  ['/redefinir-senha', 'redefinir senha (sem link)'],
  ['/confirmar-email', 'confirmar e-mail (sem link)'],
  ['/painel', 'painel'],
  ['/painel?assinou=pro', 'painel após assinar'],
  ['/editor', 'editor'],
  // A identidade virou três seções em 12/09/2026; cada uma renderiza cartões
  // que só existem nela (cidade do IBGE, CEP, áreas com IA).
  ['/editor?section=local', 'editor · local e endereço'],
  ['/editor?section=areas', 'editor · áreas'],
  // Chegar por âncora rola até o campo e o destaca — só acontece no navegador.
  ['/editor?section=identidade#foto', 'editor · âncora da foto'],
  ['/editor?section=bio', 'editor · apresentação'],
  ['/editor?section=marca', 'editor · marca'],
  ['/editor?section=qrcode', 'editor · cartão digital'],
  ['/editor?section=conteudo', 'editor · documentos'],
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
  // A triagem: lista de perguntas, painel de edição por pergunta e os avisos de
  // dado sensível — tudo em uma tela só.
  ['/editor?section=triagem', 'editor · assistente de triagem'],
  // O ensaio do próprio assistente — percorrido em conversaDeTeste.
  ['/assistente/testar', 'testar meu assistente'],
  ['/editor?section=botao', 'editor · botão flutuante'],
  // A conversa do advogado com o próprio assistente — percorrida em agendaDoAdvogado.
  ['/agenda', 'sua agenda (conversa do advogado)'],
  // Contratos: a mesa de documentos e a conferência PÚBLICA — o documento em
  // si é percorrido de ponta a ponta em contratoDoAdvogado.
  ['/contratos', 'contratos e procurações'],
  ['/contratos/conferir', 'conferir um documento (pública)'],
  // O editor de modelo próprio — percorrido de ponta a ponta em modeloProprioDoAdvogado.
  ['/contratos/modelos/novo', 'novo modelo de documento'],
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
  /^\/(painel|editor|agenda|assistente|suporte|conta|planos|assinar|plano\/mudar|comecar|escritorio\/editar|contratos(?!\/conferir))/

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
    // A rede de proteção troca a tela branca por uma tela COM texto, que passaria
    // na conferência acima. Cair nela é quebra do mesmo jeito.
    if (await pagina.locator('[data-falha-na-tela]').count()) erros.push('a tela quebrou e caiu na FalhaNaTela')
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

// A conversa do perfil, do começo ao último passo.
//
// Responde ao que está EM CENA, e não a uma sequência decorada: com a triagem
// (plano Max), o roteiro tem um tamanho e uma ordem diferentes em cada perfil —
// as perguntas são do advogado. O percurso é sempre o mesmo gesto: se há campo,
// escreve; se há "Pronto", marca e confirma; senão, toca na primeira opção.
// Para no botão final — o que ele faz depende do perfil.
async function ateOFimDaConversa(pagina, { nome = 'Visitante Smoke', texto = 'Revisão de contrato' } = {}) {
  const area = pagina.locator('[data-conversa-resposta]')

  /**
   * Espera o assistente TERMINAR de responder e abrir o próximo gesto.
   *
   * Entre duas falas seguidas o "digitando…" some por um instante e a área
   * volta a mostrar os controles anteriores. Sem esta espera, o percurso
   * respondia duas vezes à mesma pergunta e o clique caía num botão que estava
   * sendo desmontado. `data-passo` é o sinal de que a conversa de fato andou.
   */
  const proximoGesto = (anterior) =>
    pagina.waitForFunction(
      (ant) => {
        const el = document.querySelector('[data-conversa-resposta]')
        if (!el || el.dataset.digitando === '1') return false
        if (el.dataset.passo === ant) return false
        return !!el.querySelector('input, button')
      },
      anterior,
      { timeout: ESPERA },
    )

  await proximoGesto('boot')
  for (let volta = 0; volta < 24; volta++) {
    const passo = await area.getAttribute('data-passo')
    // O fim tem duas caras: link do WhatsApp no perfil de verdade, botão inerte
    // no perfil de exemplo e no teste do próprio advogado.
    if (passo === 'done') return

    const campo = area.locator('input').first()
    if (await campo.count()) {
      const rotulo = (await campo.getAttribute('aria-label')) ?? ''
      const tipo = await campo.getAttribute('type')
      await campo.fill(tipo === 'date' ? '2030-01-15' : /nome|chamar/i.test(rotulo) ? nome : texto)
      await clicar(pagina, 'Enviar resposta')
    } else if (await area.getByRole('button', { name: /^Pronto/ }).count()) {
      // Múltipla escolha: marca a primeira e confirma.
      await area.locator('button[aria-pressed]').first().click()
      await area.getByRole('button', { name: /^Pronto/ }).click()
    } else {
      // Qualquer outro passo é uma fileira de opções: a primeira serve — dia,
      // horário, "Sim", "Presencial", o primeiro assunto da triagem.
      await area.locator('button').first().click()
    }
    await proximoGesto(passo)
  }
  throw new Error('a conversa não chegou ao fim em 24 voltas')
}

// Perfil de VERDADE: a conversa termina num link de WhatsApp com as respostas.
//
// Roda no rascunho semeado (SEED), e não no perfil-modelo: desde 12/09/2026 o
// exemplo não tem link nenhum no fim — o número dele é inventado e pode ser de
// alguém real (ver lib/exemplo.ts e exemploNaoSai, abaixo). Em modo local o
// rascunho responde pelo próprio endereço, com a agenda padrão preenchida.
async function conversaDoPerfil() {
  const { contexto, pagina, erros } = await abrir('/ana-smoke-1234/agendar')
  try {
    await ateOFimDaConversa(pagina)
    const link = pagina.getByRole('link', { name: /Enviar no WhatsApp/ })
    await link.waitFor({ timeout: ESPERA })
    const href = decodeURIComponent((await link.getAttribute('href')) ?? '')
    if (!href.includes('Visitante Smoke')) erros.push('a mensagem final não levou as respostas')
    if (!href.startsWith('https://wa.me/5531999999999')) {
      erros.push('o pedido não foi para o WhatsApp do perfil')
    }
    // A triagem inteira tem de chegar ao advogado: o bloco, as perguntas DELE e
    // a ressalva de que aquilo não é análise jurídica.
    if (!href.includes('— Triagem —')) erros.push('a mensagem saiu sem o bloco da triagem')
    if (!href.includes('Qual assunto você deseja tratar?')) {
      erros.push('a mensagem saiu sem as perguntas da triagem')
    }
    // O DESVIO foi seguido: "Direito de Família" pula a pergunta do processo.
    // Se o caminho fosse ignorado, ela estaria aqui.
    if (href.includes('Você já possui processo sobre esse assunto?')) {
      erros.push('a conversa ignorou o caminho configurado e fez a pergunta que devia pular')
    }
    if (!href.includes('Conte brevemente o que aconteceu.')) {
      erros.push('o desvio não chegou à pergunta de destino')
    }
    if (!/não são análise jurídica/i.test(href)) {
      erros.push('a mensagem saiu sem a ressalva da triagem')
    }
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

/**
 * O ENSAIO do próprio advogado, em /assistente/testar.
 *
 * É a mesma conversa do visitante, com o perfil gravado — e o que importa aqui é
 * o que ela NÃO faz no fim: o botão do WhatsApp não pode ser um link. Um teste
 * que manda mensagem de verdade é um teste que ninguém faz duas vezes, e o
 * destinatário seria o próprio advogado.
 */
async function conversaDeTeste() {
  const { contexto, pagina, erros } = await abrir('/assistente/testar')
  try {
    await pagina.getByText(/nada é enviado/i).first().waitFor({ timeout: ESPERA })
    await ateOFimDaConversa(pagina)
    const botao = pagina.getByRole('button', { name: /Enviar no WhatsApp/ })
    await botao.waitFor({ timeout: ESPERA })
    if (await pagina.getByRole('link', { name: /Enviar no WhatsApp/ }).count()) {
      erros.push('o teste do assistente termina num link de WhatsApp de verdade')
    }
    await botao.click()
    await pagina.getByText(/nada foi enviado/).first().waitFor({ timeout: ESPERA })
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
    // Camila usa a agenda do assistente no perfil dela: a conversa do escritório
    // tem de oferecer os dias e horários DELA, não "esta semana, de manhã".
    await clicar(pagina, 'Camila Nunes')
    await clicar(pagina, 'Online')
    const dia = pagina.locator('button').filter({ hasText: /^(seg|ter|qua|qui|sex|sáb|dom),/i }).first()
    await dia.waitFor({ timeout: ESPERA })
    await dia.click()
    const hora = pagina.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first()
    await hora.waitFor({ timeout: ESPERA })
    await hora.click()
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
    if (!href.includes('Dia e horário:')) erros.push('o pedido não levou o horário da agenda da advogada')
    // O escritório-modelo encaminha para o advogado escolhido: o link tem de ser o
    // WhatsApp dela, não o institucional.
    if (!href.startsWith('https://wa.me/5511990000002')) {
      erros.push('o pedido não foi para o WhatsApp da advogada escolhida')
    }

    // Sem preferência não há agenda de onde tirar horário: volta a pergunta de
    // período, e o pedido vai para o WhatsApp do escritório.
    await clicar(pagina, 'Recomeçar')
    await clicar(pagina, 'Direito de Família')
    await clicar(pagina, 'Tanto faz')
    await clicar(pagina, 'Online')
    await clicar(pagina, 'Esta semana, de manhã')
    const nome2 = pagina.getByLabel('Seu nome')
    await nome2.waitFor({ timeout: ESPERA })
    await nome2.fill('Visitante Smoke')
    await clicar(pagina, 'Enviar resposta')
    const link2 = pagina.getByRole('link', { name: 'Enviar no WhatsApp' })
    await link2.waitFor({ timeout: ESPERA })
    const href2 = decodeURIComponent((await link2.getAttribute('href')) ?? '')
    if (!href2.includes('Preferência de horário: Esta semana, de manhã')) {
      erros.push('sem preferência, o pedido não levou o período')
    }
    if (!href2.startsWith('https://wa.me/5511990000000')) {
      erros.push('sem preferência, o pedido não foi para o WhatsApp do escritório')
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
    // Quanto tempo vai durar — é a resposta que fecha o horário.
    await clicar(pagina, '1 hora')
    // O compromisso indo para a agenda dele: nome → qual agenda → a agenda abre
    // preenchida. Google e Outlook são LINKS — confere que levam o nome e a hora.
    // O botão diz QUAL compromisso leva ("Pôr 25 nov · 14:00 na minha agenda").
    const porNaAgenda = () => pagina.getByRole('button', { name: /^Pôr .+ na minha agenda$/ })
    await porNaAgenda().waitFor({ timeout: ESPERA })
    await porNaAgenda().click()
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

    // Depois de ir para a agenda, o mesmo compromisso NÃO pode ser oferecido de
    // novo: tocar outra vez só pedia o nome e criava o evento em dobro, sem dizer
    // de qual horário se tratava.
    await pagina.getByRole('button', { name: 'Outro dia', exact: true }).waitFor({ timeout: ESPERA })
    if (await porNaAgenda().count()) {
      erros.push('a oferta de pôr na agenda continuou depois de o compromisso ir para a agenda')
    }

    // O roteiro continua andando depois de mexer na própria fonte de dados. E
    // "Outro dia" LIMPA a oferta da agenda de propósito — o botão não pode
    // oferecer um compromisso que já não é o que está na tela.
    await clicar(pagina, 'Outro dia')
    await pagina.getByLabel('Data do horário marcado').waitFor({ timeout: ESPERA })
    if (await porNaAgenda().count()) {
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
    await clicar(pagina, '1 hora')
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

/**
 * A TELA DA TRIAGEM, de ponta a ponta: montar, ver o roteiro e acessibilidade.
 *
 * Não substitui uma auditoria, mas trava o que mais some sem ninguém notar: um
 * botão sem nome acessível (só ícone) e um campo sem rótulo viram "botão" e
 * "caixa de edição" para quem usa leitor de tela — e a tela inteira deixa de
 * ser navegável. Aqui há muitos dos dois: setas de ordenar, lixeiras por opção,
 * chips de resposta.
 *
 * Também confere o que a triagem acrescenta ao teclado: cada pergunta em cena
 * tem de ser alcançável pelo Tab, sem armadilha de foco.
 */
async function acessibilidadeDaTriagem() {
  const erros = []

  /** Nomes acessíveis vazios entre os controles de um pedaço da tela. */
  const semNome = (pagina, escopo) =>
    pagina.locator(escopo).evaluate((raiz) => {
      const nome = (el) =>
        (
          el.getAttribute('aria-label') ||
          (el.getAttribute('aria-labelledby')
            ? (document.getElementById(el.getAttribute('aria-labelledby'))?.textContent ?? '')
            : '') ||
          (el.closest('label')?.textContent ?? '') ||
          el.textContent ||
          el.getAttribute('placeholder') ||
          ''
        ).trim()
      return Array.from(raiz.querySelectorAll('button, input, select, textarea'))
        .filter((el) => el.offsetParent !== null && !nome(el))
        .map((el) => `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''}`)
    })

  // 1. O editor da triagem, com uma pergunta ABERTA (é onde moram os controles
  //    só de ícone: mover para cima, mover para baixo, excluir, remover opção).
  {
    const { contexto, pagina, erros: runtime } = await abrir('/editor?section=triagem')
    try {
      const itens = pagina.locator('[data-perguntas] > li')
      await itens.first().waitFor({ timeout: ESPERA })
      const antes = await itens.count()
      // "+ Adicionar pergunta" tem de ADICIONAR. A pergunta nova nasce sem
      // enunciado (é o advogado quem vai escrever), e o normalizador chegou a
      // descartá-la por isso — o botão não fazia nada, e nenhum teste via.
      await clicar(pagina, '+ Adicionar pergunta')
      await itens.nth(antes).waitFor({ timeout: ESPERA })
      if ((await itens.count()) !== antes + 1) {
        erros.push('“+ Adicionar pergunta” não adicionou nada')
      }

      // DIGITAR tem de funcionar. O editor passava cada tecla pelo normalizador
      // do servidor, que come o espaço do fim — "Em " virava "Em" e a frase
      // saía "Emqualcidade". `fill` escreveria tudo de uma vez e NÃO pegaria
      // isso: é tecla por tecla, como uma pessoa digita.
      const enunciado = pagina.getByPlaceholder('Qual assunto você deseja tratar?')
      await enunciado.pressSequentially('Em qual cidade')
      const escrito = await enunciado.inputValue()
      if (escrito !== 'Em qual cidade') {
        erros.push(`o enunciado não aceita espaço (ficou "${escrito}")`)
      }
      // A pergunta nova de escolha nasce com dois campos de opção — que o mesmo
      // normalizador descartava por estarem vazios.
      const opcao1 = pagina.getByLabel('Opção 1', { exact: true })
      if (!(await opcao1.count())) {
        erros.push('a pergunta nova nasceu sem campos de opção')
      } else {
        await opcao1.pressSequentially('Belo Horizonte')
        const opcaoEscrita = await opcao1.inputValue()
        if (opcaoEscrita !== 'Belo Horizonte') {
          erros.push(`a opção não aceita espaço (ficou "${opcaoEscrita}")`)
        }
      }
      await clicar(pagina, '+ Adicionar opção')
      if ((await pagina.getByLabel('Opção 3', { exact: true }).count()) !== 1) {
        erros.push('“+ Adicionar opção” não adicionou nada')
      }

      // CONFIRMAR fecha o painel sem depender do Enter; EDITAR, escrito, reabre;
      // e o Enter no enunciado também confirma, como atalho.
      await clicar(pagina, 'Confirmar pergunta')
      await enunciado.waitFor({ state: 'detached', timeout: ESPERA })
      await pagina.getByRole('button', { name: `Editar a pergunta ${antes + 1}` }).click()
      await enunciado.waitFor({ timeout: ESPERA })
      await enunciado.press('Enter')
      await enunciado.waitFor({ state: 'detached', timeout: ESPERA })
      // E excluir tem de excluir.
      await pagina.getByRole('button', { name: `Excluir a pergunta ${antes + 1}` }).click()
      await itens.nth(antes).waitFor({ state: 'detached', timeout: ESPERA })
      if ((await itens.count()) !== antes) erros.push('excluir não removeu a pergunta')

      // SEM NENHUMA PERGUNTA, a tela tem de oferecer um começo de UM TOQUE —
      // é o caminho de quem abriu o editor justamente para não ter trabalho.
      for (let i = antes; i > 0; i--) {
        await pagina.getByRole('button', { name: `Excluir a pergunta ${i}` }).click()
      }
      const umToque = pagina.getByRole('button', { name: /^Usar a triagem geral/ })
      await umToque.waitFor({ timeout: ESPERA })
      await umToque.click()
      await itens.nth(1).waitFor({ timeout: ESPERA })
      if ((await itens.count()) < 3) erros.push('o modelo de um toque não montou a triagem')

      if (!(await pagina.getByRole('button', { name: /Testar meu assistente/ }).isEnabled())) {
        erros.push('“Testar meu assistente” ficou desabilitado com a triagem montada')
      }

      // O FLUXOGRAMA mora no lugar da prévia do celular — aqui, a 390px, na aba
      // "Fluxograma". Ele tem de mostrar as perguntas do advogado E o fim da
      // conversa.
      await pagina.getByRole('button', { name: 'Fluxograma', exact: true }).click()
      const mapa = pagina.locator('[data-mapa]')
      await mapa.waitFor({ timeout: ESPERA })
      const textoDoMapa = await mapa.innerText()
      if (!/Qual assunto/i.test(textoDoMapa)) {
        erros.push('o fluxograma não mostra as perguntas do advogado')
      }
      if (!/WhatsApp/i.test(textoDoMapa)) erros.push('o fluxograma não mostra o fim da conversa')

      // LIGAR, pelo próprio fluxograma: toca na primeira resposta da pergunta 1
      // e marca a pergunta 2. O trecho "Só para quem respondeu" tem de aparecer
      // — é o desenho sendo lido de volta.
      await mapa.locator('button[aria-expanded]').first().click()
      // Só dá para ligar a perguntas SEGUINTES: nenhuma oferecida pode ser a
      // própria pergunta nem uma anterior — é o que torna o loop impossível.
      const oferecidas = await mapa.locator('fieldset li').allInnerTexts()
      if (!oferecidas.length) erros.push('o fluxograma não ofereceu pergunta nenhuma para ligar')
      if (oferecidas.some((t) => /^1\./.test(t.trim()))) {
        erros.push('o fluxograma ofereceu ligar a resposta à própria pergunta ou a uma anterior')
      }
      await mapa.getByRole('checkbox', { name: /^2\./ }).check()
      await mapa.getByText(/Só para quem respondeu/).first().waitFor({ timeout: ESPERA })
      const mudosNoMapa = await semNome(pagina, '[data-mapa]')
      if (mudosNoMapa.length) {
        erros.push(`controles sem nome acessível no fluxograma: ${mudosNoMapa.join(', ')}`)
      }
      await mapa.getByRole('button', { name: 'Pronto', exact: true }).click()

      // TIRAR uma pergunta que o assistente faz sozinho, e DEVOLVER: o passo sai
      // do fluxo, aparece riscado com "Devolver", e volta. A abertura, com o
      // aviso de segurança, não pode ter botão de tirar.
      const tirar = mapa.getByRole('button', { name: /^Tirar “/ }).first()
      if (!(await tirar.count())) {
        erros.push('o fluxograma não oferece tirar nenhuma pergunta que o assistente faz sozinho')
      } else {
        const nomeDoBotao = (await tirar.getAttribute('aria-label')) ?? ''
        const passo = nomeDoBotao.replace(/^Tirar “/, '').replace(/” da conversa$/, '')
        await tirar.click()
        const devolver = mapa.getByRole('button', { name: `Devolver “${passo}” à conversa` })
        await devolver.waitFor({ timeout: ESPERA })
        await devolver.click()
        await mapa.getByRole('button', { name: nomeDoBotao, exact: true }).waitFor({ timeout: ESPERA })
      }
      if (await mapa.getByRole('button', { name: /^Tirar “Abertura/ }).count()) {
        erros.push('a abertura com o aviso de segurança pode ser tirada da conversa')
      }

      // A MESMA ligação, vista da pergunta de destino: a pergunta 2 diz "Só quem
      // deu uma resposta", e não sobe acima da pergunta de que depende.
      await pagina.getByRole('button', { name: 'Editar', exact: true }).click()
      await pagina.getByRole('button', { name: 'Editar a pergunta 2' }).click()
      const soQuem = pagina
        .getByRole('group', { name: 'Quem recebe esta pergunta' })
        .getByRole('button', { name: 'Só quem deu uma resposta' })
      await soQuem.waitFor({ timeout: ESPERA })
      if ((await soQuem.getAttribute('aria-pressed')) !== 'true') {
        erros.push('a ligação feita no fluxograma não aparece na pergunta de destino')
      }
      if (await pagina.getByRole('button', { name: 'Mover a pergunta 2 para cima' }).isEnabled()) {
        erros.push('dá para subir a pergunta acima daquela de que ela depende')
      }

      // O botão que abre os modelos leva o título da caixa junto no nome
      // acessível ("Começar por um modelo Ver modelos") — daí a expressão.
      await pagina.getByRole('button', { name: /Ver modelos/ }).click()
      await pagina.getByRole('button', { name: /^Direito de Família/ }).click()
      await itens.nth(1).waitFor({ timeout: ESPERA })
      const primeira = pagina.getByRole('button', { name: 'Editar a pergunta 1' })
      await primeira.waitFor({ timeout: ESPERA })
      await primeira.click()
      const mudos = await semNome(pagina, '[data-triagem-editor]')
      if (mudos.length) erros.push(`controles sem nome acessível no editor: ${mudos.join(', ')}`)
      // Ordenar pelo teclado: a primeira pergunta não sobe, a segunda sim.
      const paraCima = pagina.getByRole('button', { name: 'Mover a pergunta 2 para cima' })
      await paraCima.waitFor({ timeout: ESPERA })
      await paraCima.press('Enter')
    } catch (e) {
      erros.push(`editor da triagem: ${String(e).split('\n')[0]}`)
    }
    erros.push(...runtime)
    await contexto.close()
  }

  // 2. A conversa: cada gesto alcançável pelo Tab e com nome.
  {
    const { contexto, pagina, erros: runtime } = await abrir('/ana-smoke-1234/agendar')
    try {
      const area = pagina.locator('[data-conversa-resposta]')
      await area.locator('button').first().waitFor({ timeout: ESPERA })
      const mudos = await semNome(pagina, '[data-conversa-resposta]')
      if (mudos.length) erros.push(`controles sem nome na conversa: ${mudos.join(', ')}`)
      // O log da conversa é anunciado sozinho (role=log + aria-live).
      const log = pagina.locator('[role="log"]')
      if ((await log.getAttribute('aria-live')) !== 'polite') {
        erros.push('a conversa não é anunciada por leitor de tela (aria-live)')
      }
      // Tab alcança a primeira opção da triagem.
      await pagina.keyboard.press('Tab')
      const focado = await pagina.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
      if (!focado) erros.push('o Tab não alcançou nenhum controle da conversa')
    } catch (e) {
      erros.push(`conversa da triagem: ${String(e).split('\n')[0]}`)
    }
    erros.push(...runtime)
    await contexto.close()
  }

  return erros
}

/**
 * A busca do editor leva ao CAMPO, e o painel tem porta para cada seção.
 *
 * Digita "whats" na bio, clica no primeiro resultado: o endereço tem de virar
 * ?section=redes#whatsapp, o campo tem de acender (classe `campo-alvo`) e o
 * chip ativo tem de trocar. Depois, no painel: "Editar perfil" existe, a grade
 * "Seu perfil" tem um cartão por seção e o índice fica ACIMA da agenda — três
 * coisas que um teste de unidade não enxerga.
 */
async function buscaDoEditor() {
  const { contexto, pagina, erros } = await abrir('/editor?section=bio')
  try {
    const busca = pagina.getByPlaceholder(/O que você quer mudar/)
    await busca.waitFor({ timeout: ESPERA })
    await busca.fill('whats')
    const resultado = pagina.getByRole('list', { name: 'Resultados da busca' }).getByRole('link').first()
    await resultado.waitFor({ timeout: ESPERA })
    if (!/WhatsApp/.test(await resultado.innerText())) erros.push('"whats" não achou o WhatsApp primeiro')
    await resultado.click()
    await pagina.waitForURL(/section=redes#whatsapp$/, { timeout: ESPERA })
    await pagina.waitForFunction(
      () => document.getElementById('whatsapp')?.classList.contains('campo-alvo'),
      null,
      { timeout: ESPERA },
    )
    const ativo = await pagina
      .locator('nav[aria-label="Seções do editor"] [aria-current="page"]')
      .innerText()
    if (!/Contato e redes/.test(ativo)) erros.push(`o chip ativo diz "${ativo}"`)

    await pagina.goto(BASE + '/painel', { waitUntil: 'networkidle', timeout: ESPERA })
    await pagina.getByRole('link', { name: 'Editar perfil' }).waitFor({ timeout: ESPERA })
    for (const nome of ['Dados e foto', 'Apresentação', 'Contato e redes', 'Áreas', 'Local e endereço', 'Tema']) {
      if (!(await pagina.getByRole('link', { name: new RegExp(`^${nome}`) }).count())) {
        erros.push(`o painel não tem o cartão "${nome}"`)
      }
    }
    const indice = await pagina.getByText('Índice de confiança', { exact: true }).boundingBox()
    const agenda = await pagina.getByRole('heading', { name: 'Sua agenda' }).boundingBox()
    if (!indice || !agenda) erros.push('não achou o índice ou a agenda no painel')
    else if (indice.y > agenda.y) erros.push('a agenda apareceu acima do índice')
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

/**
 * O perfil de EXEMPLO não sai da página — em lugar nenhum.
 *
 * Os perfis-modelo são fictícios, e isso inclui o WhatsApp: um número inventado
 * pode ser de alguém de verdade. Desde 12/09/2026 os botões deles só dizem o que
 * fariam (lib/exemplo.ts). São três portas, e cada uma é um componente
 * diferente — conferir uma não prova as outras: o telefone da home (ProfileView
 * em prévia), a página cheia do exemplo (ProfileView de verdade) e o fim da
 * conversa do assistente (AssistantChat).
 */
async function exemploNaoSai() {
  const erros = []

  // Toca num link e confere: apareceu o aviso, a página não mudou, aba nenhuma abriu.
  const tocar = async (contexto, pagina, escopo, nome, caminho) => {
    const abas = []
    const contar = (p) => abas.push(p)
    contexto.on('page', contar)
    const link = escopo.getByRole('link', { name: nome }).first()
    // Centralizado antes do toque: rente à borda, o aviso do toque anterior (que
    // mora no pé da tela) ficaria por cima dele.
    await link.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await link.click()
    await escopo
      .getByRole('status')
      .filter({ hasText: /Num perfil de verdade/ })
      .first()
      .waitFor({ timeout: ESPERA })
    contexto.off('page', contar)
    if (new URL(pagina.url()).pathname !== caminho) erros.push(`"${nome}" levou para ${pagina.url()}`)
    if (abas.length) erros.push(`"${nome}" abriu outra aba`)
    const fechar = escopo.getByRole('button', { name: 'Fechar o aviso' }).first()
    await fechar.click()
    await fechar.waitFor({ state: 'detached', timeout: ESPERA })
  }

  // 1. O telefone da home: o cartaz está lá, e nenhum botão sai.
  {
    const { contexto, pagina, erros: runtime } = await abrir('/')
    try {
      const moldura = pagina.locator('[data-moldura-telefone]').first()
      await moldura.getByText('Exemplo · dados fictícios').waitFor({ timeout: ESPERA })
      await tocar(contexto, pagina, moldura, 'Conversar no WhatsApp', '/')
      await tocar(contexto, pagina, moldura, 'Instagram', '/')
    } catch (e) {
      erros.push(`telefone da home: ${String(e).split('\n')[0]}`)
    }
    erros.push(...runtime)
    await contexto.close()
  }

  // 2. A página cheia do exemplo ("Ver um exemplo").
  {
    const { contexto, pagina, erros: runtime } = await abrir(`/${SLUG}`)
    try {
      await pagina.getByText(/sem levar a lugar nenhum/).waitFor({ timeout: ESPERA })
      await tocar(contexto, pagina, pagina, 'Conversar no WhatsApp', `/${SLUG}`)
      await tocar(contexto, pagina, pagina, 'LinkedIn', `/${SLUG}`)
    } catch (e) {
      erros.push(`página do exemplo: ${String(e).split('\n')[0]}`)
    }
    erros.push(...runtime)
    await contexto.close()
  }

  // 3. O fim da conversa do assistente, no exemplo: botão sem link, e o
  //    assistente diz que nada foi enviado.
  {
    const { contexto, pagina, erros: runtime } = await abrir(`/${SLUG}/agendar`)
    try {
      await ateOFimDaConversa(pagina)
      const botao = pagina.getByRole('button', { name: /Enviar no WhatsApp/ })
      await botao.waitFor({ timeout: ESPERA })
      if (await pagina.getByRole('link', { name: /Enviar no WhatsApp/ }).count()) {
        erros.push('o fim da conversa do exemplo ainda é um link para o WhatsApp')
      }
      await botao.click()
      await pagina.getByText(/nada foi enviado/).first().waitFor({ timeout: ESPERA })
      if (new URL(pagina.url()).pathname !== `/${SLUG}/agendar`) {
        erros.push(`o fim da conversa do exemplo levou para ${pagina.url()}`)
      }
    } catch (e) {
      erros.push(`conversa do exemplo: ${String(e).split('\n')[0]}`)
    }
    erros.push(...runtime)
    await contexto.close()
  }

  return erros
}

/**
 * A comparação de planos no celular: um plano por vez, sem rolagem lateral.
 *
 * A tabela rolava de lado dentro de uma moldura e escondia Pro e Max atrás de
 * um "deslize para ver"; virou um seletor (components/landing/CompararPlanos).
 * Três coisas aqui só existem no navegador: a tabela larga sumir na tela
 * estreita, a home não rolar de lado, e o seletor GRUDAR no topo — que depende
 * de a raiz da home não ser contêiner de rolagem (overflow-x-clip).
 */
async function comparacaoNoCelular() {
  const { contexto, pagina, erros } = await abrir('/')
  try {
    const abas = pagina.getByRole('tablist', { name: /Escolha um plano/ })
    await abas.waitFor({ timeout: ESPERA })
    if (await pagina.locator('table').isVisible()) erros.push('a tabela larga apareceu no celular')
    const [larguraDoConteudo, larguraDaTela] = await pagina.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ])
    if (larguraDoConteudo > larguraDaTela) {
      erros.push(`a home rola de lado no celular (${larguraDoConteudo} > ${larguraDaTela})`)
    }
    await pagina.getByRole('tab', { name: /Max/ }).click()
    const selecionada = await pagina.getByRole('tab', { selected: true }).innerText()
    if (!selecionada.includes('Max')) erros.push(`tocar em Max selecionou "${selecionada}"`)
    // No fim da lista, o seletor tem de continuar no topo da tela. `instant`
    // porque a home rola suave, e medir no meio da animação mede nada.
    await pagina
      .getByRole('link', { name: /Assinar Max/ })
      .last()
      .evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await pagina.waitForTimeout(300)
    const caixa = await abas.boundingBox()
    if (!caixa || caixa.y < 0 || caixa.y > 40) {
      erros.push(`o seletor de plano não ficou grudado no topo (y=${caixa && Math.round(caixa.y)})`)
    }
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

/**
 * Um modelo próprio do começo ao uso: escrever, ser barrado por um CPF no texto,
 * trocar pelo campo, salvar, voltar à lista, usar o modelo e ver o campo que o
 * advogado inventou virar pergunta — e a resposta aparecer na folha.
 *
 * É a trava de dado pessoal no DOM: se ela parar de aparecer, ou se o salvar
 * passar por cima dela, este percurso quebra.
 */
async function modeloProprioDoAdvogado() {
  const { contexto, pagina, erros } = await abrir('/contratos/modelos/novo')
  try {
    await pagina.getByText('O modelo guarda só texto').waitFor({ timeout: ESPERA })
    await pagina.locator('input[name="nome-do-modelo"]').fill('Consultoria mensal')
    await pagina.locator('input[name="titulo-do-documento"]').fill('Contrato de consultoria jurídica')
    const objeto = pagina.getByLabel('Texto do trecho 2')
    await objeto.fill('Consultoria mensal para o cliente de CPF 529.982.247-25.')
    await pagina.getByText('Isto não pode ficar no modelo').waitFor({ timeout: ESPERA })
    await clicar(pagina, 'Salvar modelo')
    if (!/\/contratos\/modelos\/novo/.test(pagina.url())) erros.push('salvou um modelo com CPF no texto')

    await objeto.fill('Consultoria jurídica mensal, pelo valor de {Valor mensal}.')
    await pagina.getByText('Isto não pode ficar no modelo').waitFor({ state: 'detached', timeout: ESPERA })
    await clicar(pagina, 'Salvar modelo')
    await pagina.waitForURL(/\/contratos(\?|$)/, { timeout: ESPERA })

    await pagina.getByRole('button', { name: 'Usar o modelo Consultoria mensal' }).click()
    await pagina.waitForURL(/\/contratos\/rascunho\//, { timeout: ESPERA })
    await pagina.locator('label', { hasText: /^Advogada$/ }).first().click()
    await pagina.getByLabel(/^Endereço profissional/).fill('Av. Afonso Pena, 1500, Belo Horizonte/MG')
    await pagina.getByLabel(/^Nome completo/).fill('João da Silva')
    await pagina.getByLabel(/^Nacionalidade/).fill('brasileiro')
    await pagina.getByLabel(/^Estado civil/).fill('solteiro')
    await pagina.getByLabel(/^Profissão/).fill('engenheiro')
    await pagina.getByLabel(/^CPF/).fill('52998224725')
    await pagina.getByLabel(/^Endereço completo/).fill('Rua das Flores, 120, Belo Horizonte/MG')
    await pagina.getByLabel(/^Valor mensal/).fill('R$ 2.000,00')
    await clicar(pagina, 'Montar a minuta')

    const folha = pagina.locator('article[aria-label^="Documento:"]')
    await folha.waitFor({ timeout: ESPERA })
    const textoDaFolha = (await folha.locator('textarea').evaluateAll((els) => els.map((e) => e.value))).join('\n')
    if (!textoDaFolha.includes('pelo valor de R$ 2.000,00')) erros.push('o campo do modelo não virou o valor preenchido')
    if (/\{|\}/.test(textoDaFolha)) erros.push('sobrou campo entre chaves na minuta')
  } catch (e) {
    erros.push(String(e).split('\n')[0])
  }
  await contexto.close()
  return erros
}

const CONVERSAS = [
  ['busca do editor e portas do painel', buscaDoEditor],
  ['comparação de planos no celular', comparacaoNoCelular],
  ['balão de conversa no celular da home', balaoNoCelular],
  ['perfil de exemplo não sai da página', exemploNaoSai],
  ['agenda do advogado (editor)', agendaDoAdvogado],
  ['contrato do advogado, do modelo à conferência', contratoDoAdvogado],
  ['modelo próprio: trava de dado pessoal, salvar e usar', modeloProprioDoAdvogado],
  ['assistente do perfil', conversaDoPerfil],
  ['teste do próprio assistente', conversaDeTeste],
  ['tela da triagem: montar, ver o roteiro e acessibilidade', acessibilidadeDaTriagem],
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
