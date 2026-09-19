import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { MeetingRequestForm } from './MeetingRequestForm'

describe('pedido de contato sem escolha de horário', () => {
  it('não pergunta a data quando a triagem retirou essa etapa', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MeetingRequestForm slug="advogada" contactOnly preferredAt="2026-09-24T10:00" />
      </MemoryRouter>,
    )

    expect(html).toContain('Nenhuma data será marcada agora')
    expect(html).not.toContain('type="datetime-local"')
    expect(html).not.toContain('Horário pedido')
  })

  it('continua permitindo preferência de horário quando a etapa está ativa', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MeetingRequestForm slug="advogada" />
      </MemoryRouter>,
    )

    expect(html).toContain('type="datetime-local"')
  })
})
