// Travas da prévia do link, do dado estruturado e do HTML estático.
//
// O que este arquivo protege é difícil de notar quebrado: ninguém abre o código
// fonte de uma página para conferir uma meta tag, e a prévia errada só aparece
// no aparelho de um cliente do advogado, num grupo de WhatsApp onde nós não
// estamos. Quando alguém percebe, já circulou.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  corpoDaHome,
  corpoDoEscritorio,
  corpoDoPerfil,
  ehSlugDePerfil,
  escapeHtml,
  ESCRITORIO_DE_EXEMPLO,
  escritorioIndexavel,
  EXAMPLE_SLUGS,
  headDoPerfil,
  HOME,
  ogImageUrl,
  paginaIndexavel,
  perfilIndexavel,
  renderHead,
  ROBOTS_INDEXAR,
  ROBOTS_NAO_INDEXAR,
  ROTAS_RESERVADAS,
  seoDescription,
  seoTitle,
  slugDeEscritorio,
  tagsDaHome,
  tagsDoEscritorio,
  tagsDoPerfil,
  urlCanonica,
  type EscritorioCompartilhavel,
  type PerfilCompartilhavel,
} from './ogTags'
import { sampleFirm } from './escritorio'
import { exampleProfiles } from './mockData'

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

const escritorio = (extra: Partial<EscritorioCompartilhavel> = {}): EscritorioCompartilhavel => ({
  slug: 'ribeiro-advogados',
  name: 'Ribeiro Advogados',
  oabRegistry: 'OAB/SP 12.345',
  tagline: 'Sociedade de advogados',
  about: 'Atuação em direito de família e sucessões desde 2010, com sede na capital paulista.',
  city: 'São Paulo',
  state: 'SP',
  areas: [{ label: 'Direito de Família' }],
  lawyers: [{ slug: 'ana-ribeiro', name: 'Ana Ribeiro', oabNumber: 'OAB/SP 123.456', area: 'Direito de Família' }],
  ...extra,
})

const ld = (tags: ReturnType<typeof tagsDoPerfil>) =>
  tags.filter((t) => t.tipo === 'ld').map((t) => (t as { dados: { '@graph': Record<string, unknown>[] } }).dados)

const metaDe = (tags: ReturnType<typeof tagsDoPerfil>, chave: string) =>
  (tags.find((t) => t.tipo === 'meta' && t.chave === chave) as { valor: string } | undefined)?.valor

describe('o texto da prévia é factual', () => {
  it('monta título com área e foro geográfico', () => {
    expect(seoTitle(perfil())).toBe(
      'Ana Ribeiro — Advogado(a) de Direito de Família e Sucessões em São Paulo/SP',
    )
  })

  it('descrição: frase do advogado, áreas, foro e modo de atendimento, inscrição', () => {
    expect(seoDescription(perfil({ serviceMode: { inPerson: true, online: true } }))).toBe(
      'Advogada. Atuação em Direito de Família e Sucessões. Atendimento em São Paulo/SP, presencial e on-line. OAB/SP 123.456.',
    )
  })

  it('cai na bio quando não há dado estruturado', () => {
    const p = perfil({ areas: [], city: '', state: '', oabNumber: '', headline: '', bio: 'Advogada.' })
    expect(seoDescription(p)).toBe('Advogada.')
  })

  it('não passa de ~155 caracteres, cortando em palavra inteira', () => {
    const p = perfil({
      headline: 'Advogada com atuação em varas de família e sucessões da capital e do interior',
      areas: [{ label: 'Direito de Família' }, { label: 'Sucessões' }, { label: 'Inventários' }],
      serviceMode: { inPerson: true, online: true },
    })
    const d = seoDescription(p)
    expect(d.length).toBeLessThanOrEqual(155)
    expect(d.endsWith('…')).toBe(true)
    expect(d).not.toMatch(/\s…$/)
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

  // Formato novo do JSON público (2026-09-03): o backend já manda o caminho da
  // rota de avatar com a versão. Aqui só entra a origem absoluta na frente —
  // og:image relativa não vale para robô nenhum.
  it('caminho da nossa rota (formato novo, com versão) ganha a origem absoluta', () => {
    const p = perfil({ avatarUrl: '/api/profiles/ana-ribeiro/avatar?v=0a1b2c3d' })
    expect(ogImageUrl(p, ORIGEM)).toBe(`${ORIGEM}/api/profiles/ana-ribeiro/avatar?v=0a1b2c3d`)
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

  // O Facebook documenta: sem width/height, a PRIMEIRA partilha sai sem imagem
  // (o robô ainda não baixou a foto quando monta o cartão). Só quando sabemos.
  it('declara as medidas da imagem padrão e da nossa foto; da externa, não', () => {
    const padrao = tagsDoPerfil(perfil(), `${ORIGEM}/x`, ORIGEM)
    expect(metaDe(padrao, 'og:image:width')).toBe('1200')
    expect(metaDe(padrao, 'og:image:height')).toBe('630')
    const nossa = tagsDoPerfil(perfil({ avatarUrl: '/api/profiles/ana-ribeiro/avatar?v=1' }), `${ORIGEM}/x`, ORIGEM)
    expect(metaDe(nossa, 'og:image:width')).toBe('512')
    expect(metaDe(nossa, 'og:image:alt')).toBe('Foto de Ana Ribeiro')
    const externa = tagsDoPerfil(perfil({ avatarUrl: 'https://cdn.exemplo/ana.jpg' }), `${ORIGEM}/x`, ORIGEM)
    expect(metaDe(externa, 'og:image:width')).toBeUndefined()
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
  // e fecha o bloco ali, mesmo dentro de uma string. Uma bio contendo
  // `</script>` quebraria para fora do dado estruturado.
  it('não deixa </script> escapar de dentro do JSON-LD', () => {
    const html = headDoPerfil(
      perfil({ headline: '</script><img onerror=alert(1)>' }),
      `${ORIGEM}/x`,
      ORIGEM,
    )
    const fechamentos = html.match(/<\/script>/g) ?? []
    // Exatamente um: o bloco JSON-LD do perfil, e nenhum a mais.
    expect(fechamentos).toHaveLength(1)
    expect(html).toContain('\\u003c/script')
  })

  // O corpo estático é HTML montado com o texto do advogado — mesmo risco.
  it('escapa o texto do advogado no corpo estático', () => {
    const html = corpoDoPerfil(
      perfil({
        bio: '<script>alert(1)</script>',
        faqs: [{ question: '<b>q</b>', answer: '"a"' }],
        areas: [{ label: '<i>x</i>', description: 'y' }],
      }),
      ORIGEM,
    )
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('<b>q</b>')
    expect(html).not.toContain('<i>x</i>')
    // Só o nosso <style> e a nossa marcação; nenhum script.
    expect(html.match(/<script/g)).toBeNull()
  })

  it('link de rede só entra com https', () => {
    const html = corpoDoPerfil(
      perfil({ socials: [{ kind: 'instagram', url: 'javascript:alert(1)' }, { kind: 'linkedin', url: 'https://linkedin.com/in/ana' }] }),
      ORIGEM,
    )
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="https://linkedin.com/in/ana"')
  })

  it('escapeHtml cobre os cinco caracteres, e o & primeiro', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('as tags essenciais estão todas lá', () => {
  const chaves = tagsDoPerfil(perfil({ avatarUrl: 'data:image/png;base64,A' }), `${ORIGEM}/ana-ribeiro`, ORIGEM)

  it.each([['og:title'], ['og:description'], ['og:image'], ['og:url'], ['og:type'], ['robots'], ['og:image:alt']])(
    'tem %s',
    (chave) => {
      expect(chaves.some((t) => t.tipo === 'meta' && t.chave === chave)).toBe(true)
    },
  )

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

  it('og:type=profile traz o nome separado', () => {
    expect(metaDe(chaves, 'profile:first_name')).toBe('Ana')
    expect(metaDe(chaves, 'profile:last_name')).toBe('Ribeiro')
  })

  it('o título termina em advoc.me uma vez só', () => {
    const title = chaves.find((t) => t.tipo === 'title') as { texto: string }
    expect(title.texto.match(/advoc\.me/g)).toHaveLength(1)
  })
})

describe('o dado estruturado', () => {
  // `Attorney` foi DEPRECIADO pelo schema.org; o Google documenta ProfilePage →
  // Person para página de pessoa. `LegalService` é negócio local: só com endereço.
  it('é ProfilePage com Person, sem Attorney nem FAQPage', () => {
    const [grafo] = ld(tagsDoPerfil(perfil({ faqs: [{ question: 'Q?', answer: 'R.' }] }), `${ORIGEM}/x`, ORIGEM))
    const tipos = grafo['@graph'].map((n) => n['@type'])
    expect(tipos).toEqual(['ProfilePage', 'Person'])
    expect(JSON.stringify(grafo)).not.toContain('Attorney')
    expect(JSON.stringify(grafo)).not.toContain('FAQPage')
  })

  it('a pessoa carrega OAB, áreas, redes e telefone — só https em sameAs', () => {
    const [grafo] = ld(
      tagsDoPerfil(
        perfil({
          socials: [{ kind: 'instagram', url: 'https://instagram.com/ana' }, { kind: 'website', url: 'http://inseguro' }],
          contact: { whatsapp: '5511999998888', email: 'ana@exemplo.adv.br' },
        }),
        `${ORIGEM}/x`,
        ORIGEM,
      ),
    )
    const pessoa = grafo['@graph'][1]
    expect(pessoa.identifier).toEqual({ '@type': 'PropertyValue', name: 'OAB', value: 'OAB/SP 123.456' })
    expect(pessoa.knowsAbout).toEqual(['Direito de Família', 'Sucessões'])
    expect(pessoa.sameAs).toEqual(['https://instagram.com/ana'])
    expect(pessoa.telephone).toBe('+5511999998888')
    expect(pessoa.email).toBe('ana@exemplo.adv.br')
    expect(pessoa.disambiguatingDescription).toContain('não confere')
  })

  it('só vira LegalService quando o endereço é público', () => {
    const escondido = ld(
      tagsDoPerfil(perfil({ address: { rua: 'Rua A', numero: '1', publico: false } }), `${ORIGEM}/x`, ORIGEM),
    )[0]
    expect(escondido['@graph'].map((n) => n['@type'])).toEqual(['ProfilePage', 'Person'])
    expect(JSON.stringify(escondido)).not.toContain('Rua A')

    const publico = ld(
      tagsDoPerfil(perfil({ address: { rua: 'Rua A', numero: '1', bairro: 'Centro', cep: '01000-000', publico: true } }), `${ORIGEM}/x`, ORIGEM),
    )[0]
    const tipos = publico['@graph'].map((n) => n['@type'])
    expect(tipos).toEqual(['ProfilePage', 'Person', 'LegalService'])
    const negocio = publico['@graph'][2]
    expect((negocio.address as { streetAddress: string }).streetAddress).toBe('Rua A, 1')
    expect(negocio.founder).toEqual({ '@id': `${ORIGEM}/x#pessoa` })
    expect(JSON.stringify(negocio)).not.toContain('priceRange')
  })

  it('a home diz quem publica: Organization com logo e WebSite, sem SearchAction', () => {
    const [grafo] = ld(tagsDaHome(ORIGEM))
    expect(grafo['@graph'].map((n) => n['@type'])).toEqual(['Organization', 'WebSite'])
    expect(JSON.stringify(grafo)).not.toContain('SearchAction')
    expect((grafo['@graph'][0].logo as { url: string }).url).toBe(`${ORIGEM}/logo.png`)
  })

  it('o escritório é um LegalService com os advogados como membros', () => {
    const [grafo] = ld(tagsDoEscritorio(escritorio(), `${ORIGEM}/escritorio/ribeiro-advogados`, ORIGEM))
    const negocio = grafo['@graph'][1]
    expect(negocio['@type']).toBe('LegalService')
    expect((negocio.member as { url: string }[])[0].url).toBe(`${ORIGEM}/ana-ribeiro`)
  })
})

describe('o que entra no índice', () => {
  it('perfil com área ou com bio de verdade é indexável; sem os dois, não', () => {
    expect(perfilIndexavel(perfil())).toBe(true)
    expect(perfilIndexavel(perfil({ areas: [], bio: 'Advogada.' }))).toBe(false)
    expect(perfilIndexavel(perfil({ areas: [], bio: 'a'.repeat(80) }))).toBe(true)
  })

  it('os perfis de exemplo nunca entram — são pessoas fictícias', () => {
    for (const slug of EXAMPLE_SLUGS) expect(perfilIndexavel(perfil({ slug }))).toBe(false)
    expect(escritorioIndexavel(escritorio({ slug: ESCRITORIO_DE_EXEMPLO }))).toBe(false)
    expect(escritorioIndexavel(escritorio())).toBe(true)
  })

  it('a decisão vira a meta robots', () => {
    expect(metaDe(tagsDoPerfil(perfil(), `${ORIGEM}/x`, ORIGEM), 'robots')).toBe(ROBOTS_INDEXAR)
    expect(metaDe(tagsDoPerfil(perfil({ slug: EXAMPLE_SLUGS[0] }), `${ORIGEM}/x`, ORIGEM), 'robots')).toBe(
      ROBOTS_NAO_INDEXAR,
    )
    expect(ROBOTS_INDEXAR).toContain('max-image-preview:large')
  })

  // A lista de slugs de exemplo mora aqui (o único arquivo que a borda importa);
  // as fixtures moram em mockData/escritorio. Divergir = exemplo indexado.
  it('os slugs de exemplo batem com as fixtures', () => {
    expect([...EXAMPLE_SLUGS].sort()).toEqual(exampleProfiles.map((p) => p.slug).sort())
    expect(ESCRITORIO_DE_EXEMPLO).toBe(sampleFirm.slug)
  })

  it.each([
    ['/', true],
    ['/ana-ribeiro', true],
    ['/legal/termos', true],
    ['/escritorio/ribeiro-advogados', true],
    ['/painel', false],
    ['/entrar', false],
    ['/escritorio/editar', false],
    ['/ana-ribeiro/agendar', false],
    ['/ana-ribeiro/denunciar', false],
    ['/__preview/classic', false],
    ['/contratos/conferir', false],
  ])('%s → indexável: %s', (caminho, esperado) => {
    expect(paginaIndexavel(caminho)).toBe(esperado)
  })

  it('a canônica não tem query nem barra final', () => {
    expect(urlCanonica(ORIGEM, '/ana-ribeiro/')).toBe(`${ORIGEM}/ana-ribeiro`)
    expect(urlCanonica(ORIGEM, '/')).toBe(`${ORIGEM}/`)
    expect(urlCanonica(ORIGEM, '')).toBe(`${ORIGEM}/`)
  })
})

describe('o corpo estático — o que o robô lê no lugar de uma div vazia', () => {
  it('traz nome, OAB, áreas, bio, perguntas e contato como texto', () => {
    const html = corpoDoPerfil(
      perfil({
        avatarUrl: '/api/profiles/ana-ribeiro/avatar?v=1',
        faqs: [{ question: 'Atende on-line?', answer: 'Sim, por vídeo.' }],
        contact: { whatsapp: '5511999998888', email: 'ana@exemplo.adv.br' },
        serviceMode: { inPerson: true, online: true },
        regionNote: 'Atendimento em toda a Grande SP',
      }),
      ORIGEM,
    )
    expect(html).toContain('<h1>Ana Ribeiro</h1>')
    expect(html).toContain('OAB/SP 123.456 · São Paulo/SP')
    expect(html).toContain('<li>Direito de Família</li>')
    expect(html).toContain('<dt>Atende on-line?</dt><dd>Sim, por vídeo.</dd>')
    expect(html).toContain('Presencial e on-line. Atendimento em toda a Grande SP.')
    expect(html).toContain('href="https://wa.me/5511999998888"')
    expect(html).toContain('mailto:ana@exemplo.adv.br')
    expect(html).toContain(`src="${ORIGEM}/api/profiles/ana-ribeiro/avatar?v=1"`)
    expect(html).toContain('não confere')
  })

  it('o endereço escondido não vaza para o texto', () => {
    const html = corpoDoPerfil(perfil({ address: { rua: 'Rua Secreta', numero: '9', publico: false } }), ORIGEM)
    expect(html).not.toContain('Rua Secreta')
  })

  // Os dados do exemplo são inventados: um número fictício pode ser de alguém
  // de verdade (ver lib/exemplo.ts). Nenhum link de contato sai daqui.
  it('no exemplo, nada de WhatsApp, e-mail ou rede', () => {
    const html = corpoDoPerfil(
      perfil({
        slug: EXAMPLE_SLUGS[0],
        contact: { whatsapp: '5511999998888', email: 'x@y.z' },
        socials: [{ kind: 'instagram', url: 'https://instagram.com/x' }],
      }),
      ORIGEM,
    )
    expect(html).not.toContain('wa.me')
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain('instagram.com')
  })

  it('o escritório lista os advogados com link para o perfil de cada um', () => {
    const html = corpoDoEscritorio(escritorio())
    expect(html).toContain('<h1>Ribeiro Advogados</h1>')
    expect(html).toContain('<a href="/ana-ribeiro">Ana Ribeiro</a>')
  })

  it('a home tem um h1 e as mesmas âncoras do Landing.tsx', () => {
    const html = corpoDaHome()
    expect(html.match(/<h1>/g)).toHaveLength(1)
    // A vitrine de contratos é um componente à parte; as âncoras são as mesmas.
    const landing =
      readFileSync(join(__dirname, '..', 'pages', 'Landing.tsx'), 'utf-8') +
      readFileSync(join(__dirname, '..', 'components', 'landing', 'ContratosVitrine.tsx'), 'utf-8')
    for (const id of ['problema', 'assistente', 'contratos', 'como-funciona', 'planos']) {
      expect(landing).toContain(`id="${id}"`)
      expect(html).toContain(`id="${id}"`)
    }
  })

  it('renderHead marca toda tag como nossa', () => {
    const html = renderHead(tagsDaHome(ORIGEM))
    const tags = html.split('\n').filter(Boolean)
    for (const t of tags) expect(t).toContain('data-advocme-seo')
  })
})

// O index.html é o que vale se a borda falhar; o Landing.tsx é o que vale
// depois que o app monta; HOME é o que a borda escreve. Três lugares, um texto.
describe('a home tem um título só', () => {
  const indexHtml = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf-8')
  it('index.html usa HOME.title e HOME.description', () => {
    expect(indexHtml).toContain(`<title>${HOME.title}</title>`)
    expect(indexHtml).toContain(`content="${HOME.description}"`)
  })
  it('Landing.tsx usa HOME.title', () => {
    const landing = readFileSync(join(__dirname, '..', 'pages', 'Landing.tsx'), 'utf-8')
    expect(landing).toContain('document.title = HOME.title')
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

  it('reconhece a página pública do escritório, e não o editor dela', () => {
    expect(slugDeEscritorio('/escritorio/ribeiro-advogados')).toBe('ribeiro-advogados')
    expect(slugDeEscritorio('/escritorio/editar')).toBeNull()
    expect(slugDeEscritorio('/escritorio')).toBeNull()
    expect(slugDeEscritorio('/escritorio/x/y')).toBeNull()
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
