import { useCallback, useEffect, useState } from 'react'
import {
  aceitarProgramaParceiros,
  NaoParticipa,
  NOME_DO_PROGRAMA,
  painelDoParceiro,
  type PainelDoParceiro,
} from '@/lib/partners'
import { copiarTexto } from '@/lib/copiar'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { ShareIcon } from '@/components/ui/icons'
import { PainelDoProgramaParceiros, SemParticipacao } from '@/components/parceiros/PainelDoProgramaParceiros'

// /parceiros — o painel do Programa Advocme Parceiros. Protegida (RequireAuth):
// o servidor responde só sobre a conta da sessão, e quem não participa recebe a
// explicação de que a entrada é por convite.
export default function PartnersPage() {
  const voltar = useVoltar('/painel')
  const [dados, setDados] = useState<PainelDoParceiro | null>(null)
  const [naoParticipa, setNaoParticipa] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aceitando, setAceitando] = useState(false)
  const [copiado, setCopiado] = useState<boolean | null>(null)
  const [carregandoMais, setCarregandoMais] = useState(false)

  useEffect(() => {
    let vivo = true
    painelDoParceiro()
      .then((d) => vivo && setDados(d))
      .catch((e: unknown) => {
        if (!vivo) return
        if (e instanceof NaoParticipa) setNaoParticipa(true)
        else setFalha(e instanceof Error ? e.message : 'Não foi possível carregar o programa agora.')
      })
    return () => {
      vivo = false
    }
  }, [])

  const aceitar = useCallback(async () => {
    if (!dados || dados.status !== 'invited') return
    setAceitando(true)
    setErro(null)
    try {
      setDados(await aceitarProgramaParceiros(dados.regras.versao))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar o aceite agora.')
    } finally {
      setAceitando(false)
    }
  }, [dados])

  const copiar = useCallback(async () => {
    if (!dados || dados.status === 'invited' || !dados.referralUrl) return
    setCopiado(await copiarTexto(dados.referralUrl))
  }, [dados])

  const mais = useCallback(async () => {
    if (!dados || dados.status === 'invited' || !dados.indicacoes.proximo) return
    setCarregandoMais(true)
    try {
      const prox = await painelDoParceiro(dados.indicacoes.proximo)
      if (prox.status === 'invited') return
      setDados({
        ...dados,
        indicacoes: { ...prox.indicacoes, itens: [...dados.indicacoes.itens, ...prox.indicacoes.itens] },
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar mais indicações.')
    } finally {
      setCarregandoMais(false)
    }
  }, [dados])

  if (falha) return <FalhaAoCarregar mensagem={falha} />

  return (
    <SubPage
      title={NOME_DO_PROGRAMA}
      subtitle="Indique o Advocme a outros profissionais e amplie seu acesso ao MAX."
      icon={<ShareIcon width={20} height={20} />}
      backTo={voltar}
      documentTitle="Advocme Parceiros"
    >
      {naoParticipa ? (
        <SemParticipacao />
      ) : !dados ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" role="status" aria-label="Carregando" />
        </div>
      ) : (
        <PainelDoProgramaParceiros
          dados={dados}
          onAceitar={() => void aceitar()}
          aceitando={aceitando}
          onCopiar={() => void copiar()}
          copiado={copiado}
          onMais={() => void mais()}
          carregandoMais={carregandoMais}
          erro={erro}
        />
      )}
    </SubPage>
  )
}
