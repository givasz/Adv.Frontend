# Entrega e tráfego — como um perfil chega a quem procura

_12/09/2026. Onde cada decisão mora no código e por que ela é assim. Pesquisa feita
no dia contra a documentação do Google, da Meta (WhatsApp/Facebook), do
schema.org e do IndexNow; o que é opinião está marcado._

## O que está no ar

| Sinal | Onde | O que faz |
| --- | --- | --- |
| Prévia de link (Open Graph + Twitter card) | `src/lib/ogTags.ts` → `netlify/edge-functions/perfil.ts` | Título, descrição, foto (com largura/altura e `alt`), `og:type=profile` com nome separado, canônica. Montado na borda, servido no HTML cru, igual para pessoa e robô. |
| Texto do perfil no HTML cru | `corpoDoPerfil` / `corpoDoEscritorio` / `corpoDaHome` (ogTags.ts) | Nome, OAB, áreas, bio, perguntas, atendimento e contato como HTML simples dentro do `#root`. O React substitui ao montar. É o que os robôs de busca por IA (ChatGPT, Perplexity, Claude) e os mensageiros leem — nenhum deles executa JavaScript. |
| Dado estruturado (JSON-LD) | `perfilJsonLd`, `escritorioJsonLd`, `homeJsonLd` | Perfil: `ProfilePage` → `Person` (OAB como `identifier`, redes em `sameAs`, áreas em `knowsAbout`, telefone, cidade) e, só com endereço público, um `LegalService` ligado à pessoa. Escritório: `LegalService` com os advogados como `member`. Home: `Organization` com logo + `WebSite`. |
| Decisão de indexar | `perfilIndexavel`, `escritorioIndexavel`, `paginaIndexavel` | `index, follow, max-image-preview:large, max-snippet:-1` na home, nos legais, nos perfis com área ou bio e nos escritórios com gente dentro. `noindex` em tudo o mais: painel, editor, login, `/x/agendar`, `/__preview`, exemplos (pessoas fictícias) e perfis rasos. |
| robots.txt | `netlify/edge-functions/robots.ts` | Quase vazio, de propósito: `Disallow` proíbe a leitura e não a indexação; quem decide é a meta de cada página. Só `/__preview/` fica proibido. `/api/` liberado porque é por lá que o Google Imagens busca a foto. |
| sitemap.xml | `netlify/edge-functions/sitemap.ts` ← `GET /api/sitemap` | Perfis e escritórios com `lastmod` do banco (o Google ignora `priority` e `changefreq`). Mesma régua de "raso" do `noindex`, para o Search Console não apontar contradição. |
| IndexNow | `backend/src/seo/indexnow.ts` | Ao publicar, editar, despublicar, renumerar ou encerrar, o endereço vai numa fila e sai num POST por minuto para api.indexnow.org (Bing, Yandex, Copilot, busca do ChatGPT). Precisa de `INDEXNOW_KEY` no `.env` da VPS igual ao nome do arquivo em `frontend/public/<chave>.txt`. |
| Visita da borda não conta | `GET /api/profiles/:slug?origem=borda` | A busca da borda vinha contando uma visita a mais por abertura de página (e uma por robô de prévia). |
| Um título para a home | `HOME` em ogTags.ts; index.html; Landing.tsx | Havia dois títulos diferentes para a mesma página. Teste compara os três. |

## O que a pesquisa mudou no plano

- **`Attorney` está depreciado** no schema.org; `LegalService` é negócio local e
  o Google só o reconhece com endereço. Por isso o perfil virou `ProfilePage` →
  `Person` (o tipo que o Google documenta para página de pessoa) e o
  `LegalService` só entra quando o advogado publicou o endereço.
- **`FAQPage` não gera mais resultado rico** fora de governo/saúde desde 2023, e
  foi descontinuado de vez em 05/2026. O markup saiu; as perguntas continuam
  como texto no HTML estático, que é o que as IAs leem.
- **`SearchAction`** (caixa de busca nos sitelinks) foi removido pelo Google em
  11/2024. Não entrou.
- **`llms.txt`** não é lido por nenhum serviço de IA (Google compara ao meta
  keywords). Não entrou.
- **A Indexing API do Google** só aceita vaga de emprego e transmissão. Para o
  Google vale o sitemap com `lastmod` verdadeiro; para o resto, IndexNow.
- **`max-snippet`/`nosnippet`** também limitam citação nas respostas por IA do
  Google. Liberado (`-1`).
- **WhatsApp** (doc da Meta): lê `og:title`, `og:description` (~80 caracteres
  visíveis), `og:url`, `og:image`; imagem < 600 KB e ≥ 300 px de largura; o
  `<head>` precisa estar nos primeiros 300 KB. A foto do perfil é 512×512 JPEG
  (lib/image.ts) — cabe com folga.
- **Conteúdo raso em escala** é o que o Google pune num domínio inteiro. A
  régua "área ou bio de 80 caracteres" para indexar é opinião nossa; o
  mecanismo (`noindex` tira a página da avaliação do site) é documentado.

## O que NÃO fazemos, e por quê

- **Cloaking**: nunca servir HTML diferente por User-Agent. Todo mundo recebe o
  mesmo documento, com o corpo estático dentro.
- **Prerender com Chromium** (extensão do Netlify): custa invocação de função
  por página e resolve o mesmo problema que o corpo estático resolve de graça.
  Revisitar se algum dia o texto estático deixar de bastar.
- **Palavras-chave que não refletem o perfil** ("advogado em [cidade]" para
  cidades não atendidas, listas de áreas que o advogado não tem): é doorway
  abuse para o Google e captação para a OAB. Título e descrição saem dos campos
  que o advogado preencheu, e só.
- **Honorários no dado estruturado** (`priceRange`): Prov. 205/2021.

## O que fica com o advogado (e vale dizer no painel um dia)

- Google Business Profile próprio, com o `advoc.me/nome` como site e nome,
  endereço e telefone IGUAIS aos do perfil (NAP consistente).
- Instagram com conta profissional e "pesquisável" ligado (desde 07/2025 os
  posts públicos entram no Google) e o link do perfil na bio.
- Preencher área E bio: é o que liga a indexação.

## Como conferir depois do deploy

```
curl -s https://advoc.me/<slug> | grep -c 'data-advocme-estatico'   # 1+ = corpo estático servido
curl -s https://advoc.me/<slug> | grep -o '<title[^>]*>[^<]*'          # título do advogado
curl -s https://advoc.me/painel | grep -o 'name="robots" content="[^"]*"'  # noindex
curl -s https://advoc.me/sitemap.xml | grep -c '<loc>'
curl -s https://advoc.me/7c1f0b1e2a9d4f6b8e3c5a7d9f1b3e5c.txt          # chave do IndexNow
```

Validadores: Rich Results Test (Google), Sharing Debugger (Meta), Post
Inspector (LinkedIn), Bing Webmaster Tools (enviar o sitemap uma vez; o IndexNow
faz o resto).
