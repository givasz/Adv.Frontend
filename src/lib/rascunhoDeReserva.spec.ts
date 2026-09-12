import { describe, expect, it } from 'vitest'
import { checkCompliance } from './oab'
import { draftText, RASCUNHO_NEUTRO } from './rascunhoDeReserva'
import type { GenerateKind, GenerateRequest } from './types'

// O rascunho de reserva é o que aparece no editor quando a IA não respondeu. Ele
// não pode ser o caminho pelo qual um texto vedado chega ao perfil.

const KINDS: GenerateKind[] = ['bio', 'area', 'headline', 'improve', 'faq']
const RUINS = ['a melhor advogada', 'garanto resultado', 'honorários grátis']

const req = (r: Partial<GenerateRequest>): GenerateRequest => ({ kind: 'bio', keywords: [], ...r })

describe('rascunho de reserva nunca devolve texto reprovado', () => {
  it('palavra-chave vedada não entra (caso medido em 12/09/2026)', () => {
    const texto = draftText(req({ name: 'Ana Souza', keywords: RUINS }))
    expect(texto).not.toMatch(/melhor|garant|gr[aá]tis/i)
    expect(checkCompliance(texto)).toEqual([])
  })

  for (const kind of KINDS) {
    it(`${kind}: com TUDO vedado no pedido, o resultado passa sem vedação`, () => {
      const texto = draftText(
        req({
          kind,
          name: 'Dra. Ana, a melhor advogada',
          keywords: RUINS,
          areas: RUINS,
          areaLabel: 'a melhor área, garanto resultado',
          currentText: 'Sou a melhor advogada e garanto resultado.',
        }),
      )
      expect(checkCompliance(texto).filter((i) => i.severity === 'block')).toEqual([])
      expect(texto).not.toMatch(/melhor|garant/i)
    })

    it(`${kind}: o texto neutro passa limpo`, () => {
      expect(checkCompliance(RASCUNHO_NEUTRO[kind])).toEqual([])
    })
  }

  it('currículo não vira área de atuação', () => {
    const texto = draftText(req({ keywords: ['10 anos de atuação', 'PUC-Campinas', 'divórcio'] }))
    expect(texto).toContain('com atuação em divórcio')
    expect(texto).not.toMatch(/PUC|10 anos/)
  })

  it('FAQ: a pergunta não vira sujeito da frase', () => {
    const texto = draftText(req({ kind: 'faq', areaLabel: 'Qual o prazo para entrar com ação trabalhista?' }))
    expect(texto).not.toContain('?')
  })

  it('revisão devolve o próprio texto quando ele é regular', () => {
    const atual = 'Atuo em Direito de Família, com orientação clara.'
    expect(draftText(req({ kind: 'improve', currentText: atual }))).toBe(atual)
  })
})
