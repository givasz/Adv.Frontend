// Gera os ativos de marca que o navegador e os mensageiros pedem em BITMAP.
//
//   public/og-padrao.jpg       1200×630 — prévia de link da home e de perfil sem foto
//   public/apple-touch-icon.png  180×180 — ícone ao salvar na tela de início do iPhone
//
// Rodar: `npm run brand`. O resultado é COMMITADO — não é passo de build.
// Regerar só ao mexer na marca; os arquivos mudam pouco e o build não deve
// depender de baixar um navegador.
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
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(RAIZ, 'public')

const COR = {
  paper: '#f5f0e6',
  paperSoft: '#faf6ec',
  ink: '#211c17',
  inkFaint: '#6b6155',
  burgundy: '#6b2131',
  brass: '#b08d57',
}

// A balança do produto — mesmo traçado de ScaleIcon (components/ui/icons.tsx).
const BALANCA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
  stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3v18M7 21h10M5 7h14M5 7l-2.5 6a3.5 3.5 0 0 0 5 0L5 7Zm14 0-2.5 6a3.5 3.5 0 0 0 5 0L19 7ZM12 5 5 7m7-2 7 2" />
</svg>`

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
  .marca{display:flex;align-items:center;gap:18px;margin-bottom:40px}
  .marca svg{width:56px;height:56px;color:${COR.burgundy}}
  .marca span{font-family:Fraunces,Georgia,serif;font-size:42px;font-weight:600;letter-spacing:-.02em}
  h1{font-family:Fraunces,Georgia,serif;font-size:76px;line-height:1.06;
    font-weight:600;letter-spacing:-.025em;max-width:16ch}
  p{margin-top:28px;font-size:30px;line-height:1.45;color:${COR.inkFaint};max-width:30ch}
  .regua{margin-top:52px;display:flex;align-items:center;gap:14px}
  .regua i{display:block;width:96px;height:5px;border-radius:3px;background:${COR.brass}}
  .regua b{font-size:22px;font-weight:500;color:${COR.inkFaint};letter-spacing:.01em}
</style></head><body>
  <div class="marca">${BALANCA}<span>advoc.me</span></div>
  <h1>Sua presença digital, dentro das regras.</h1>
  <p>A página de perfil única e compartilhável para advogados.</p>
  <div class="regua"><i></i><b>Prov. 205/2021 · Código de Ética</b></div>
</body></html>`

const icone = `<!doctype html><html><head><meta charset="utf-8">${FONTES}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:180px;height:180px;background:${COR.paperSoft};
    display:flex;align-items:center;justify-content:center}
  svg{width:112px;height:112px;color:${COR.burgundy}}
</style></head><body>${BALANCA}</body></html>`

const alvos = [
  { nome: 'og-padrao.jpg', html: og, largura: 1200, altura: 630, jpeg: true },
  { nome: 'apple-touch-icon.png', html: icone, largura: 180, altura: 180 },
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
  // JPEG na imagem grande: ela é quase toda degradê, e um PNG disso passa dos
  // 300 KB que o WhatsApp recomenda como teto para prévia. O ícone continua PNG,
  // que preserva o traço fino da balança sem os artefatos do JPEG.
  const bytes = await pagina.screenshot(
    alvo.jpeg ? { type: 'jpeg', quality: 88 } : { type: 'png' },
  )
  writeFileSync(join(PUBLIC, alvo.nome), bytes)
  console.log(`✓ public/${alvo.nome} (${alvo.largura}×${alvo.altura}, ${Math.round(bytes.length / 1024)} KB)`)
  await pagina.close()
}

await navegador.close()
