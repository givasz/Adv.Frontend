// Gera public/logo.png a partir de scripts/fonte/logo.jpg.
//
//   entrada  scripts/fonte/logo.jpg   a marca como ela chegou: dourado sobre um
//                                     quadrado preto, com margem larga
//   saída    public/logo.png          a mesma marca com FUNDO TRANSPARENTE,
//                                     recortada rente e reduzida
//
// Rodar: `npm run logo`. O resultado é COMMITADO — não é passo de build, igual
// ao gen-brand-assets.mjs. Regerar só quando a marca mudar.
//
// POR QUE NÃO USAR O JPEG DIRETO
//
// O fundo do site é creme. Um quadrado preto ao lado da palavra "advoc.me" no
// cabeçalho não lê como logotipo, lê como imagem que não carregou. E o perfil
// público tem temas escuros, onde o mesmo quadrado apareceria com uma borda
// dura em volta. Fundo transparente resolve os dois de uma vez.
//
// COMO O FUNDO VIRA TRANSPARÊNCIA
//
// A marca é dourado CHAPADO sobre preto — não um objeto translúcido. Então o
// alfa NÃO pode ser a luminância do pixel: o degradê do próprio dourado viraria
// transparência e a logo sairia lavada sobre o creme (foi a primeira tentativa,
// e ficou amarelo-pálido).
//
// O que de fato separa dentro de fora é uma faixa de um pixel na borda, onde o
// JPEG misturou o dourado com o preto. Daí a regra: opaco acima de ALTO,
// transparente abaixo de BAIXO, e rampa suave no meio — com a cor da faixa
// clareada na proporção da mistura, senão sobra um contorno escuro em volta da
// marca sobre fundo claro.
//
// POR QUE PLAYWRIGHT
//
// Mesmo motivo do gen-brand-assets.mjs: o projeto já tem um navegador instalado
// para o smoke das rotas, e o canvas dele decodifica JPEG e escreve PNG com
// canal alfa sem acrescentar uma única dependência de imagem ao package.json.

import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENTRADA = join(RAIZ, 'scripts', 'fonte', 'logo.jpg')
const SAIDA = join(RAIZ, 'public', 'logo.png')
const SAIDA_TELA = join(RAIZ, 'public', 'logo-144.png')

/** Abaixo disto é fundo; acima daquilo é marca; no meio, a borda serrilhada. */
const BAIXO = 8
const ALTO = 64
/** Altura da MATRIZ (logo.png): é a fonte do gen-brand-assets, fica grande. */
const ALTURA = 360
/**
 * Altura da versão DE TELA (logo-144.png), a que o componente Marca de fato
 * carrega. O maior uso na interface é 46px (o 404 do perfil); 144 cobre 3x de
 * densidade com folga. A matriz de 360 pesava 66KB e era desenhada a 20px de
 * altura no rodapé de todo perfil free — puro peso sem um pixel a mais na tela.
 */
const ALTURA_TELA = 144

const navegador = await chromium.launch()
const pagina = await navegador.newPage()

const base64 = readFileSync(ENTRADA).toString('base64')

const png = await pagina.evaluate(
  async ({ dataUrl, BAIXO, ALTO, ALTURA, ALTURA_TELA }) => {
    const img = new Image()
    img.src = dataUrl
    await img.decode()

    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const dados = ctx.getImageData(0, 0, c.width, c.height)
    const p = dados.data

    // Limites do que sobrou, para recortar a margem preta no mesmo passo.
    let x0 = c.width
    let y0 = c.height
    let x1 = -1
    let y1 = -1

    for (let i = 0; i < p.length; i += 4) {
      const m = Math.max(p[i], p[i + 1], p[i + 2])
      if (m <= BAIXO) {
        p[i + 3] = 0
        continue
      }
      if (m >= ALTO) {
        p[i + 3] = 255
      } else {
        const a = (m - BAIXO) / (ALTO - BAIXO)
        // Piso de 0.35 na divisão: sem ele, um pixel quase preto viraria branco
        // estourado em vez de dourado claro.
        const k = Math.max(a, 0.35)
        p[i] = Math.min(255, Math.round(p[i] / k))
        p[i + 1] = Math.min(255, Math.round(p[i + 1] / k))
        p[i + 2] = Math.min(255, Math.round(p[i + 2] / k))
        p[i + 3] = Math.round(a * 255)
      }
      const px = (i / 4) % c.width
      const py = Math.floor(i / 4 / c.width)
      if (px < x0) x0 = px
      if (px > x1) x1 = px
      if (py < y0) y0 = py
      if (py > y1) y1 = py
    }
    ctx.putImageData(dados, 0, 0)

    const larguraCorte = x1 - x0 + 1
    const alturaCorte = y1 - y0 + 1
    const escala = ALTURA / alturaCorte

    const fim = document.createElement('canvas')
    fim.width = Math.round(larguraCorte * escala)
    fim.height = ALTURA
    const fctx = fim.getContext('2d')
    fctx.imageSmoothingQuality = 'high'
    fctx.drawImage(c, x0, y0, larguraCorte, alturaCorte, 0, 0, fim.width, fim.height)

    const blob = await new Promise((r) => fim.toBlob(r, 'image/png'))
    const buf = new Uint8Array(await blob.arrayBuffer())

    // Versão de tela: reduzida da MATRIZ já processada (mesmo recorte, mesmo
    // alfa), só menor — é a que a interface carrega de verdade.
    const tela = document.createElement('canvas')
    tela.width = Math.round(fim.width * (ALTURA_TELA / fim.height))
    tela.height = ALTURA_TELA
    const tctx = tela.getContext('2d')
    tctx.imageSmoothingQuality = 'high'
    tctx.drawImage(fim, 0, 0, tela.width, tela.height)
    const blobTela = await new Promise((r) => tela.toBlob(r, 'image/png'))
    const bufTela = new Uint8Array(await blobTela.arrayBuffer())

    return {
      bytes: Array.from(buf),
      largura: fim.width,
      altura: fim.height,
      bytesTela: Array.from(bufTela),
      larguraTela: tela.width,
      alturaTela: tela.height,
    }
  },
  { dataUrl: `data:image/jpeg;base64,${base64}`, BAIXO, ALTO, ALTURA, ALTURA_TELA },
)

await navegador.close()

writeFileSync(SAIDA, Buffer.from(png.bytes))
console.log(`${SAIDA}: ${png.largura}×${png.altura}, ${(png.bytes.length / 1024).toFixed(1)} KB`)
writeFileSync(SAIDA_TELA, Buffer.from(png.bytesTela))
console.log(
  `${SAIDA_TELA}: ${png.larguraTela}×${png.alturaTela}, ${(png.bytesTela.length / 1024).toFixed(1)} KB`,
)
