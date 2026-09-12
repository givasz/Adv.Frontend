// /robots.txt — o que os robôs podem PERCORRER.
//
// É uma edge function, e não um arquivo em `public/`, por causa de UMA linha: a
// diretiva `Sitemap:` exige URL ABSOLUTA. Num arquivo estático teríamos de
// escrever o domínio à mão — e ele muda (advocme.netlify.app hoje, advoc.me na
// virada). Gerando na borda, a linha sai da origem da própria requisição.
//
// A REGRA É QUASE VAZIA, DE PROPÓSITO.
//
// Antes, este arquivo proibia o painel, o editor, o login e as subpáginas do
// perfil. Parecia certo e era o oposto: `Disallow` proíbe a LEITURA, não a
// indexação. Uma página que o Google não pode ler ele ainda indexa pelo
// endereço quando alguém linka — aparece no resultado como "nenhuma informação
// disponível para esta página". E, como não pode ler, nunca vê o `noindex` que
// a tiraria de lá. Quem decide o que entra no índice é a META `robots` que a
// borda escreve em cada página (perfil.ts + paginaIndexavel em ogTags.ts):
// `index` na home, nos documentos legais, nos perfis e nos escritórios;
// `noindex` em tudo o mais. Para o robô LER o noindex, ele precisa poder entrar.
//
// O que continua proibido é o que nunca é linkado e só existe para o app: a
// prévia interna de temas (o mesmo perfil em oito roupas). A API fica LIBERADA:
// é por `/api/profiles/:slug/avatar` que o Google Imagens busca a foto do
// advogado que o `og:image` aponta — proibir `/api/` seria tirar o rosto dele
// do resultado.
//
// Robôs de IA: o `User-agent: *` já os inclui. Os de BUSCA por IA
// (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot)
// são justamente o que queremos: é assim que "advogado de família em Campinas"
// perguntado ao ChatGPT devolve o perfil de quem está aqui. Os de TREINO
// (GPTBot, ClaudeBot, Google-Extended) são uma decisão de política, sem efeito
// em citação; hoje não os separamos.

interface ContextoNetlify {
  next(): Promise<Response>
}

export default function handler(req: Request, _ctx: ContextoNetlify): Response {
  const origem = new URL(req.url).origin

  const corpo = `# advoc.me — o que entra no índice é decidido pela meta robots de cada página.
User-agent: *
Allow: /

# Prévia interna de temas: o mesmo perfil em oito roupas, nunca linkada.
Disallow: /__preview/
# /assets/ (o JavaScript e o CSS do app) fica LIBERADO de propósito: o Google
# renderiza a página como um navegador, e sem esses arquivos ele veria só o
# HTML estático — que é bom, mas não é a página inteira.

Sitemap: ${origem}/sitemap.xml
`

  return new Response(corpo, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
