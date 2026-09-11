import { describe, expect, it } from 'vitest'
import {
  buildIcs,
  emUmBloco,
  linkGoogleAgenda,
  linkOutlook,
  nomeDoArquivo,
  type Compromisso,
} from './ics'

// O .ics é lido por programa alheio (Google, Calendário do iPhone, Outlook) que
// não perdoa: campo mal escapado importa lixo, linha longa demais ou terminada em
// LF sozinho faz a agenda RECUSAR o arquivo inteiro — e o advogado só descobre
// que não funciona quando o compromisso não está lá.

const AGORA = new Date(Date.UTC(2026, 8, 9, 15, 30, 0))

const compromisso = (over: Partial<Compromisso> = {}): Compromisso => ({
  inicio: '2026-11-25T14:00',
  duracaoMin: 45,
  titulo: 'Atendimento',
  ...over,
})

/** As linhas como a agenda as lê (o arquivo é CRLF por exigência da RFC). */
const linhas = (ics: string) => ics.split('\r\n')

describe('buildIcs', () => {
  it('monta um evento com hora local flutuante — sem Z, sem fuso', () => {
    const ics = buildIcs([compromisso()], 'givanildo-barbosa', AGORA)
    expect(linhas(ics)).toEqual(
      expect.arrayContaining([
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'DTSTAMP:20260909T153000Z',
        'DTSTART:20261125T140000',
        'DTEND:20261125T144500',
        'SUMMARY:Atendimento',
        'END:VCALENDAR',
      ]),
    )
    // A hora do compromisso NÃO leva Z: ela vale no relógio de quem abrir.
    expect(ics).not.toContain('DTSTART:20261125T140000Z')
  })

  it('termina em CRLF e usa CRLF entre as linhas', () => {
    const ics = buildIcs([compromisso()], 'x', AGORA)
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.includes('\n\n')).toBe(false)
  })

  it('vira o dia, o mês e o ano quando a duração atravessa a meia-noite', () => {
    const ics = buildIcs(
      [compromisso({ inicio: '2026-12-31T23:30', duracaoMin: 60 })],
      'x',
      AGORA,
    )
    expect(ics).toContain('DTSTART:20261231T233000')
    expect(ics).toContain('DTEND:20270101T003000')
  })

  it('escapa o que a RFC reserva — vírgula, ponto-e-vírgula, contrabarra e quebra', () => {
    const ics = buildIcs(
      [
        compromisso({
          titulo: 'Reunião: João; sala 2, fundos \\ anexo',
          local: 'Rua X, 100 — sala 2',
        }),
      ],
      'x',
      AGORA,
    )
    expect(ics).toContain('SUMMARY:Reunião: João\\; sala 2\\, fundos \\\\ anexo')
    expect(ics).toContain('LOCATION:Rua X\\, 100 — sala 2')
  })

  it('dobra linha longa em 75 octetos, contando bytes e sem partir o acento', () => {
    const ics = buildIcs(
      [compromisso({ titulo: 'Ação'.repeat(40) })],
      'x',
      AGORA,
    )
    for (const linha of linhas(ics)) {
      expect(new TextEncoder().encode(linha).length).toBeLessThanOrEqual(75)
    }
    // A continuação começa com espaço, e o acento sobreviveu inteiro.
    expect(ics).toContain('\r\n ')
    expect(ics).not.toContain('�')
  })

  it('o UID é estável — adicionar duas vezes atualiza, não duplica', () => {
    const a = buildIcs([compromisso()], 'givanildo-barbosa', AGORA)
    const b = buildIcs([compromisso({ titulo: 'Outro nome' })], 'givanildo-barbosa', new Date())
    const uid = (ics: string) => linhas(ics).find((l) => l.startsWith('UID:'))
    expect(uid(a)).toBe(uid(b))
  })

  it('leva lembrete de uma hora antes', () => {
    const ics = buildIcs([compromisso()], 'x', AGORA)
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-PT1H')
  })

  it('sem local e sem descrição, não escreve campo vazio', () => {
    const ics = buildIcs([compromisso()], 'x', AGORA)
    expect(ics).not.toContain('LOCATION:')
    expect(ics).not.toContain('DESCRIPTION:Anotado')
  })

  it('vários compromissos cabem num arquivo só', () => {
    const ics = buildIcs(
      [compromisso(), compromisso({ inicio: '2026-11-25T15:00' })],
      'x',
      AGORA,
    )
    expect(linhas(ics).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2)
    expect(linhas(ics).filter((l) => l === 'BEGIN:VCALENDAR')).toHaveLength(1)
  })
})

describe('nomeDoArquivo', () => {
  it('nomeia pelo horário quando é um só, e pela contagem quando são vários', () => {
    expect(nomeDoArquivo([compromisso()])).toBe('compromisso-2026-11-25-1400.ics')
    expect(nomeDoArquivo([compromisso(), compromisso()])).toBe('compromissos-2.ics')
  })
})

describe('emUmBloco', () => {
  it('o dia todo vira um compromisso só, do primeiro início ao fim do último', () => {
    const c = emUmBloco(['2026-11-25T15:00', '2026-11-25T09:00', '2026-11-25T16:00'], 45, {
      titulo: 'Audiência',
    })
    expect(c).toEqual({ titulo: 'Audiência', inicio: '2026-11-25T09:00', duracaoMin: 7 * 60 + 45 })
  })

  it('um horário só fica como está, e nenhum não vira compromisso', () => {
    expect(emUmBloco(['2026-11-25T14:00'], 45, { titulo: 'X' })?.duracaoMin).toBe(45)
    expect(emUmBloco([], 45, { titulo: 'X' })).toBeNull()
  })
})

describe('linkOutlook', () => {
  it('abre a tela de novo evento com o instante em UTC, calculado no relógio do aparelho', () => {
    const url = new URL(linkOutlook(compromisso({ titulo: 'Reunião — João', local: 'Rua X, 100' })))
    expect(url.hostname).toBe('outlook.live.com')
    expect(url.pathname).toBe('/calendar/0/action/compose')
    expect(url.searchParams.get('subject')).toBe('Reunião — João')
    expect(url.searchParams.get('location')).toBe('Rua X, 100')
    expect(url.searchParams.get('startdt')).toBe(
      `${new Date(2026, 10, 25, 14, 0).toISOString().slice(0, 19)}Z`,
    )
    expect(url.searchParams.get('enddt')).toBe(
      `${new Date(2026, 10, 25, 14, 45).toISOString().slice(0, 19)}Z`,
    )
  })

  it('espaço vai como %20 — o Outlook mostra o + literal — e o + do texto sobrevive', () => {
    const link = linkOutlook(compromisso({ titulo: 'João + Maria' }))
    expect(link).not.toMatch(/subject=[^&]*\+/)
    expect(new URL(link).searchParams.get('subject')).toBe('João + Maria')
  })

  it('a conta do trabalho mora no endereço do Microsoft 365', () => {
    expect(new URL(linkOutlook(compromisso(), 'trabalho')).hostname).toBe('outlook.office.com')
  })
})

describe('linkGoogleAgenda', () => {
  it('leva o fuso do aparelho — sem ele o Google lê a hora como UTC', () => {
    const url = new URL(linkGoogleAgenda(compromisso({ local: 'Rua X, 100' })))
    expect(url.searchParams.get('dates')).toBe('20261125T140000/20261125T144500')
    expect(url.searchParams.get('ctz')).toBeTruthy()
    expect(url.searchParams.get('text')).toBe('Atendimento')
    expect(url.searchParams.get('location')).toBe('Rua X, 100')
  })
})
