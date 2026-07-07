import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = process.argv[2] || './shots'
const BASE = 'http://localhost:5173/__preview'
const THEMES = [
  'papel',
  'nevoa',
  'esmeralda',
  'toga',
  'ardosia',
  'meia-noite',
  'obsidian',
  'marmore',
]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 1400 }, deviceScaleFactor: 2 })

for (const t of THEMES) {
  await page.goto(`${BASE}/${t}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${t}.png`, fullPage: true })
  console.log('shot', t)
}

await browser.close()
console.log('done →', OUT)
