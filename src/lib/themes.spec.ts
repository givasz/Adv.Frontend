import { describe, expect, it } from 'vitest'
import { getTheme, isThemeUnlocked, LEGACY_THEME, profileVars, THEMES, themeStyle, tintaSobre, type Theme } from './themes'

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

describe('temas — sobriedade (REGRAS.md §2, "Design chamativo ou mercantil")', () => {
  // O REGRAS.md nomeia o que contraria a discrição exigida da divulgação de
  // advogado: foil metálico, mármore brilhante, fonte cursiva. Os acabamentos
  // deixaram de existir no TIPO (ThemeStyle não tem mais finish/surface), e o
  // que sobra aqui é o que ainda daria para contrabandear por variável CSS.
  it('nenhum tema pinta fundo com gradiente ou imagem — o fundo é uma cor só', () => {
    for (const t of THEMES) {
      expect(t.vars['--c-bg-image'], `${t.id} declara --c-bg-image`).toBeUndefined()
      expect(t.vars['--c-bg']).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('o grão é quase invisível', () => {
    for (const t of THEMES) {
      expect(Number(t.vars['--c-grain']), `${t.id}`).toBeLessThanOrEqual(0.04)
    }
  })

  it('nome e descrição não vendem luxo', () => {
    // Vocabulário de ostentação. Vale para como NÓS anunciamos o tema, não só
    // para o que o advogado escreve.
    const vedado = /\b(ouro|dourad|prata|mármore|marmore|luxo|premium|exclusiv|brilh|esmeralda|diamante)/i
    for (const t of THEMES) {
      expect(`${t.name} ${t.blurb}`, `${t.id}`).not.toMatch(vedado)
    }
  })
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

  it('o Free entrega só o neutro; o Névoa é do Max desde 13/09/2026', () => {
    const livres = THEMES.filter((t) => isThemeUnlocked(t, 'free')).map((t) => t.id)
    expect(livres).toEqual(['papel'])
    expect(getTheme('nevoa').tier).toBe('premium')
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
    expect(themeStyle('marinho')).toMatchObject({ '--c-bg': '#0f1b2d' })
    // Tema desconhecido cai no padrão em vez de quebrar a página.
    expect(getTheme(undefined as never).id).toBe('papel')
    expect(getTheme('nao-existe').id).toBe('papel')
  })
})

describe('temas — ids da coleção anterior', () => {
  // Os ids antigos estão gravados nos perfis. Sem o mapa, quem escolheu
  // Meia-noite abriria o próprio perfil no neutro sem ninguém avisar.
  it('cada id antigo aponta para um tema que existe', () => {
    for (const [antigo, novo] of Object.entries(LEGACY_THEME)) {
      expect(THEMES.some((t) => t.id === novo), `${antigo} → ${novo}`).toBe(true)
      expect(getTheme(antigo).id).toBe(novo)
    }
  })

  it('o mapa não reaproveita nenhum id vivo como chave', () => {
    for (const antigo of Object.keys(LEGACY_THEME)) {
      expect(THEMES.some((t) => t.id === antigo), antigo).toBe(false)
    }
  })

  it('chave herdada do protótipo não vira tema', () => {
    expect(getTheme('constructor').id).toBe('papel')
    expect(getTheme('__proto__').id).toBe('papel')
  })
})

describe('profileVars — o tema mais a cor da marca', () => {
  it('sem marca devolve exatamente as variáveis do tema', () => {
    expect(profileVars({ theme: 'marinho' })).toBe(getTheme('marinho').vars)
  })

  it('a cor da marca substitui o acento do tema e o realce desce dela', () => {
    const v = profileVars({ theme: 'marinho', branding: { accent: '#8a2be2' } }) as Record<string, string>
    expect(v['--c-accent']).toBe('#8a2be2')
    expect(v['--c-accent-soft']).toBe('rgba(138,43,226,0.14)')
    // O resto do tema continua lá: é o Marinho de fundo, só com outro acento.
    expect(v['--c-bg']).toBe('#0f1b2d')
  })

  it('id antigo com marca também funciona — a tradução vem antes', () => {
    const v = profileVars({ theme: 'obsidian', branding: { accent: '#8a2be2' } }) as Record<string, string>
    expect(v['--c-bg']).toBe(getTheme('marinho').vars['--c-bg'])
    expect(v['--c-accent']).toBe('#8a2be2')
  })
})

describe('tintaSobre — a tinta da cor da marca', () => {
  it('cor escura pede tinta branca; cor clara pede tinta escura', () => {
    expect(tintaSobre('#8a2be2')).toBe('#ffffff') // roxo
    expect(tintaSobre('#1f3350')).toBe('#ffffff') // marinho
    expect(tintaSobre('#d8d0bf')).toBe('#121212') // pedra
    expect(tintaSobre('#ffd400')).toBe('#121212') // amarelo
  })

  it('profileVars leva a tinta junto com a cor da marca', () => {
    // O caso que motivou: Marinho (tinta do tema azul-escura) com marca roxa.
    const v = profileVars({ theme: 'marinho', branding: { accent: '#8a2be2' } }) as Record<string, string>
    expect(v['--c-accent-ink']).toBe('#ffffff')
    const w = profileVars({ theme: 'papel', branding: { accent: '#e6d3a3' } }) as Record<string, string>
    expect(w['--c-accent-ink']).toBe('#121212')
  })

  it('a tinta escolhida passa em AA sobre qualquer cor de marca', () => {
    for (const hex of ['#8a2be2', '#d8d0bf', '#808080', '#00a0e0', '#c8102e', '#f5f5f5']) {
      const ink = tintaSobre(hex)
      expect(contrast(ink, parseColor(hex)!), hex).toBeGreaterThanOrEqual(4.5)
    }
  })
})
