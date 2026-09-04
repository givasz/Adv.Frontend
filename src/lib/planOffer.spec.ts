// A oferta comercial não pode prometer o que o produto não faz.
//
// Estes testes existem porque a home esteve no ar prometendo três coisas que não
// se sustentavam: um assistente que "marca horários por você" (ele só monta uma
// mensagem de WhatsApp), um endereço em `advoc.me/seu-nome` (domínio que não
// existe) e um domínio `.adv.br` com o mesmo ✓ dos recursos reais. Nenhum teste
// podia pegar isso, porque a lista de benefícios era texto solto dentro do JSX.
//
// Agora ela é dado (planOffer.ts) e passa por aqui: cada número anunciado é
// conferido contra plans.ts, e cada promessa contra o que o código realmente
// libera. Copy que mente para de compilar verde.

import { describe, expect, it } from 'vitest'
import {
  PLAN_COMPARE,
  PLAN_OFFERS,
  REGRAS_DE_COBRANCA,
  offerOf,
  type CompareRow,
} from './planOffer'
import {
  AREA_LIMIT,
  CHAR_LIMITS,
  FAQ_LIMIT,
  FIRM_PRICING,
  canUseDigitalCard,
  canUseFaq,
  canUsePrintCard,
  canUseScheduling,
  canUseVideo,
} from './plans'
import { canUseAi } from './aiFeatures'
import { THEMES, isThemeUnlocked } from './themes'

const textos = (id: Parameters<typeof offerOf>[0]) =>
  offerOf(id)
    .items.map((i) => i.text)
    .join(' | ')

describe('os números anunciados são os do produto', () => {
  it('áreas, bio e perguntas frequentes batem com plans.ts', () => {
    expect(textos('free')).toContain(`${AREA_LIMIT.free} áreas`)
    expect(textos('free')).toContain(`${CHAR_LIMITS.free.bio} caracteres`)

    expect(textos('pro')).toContain(`${AREA_LIMIT.pro} áreas`)
    expect(textos('pro')).toContain(`${CHAR_LIMITS.pro.bio} caracteres`)
    expect(textos('pro')).toContain(`${FAQ_LIMIT.pro} perguntas frequentes`)

    expect(textos('premium')).toContain(`${AREA_LIMIT.premium} áreas`)
    expect(textos('premium')).toContain(`${CHAR_LIMITS.premium.bio} caracteres`)
    expect(textos('premium')).toContain(`${FAQ_LIMIT.premium} perguntas frequentes`)
  })

  it('a contagem de temas bate com themes.ts', () => {
    const conta = (p: 'free' | 'pro' | 'premium') =>
      THEMES.filter((t) => isThemeUnlocked(t, p)).length
    expect(textos('free')).toContain(`${conta('free')} temas`)
    expect(textos('pro')).toContain(`${conta('pro')} dos ${THEMES.length} temas`)
  })

  it('o preço do escritório bate com FIRM_PRICING', () => {
    const firm = offerOf('firm')
    expect(firm.price).toBe(`R$ ${FIRM_PRICING.basePrice}`)
    expect(textos('firm')).toContain(`${FIRM_PRICING.includedSeats} advogados`)
    expect(textos('firm')).toContain(`R$ ${FIRM_PRICING.extraSeatPrice}/mês`)
  })
})

describe('recurso anunciado é recurso que existe naquele plano', () => {
  it('só anuncia agendamento onde canUseScheduling permite', () => {
    expect(canUseScheduling('free')).toBe(false)
    // ...e o Free diz isso na cara, em vez de deixar a pessoa procurar.
    expect(offerOf('free').falta?.join(' | ')).toMatch(/agendamento/i)
    expect(canUseScheduling('pro')).toBe(true)
    expect(textos('pro')).toMatch(/agendamento/i)
  })

  it('cartão impresso e vídeo são anunciados só no Max', () => {
    expect(canUsePrintCard('pro')).toBe(false)
    expect(canUsePrintCard('premium')).toBe(true)
    expect(textos('pro')).not.toMatch(/gráfica/i)
    expect(textos('premium')).toMatch(/gráfica/i)

    expect(canUseVideo('pro')).toBe(false)
    expect(canUseVideo('premium')).toBe(true)
    expect(textos('pro')).not.toMatch(/vídeo/i)
    expect(textos('premium')).toMatch(/vídeo/i)
  })

  it('cartão digital é anunciado no Pro, onde ele existe', () => {
    expect(canUseDigitalCard('pro')).toBe(true)
    expect(textos('pro')).toMatch(/QR Code/i)
  })

  it('o Free não anuncia perguntas frequentes — ele tem zero', () => {
    expect(FAQ_LIMIT.free).toBe(0)
    expect(textos('free')).not.toMatch(/perguntas frequentes/i)
    expect(offerOf('free').falta?.join(' | ')).toMatch(/perguntas frequentes/i)
  })
})

describe('promessas que já quebraram, e não podem voltar', () => {
  const tudo = PLAN_OFFERS.flatMap((o) => o.items.map((i) => i.text)).join(' | ')

  it('não promete um assistente que marca horário sozinho', () => {
    // O assistente termina numa mensagem de WhatsApp; quem marca é o advogado.
    expect(tudo).not.toMatch(/marca horários por você/i)
    expect(textos('pro')).toMatch(/WhatsApp/i)
  })

  it('não promete endereço em advoc.me — o domínio não está no ar', () => {
    expect(tudo).not.toMatch(/advoc\.me\/seu-nome/i)
  })

  it('recurso indisponível vai marcado, nunca como recurso pronto', () => {
    const dominio = offerOf('premium').items.find((i) => /\.adv\.br/i.test(i.text))
    expect(dominio).toBeDefined()
    expect(dominio!.emPreparo).toBe(true)
    // E nada que esteja "em preparo" pode passar por incluído.
    for (const oferta of PLAN_OFFERS) {
      for (const item of oferta.items) {
        if (/em breve/i.test(item.text)) expect(item.emPreparo).toBe(true)
      }
    }
  })
})

describe('linguagem: vendemos o perfil, não captação de clientes', () => {
  // Prometer clientes a um advogado é oferecer o que o Prov. 205/2021 veda A ELE.
  // Ver REGRAS.md — é a primeira frase que uma fiscalização citaria.
  const tudo = PLAN_OFFERS.flatMap((o) => [o.pitch, ...o.items.map((i) => i.text)]).join(' | ')

  it('nada de captar clientes, resultados ou destaque comprado', () => {
    expect(tudo).not.toMatch(/mais clientes|capt(e|ar|ação)|conquiste|resultado garantido/i)
    expect(tudo).not.toMatch(/apareça (primeiro|em destaque)|topo da busca|ranking/i)
  })

  it('nada de urgência artificial nem contagem regressiva', () => {
    expect(tudo).not.toMatch(/últimas vagas|só hoje|não perca|corra|agora ou nunca/i)
  })
})

describe('a oferta não fala em "grátis nos testes"', () => {
  // Existiu um selo "R$ 0 hoje — sem cobrança nos testes" ao lado do preço. Saiu
  // porque o provedor de pagamento está a caminho: a oferta que a pessoa lê hoje
  // tem de ser a mesma que ela vai pagar amanhã. O único lugar que fala do
  // pagamento ainda não estar ligado é o checkout — e só enquanto for verdade.
  const tudo = [
    ...PLAN_OFFERS.flatMap((o) => [o.pitch, o.period, ...o.items.map((i) => i.text), ...(o.falta ?? [])]),
    ...REGRAS_DE_COBRANCA,
    ...PLAN_COMPARE.flatMap((g) => g.rows.flatMap((r) => [r.label, r.hint ?? '', ...Object.values(r.values).map(String)])),
  ].join(' | ')

  it('nem os cartões, nem a tabela, nem as regras de cobrança', () => {
    expect(tudo).not.toMatch(/em teste|nos testes|sem cobrança|R\$ 0 hoje|sem pagar/i)
  })

  it('o Free continua sendo o único de graça, e diz isso pelo período', () => {
    expect(offerOf('free').price).toBe('R$ 0')
    expect(offerOf('free').period).toMatch(/para sempre/i)
    expect(offerOf('pro').period).toBe('/mês')
    expect(offerOf('premium').period).toBe('/mês')
  })
})

describe('a tabela comparativa é calculada, não digitada', () => {
  const linha = (re: RegExp): CompareRow => {
    const r = PLAN_COMPARE.flatMap((g) => g.rows).find((r) => re.test(r.label))
    if (!r) throw new Error(`linha não encontrada: ${re}`)
    return r
  }

  it('limites numéricos batem com plans.ts', () => {
    expect(linha(/^Áreas/).values).toEqual({
      free: `${AREA_LIMIT.free}`,
      pro: `${AREA_LIMIT.pro}`,
      premium: `${AREA_LIMIT.premium}`,
    })
    expect(linha(/bio/i).values).toEqual({
      free: `${CHAR_LIMITS.free.bio}`,
      pro: `${CHAR_LIMITS.pro.bio}`,
      premium: `${CHAR_LIMITS.premium.bio}`,
    })
    const faq = linha(/perguntas frequentes/i).values
    expect(faq.free).toBe(canUseFaq('free') ? `${FAQ_LIMIT.free}` : false)
    expect(faq.pro).toBe(`${FAQ_LIMIT.pro}`)
    expect(faq.premium).toBe(`${FAQ_LIMIT.premium}`)
  })

  it('cada ✓ corresponde a um portão de plano que abre', () => {
    const casos: [RegExp, (p: 'free' | 'pro' | 'premium') => boolean][] = [
      [/agendamento/i, canUseScheduling],
      [/QR Code/i, canUseDigitalCard],
      [/gráfica/i, canUsePrintCard],
      [/^Vídeo/i, canUseVideo],
      [/frase de apresentação e revisa/i, (p) => canUseAi('headline', p)],
      [/IA escreve a bio/i, (p) => canUseAi('bio', p)],
    ]
    for (const [re, portao] of casos) {
      const r = linha(re)
      for (const p of ['free', 'pro', 'premium'] as const) {
        expect(r.values[p], `${r.label} · ${p}`).toBe(portao(p))
      }
    }
  })

  it('recurso em preparo nunca aparece como ✓', () => {
    for (const r of PLAN_COMPARE.flatMap((g) => g.rows)) {
      if (!r.emPreparo) continue
      for (const v of Object.values(r.values)) expect(v).not.toBe(true)
    }
    expect(linha(/adv\.br/).emPreparo).toBe(true)
  })

  it('a tabela não vende captação nem urgência', () => {
    const tudo = PLAN_COMPARE.flatMap((g) => g.rows.map((r) => `${r.label} ${r.hint ?? ''}`)).join(' | ')
    // "cor de destaque" é a cor de realce do tema, não posição comprada — a
    // vedação é a "apareça em destaque" / "topo da busca" do REGRAS.md.
    expect(tudo).not.toMatch(/mais clientes|capt(e|ar|ação)|conquiste|em destaque|topo da busca|ranking|só hoje/i)
  })
})

describe('cada plano tem um caminho de compra', () => {
  it('todos têm destino e rótulo de ação', () => {
    for (const o of PLAN_OFFERS) {
      expect(o.ctaTo.startsWith('/')).toBe(true)
      expect(o.ctaLabel.length).toBeGreaterThan(3)
    }
  })

  it('só um plano é destacado como o mais popular', () => {
    expect(PLAN_OFFERS.filter((o) => o.featured)).toHaveLength(1)
  })
})
