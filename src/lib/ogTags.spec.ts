// Travas da prévia do link.
//
// O que este arquivo protege é difícil de notar quebrado: ninguém abre o código
// fonte de uma página para conferir uma meta tag, e a prévia errada só aparece
// no aparelho de um cliente do advogado, num grupo de WhatsApp onde nós não
// estamos. Quando alguém percebe, já circulou.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ehSlugDePerfil,
  escapeHtml,
  headDoPerfil,
  ogImageUrl,
  ROTAS_RESERVADAS,
  seoDescription,
  seoTitle,
  tagsDoPerfil,
  type PerfilCompartilhavel,
} from './ogTags'

const ORIGEM = 'https://advocme.netlify.app'

const perfil = (extra: Partial<PerfilCompartilhavel> = {}): PerfilCompartilhavel => ({
  slug: 'ana-ribeiro',
  name: 'Ana Ribeiro',
  oabNumber: 'OAB/SP 123.456',
  headline: 'Advogada',
  bio: 'Atuação em direito de família.',
  city: 'São Paulo',
  state: 'SP',
  areas: [{ label: 'Direito de Família' }, { label: 'Sucessões' }],
  ...extra,
})

describe('o texto da prévia é factual', () => {
  it('monta título com área e foro geográfico', () => {
    expect(seoTitle(perfil())).toBe(
      'Ana Ribeiro — Advogado(a) de Direito de Família e Sucessões em São Paulo/SP',
    )
  })

  it('cai na headline quando não há dado estruturado', () => {
    const p = perfil({ areas: [], city: '', state: '', oabNumber: '', headline: 'Advogada' })
    expect(seoDescription(p)).toBe('Advogada')
  })

  // O Prov. 205/2021 veda superlativo e promessa de resultado na publicidade do
  // advogado, e a prévia é publicidade dele — mais exposta que a página, aliás:
  // circula em grupo, sem o resto do perfil para qualificá-la.
  it('não inventa adjetivo nem chamariz', () => {
    const texto = `${seoTitle(perfil())} ${seoDescription(perfil())}`.toLowerCase()
    for (const proibido of ['melhor', 'líder', 'especialista', 'garanto', 'rápido', 'barato']) {
      expect(texto).not.toContain(proibido)
    }
  })
})

describe('a foto vira uma URL que o robô consegue buscar', () => {
  // O bug que originou tudo: `avatarUrl` é um data URI, e data URI em og:image
  // não produz imagem nenhuma — o robô do mensageiro busca a imagem por HTTP,
  // num processo que nem abre a página.
  it('aponta para o endpoint de avatar, nunca para o data URI', () => {
    const p = perfil({ avatarUrl: 'data:image/png;base64,AAAA' })
    const url = ogImageUrl(p, ORIGEM)
    expect(url).toBe(`${ORIGEM}/api/profiles/ana-ribeiro/avatar`)
    expect(url).not.toContain('data:')
  })

  it('sem foto, usa a imagem padrão da plataforma', () => {
    expect(ogImageUrl(perfil(), ORIGEM)).toBe(`${ORIGEM}/og-padrao.jpg`)
  })

  /**
   * Foto hospedada fora ("colar link"): o og:image aponta DIRETO para o host
   * dela, e não para a nossa rota de avatar.
   *
   * Antes passava pela nossa rota, que respondia `302` para o endereço gravado
   * no perfil — ou seja, um redirecionamento aberto no nosso domínio. Criar
   * conta é grátis: bastava salvar a foto apontando para a página do golpe e
   * `advoc.me/api/profiles/<slug>/avatar` virava um link nosso levando a
   * qualquer lugar, que é justamente o que um filtro de e-mail e a própria
   * pessoa conferem antes de clicar.
   *
   * A rota deixou de redirecionar (backend/src/profiles/profiles.service.ts);
   * este teste é o outro lado da mesma decisão.
   */
  it('foto hospedada fora aponta para o host dela, não para a nossa origem', () => {
    const p = perfil({ avatarUrl: 'https://cdn.exemplo/ana.jpg' })
    expect(ogImageUrl(p, ORIGEM)).toBe('https://cdn.exemplo/ana.jpg')
  })

  it('esquema que não é https nem data cai na imagem padrão', () => {
    // Segunda camada: `safeImageSrc` já recusa isto na gravação, mas esta função
    // também roda sobre o que JÁ está no banco.
    for (const ruim of ['javascript:alert(1)', 'http://sem-tls/x.jpg', '//outro.site/x.jpg']) {
      expect(ogImageUrl(perfil({ avatarUrl: ruim }), ORIGEM)).toBe(`${ORIGEM}/og-padrao.jpg`)
    }
  })
})

describe('o HTML servido não pode ser sequestrado pelo texto do advogado', () => {
  // `name` e `bio` são texto livre que o advogado escreve, e aqui eles entram
  // num atributo montado por concatenação. Um nome com aspas fecharia o atributo
  // e o que viesse depois viraria marcação — na NOSSA origem, onde vive o cookie
  // de sessão de quem estiver logado.
  it('escapa aspas e sinais de marcação no nome', () => {
    const html = headDoPerfil(perfil({ name: '" onload="alert(1)' }), `${ORIGEM}/x`, ORIGEM)
    expect(html).not.toContain('onload="alert(1)"')
    expect(html).toContain('&quot; onload=&quot;alert(1)')
  })

  it('escapa < e > na bio', () => {
    const html = headDoPerfil(
      perfil({ areas: [], city: '', state: '', oabNumber: '', headline: '<img src=x>' }),
      `${ORIGEM}/x`,
      ORIGEM,
    )
    expect(html).not.toContain('<img src=x>')
  })

  // JSON.stringify escapa para JSON, não para HTML: o parser procura `</script`
  // e fecha o bloco ali, mesmo dentro de uma string. Uma resposta de FAQ contendo
  // `</script>` quebraria para fora do dado estruturado.
  it('não deixa </script> escapar de dentro do JSON-LD', () => {
    const html = headDoPerfil(
      perfil({ faqs: [{ question: 'Pergunta?', answer: '</script><img onerror=alert(1)>' }] }),
      `${ORIGEM}/x`,
      ORIGEM,
    )
    const fechamentos = html.match(/<\/script>/g) ?? []
    // Exatamente um por bloco JSON-LD (Attorney + FAQPage), nenhum a mais.
    expect(fechamentos).toHaveLength(2)
    expect(html).toContain('\\u003c/script')
  })

  it('escapeHtml cobre os cinco caracteres, e o & primeiro', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('as tags essenciais estão todas lá', () => {
  const chaves = tagsDoPerfil(perfil({ avatarUrl: 'data:image/png;base64,A' }), `${ORIGEM}/ana-ribeiro`, ORIGEM)

  it.each([
    ['og:title'],
    ['og:description'],
    ['og:image'],
    ['og:url'],
    ['og:type'],
  ])('tem %s', (chave) => {
    expect(chaves.some((t) => t.tipo === 'meta' && t.chave === chave)).toBe(true)
  })

  // `summary` mostra a foto como miniatura quadrada ao lado do texto, que é
  // praticamente não aparecer. O card grande é o que faz a prévia ter rosto.
  it('pede o card grande do Twitter/LinkedIn', () => {
    const card = chaves.find((t) => t.tipo === 'meta' && t.chave === 'twitter:card')
    expect(card).toMatchObject({ valor: 'summary_large_image' })
  })

  it('tem canônica apontando para o endereço do perfil', () => {
    expect(chaves.find((t) => t.tipo === 'link')).toMatchObject({
      rel: 'canonical',
      href: `${ORIGEM}/ana-ribeiro`,
    })
  })

  it('só emite FAQPage quando há pergunta respondida', () => {
    const sem = tagsDoPerfil(perfil(), `${ORIGEM}/x`, ORIGEM).filter((t) => t.tipo === 'ld')
    const com = tagsDoPerfil(
      perfil({ faqs: [{ question: 'Quanto custa?', answer: 'Depende do caso.' }] }),
      `${ORIGEM}/x`,
      ORIGEM,
    ).filter((t) => t.tipo === 'ld')
    expect(sem).toHaveLength(1)
    expect(com).toHaveLength(2)
  })

  it('descarta pergunta sem resposta', () => {
    const tags = tagsDoPerfil(
      perfil({ faqs: [{ question: 'Quanto custa?', answer: '   ' }] }),
      `${ORIGEM}/x`,
      ORIGEM,
    ).filter((t) => t.tipo === 'ld')
    expect(tags).toHaveLength(1)
  })
})

describe('a edge function só intercepta perfil de verdade', () => {
  it.each(['ana-ribeiro', 'joao-silva-2', 'x'])('aceita o slug %s', (slug) => {
    expect(ehSlugDePerfil(`/${slug}`)).toBe(true)
  })

  it.each([
    ['/', 'a raiz é a home'],
    ['/painel', 'rota do app'],
    ['/entrar', 'rota do app'],
    ['/api/profiles/ana', 'a própria API'],
    ['/ana-ribeiro/agendar', 'subpágina, dois segmentos'],
    ['/legal/termos', 'documento legal'],
    ['/favicon.ico', 'arquivo estático'],
    ['/og-padrao.jpg', 'arquivo estático'],
    ['/Ana-Ribeiro', 'slug do backend é minúsculo'],
    ['/ana_ribeiro', 'sublinhado não é alfabeto de slug'],
  ])('recusa %s (%s)', (caminho) => {
    expect(ehSlugDePerfil(caminho)).toBe(false)
  })
})

// A lista de rotas reservadas é escrita à mão porque a edge function vê só o
// caminho — ela não tem a ordem do <Routes>, onde `/:slug` é o último caso.
// Quando alguém acrescenta uma rota nova em App.tsx e esquece daqui, abrir essa
// tela dispara uma busca por um perfil com o nome dela: 404 na API e a página
// servida com o head errado. Este teste é o aviso.
describe('as rotas reservadas acompanham o App.tsx', () => {
  it('toda rota de um segmento do App está na lista', () => {
    const app = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf-8')
    const caminhos = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])

    const deUmSegmento = caminhos
      .map((c) => c.replace(/^\//, '').split('/')[0])
      .filter((seg) => seg && !seg.startsWith(':') && !seg.startsWith('$') && !seg.includes('{'))

    const faltando = [...new Set(deUmSegmento)].filter((seg) => !ROTAS_RESERVADAS.has(seg))
    expect(faltando).toEqual([])
  })
})
