// TRAVA DOS AVISOS QUE O VISITANTE LÊ.
//
// Quase tudo neste projeto tem teste de comportamento. Isto aqui é diferente: é
// um teste sobre o TEXTO, e existe porque o pior defeito jurídico que o produto
// já teve não quebrava nada — funcionava perfeitamente e dizia a coisa errada.
//
// Até 04/09/2026 o rodapé de todo perfil público trazia "Perfil informativo · em
// conformidade com o Provimento 205/2021 da OAB". Lida por um visitante, essa
// frase diz que a PLATAFORMA atesta a conformidade daquele perfil — o oposto do
// que os Termos afirmam (itens 4 e 12: a checagem é apoio, não garantia) e a
// mesma lógica do selo "verificada", removido em julho por violar o art. 5º, §
// 1º do Provimento. Num processo por publicidade irregular ou por perfil falso,
// era a frase que a inicial citaria.
//
// Nenhum compilador pega isso. Este arquivo pega.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTACT_EMAIL, OPERADOR, TERMS_VERSION } from './legalIdentity'

const SRC = join(__dirname, '..')
const ler = (...partes: string[]) => readFileSync(join(SRC, ...partes), 'utf8')

// Só o que o visitante LÊ. Comentário de código explica o erro antigo e precisa
// poder citá-lo — senão o próprio comentário derrubaria o teste.
function textoVisivel(fonte: string): string {
  return fonte
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

describe('o perfil público não certifica nada', () => {
  const visivel = textoVisivel(ler('components', 'profile', 'ProfileView.tsx'))

  it('não afirma que o perfil está em conformidade', () => {
    expect(visivel).not.toMatch(/em conformidade com o Provimento/i)
    expect(visivel).not.toMatch(/perfil (verificad|conferid)/i)
  })

  it('diz quem responde pelo conteúdo', () => {
    expect(visivel).toMatch(/único responsável pelas informações/i)
  })

  it('diz que não conferimos', () => {
    expect(visivel).toMatch(/não confere, não valida e não endossa/i)
  })
})

describe('o aviso da OAB é visível, não só tooltip', () => {
  const fonte = ler('components', 'ui', 'CnaLink.tsx')
  const visivel = textoVisivel(fonte)

  it('a ressalva sai do atributo title e vira texto na tela', () => {
    // O `title` continua existindo (serve ao mouse); o que não pode é ser o
    // ÚNICO lugar — no celular, tooltip não existe, e é ali que estes perfis
    // são abertos.
    expect(visivel).toMatch(/Número informado pelo próprio profissional/i)
    expect(visivel).toMatch(/não conferido pelo advoc\.me/i)
  })

  it('continua sem marca de verificação ao lado do número', () => {
    // O comentário do arquivo CITA o "✓" para explicar por que ele não está
    // lá — por isso a conferência é sobre o texto visível, não sobre a fonte.
    expect(visivel).not.toMatch(/CheckIcon|✓/)
  })
})

describe('quem chega pelo link alcança os documentos e sabe com quem trata', () => {
  const fonte = ler('pages', 'PublicProfile.tsx')

  it('o rodapé leva aos Termos — não só à Privacidade', () => {
    // Uma limitação de responsabilidade que o terceiro prejudicado nunca teve
    // como ler é uma limitação que não se opõe a ele.
    expect(fonte).toMatch(/to="\/legal\/termos"/)
    expect(fonte).toMatch(/to="\/legal\/privacidade"/)
  })

  it('a denúncia continua ao alcance de quem não tem conta', () => {
    expect(fonte).toMatch(/\/denunciar/)
  })

  it('identifica o operador da plataforma', () => {
    expect(fonte).toMatch(/OPERADOR\.razaoSocial/)
    expect(fonte).toMatch(/OPERADOR\.cnpj/)
  })
})

describe('identificação do fornecedor', () => {
  it('está preenchida — CDC, arts. 6º, III e 31', () => {
    // Termos sem parte identificada é o primeiro argumento para o juiz
    // relativizar as cláusulas. Um placeholder esquecido aqui passaria batido
    // em qualquer revisão de código.
    expect(OPERADOR.razaoSocial).not.toMatch(/pendente|placeholder|xxx/i)
    expect(OPERADOR.cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)
    expect(OPERADOR.municipio).toBeTruthy()
    expect(OPERADOR.uf).toHaveLength(2)
  })
})

describe('os canais que os documentos prometem existem de verdade', () => {
  const legal = ler('lib', 'legalContent.ts')
  const visivel = textoVisivel(legal)

  it('não promete um e-mail enquanto não houver caixa que alguém leia', () => {
    // Até 04/09/2026 os sete documentos apontavam contato@advoc.me como canal do
    // encarregado (LGPD, art. 41), com resposta em 15 dias. O domínio não é
    // nosso e o backend não recebe e-mail: a caixa não podia existir. Um canal
    // inventado é pior do que canal nenhum — quem escreve para lá não fica sem
    // resposta por acaso, fica porque a política mentiu.
    //
    // Quando a caixa existir e for LIDA, preencha CONTACT_EMAIL em
    // legalIdentity.ts; este teste se ajusta sozinho.
    if (CONTACT_EMAIL) return
    const emails = visivel.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []
    expect(emails, `endereço de e-mail no texto legal: ${emails.join(', ')}`).toEqual([])
  })

  it('oferece o canal de quem TEM conta', () => {
    expect(visivel).toMatch(/Suporte/)
  })

  it('oferece um caminho para quem NÃO tem conta', () => {
    // Sem e-mail, sobram dois: a denúncia (pública, sem cadastro) e a sede da
    // empresa. Juízo não precisa de e-mail para citar — precisa de pessoa
    // jurídica determinada e endereço.
    expect(visivel).toMatch(/Denunciar este perfil/)
    expect(visivel).toMatch(/sede de \$\{OPERADOR\.razaoSocial\}|CANAL_SEDE/)
  })
})

describe('a caixa de aceite existe no cadastro', () => {
  const fonte = ler('pages', 'AuthPage.tsx')

  it('é uma caixa de verdade, e começa desmarcada', () => {
    expect(fonte).toMatch(/const \[aceitou, setAceitou\] = useState\(false\)/)
    expect(fonte).toMatch(/AceiteDosTermos/)
  })

  it('trava o botão de criar conta', () => {
    expect(fonte).toMatch(/confirm === password && aceitou/)
  })
})

describe('a versão dos documentos', () => {
  it('é a que os documentos exibem', () => {
    // A mesma constante alimenta o texto legal, o aceite gravado e a trava de
    // paridade com o backend.
    const legal = ler('lib', 'legalContent.ts')
    expect(legal).toMatch(/TERMS_UPDATED/)
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}(-\d+)?$/)
  })
})
