/**
 * Copia um texto para a área de transferência — e diz se deu certo.
 *
 * `navigator.clipboard` não chega a todo lugar: o navegador embutido do Android
 * (Instagram, Facebook) recusa, e página fora de https também. Nesses casos o
 * botão "Copiar" não fazia nada, em silêncio — o `catch` vazio engolia a recusa.
 *
 * O plano B é o jeito antigo: um campo de texto fora da tela, selecionado, e
 * `execCommand('copy')`, que ainda funciona onde a API nova não chega. Quando
 * nenhum dos dois funciona, quem chamou recebe `false` e deve dizer isso à
 * pessoa — e deixar o texto à vista para ela copiar à mão.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    /* recusado — tenta o jeito antigo */
  }
  return copiarPeloCampo(texto)
}

function copiarPeloCampo(texto: string): boolean {
  if (typeof document === 'undefined') return false
  const campo = document.createElement('textarea')
  campo.value = texto
  // `readonly` evita que o teclado do celular suba no meio do toque; fora da tela
  // mas DENTRO do documento, porque o iOS só seleciona o que está na página.
  campo.setAttribute('readonly', '')
  campo.style.position = 'fixed'
  campo.style.top = '0'
  campo.style.left = '-9999px'
  campo.style.opacity = '0'
  document.body.appendChild(campo)
  try {
    campo.select()
    campo.setSelectionRange(0, texto.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    campo.remove()
  }
}
