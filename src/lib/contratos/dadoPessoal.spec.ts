import { describe, expect, it } from 'vitest'
import { acharDadosPessoais } from './dadoPessoal'
import CASOS from './dadoPessoal.casos.json'

// Os mesmos casos que o servidor usa (backend/src/contratos/dado-pessoal.spec.ts).
// Se a tela e o servidor discordarem, a pessoa vê "tudo certo" e o salvar falha.
describe('dado pessoal num modelo — casos compartilhados com o servidor', () => {
  it.each((CASOS as { texto: string; tipos: string[] }[]).map((c) => [c.texto, c.tipos] as const))(
    '%s',
    (texto, tipos) => {
      expect(acharDadosPessoais(texto).map((a) => a.tipo)).toEqual(tipos)
    },
  )
})
