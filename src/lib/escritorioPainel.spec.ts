import { describe, expect, it } from 'vitest'
import { blankFirm, sampleFirm, type Firm, type FirmMember } from './escritorio'
import {
  assuntosDaConversa,
  atendimentoDe,
  conversaSemDestino,
  editorDoEscritorio,
  faltasDoEscritorio,
  partesDoEscritorio,
  rotuloDoEstado,
} from './escritorioPainel'

const vazio = (): Firm => ({ ...blankFirm(), name: 'Sociedade Teste' })

describe('painel do escritório — o que falta', () => {
  it('escritório recém-criado: tudo falta, e a conversa sem saída vem primeiro', () => {
    const { faltas, pct } = faltasDoEscritorio(vazio())
    expect(pct).toBe(0)
    expect(faltas[0].key).toBe('destino')
    expect(faltas.map((f) => f.key)).toContain('advogados')
  })

  it('o escritório de exemplo não tem nada de grave faltando', () => {
    const { faltas } = faltasDoEscritorio(sampleFirm)
    expect(faltas.map((f) => f.key)).not.toContain('destino')
    expect(faltas.map((f) => f.key)).not.toContain('advogados')
  })

  it('a caixa ligada resolve o destino mesmo sem WhatsApp institucional', () => {
    const f = { ...vazio(), meetingInboxEnabled: true }
    expect(conversaSemDestino(f)).toBe(false)
  })

  it('WhatsApp que o wa.me recusa não conta como destino', () => {
    const f = { ...vazio(), contact: { whatsapp: '123' } }
    expect(conversaSemDestino(f)).toBe(true)
  })

  it('toda falta aponta para um cartão que existe no editor', () => {
    for (const falta of faltasDoEscritorio(vazio()).faltas) {
      expect(editorDoEscritorio(falta.ancora)).toMatch(/^\/escritorio\/editar#[a-z]+$/)
    }
  })
})

describe('painel do escritório — resumo das partes', () => {
  it('uma linha para cada cartão do editor, sem repetir âncora', () => {
    const partes = partesDoEscritorio(sampleFirm)
    expect(new Set(partes.map((p) => p.ancora)).size).toBe(partes.length)
  })

  it('endereço escondido aparece como oculto, não como vazio', () => {
    const f = { ...sampleFirm, address: { ...sampleFirm.address, publico: false } }
    const sede = partesDoEscritorio(f).find((p) => p.ancora === 'sede')!
    expect(sede.texto).toMatch(/oculto na página/)
    expect(sede.pendente).toBe(false)
  })

  it('assuntos somam as áreas dos advogados e os escritos à mão, sem repetir e em ordem alfabética', () => {
    const f: Firm = {
      ...vazio(),
      lawyers: [
        { id: '1', name: 'B', oabNumber: '', area: 'Família', bio: '' },
        { id: '2', name: 'A', oabNumber: '', area: 'família', bio: '' },
      ],
      extraAreas: ['Consumidor'],
    }
    expect(assuntosDaConversa(f)).toEqual(['Consumidor', 'Família'])
  })
})

describe('painel do escritório — advogados', () => {
  const membro = (over: Partial<FirmMember>): FirmMember => ({
    id: 'm',
    kind: 'membership',
    name: 'Fulana',
    role: 'member',
    status: 'active',
    ...over,
  })

  it('quem não tem perfil não tem atendimento próprio', () => {
    const a = atendimentoDe(membro({ kind: 'roster', status: 'listed' }), sampleFirm)
    expect(a).toMatchObject({ comConta: false, agenda: false, triagem: false, caixa: false })
  })

  it('cruza o membro com o card público pelo endereço do perfil', () => {
    const f: Firm = {
      ...vazio(),
      lawyers: [{ id: '1', slug: 'fulana', name: 'Fulana', oabNumber: '', area: '', bio: '', meetingInbox: true }],
    }
    const a = atendimentoDe(membro({ profileSlug: 'fulana' }), f)
    expect(a.caixa).toBe(true)
    expect(a.alcancavel).toBe(false) // centralizando, a caixa dele não recebe pela página
    expect(atendimentoDe(membro({ profileSlug: 'fulana' }), { ...f, assistantRoute: 'lawyer' }).alcancavel).toBe(true)
  })

  it('o estado de cada linha usa o vocabulário do editor', () => {
    expect(rotuloDoEstado(membro({ role: 'owner' }))).toBe('Dono')
    expect(rotuloDoEstado(membro({ status: 'invited' }))).toBe('Convite enviado')
    expect(rotuloDoEstado(membro({ status: 'listed', kind: 'roster' }))).toBe('Sem conta')
  })
})
