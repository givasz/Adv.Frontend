import { Link } from 'react-router-dom'
import { ScaleIcon } from '@/components/ui/icons'

/**
 * A tela para quando o perfil não pôde ser carregado.
 *
 * Existe porque a alternativa era pior: uma falha do servidor deixava a página
 * girando o carregador para sempre — sem erro no console, sem nada a clicar. Um
 * carregador eterno é uma tela quebrada que finge estar trabalhando.
 *
 * "Tentar de novo" recarrega a página inteira de propósito: o que costuma
 * falhar aqui é a primeira chamada da sessão, e recarregar refaz a conferência
 * do zero em vez de tentar remendar um estado pela metade.
 */
export function FalhaAoCarregar({
  mensagem,
  titulo = 'Não foi possível carregar seu perfil',
}: {
  mensagem?: string
  titulo?: string
}) {
  return (
    <div className="grain flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper-deep px-6 text-center">
      <ScaleIcon width={26} height={26} className="text-burgundy" aria-hidden />
      <div>
        <h1 className="font-display text-[22px] font-semibold leading-tight text-ink">{titulo}</h1>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ink-soft">
          {mensagem || 'A conexão com o servidor falhou. Seus dados estão a salvo.'}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => window.location.reload()} className="btn-primary">
          Tentar de novo
        </button>
        <Link to="/" className="btn-ghost">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
