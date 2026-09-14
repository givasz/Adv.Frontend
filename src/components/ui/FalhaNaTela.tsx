import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'

// Rede de proteção de todas as telas.
//
// Sem ela, qualquer erro ao desenhar — um pedaço que não carregou, um hook fora
// de ordem — desmontava o app inteiro e deixava só o fundo do body: nenhuma
// palavra, nenhum botão, e o endereço na barra dizendo que a página abriu. A
// pessoa ficava sem ter o que fazer além de adivinhar que era para recarregar.
//
// Ela não conserta o erro, só troca o vazio por uma tela que diz o que fazer. O
// console continua recebendo o erro inteiro, e o smoke recusa rota que caia aqui
// (`data-falha-na-tela`) — senão esta tela, por ter texto, passaria pela
// conferência de "tela em branco".
//
// Mudar de endereço dá à tela nova uma chance: sem isso, o "Voltar ao início"
// levaria de volta a esta mesma tela.

interface Props {
  caminho: string
  children: ReactNode
}

interface Estado {
  falhou: boolean
  caminho: string
}

class Rede extends Component<Props, Estado> {
  state: Estado = { falhou: false, caminho: this.props.caminho }

  static getDerivedStateFromError(): Partial<Estado> {
    return { falhou: true }
  }

  static getDerivedStateFromProps(props: Props, state: Estado): Partial<Estado> | null {
    return props.caminho !== state.caminho ? { falhou: false, caminho: props.caminho } : null
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[FalhaNaTela]', erro, info.componentStack)
  }

  render() {
    if (!this.state.falhou) return this.props.children
    return (
      <div data-falha-na-tela>
        <FalhaAoCarregar
          titulo="Não foi possível abrir esta página"
          mensagem="Pode ter sido a conexão ou uma atualização do site. Tentar de novo costuma resolver."
        />
      </div>
    )
  }
}

export function FalhaNaTela({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Rede caminho={pathname}>{children}</Rede>
}
