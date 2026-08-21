import { describe, expect, it } from 'vitest'
import {
  BLEED_H,
  BLEED_W,
  CARD_MM,
  CARD_TAGLINE_MAX,
  DEFAULT_CARD,
  esc,
  fitText,
  phoneLabel,
  pxAt300,
  renderCard,
  renderSheet,
  resolveCard,
  type CardConfig,
  type CardTemplate,
} from './cardArt'
import { publicTexts } from './oab'
import type { Profile } from './types'

// O cartão vai para o PAPEL: errado aqui custa uma tiragem inteira. Estes testes
// guardam as três coisas que não podem quebrar em silêncio — a medida física, o
// endereço que o QR carrega e o escape do texto digitado.

const perfil: Profile = {
  slug: 'marina-sales',
  name: 'Marina Sales',
  oabNumber: 'OAB/SP 123.456',
  headline: 'Advogada · Família',
  bio: 'Atuo em Direito de Família.',
  city: 'São Paulo',
  state: 'SP',
  serviceMode: { inPerson: true, online: true },
  areas: [
    { id: 'a1', label: 'Direito de Família', description: '' },
    { id: 'a2', label: 'Sucessões', description: '' },
    { id: 'a3', label: 'Contratos', description: '' },
  ],
  socials: [],
  contact: { whatsapp: '5511998877665', email: 'marina@exemplo.com.br' },
  plan: 'premium',
  theme: 'papel',
}

const cfg = (patch: Partial<CardConfig> = {}): CardConfig => ({ ...DEFAULT_CARD, ...patch })
const MODELOS: CardTemplate[] = ['timbre', 'razao', 'reto']

describe('medidas do papel', () => {
  it('a arte sai com sangria nos dois eixos', () => {
    expect(BLEED_W).toBe(CARD_MM.trimW + 6)
    expect(BLEED_H).toBe(CARD_MM.trimH + 6)
  })

  it('300 dpi: 96 mm viram 1134 px', () => {
    expect(pxAt300(BLEED_W)).toBe(1134)
    expect(pxAt300(BLEED_H)).toBe(661)
  })

  it('o SVG declara o tamanho em milímetros e o viewBox em milímetros', () => {
    const svg = renderCard(perfil, cfg(), 'frente')
    expect(svg).toContain(`width="${BLEED_W}mm"`)
    expect(svg).toContain(`height="${BLEED_H}mm"`)
    expect(svg).toContain(`viewBox="0 0 ${BLEED_W} ${BLEED_H}"`)
  })

  it('a prévia sem sangria mostra só o que sobra do corte', () => {
    // O que a pessoa recebe são 90 × 50 mm. Mostrar a sangria na tela prometeria
    // uma borda de 3 mm que a guilhotina leva embora.
    const svg = renderCard(perfil, cfg(), 'frente', { sangria: false })
    expect(svg).toContain(`width="${CARD_MM.trimW}mm"`)
    expect(svg).toContain(`viewBox="${CARD_MM.bleed} ${CARD_MM.bleed} ${CARD_MM.trimW} ${CARD_MM.trimH}"`)
  })

  it('o fundo é um elemento desenhado, não um estilo de fundo', () => {
    // Impressão pelo navegador com "gráficos de plano de fundo" desligado sai
    // branca se o fundo for CSS. Como <rect>, sai sempre.
    const svg = renderCard(perfil, cfg(), 'frente')
    expect(svg).toMatch(new RegExp(`<rect x="0" y="0" width="${BLEED_W}" height="${BLEED_H}" fill="#`))
    expect(svg).not.toContain('background')
  })
})

describe('conteúdo do cartão', () => {
  it('todo modelo mostra nome e inscrição', () => {
    for (const template of MODELOS) {
      const svg = renderCard(perfil, cfg({ template }), 'frente')
      expect(svg, template).toContain('Marina Sales')
      expect(svg, template).toContain('OAB/SP 123.456')
    }
  })

  it('o telefone sai com máscara brasileira, sem o código do país', () => {
    expect(phoneLabel('5511998877665')).toBe('(11) 99887-7665')
    expect(phoneLabel('')).toBe('')
    const svg = renderCard(perfil, cfg(), 'frente')
    expect(svg).toContain('(11) 99887-7665')
    expect(svg).not.toContain('5511998877665')
  })

  it('desligar um campo tira o campo do papel', () => {
    const svg = renderCard(perfil, cfg({ showWhatsapp: false, showEmail: false, showCity: false }), 'frente')
    expect(svg).not.toContain('99887-7665')
    expect(svg).not.toContain('marina@exemplo.com.br')
    expect(svg).not.toContain('São Paulo')
  })

  it('a linha livre ocupa o lugar das áreas', () => {
    const comAreas = renderCard(perfil, cfg(), 'frente')
    expect(comAreas).toContain('Direito de Família')

    const comLinha = renderCard(perfil, cfg({ tagline: 'Família e Sucessões' }), 'frente')
    expect(comLinha).toContain('Família e Sucessões')
  })

  it('no máximo duas áreas entram — o cartão não é o perfil', () => {
    const svg = renderCard(perfil, cfg(), 'frente')
    expect(svg).not.toContain('Contratos')
  })

  it('sem foto marcada, nenhuma imagem entra na arte', () => {
    const comFoto = { ...perfil, avatarUrl: 'data:image/jpeg;base64,AAAA' }
    expect(renderCard(comFoto, cfg({ showPhoto: false }), 'frente')).not.toContain('<image')
    expect(renderCard(comFoto, cfg({ showPhoto: true }), 'frente')).toContain('<image')
  })
})

describe('verso', () => {
  it('o QR carrega o endereço REAL do perfil, e o rótulo diz o mesmo', () => {
    // O bug que este teste guarda: rótulo dizendo um endereço e código levando a
    // outro. Quem imprime só descobre depois de mil cartões na mão.
    const svg = renderCard(perfil, cfg(), 'verso')
    expect(svg).toContain('/marina-sales')
    expect(svg).toContain('<path d="M')
  })

  it('sem QR, o verso repete o timbre em vez de sair vazio', () => {
    const svg = renderCard(perfil, cfg({ showQr: false }), 'verso')
    expect(svg).not.toContain('Aponte a câmera')
    expect(svg).toContain('Marina Sales')
  })
})

describe('texto digitado', () => {
  it('escapa o que quebraria o SVG', () => {
    expect(esc('<script>&"x"')).toBe('&lt;script&gt;&amp;&quot;x&quot;')
  })

  it('um nome com sinais de marcação não injeta elemento nenhum', () => {
    // A prévia injeta esta string como HTML: sem escape, isto vira execução.
    const hostil = { ...perfil, name: '<img src=x onerror=alert(1)>' }
    const svg = renderCard(hostil, cfg(), 'frente')
    expect(svg).not.toContain('<img')
    expect(svg).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('nome comprido encolhe em vez de vazar da área segura', () => {
    const longo = 'Maria Aparecida da Conceição Albuquerque Vasconcelos'
    const { size, text } = fitText(longo, 82, 6.2, { factor: 0.56 })
    expect(size).toBeLessThan(6.2)
    expect(text.length * (size * 0.56)).toBeLessThanOrEqual(82)
  })

  it('quando nem encolhendo cabe, corta com reticências', () => {
    const { text } = fitText('x'.repeat(400), 82, 6.2, { factor: 0.56 })
    expect(text.endsWith('…')).toBe(true)
    expect(text.length).toBeLessThan(400)
  })

  it('texto que cabe não é mexido', () => {
    expect(fitText('Marina Sales', 82, 6.2)).toEqual({ text: 'Marina Sales', size: 6.2 })
  })
})

describe('configuração', () => {
  it('modelo desconhecido cai no padrão', () => {
    expect(resolveCard({ template: 'chique' as CardTemplate }).template).toBe(DEFAULT_CARD.template)
    expect(resolveCard(undefined)).toEqual(DEFAULT_CARD)
  })

  it('a linha livre é cortada no limite, venha de onde vier', () => {
    const c = resolveCard({ tagline: 'a'.repeat(500) })
    expect(c.tagline.length).toBe(CARD_TAGLINE_MAX)
  })

  it('a linha livre é conferida junto com o resto do perfil', () => {
    // publicTexts é a lista ÚNICA do que passa pela checagem de conformidade —
    // um campo público fora dela é um campo que ninguém confere.
    const rotulos = publicTexts({ card: { tagline: 'o melhor advogado' } }).map((t) => t.label)
    expect(rotulos).toContain('Linha do cartão de visita')
  })
})

describe('fontes trocadas na exportação', () => {
  it('a pilha de fonte pedida substitui a do tema', () => {
    // O PNG embute a fonte com nome próprio (ver lib/cardExport.ts). Sem esta
    // porta, o arquivo exportado sairia com a fonte de reserva.
    const svg = renderCard(perfil, cfg(), 'frente', {
      fonts: { display: "'AdvCardDisplay', serif", body: "'AdvCardBody', sans-serif" },
    })
    expect(svg).toContain('AdvCardDisplay')
    expect(svg).toContain('AdvCardBody')
    expect(svg).not.toContain('Fraunces')
  })
})

describe('folha da gráfica', () => {
  const folha = renderSheet(perfil, cfg())

  it('é uma A4 com os dois lados', () => {
    expect(folha).toContain('width="210mm"')
    expect(folha).toContain('height="297mm"')
    expect(folha).toContain('FRENTE')
    expect(folha).toContain('VERSO')
  })

  it('traz as marcas de corte e a ficha técnica que a gráfica pede', () => {
    expect(folha).toContain('90 × 50 mm de corte final')
    expect(folha).toContain('3 mm de sangria em cada lado')
    expect(folha).toContain('300 dpi')
    // 8 marcas por cartão × 2 cartões
    expect((folha.match(/stroke-width="0\.2"/g) ?? []).length).toBe(16)
  })

  it('cada lado tem seus próprios ids — dois cartões não dividem recorte', () => {
    const comFoto = renderSheet({ ...perfil, avatarUrl: 'data:image/jpeg;base64,AAAA' }, cfg({ showPhoto: true }))
    const ids = comFoto.match(/id="(c\d+-foto)"/g) ?? []
    expect(new Set(ids).size).toBe(ids.length)
  })
})
