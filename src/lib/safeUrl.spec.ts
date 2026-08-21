import { describe, expect, it } from 'vitest'
import { safeHref } from './safeUrl'

describe('safeHref', () => {
  it('mantém links normais', () => {
    expect(safeHref('https://instagram.com/adv')).toBe('https://instagram.com/adv')
    expect(safeHref('http://exemplo.com/')).toBe('http://exemplo.com/')
  })

  it('assume https quando falta o esquema', () => {
    expect(safeHref('instagram.com/adv')).toBe('https://instagram.com/adv')
  })

  it('recusa esquemas que executam código ou vazam arquivo', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    expect(safeHref('  JaVaScRiPt:alert(1)')).toBeUndefined()
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(safeHref('file:///etc/passwd')).toBeUndefined()
    expect(safeHref('vbscript:msgbox(1)')).toBeUndefined()
  })

  it('recusa vazio e tipo errado', () => {
    expect(safeHref('')).toBeUndefined()
    expect(safeHref('   ')).toBeUndefined()
    expect(safeHref(null)).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
    expect(safeHref(42 as unknown as string)).toBeUndefined()
  })
})
