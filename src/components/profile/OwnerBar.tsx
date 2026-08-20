import { Link } from 'react-router-dom'
import { ArrowRight, ScaleIcon } from '@/components/ui/icons'

// Barra do DONO, sobre o próprio perfil público.
//
// Existe por causa de um beco sem saída: o botão da home passou a levar o
// advogado logado direto ao perfil publicado — o que ele pediu — e lá não havia
// nenhum caminho de volta para o editor. Ele via a própria página e ficava preso
// nela, sem nada para clicar.
//
// Só aparece para quem é dono daquele endereço. Para qualquer visitante, o
// perfil continua exatamente como era: nenhum vestígio de painel, nenhum botão
// de edição.

export function OwnerBar() {
  return (
    <div className="sticky top-0 z-30 border-b border-ink/10 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] leading-snug text-ink-soft">
          <ScaleIcon width={15} height={15} className="shrink-0 text-burgundy" />
          <span className="min-w-0">
            <span className="font-semibold text-ink">Este é o seu perfil</span>
            <span className="hidden sm:inline"> — é assim que ele aparece para quem abre o link.</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Link
            to="/painel"
            className="rounded-full border border-ink/15 px-3 py-2 text-[12.5px] font-medium text-ink transition-colors hover:border-burgundy/40 hover:text-burgundy"
          >
            Painel
          </Link>
          <Link
            to="/editor"
            className="inline-flex items-center gap-1.5 rounded-full bg-burgundy px-3.5 py-2 text-[12.5px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep"
          >
            Editar perfil
            <ArrowRight width={14} height={14} />
          </Link>
        </span>
      </div>
    </div>
  )
}
