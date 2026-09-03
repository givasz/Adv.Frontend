/**
 * A logo do advoc.me — a balança dourada que fica ao lado do nome.
 *
 * Um componente só, e não um `<img>` solto em cada cabeçalho: a marca aparece
 * em oito lugares (home, entrar, painel, editor, escritório, documentos legais,
 * páginas internas e o rodapé do perfil), e o dia em que o arquivo mudar de
 * nome ou de proporção não pode ser um dia de caçar oito cópias.
 *
 * TRÊS COISAS QUE PARECEM DETALHE E NÃO SÃO:
 *
 * 1. O tamanho é dado pela ALTURA, com a largura livre. A marca é mais larga do
 *    que alta (501×360); forçá-la num quadrado a espremeria ou deixaria um vão
 *    ao lado do nome. Altura casada com a do texto é o que faz o conjunto ler
 *    como uma coisa só.
 *
 * 2. `alt=""` e `aria-hidden`. Ela nunca aparece sozinha — a palavra "advoc.me"
 *    está sempre do lado, em texto de verdade. Um alt aqui faria o leitor de
 *    tela anunciar a marca duas vezes seguidas.
 *
 * 3. `width`/`height` no atributo, e não só no estilo. Sem eles o navegador não
 *    sabe o espaço que a imagem vai ocupar antes de baixá-la, e o cabeçalho
 *    inteiro pula no momento em que ela chega.
 */

/**
 * Proporção do arquivo em public/logo-144.png (ver scripts/gen-logo.mjs).
 * A interface carrega a versão DE TELA (144px de altura, ~16KB) e não a matriz
 * logo.png (360px, ~65KB): o maior uso é 46px de altura, e 144 cobre densidade
 * 3x com folga — os 49KB de diferença eram pagos por todo visitante de perfil
 * free, para desenhar a marca a 20px no rodapé.
 */
const PROPORCAO = 200 / 144

export function Marca({
  size = 20,
  className = '',
}: {
  /** altura em pixels; a largura acompanha a proporção da marca */
  size?: number
  className?: string
}) {
  const largura = Math.round(size * PROPORCAO)
  return (
    <img
      src="/logo-144.png"
      alt=""
      aria-hidden
      width={largura}
      height={size}
      decoding="async"
      draggable={false}
      className={`shrink-0 select-none ${className}`}
      style={{ height: size, width: largura }}
    />
  )
}
