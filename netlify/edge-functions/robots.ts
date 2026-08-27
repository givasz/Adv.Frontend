// /robots.txt — o que os buscadores podem percorrer.
//
// É uma edge function, e não um arquivo em `public/`, por causa de UMA linha: a
// diretiva `Sitemap:` exige URL ABSOLUTA. Num arquivo estático teríamos de
// escrever o domínio à mão — e o domínio ainda não foi decidido. Hoje o site é
// `advocme.netlify.app`; amanhã será outro, e um robots.txt apontando para o
// endereço antigo é um sitemap que nunca chega ao buscador.
//
// Gerando na borda, a linha sai da origem da própria requisição: funciona no
// endereço de hoje, funciona em qualquer prévia de deploy, e funciona no domínio
// próprio no dia em que ele existir, sem tocar em nada.
//
// A regra em si: as páginas PÚBLICAS (home, documentos legais e os perfis dos
// advogados) são para serem encontradas; o que exige sessão, não. As áreas
// fechadas não estão listadas por segredo — quem as protege é o servidor, que
// responde 401 sem cookie. Estão porque um resultado de busca que leva a uma tela
// de login é um resultado ruim: a pessoa clica, não acha o que procurava e volta.
// O buscador registra essa volta e nos rebaixa na próxima vez.

interface ContextoNetlify {
  next(): Promise<Response>
}

export default function handler(req: Request, _ctx: ContextoNetlify): Response {
  const origem = new URL(req.url).origin

  const corpo = `# advoc.me
User-agent: *
Allow: /

# Áreas que exigem conta — nada a indexar.
Disallow: /painel
Disallow: /editor
Disallow: /comecar
Disallow: /entrar
Disallow: /criar-conta
Disallow: /conta/
Disallow: /planos
Disallow: /assinar/
Disallow: /suporte
Disallow: /contestar
Disallow: /escritorio/editar

# Prévia interna de temas — a mesma página em oito roupas seria lida como
# conteúdo duplicado do perfil de verdade.
Disallow: /__preview/

# Subpáginas de ação do perfil: quem chega nelas pela busca cai num formulário
# sem o contexto do perfil que o explica.
Disallow: /*/denunciar
Disallow: /*/agendar
Disallow: /*/compartilhar

Sitemap: ${origem}/sitemap.xml
`

  return new Response(corpo, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
