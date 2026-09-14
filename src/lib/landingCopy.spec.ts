// TRAVA DA LINGUAGEM COMERCIAL DA HOME.
//
// A home passou a VENDER em 14/09/2026 — desejo, benefício, diferencial,
// recursos, segurança, nessa ordem — e é exatamente quando uma página vende que
// ela mais corre o risco de dizer o que a advocacia não pode ouvir: "mais
// clientes", "aprovado pela OAB", "o plano mais escolhido". Nenhuma dessas
// frases quebra um teste de comportamento. Este arquivo lê o texto que o
// visitante lê e recusa o vocabulário — na home, nas vitrines e no corpo
// estático que a borda serve ao buscador.
//
// Três famílias, e o porquê de cada uma:
//   • captação e resultado — prometer clientes a um advogado é oferecer o que o
//     Prov. 205/2021 veda A ELE (ver REGRAS.md e planOffer.spec.ts);
//   • chancela — a plataforma nunca certifica conteúdo nem fala em nome da OAB
//     (avisosPublicos.spec.ts cuida do perfil público; aqui é a home);
//   • prova inventada e hype — "mais escolhido" ninguém mediu, e "revolucione a
//     sua advocacia" é copy de startup, não de produto para advogados.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { corpoDaHome } from './ogTags'

const SRC = join(__dirname, '..')

// Só o que o visitante LÊ. Comentário de código explica o vocabulário proibido e
// precisa poder citá-lo — senão o próprio comentário derrubaria o teste.
function textoVisivel(fonte: string): string {
  return fonte
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

function fontesDaHome(): { nome: string; texto: string }[] {
  const pasta = join(SRC, 'components', 'landing')
  const vitrines = readdirSync(pasta)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join(pasta, f))
  return [join(SRC, 'pages', 'Landing.tsx'), ...vitrines].map((nome) => ({
    nome: nome.slice(SRC.length + 1).replace(/\\/g, '/'),
    texto: textoVisivel(readFileSync(nome, 'utf8')),
  }))
}

const PROIBIDO: [RegExp, string][] = [
  // captação e resultado
  [/mais clientes|novos clientes|capt(e|ar|ação) de client|conquiste|converta|convers(ão|ões) de visitante/i, 'não vendemos captação de clientes'],
  [/aumente (os |seus )?contratos|feche mais|garanta (novos )?clientes|resultado garantido/i, 'não vendemos resultado'],
  // chancela
  [/aprovad[oa]s? pela OAB|garantid[oa]s? pela OAB|100% aprovad|juridicamente aprovad|nunca terá problemas|selo da OAB/i, 'a plataforma não fala em nome da OAB'],
  [/perfil (verificad|conferid)|advogad[oa] verificad/i, 'a plataforma não verifica ninguém'],
  // prova inventada e hype
  [/mais escolhid[oa]|mais popular|escolha dos melhores|plano campeão|plano que mais converte/i, 'ninguém mediu popularidade'],
  [/revolucion|domine o mercado|potencialize|próximo nível|solução completa e inovadora|à frente da concorrência/i, 'copy de startup genérica'],
  // urgência artificial
  [/últimas vagas|só hoje|não perca|\bcorra\b|agora ou nunca/i, 'sem urgência artificial'],
]

describe('a home vende sem prometer o que a advocacia não pode ouvir', () => {
  const fontes = fontesDaHome()

  it('encontra a home e as vitrines (o teste não pode passar por não ler nada)', () => {
    expect(fontes.map((f) => f.nome)).toEqual(
      expect.arrayContaining(['pages/Landing.tsx', 'components/landing/PrimeiroContato.tsx']),
    )
  })

  for (const { nome, texto } of fontes) {
    it(nome, () => {
      for (const [re, porque] of PROIBIDO) {
        expect(re.test(texto), `${porque} — achado ${re} em ${nome}`).toBe(false)
      }
    })
  }

  it('o corpo estático da home (o que o buscador lê) segue as mesmas regras', () => {
    const corpo = corpoDaHome()
    for (const [re, porque] of PROIBIDO) {
      expect(re.test(corpo), `${porque} — achado ${re} no corpo da home`).toBe(false)
    }
  })
})

describe('o que a home PRECISA dizer', () => {
  const landing = fontesDaHome().find((f) => f.nome === 'pages/Landing.tsx')!.texto.replace(/\s+/g, ' ')

  it('a triagem é apresentada como configurada pelo próprio advogado', () => {
    expect(landing).toMatch(/perguntas que você (definiu|escreveu|escolheu)/i)
    expect(landing).toContain('Assistente de triagem · plano Max')
  })

  it('o assistente não orienta nem substitui o advogado', () => {
    expect(landing).toMatch(/não (dá|presta) orientação jurídica/i)
    expect(landing).toMatch(/quem avalia é você/i)
  })

  it('a checagem sinaliza — e a responsabilidade pelo conteúdo é do profissional', () => {
    expect(landing).toMatch(/sinaliza possíveis pontos de atenção/i)
    expect(landing).toMatch(/responsabilidade pelo conteúdo/i)
    expect(landing).toMatch(/apoio, não garantia/i)
  })

  it('diz que é independente e aponta para o CNA', () => {
    expect(landing).toMatch(/não é filiado à OAB/i)
    expect(landing).toMatch(/consulta pública do CNA/i)
  })

  it('a mensagem de exemplo é montada pela função de verdade', () => {
    const vitrine = readFileSync(join(SRC, 'components', 'landing', 'PrimeiroContato.tsx'), 'utf8')
    expect(vitrine).toMatch(/buildAssistantMessage\(/)
  })
})
