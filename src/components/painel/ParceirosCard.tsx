import { useEffect, useState } from 'react'
import { dataDoBeneficio, mostrarNoPainel, NOME_DO_PROGRAMA, resumoDoParceiro, type ResumoDoParceiro } from '@/lib/partners'
import { ShareIcon } from '@/components/ui/icons'
import { Atalho, Grupo } from './pecas'

// O atalho do Programa Advocme Parceiros no painel — só para quem foi convidado,
// participa ou está suspenso. Para todo o resto da base, não existe: nem cartão,
// nem convite a participar (a entrada é por convite do Advocme).
//
// Componente com hook próprio pelo mesmo motivo do EscritorioCard: o painel tem
// saída antecipada enquanto o perfil carrega.
export function ParceirosCard() {
  const [resumo, setResumo] = useState<ResumoDoParceiro | null>(null)
  useEffect(() => {
    let vivo = true
    void resumoDoParceiro().then((r) => vivo && setResumo(r))
    return () => {
      vivo = false
    }
  }, [])
  return <CartaoDoProgramaParceiros resumo={resumo} />
}

/** A parte que desenha — separada para o teste não depender de rede. */
export function CartaoDoProgramaParceiros({ resumo }: { resumo: ResumoDoParceiro | null }) {
  if (!resumo || !mostrarNoPainel(resumo.status)) return null
  const texto =
    resumo.status === 'invited'
      ? 'Você foi convidado. Leia as regras e ative o acesso adicional ao MAX.'
      : resumo.status === 'suspended'
        ? 'Participação suspensa: o link não registra novas indicações.'
        : 'Seu link de indicação e a situação de cada indicação.'
  const destaque =
    resumo.status === 'active' && resumo.activeBenefit && resumo.benefitUntil
      ? `MAX até ${dataDoBeneficio(resumo.benefitUntil)}`
      : undefined
  return (
    <Grupo titulo="Parceiros" subtitulo="Indique o Advocme a outros profissionais da advocacia.">
      <Atalho to="/parceiros" Icone={ShareIcon} titulo={NOME_DO_PROGRAMA} texto={texto} destaque={destaque} />
    </Grupo>
  )
}
