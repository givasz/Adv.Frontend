import { describe, expect, it } from 'vitest'
import { HREF_DE_EXEMPLO, oQueAconteceria, type AcaoDeExemplo } from './exemplo'

// O aviso é a ÚNICA coisa que um botão de perfil de exemplo faz. Se a frase
// sair vazia, torta ou com o endereço de destino, o toque volta a parecer botão
// quebrado — ou pior, a entregar o número inventado que não pode sair daqui.
describe('perfil de exemplo', () => {
  const ACOES: AcaoDeExemplo[] = [
    'whatsapp',
    'agendamento',
    'assistente',
    'email',
    'endereco',
    'cartao',
    'cna',
    'rede:instagram',
    'rede:website',
    'rede:desconhecida',
  ]

  it('toda ação vira uma frase completa, sem endereço nenhum dentro', () => {
    for (const acao of ACOES) {
      const frase = oQueAconteceria(acao, 'Marina', 'Instagram')
      expect(frase).toMatch(/^Num perfil de verdade, /)
      expect(frase.endsWith('.')).toBe(true)
      // Nem URL, nem número: a frase conta o que aconteceria, não para onde.
      expect(frase).not.toMatch(/https?:|wa\.me|@|\d{6,}/)
    }
  })

  it('diz de quem é o destino, pelo primeiro nome', () => {
    expect(oQueAconteceria('whatsapp', 'Marina')).toContain('WhatsApp de Marina')
    expect(oQueAconteceria('email', 'Marina')).toContain('escrever a Marina')
  })

  it('nomeia a rede pelo rótulo do ladrilho, e o site sem artigo torto', () => {
    expect(oQueAconteceria('rede:instagram', 'Marina', 'Instagram')).toContain(
      'página de Marina no Instagram',
    )
    expect(oQueAconteceria('rede:website', 'Marina', 'Site')).toContain('o site de Marina')
    // Sem rótulo (rede que o mapa não conhece), a frase continua de pé.
    expect(oQueAconteceria('rede:desconhecida', 'Marina')).toContain('uma rede social de Marina')
  })

  it('sem nome, não sobra "de ." pendurado', () => {
    for (const acao of ACOES) {
      expect(oQueAconteceria(acao, '  ')).not.toMatch(/\bde \.|\ba \./)
    }
  })

  it('o href de exemplo nunca sai da página', () => {
    expect(HREF_DE_EXEMPLO.startsWith('#')).toBe(true)
  })
})
