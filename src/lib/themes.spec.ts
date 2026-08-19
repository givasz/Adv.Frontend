import { describe, expect, it } from 'vitest'
import { getTheme, isThemeUnlocked, THEMES, themeStyle, type Theme } from './themes'

// ---- utilidades de cor ----

function parseColor(c: string): [number, number, number] | null {
  const hex = /^#?([0-9a-f]{6})$/i.exec(c.trim())
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const fn = /rgba?\(([^)]+)\)/.exec(c)
  if (fn) {
    const p = fn[1].split(',').map(Number)
    return [p[0], p[1], p[2]]
  }
  return null
}

/** Achata uma cor com alfa sobre um fundo opaco. */
function flatten(c: string, bg: [number, number, number]): [number, number, number] | null {
  const fn = /rgba\(([^)]+)\)/.exec(c)
  if (!fn) return parseColor(c)
  const p = fn[1].split(',').map(Number)
  const a = p[3] ?? 1
  return [0, 1, 2].map((i) => Math.round(p[i] * a + bg[i] * (1 - a))) as [number, number, number]
}

const channel = (v: number) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
const luminance = (c: [number, number, number]) =>
  0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])

function contrast(fg: string, bg: [number, number, number]): number {
  const f = flatten(fg, bg)
  if (!f) return 0
  const [l1, l2] = [luminance(f), luminance(bg)]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

const bgOf = (t: Theme) => parseColor(t.vars['--c-bg'])!
const surfaceOf = (t: Theme) => flatten(t.vars['--c-surface'], bgOf(t))!

describe('temas — contraste (WCAG AA, 4.5:1 para texto)', () => {
  // Trava de regressão: um tema bonito que não se lê não é um tema. Cada par
  // aqui é texto de verdade em algum lugar do perfil — inclusive `faint`, que
  // carrega tempo de leitura, nota de região e o rodapé de conformidade.
  for (const t of THEMES) {
    it(`${t.id}: texto, secundário e terciário passam sobre fundo e superfície`, () => {
      const bg = bgOf(t)
      const surface = surfaceOf(t)
      for (const key of ['--c-text', '--c-muted', '--c-faint'] as const) {
        expect(contrast(t.vars[key], bg), `${key} sobre o fundo`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(t.vars[key], surface), `${key} sobre a superfície`).toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`${t.id}: o acento se lê sobre o fundo e a tinta se lê sobre o acento`, () => {
      expect(contrast(t.vars['--c-accent'], bgOf(t))).toBeGreaterThanOrEqual(4.5)
      // --c-accent-ink é o texto DENTRO do botão preenchido de acento.
      expect(contrast(t.vars['--c-accent-ink'], parseColor(t.vars['--c-accent'])!)).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe('temas — coerência da paleta', () => {
  // O bug que motivou esta trava: Papel e Esmeralda tinham acento bordô/verde e
  // realces DOURADOS. Duas famílias de cor brigando sem intenção deixavam a tela
  // com aquela cara de "jogo de cores estranho".
  for (const t of THEMES) {
    it(`${t.id}: realce e anel descendem do próprio acento`, () => {
      const accent = parseColor(t.vars['--c-accent'])!
      for (const key of ['--c-accent-soft', '--c-ring'] as const) {
        const c = parseColor(t.vars[key])
        if (!c) continue // gradiente/none: nada a comparar
        const distancia = Math.max(...[0, 1, 2].map((i) => Math.abs(c[i] - accent[i])))
        expect(distancia, `${key} destoa do acento`).toBeLessThanOrEqual(12)
      }
    })
  }
})

describe('temas — identidade tipográfica', () => {
  it('cada tema declara fonte de display, de corpo e entreletras', () => {
    for (const t of THEMES) {
      for (const key of ['--font-display', '--font-body', '--name-tracking', '--display-tracking', '--label-tracking']) {
        expect(t.vars[key], `${t.id} sem ${key}`).toBeTruthy()
      }
    }
  })

  it('nem todos usam a mesma família — trocar de tema muda a voz', () => {
    const familias = new Set(THEMES.map((t) => t.vars['--font-display']))
    expect(familias.size).toBeGreaterThanOrEqual(6)
  })

  it('nenhuma pilha de fontes termina em fonte de sistema solta', () => {
    // O guia de frontend veta cair em Arial/Roboto/Inter: o fallback tem de ser
    // do mesmo gênero da fonte pretendida.
    for (const t of THEMES) {
      for (const key of ['--font-display', '--font-body'] as const) {
        expect(t.vars[key]).toMatch(/(serif|sans-serif)$/)
        expect(t.vars[key]).not.toMatch(/\b(Arial|Roboto|Inter|Helvetica)\b/)
      }
    }
  })
})

describe('temas — escada de planos', () => {
  it('o padrão é Free e está sempre liberado', () => {
    expect(isThemeUnlocked(getTheme('papel'), 'free')).toBe(true)
  })

  it('cada plano libera estritamente mais temas que o anterior', () => {
    const n = (p: 'free' | 'pro' | 'premium') => THEMES.filter((t) => isThemeUnlocked(t, p)).length
    expect(n('free')).toBeLessThan(n('pro'))
    expect(n('pro')).toBeLessThan(n('premium'))
    expect(n('premium')).toBe(THEMES.length)
  })

  it('ids são únicos e themeStyle devolve as variáveis do tema', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(themeStyle('obsidian')).toMatchObject({ '--c-bg': '#0c0c0d' })
    // Tema desconhecido cai no padrão em vez de quebrar a página.
    expect(getTheme(undefined as never).id).toBe('papel')
  })
})
