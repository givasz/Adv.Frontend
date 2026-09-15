import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STORY,
  SAFE_BOTTOM,
  SAFE_TOP,
  STORY_AREAS_MAX,
  STORY_H,
  STORY_RODAPE,
  STORY_ROTULO,
  STORY_TEMPLATES,
  STORY_W,
  iniciaisDe,
  medirAproximado,
  quebrarItens,
  quebrarLinhas,
  renderStory,
  storyLines,
  type StoryConfig,
} from './storyArt'
import { AREA_LIMIT } from './plans'
import { sampleProfile } from './mockData'
import { checkCompliance } from './oab'
import type { Profile } from './types'

const cfg = (p: Partial<StoryConfig> = {}): StoryConfig => ({ ...DEFAULT_STORY, ...p })

/** As linhas de base (`y`) de todo <text> do desenho. */
const alturasDosTextos = (svg: string) => [...svg.matchAll(/<text [^>]*\by="([\d.-]+)"/g)].map((m) => Number(m[1]))

// Perfil que empurra o desenho ao limite: nome comprido, frase longa, todas as áreas.
const cheio: Profile = {
  ...sampleProfile,
  plan: 'premium',
  name: 'Maria Eduarda Albuquerque de Vasconcellos Cavalcanti',
  headline:
    'Advocacia cível e de família com escuta atenta, orientação clara em cada etapa e atendimento presencial e online em toda a região',
  areas: Array.from({ length: 12 }, (_, i) => ({
    id: `a${i}`,
    label: `Direito Empresarial e Societário ${i + 1}`,
    description: '',
  })),
}

describe('story — medidas', () => {
  it('é uma imagem de story: 1080 × 1920', () => {
    const svg = renderStory(sampleProfile, DEFAULT_STORY)
    expect(svg).toContain(`width="${STORY_W}" height="${STORY_H}"`)
    expect(svg).toContain(`viewBox="0 0 ${STORY_W} ${STORY_H}"`)
  })

  it('nenhum texto invade as faixas que o Instagram cobre, em nenhum modelo', () => {
    for (const { id } of STORY_TEMPLATES) {
      const perfis: Profile[] = [sampleProfile, cheio, { ...cheio, theme: 'timbre' }, { ...cheio, theme: 'oliva' }]
      for (const perfil of perfis) {
        const ys = alturasDosTextos(renderStory(perfil, cfg({ template: id })))
        expect(ys.length).toBeGreaterThan(0)
        for (const y of ys) {
          // A linha de base mais alta ainda leva o corpo do texto para cima dela.
          expect(y, `${id}: texto em y=${y}`).toBeGreaterThanOrEqual(SAFE_TOP + 20)
          expect(y, `${id}: texto em y=${y}`).toBeLessThanOrEqual(SAFE_BOTTOM)
        }
      }
    }
  })
})

describe('story — conteúdo', () => {
  it('nome e inscrição na OAB saem sempre, mesmo com tudo desligado', () => {
    const nada = cfg({ showPhoto: false, showHeadline: false, showAreas: false, showCity: false })
    for (const { id } of STORY_TEMPLATES) {
      const svg = renderStory(sampleProfile, { ...nada, template: id })
      expect(svg).toContain(sampleProfile.oabNumber)
      expect(svg).toMatch(/Marina|MARINA/)
    }
  })

  it('os interruptores tiram frase, áreas e cidade', () => {
    const svg = renderStory(sampleProfile, cfg({ showHeadline: false, showAreas: false, showCity: false }))
    expect(svg).not.toContain('Cível, Família')
    expect(svg).not.toContain('DIREITO DE FAMÍLIA')
    expect(svg).not.toContain('São Paulo')
  })

  it('no máximo três áreas, e nunca além da cota do plano', () => {
    expect(storyLines(cheio, DEFAULT_STORY).areas).toHaveLength(STORY_AREAS_MAX)
    const free = { ...cheio, plan: 'free' as const }
    expect(storyLines(free, DEFAULT_STORY).areas).toHaveLength(AREA_LIMIT.free)
  })

  it('leva o endereço real do perfil', () => {
    const svg = renderStory(sampleProfile, DEFAULT_STORY)
    expect(svg).toContain(`/${sampleProfile.slug}`)
  })

  it('escapa o que o advogado digitou', () => {
    const svg = renderStory({ ...sampleProfile, name: 'Ana <script>alert(1)</script> & Cia' }, DEFAULT_STORY)
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('&amp;')
  })

  it('sem foto, desenha o monograma no lugar', () => {
    const svg = renderStory({ ...sampleProfile, avatarUrl: undefined, name: 'João da Silva' }, DEFAULT_STORY)
    expect(svg).not.toContain('<image')
    expect(svg).toContain('>JS</text>')
    expect(iniciaisDe('Maria de Lourdes')).toBe('ML')
    expect(iniciaisDe('Ana')).toBe('A')
  })

  it('a foto só entra com o interruptor ligado', () => {
    expect(renderStory(sampleProfile, cfg({ showPhoto: true }))).toContain('<image')
    expect(renderStory(sampleProfile, cfg({ showPhoto: false }))).not.toContain('<image')
  })
})

describe('story — o que o desenho escreve por conta própria', () => {
  it('os textos fixos passam pela checagem de conformidade', () => {
    for (const t of [STORY_ROTULO, STORY_RODAPE, ...STORY_TEMPLATES.flatMap((x) => [x.name, x.blurb])]) {
      expect(checkCompliance(t).filter((i) => i.severity === 'block'), t).toEqual([])
    }
  })

  it('não convida a contratar nem fala de preço', () => {
    const svg = renderStory(sampleProfile, DEFAULT_STORY)
    expect(svg).not.toMatch(/contrat|agende|ligue já|grátis|gratuit|R\$|desconto/i)
  })
})

describe('quebrarLinhas', () => {
  const m = { font: 'x', size: 40, weight: 400 }

  it('nunca passa do número de linhas, e corta a última com reticências', () => {
    const linhas = quebrarLinhas('uma frase bem comprida '.repeat(20), 400, 2, m, medirAproximado)
    expect(linhas).toHaveLength(2)
    expect(linhas[1].endsWith('…')).toBe(true)
    for (const l of linhas) expect(medirAproximado(l, m)).toBeLessThanOrEqual(400)
  })

  it('lista quebra entre itens: nenhuma linha começa com o separador nem parte uma área', () => {
    const itens = ['DIREITO DE FAMÍLIA', 'DIREITO DO TRABALHO', 'DIREITO DO CONSUMIDOR']
    const linhas = quebrarItens(itens, ' · ', 700, 2, m, medirAproximado)
    expect(linhas.length).toBeLessThanOrEqual(2)
    for (const l of linhas) {
      expect(l.startsWith('·')).toBe(false)
      for (const parte of l.split(' · ')) expect(itens).toContain(parte)
    }
  })

  it('texto curto fica numa linha só', () => {
    expect(quebrarLinhas('Direito de Família', 900, 3, m, medirAproximado)).toEqual(['Direito de Família'])
  })
})
