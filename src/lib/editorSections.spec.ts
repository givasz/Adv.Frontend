import { describe, expect, it } from 'vitest'
import {
  buscarNoEditor,
  DESTINO_DO_FATOR,
  editorPath,
  isSectionId,
  SECTION_IDS,
  SECTIONS,
  SECTIONS_BY_GROUP,
  sectionUnlocked,
} from './editorSections'
import { PLAN_FEATURES } from './planFeatures'
import { TRUST_FACTORS } from './trustScore'
import { sampleProfile } from './mockData'
import type { Profile } from './types'

// Perfil recém-publicado, com o mínimo do onboarding.
const essencial: Profile = {
  ...structuredClone(sampleProfile),
  avatarUrl: '',
  headline: '',
  bio: '',
  socials: [],
  faqs: [],
  address: undefined,
  contact: {},
  branding: undefined,
  schedulingMode: 'off',
  videoUrl: '',
  card: undefined,
  plan: 'free',
  areas: [],
}

describe('editorSections — a lista', () => {
  it('toda seção tem título, rótulo curto, subtítulo e grupo', () => {
    for (const id of SECTION_IDS) {
      const s = SECTIONS[id]
      expect(s.id).toBe(id)
      expect(s.title).toBeTruthy()
      expect(s.short).toBeTruthy()
      expect(s.subtitle).toBeTruthy()
      expect(['perfil', 'ferramentas', 'conta']).toContain(s.group)
    }
  })

  it('cada seção aparece exatamente uma vez na ordem dos grupos', () => {
    const todas = Object.values(SECTIONS_BY_GROUP).flat()
    expect([...todas].sort()).toEqual([...SECTION_IDS].sort())
    for (const [grupo, ids] of Object.entries(SECTIONS_BY_GROUP)) {
      for (const id of ids) expect(SECTIONS[id].group).toBe(grupo)
    }
  })

  it('as âncoras dos campos são únicas no editor inteiro', () => {
    // Duas seções nunca aparecem juntas na tela, mas `#bio` e `#areas` também
    // são ids de cartão — repetir um id faria o scroll parar no lugar errado.
    const ids = SECTION_IDS.flatMap((id) => SECTIONS[id].campos.map((c) => c.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('reconhece só ids reais', () => {
    expect(isSectionId('bio')).toBe(true)
    expect(isSectionId('local')).toBe(true)
    expect(isSectionId('configuracoes')).toBe(false)
    expect(isSectionId(null)).toBe(false)
  })

  it('trava por plano só o que o plano não abre', () => {
    expect(sectionUnlocked('agenda', 'free')).toBe(false)
    expect(sectionUnlocked('agenda', 'pro')).toBe(true)
    expect(sectionUnlocked('marca', 'pro')).toBe(false)
    expect(sectionUnlocked('marca', 'premium')).toBe(true)
    expect(sectionUnlocked('bio', 'free')).toBe(true)
  })
})

describe('editorSections — resumo do que está preenchido', () => {
  it('um perfil completo descreve o que tem', () => {
    const r = SECTIONS.identidade.resumo(sampleProfile)
    expect(r.pendente).toBeFalsy()
    expect(r.texto).toContain(sampleProfile.oabNumber)
    expect(SECTIONS.areas.resumo(sampleProfile).texto).toContain('Direito de Família')
    expect(SECTIONS.redes.resumo(sampleProfile).texto).toContain('WhatsApp')
    expect(SECTIONS.local.resumo(sampleProfile).texto).toContain('São Paulo/SP')
  })

  it('um perfil essencial aponta o que falta, sem quebrar em nenhuma seção', () => {
    for (const id of SECTION_IDS) {
      const r = SECTIONS[id].resumo(essencial)
      expect(r.texto.length).toBeGreaterThan(0)
    }
    expect(SECTIONS.identidade.resumo(essencial).pendente).toBe(true)
    expect(SECTIONS.identidade.resumo(essencial).texto).toMatch(/foto/)
    expect(SECTIONS.bio.resumo(essencial).pendente).toBe(true)
    expect(SECTIONS.redes.resumo(essencial).pendente).toBe(true)
    expect(SECTIONS.areas.resumo(essencial).pendente).toBe(true)
  })

  it('seção travada pelo plano nunca é "pendente" — não é tarefa que dê para fazer', () => {
    expect(SECTIONS.video.resumo(essencial).pendente).toBeFalsy()
    expect(SECTIONS.marca.resumo(essencial).pendente).toBeFalsy()
    expect(SECTIONS.agenda.resumo(essencial).pendente).toBeFalsy()
    expect(SECTIONS.cartao.resumo(essencial).pendente).toBeFalsy()
  })

  it('a agenda com assistente ligado conta os horários da semana', () => {
    const r = SECTIONS.agenda.resumo({ ...sampleProfile, plan: 'pro', schedulingMode: 'assistant' })
    expect(r.texto).toMatch(/Assistente ligado · \d+ horários? por semana/)
  })
})

describe('editorSections — destinos', () => {
  it('todo fator do índice tem para onde ir, e o destino existe', () => {
    for (const f of TRUST_FACTORS) {
      const to = DESTINO_DO_FATOR[f.key]
      expect(to, `fator ${f.key} sem destino`).toBeTruthy()
      const section = new URL(to, 'http://x').searchParams.get('section')
      expect(isSectionId(section), `fator ${f.key} → seção inexistente "${section}"`).toBe(true)
    }
  })

  it('todo recurso de plano aponta para uma seção que existe (ou para uma página própria)', () => {
    for (const f of PLAN_FEATURES) {
      if (!f.to.startsWith('/editor')) continue
      const section = new URL(f.to, 'http://x').searchParams.get('section')
      expect(isSectionId(section), `recurso ${f.key} → seção inexistente "${section}"`).toBe(true)
    }
  })

  it('a âncora de um campo aponta para um campo declarado na seção', () => {
    for (const to of Object.values(DESTINO_DO_FATOR)) {
      const url = new URL(to, 'http://x')
      const campo = url.hash.slice(1)
      if (!campo) continue
      const section = url.searchParams.get('section') as keyof typeof SECTIONS
      expect(SECTIONS[section].campos.map((c) => c.id)).toContain(campo)
    }
  })

  it('monta o endereço com e sem campo', () => {
    expect(editorPath('bio')).toBe('/editor?section=bio')
    expect(editorPath('identidade', 'foto')).toBe('/editor?section=identidade#foto')
  })
})

describe('editorSections — busca', () => {
  const primeiro = (q: string) => buscarNoEditor(q)[0]

  it('leva ao campo, não à seção, quando o campo existe', () => {
    expect(primeiro('foto').to).toBe('/editor?section=identidade#foto')
    expect(primeiro('whats').to).toBe('/editor?section=redes#whatsapp')
    expect(primeiro('cep').to).toBe('/editor?section=local#endereco')
    expect(primeiro('oab').to).toBe('/editor?section=identidade#oab')
  })

  it('ignora acento e caixa', () => {
    expect(primeiro('endereco').section).toBe('local')
    expect(primeiro('VÍDEO').section).toBe('video')
    expect(primeiro('Área').section).toBe('areas')
  })

  it('acha a seção pelo assunto quando não há campo', () => {
    expect(primeiro('tema').section).toBe('aparencia')
    expect(primeiro('perguntas').section).toBe('faq')
    expect(primeiro('cancelar').section).toBe('plano')
    expect(primeiro('visitas').section).toBe('analytics')
  })

  it('começo de palavra vale mais do que trecho no meio', () => {
    // "cor" começa "cor de destaque" (marca) e "cores" (tema) — nunca "correio".
    const secoes = buscarNoEditor('cor').map((a) => a.section)
    expect(secoes.slice(0, 2)).toEqual(expect.arrayContaining(['aparencia', 'marca']))
  })

  it('texto curto demais ou vazio não devolve nada', () => {
    expect(buscarNoEditor('')).toEqual([])
    expect(buscarNoEditor('a')).toEqual([])
    expect(buscarNoEditor('xyzzy')).toEqual([])
  })

  it('respeita o teto de resultados', () => {
    expect(buscarNoEditor('e', 3).length).toBeLessThanOrEqual(3)
    expect(buscarNoEditor('en', 3).length).toBeLessThanOrEqual(3)
  })
})
