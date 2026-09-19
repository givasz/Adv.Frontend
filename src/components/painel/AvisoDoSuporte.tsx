import { Link } from 'react-router-dom'
import { useRespostasNovas } from '@/lib/support'
import { comVolta } from '@/components/ui/SubPage'
import { MessageIcon } from '@/components/ui/icons'

// "O suporte respondeu" — no topo do painel, logo abaixo da cobrança.
//
// A resposta de um chamado é a outra coisa que a pessoa não descobre sozinha
// olhando a própria página: ela abriu o chamado, fechou a aba e seguiu a vida. O
// ponto no menu da conta é discreto demais para ser o único aviso. Some sozinho
// quando a aba de respostas mostra o que havia de novo.
export function AvisoDoSuporte({ className = '' }: { className?: string }) {
  const novas = useRespostasNovas()
  if (novas === 0) return null

  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-xl2 border border-burgundy/30 bg-burgundy/[0.05] px-4 py-3.5 sm:flex-row sm:items-center ${className}`}
    >
      <MessageIcon width={18} height={18} className="shrink-0 text-burgundy" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink">
          {novas === 1 ? 'O suporte respondeu seu chamado' : `O suporte respondeu ${novas} chamados seus`}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
          A resposta da equipe está na aba Respostas do Suporte.
        </p>
      </div>
      <Link
        to={comVolta('/suporte?aba=respostas', '/painel')}
        className="shrink-0 rounded-full border border-ink/20 bg-paper px-4 py-2 text-center text-[12.5px] font-semibold text-ink transition-colors hover:border-burgundy/40 hover:text-burgundy"
      >
        {novas === 1 ? 'Ver a resposta' : 'Ver as respostas'}
      </Link>
    </div>
  )
}
