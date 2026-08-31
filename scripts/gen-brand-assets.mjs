// Gera os ativos de marca que o navegador e os mensageiros pedem em BITMAP.
//
//   public/og-padrao.jpg        1200×630 — prévia de link da home e de perfil sem foto
//   public/apple-touch-icon.png   180×180 — ícone ao salvar na tela de início do iPhone
//   public/favicon-32.png          32×32  — aba do navegador
//   public/favicon-192.png       192×192  — atalho no Android (manifest)
//   public/favicon-512.png       512×512  — splash e listagens do sistema (manifest)
//
// Rodar: `npm run brand`. O resultado é COMMITADO — não é passo de build.
// Regerar só ao mexer na marca; os arquivos mudam pouco e o build não deve
// depender de baixar um navegador.
//
// A FONTE DA MARCA É public/logo.png, e só ela.
//
// Até 31/08/2026 este script DESENHAVA uma balança em SVG, copiada à mão do
// ScaleIcon da interface. Era a "logo" do produto em todo lugar que o navegador
// olha — aba, tela de início, prévia de link — e não tinha nada a ver com a
// marca de verdade. Agora tudo aqui compõe a mesma imagem que o cabeçalho usa
// (ver scripts/gen-logo.mjs e components/ui/Marca.tsx): uma marca só, um arquivo
// só, e nada para divergir.
//
// POR QUE OS ÍCONES SÃO DOURADO SOBRE PRETO, E A MARCA DO SITE É TRANSPARENTE
//
// São dois trabalhos diferentes. Dentro da página, a marca fica ao lado do nome
// sobre o creme — precisa de fundo transparente. Já o ícone de aba e o de tela
// de início são LADRILHOS: o sistema os desenha sobre um fundo que não é nosso
// (a aba clara ou escura, a parede de ícones do telefone), e uma marca fina sem
// ladrilho some no meio. O preto é o fundo original da arte, então o ladrilho
// não inventa nada — devolve o que a logo já era.
//
// POR QUE PLAYWRIGHT E NÃO UM SVG
//
// `og:image` não aceita SVG: WhatsApp, LinkedIn e Telegram descartam o que não
// for PNG/JPEG, e o resultado é a prévia sem imagem — um retângulo cinza, que a
// pessoa lê como link quebrado. Precisa ser bitmap de verdade, e o projeto já
// tem um navegador instalado para o smoke das rotas. Desenhar em HTML e
// fotografar é mais legível (e mais fácil de ajustar) que qualquer biblioteca de
// imagem, e não acrescenta dependência nenhuma.
//
// A tipografia é a do produto (Fraunces/Hanken Grotesk, as mesmas do index.html)
// e as cores saem do tailwind.config.js. Se a paleta mudar lá, mude aqui também
// — são poucos valores, e duplicá-los custa menos que carregar o Tailwind inteiro
// dentro de um script de imagem.

import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(RAIZ, 'public')

const COR = {
  paper: '#f5f0e6',
  ink: '#211c17',
  inkFaint: '#6b6155',
  brass: '#b08d57',
  /** fundo do ladrilho — o mesmo preto de onde a arte da marca saiu */
  ladrilho: '#0b0b0b',
}

// A marca, embutida. Um caminho de arquivo dentro do HTML dependeria de o
// navegador ter permissão de ler file:// no contexto certo; um data URI não
// depende de nada e já chega decodificado junto com a página.
const LOGO = `data:image/png;base64,${readFileSync(join(PUBLIC, 'logo.png')).toString('base64')}`

const FONTES = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Hanken+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">`

// Textura de papel: as mesmas linhas discretas que a interface usa, para a prévia
// não parecer de outro produto.
const GRAO = `background-image:
  radial-gradient(circle at 18% 22%, rgba(176,141,87,.13), transparent 42%),
  radial-gradient(circle at 84% 78%, rgba(107,33,49,.10), transparent 46%);`

const og = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">${FONTES}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:${COR.paper};${GRAO}
    display:flex;flex-direction:column;justify-content:center;
    padding:0 96px;font-family:'Hanken Grotesk',system-ui,sans-serif;color:${COR.ink}}
  .marca{display:flex;align-items:center;gap:20px;margin-bottom:40px}
  .marca img{height:64px;width:auto;display:block}
  .marca span{font-family:Fraunces,Georgia,serif;font-size:42px;font-weight:600;letter-spacing:-.02em}
  h1{font-family:Fraunces,Georgia,serif;font-size:76px;line-height:1.06;
    font-weight:600;letter-spacing:-.025em;max-width:16ch}
  p{margin-top:28px;font-size:30px;line-height:1.45;color:${COR.inkFaint};max-width:30ch}
  .regua{margin-top:52px;display:flex;align-items:center;gap:14px}
  .regua i{display:block;width:96px;height:5px;border-radius:3px;background:${COR.brass}}
  .regua b{font-size:22px;font-weight:500;color:${COR.inkFaint};letter-spacing:.01em}
</style></head><body>
  <div class="marca"><img src="${LOGO}" alt=""><span>advoc.me</span></div>
  <h1>Sua presença digital, dentro das regras.</h1>
  <p>A página de perfil única e compartilhável para advogados.</p>
  <div class="regua"><i></i><b>Prov. 205/2021 · Código de Ética</b></div>
</body></html>`

/**
 * Ladrilho quadrado com a marca no meio.
 *
 * A folga é de apenas 3%: a marca é larga e baixa, e enquadrá-la num quadrado já
 * come quase 30% da altura sozinho. Com a folga generosa que um ícone normalmente
 * pede, a 16 px do favicon os dois pratos de baixo desapareciam — sobrava um
 * borrão dourado. Aqui ela ocupa a largura inteira e ainda se reconhece.
 */
const ladrilho = (lado) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0}
  body{width:${lado}px;height:${lado}px;background:${COR.ladrilho};
    display:flex;align-items:center;justify-content:center}
  img{width:94%;height:auto;display:block}
</style></head><body><img src="${LOGO}" alt=""></body></html>`

const alvos = [
  { nome: 'og-padrao.jpg', html: og, largura: 1200, altura: 630, jpeg: true },
  { nome: 'apple-touch-icon.png', html: ladrilho(180), largura: 180, altura: 180 },
  { nome: 'favicon-32.png', html: ladrilho(32), largura: 32, altura: 32 },
  { nome: 'favicon-192.png', html: ladrilho(192), largura: 192, altura: 192 },
  { nome: 'favicon-512.png', html: ladrilho(512), largura: 512, altura: 512 },
]

const navegador = await chromium.launch()
mkdirSync(PUBLIC, { recursive: true })

for (const alvo of alvos) {
  const pagina = await navegador.newPage({
    viewport: { width: alvo.largura, height: alvo.altura },
    deviceScaleFactor: 1,
  })
  await pagina.setContent(alvo.html, { waitUntil: 'networkidle' })
  // As fontes da web chegam depois do HTML; fotografar antes delas produz a
  // imagem na fonte de sistema — o erro clássico deste tipo de script.
  await pagina.evaluate(() => document.fonts.ready)
  // E a marca é uma imagem: sem esperar a decodificação dela, o ícone sai preto.
  await pagina.evaluate(() =>
    Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {})))),
  )
  // JPEG na imagem grande: ela é quase toda degradê, e um PNG disso passa dos
  // 300 KB que o WhatsApp recomenda como teto para prévia. Os ícones continuam
  // PNG, que preserva o traço fino da marca sem os artefatos do JPEG.
  const bytes = await pagina.screenshot(
    alvo.jpeg ? { type: 'jpeg', quality: 88 } : { type: 'png' },
  )
  writeFileSync(join(PUBLIC, alvo.nome), bytes)
  console.log(`✓ public/${alvo.nome} (${alvo.largura}×${alvo.altura}, ${Math.round(bytes.length / 1024)} KB)`)
  await pagina.close()
}

await navegador.close()
