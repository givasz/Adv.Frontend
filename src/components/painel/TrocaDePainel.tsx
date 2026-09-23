import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { carregarMeuEscritorio } from '@/lib/meuEscritorio'
import { ScaleIcon, UserIcon } from '@/components/ui/icons'

// A TROCA ENTRE OS DOIS PAINÉIS de quem administra um escritório: o do próprio
// perfil e o da sociedade. São duas coisas que a mesma pessoa cuida, e antes o
// escritório era um cartão no pé do painel pessoal — quem pagava a sociedade
// rolava a página inteira para achar a porta dela.
//
// No painel pessoal só aparece para quem administra (dono ou admin) um
// escritório que já tem página; membro comum não tem o que administrar, e a
// troca seria uma porta para uma tela vazia.
export function TrocaDePainel({ atual, sempre = false }: { atual: 'pessoal' | 'escritorio'; sempre?: boolean }) {
  const [mostrar, setMostrar] = useState(sempre)

  useEffect(() => {
    if (sempre) return
    let vivo = true
    carregarMeuEscritorio().then((f) => vivo && setMostrar(!!f?.slug))
    return () => {
      vivo = false
    }
  }, [sempre])

  if (!mostrar) return null

  const aba = (ativo: boolean) =>
    `flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors xs:flex-none xs:px-4 ${
      ativo ? 'bg-ink text-paper-soft shadow-selo' : 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink'
    }`

  return (
    <nav aria-label="Trocar de painel" className="flex">
      <div className="flex w-full gap-1 rounded-xl border border-ink/[0.14] bg-paper-soft p-1 xs:w-auto">
        <Link to="/painel" aria-current={atual === 'pessoal' ? 'page' : undefined} className={aba(atual === 'pessoal')}>
          <UserIcon width={15} height={15} className="shrink-0" />
          <span className="truncate">Meu perfil</span>
        </Link>
        <Link
          to="/escritorio/painel"
          aria-current={atual === 'escritorio' ? 'page' : undefined}
          className={aba(atual === 'escritorio')}
        >
          <ScaleIcon width={15} height={15} className="shrink-0" />
          <span className="truncate">Escritório</span>
        </Link>
      </div>
    </nav>
  )
}
