import { useEffect, useRef } from 'react'

// Grava o que estiver em voo antes de a tela sumir — de QUALQUER jeito que ela
// suma. Um editor com debounce tem sempre uma janela em que o texto existe só
// na memória, e cada saída fecha essa janela de um modo diferente:
//
//   • fechar/recarregar a aba no COMPUTADOR → `beforeunload`: o navegador
//     pergunta "sair mesmo?" e dá tempo de voltar. É a única saída em que dá
//     para PERGUNTAR — e só ali, porque o navegador não espera um fetch depois
//     que a pessoa confirma.
//   • fechar a aba, trocar de app ou bloquear a tela no CELULAR → `pagehide` e
//     `visibilitychange`. O `beforeunload` quase nunca dispara ali (Safari do
//     iPhone não dispara nunca; o Chrome do Android às vezes), e não há caixa
//     de diálogo para mostrar. A resposta é não perguntar: GRAVAR na hora, com
//     `keepalive`, que é o que deixa a requisição completar mesmo depois que a
//     página morreu.
//   • navegar DENTRO do app (menu da conta, "voltar" do navegador, um link do
//     cabeçalho) → a tela desmonta sem aviso nenhum. Até 13/09/2026 o timer do
//     debounce morria junto e o texto digitado no último segundo sumia. Agora a
//     limpeza do efeito grava o que sobrou.
//
// O componente diz o que está pendente e como salvar; este hook só decide
// QUANDO. `sumindo` = a página está indo embora: salve com keepalive e sem
// esperar por nada.
export function useSalvarAntesDeSair<T>(opts: {
  /** o que está por salvar agora — null quando não há nada em voo */
  pendente: () => T | null
  /** grava; `sumindo` pede keepalive (a página pode não estar mais lá para ouvir a resposta) */
  salvar: (rascunho: T, sumindo: boolean) => Promise<unknown> | void
}): void {
  // Sempre a versão mais recente das funções, sem religar os ouvintes a cada render.
  const atual = useRef(opts)
  atual.current = opts

  useEffect(() => {
    const aoFechar = (e: BeforeUnloadEvent) => {
      if (!atual.current.pendente()) return
      e.preventDefault()
      // O texto da pergunta é do navegador; este valor só a liga.
      e.returnValue = ''
    }
    const aoSumir = () => {
      const r = atual.current.pendente()
      if (r) void atual.current.salvar(r, true)
    }
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'hidden') aoSumir()
    }
    window.addEventListener('beforeunload', aoFechar)
    window.addEventListener('pagehide', aoSumir)
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => {
      window.removeEventListener('beforeunload', aoFechar)
      window.removeEventListener('pagehide', aoSumir)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      // Desmontou por navegação dentro do app: a página continua viva, o fetch
      // segue normal — sem keepalive, e com a resposta chegando a quem chamou.
      const r = atual.current.pendente()
      if (r) void atual.current.salvar(r, false)
    }
  }, [])
}
