import { useEffect, useState } from 'react'
import { carregarMetricasDoEscritorio, type Metricas } from '@/lib/metricas'
import { DetalheDasMetricas } from '@/components/editor/MetricasCard'
import { Card } from '@/components/editor/fields'
import { SubPage } from '@/components/ui/SubPage'
import { ChartIcon } from '@/components/ui/icons'

// VISITAS À PÁGINA DO ESCRITÓRIO.
//
// A página institucional não contava nada: "Quem visita você" existia só para o
// perfil individual, e quem administra uma sociedade não tinha como saber se a
// página tinha movimento nem quantas conversas o assistente institucional
// gerava. Agora conta — pela mesma tabela (LinkEvent), com as mesmas ausências:
// sem IP, sem cookie, sem identificador de visitante.
//
// A tela reaproveita o detalhe do perfil (DetalheDasMetricas) de propósito: é a
// mesma conta sobre os mesmos acontecimentos.
export default function VisitasEscritorio() {
  const [dados, setDados] = useState<Metricas | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    carregarMetricasDoEscritorio()
      .then((m) => vivo && setDados(m))
      .catch(
        (e: unknown) =>
          vivo &&
          setErro(
            e instanceof Error ? e.message : 'Não foi possível carregar as visitas agora.',
          ),
      )
    return () => {
      vivo = false
    }
  }, [])

  const visitas = dados?.visitas.total ?? 0
  const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos)

  return (
    <SubPage
      title="Visitas ao escritório"
      subtitle="O movimento da página institucional da sociedade."
      icon={<ChartIcon width={18} height={18} />}
      backTo="/escritorio/editar"
      backLabel="Escritório"
      documentTitle="Visitas ao escritório · advoc.me"
    >
      <div className="space-y-4">
        <Card title="Visitas à página do escritório">
          {erro ? (
            <p className="text-[13px] text-ink-faint">{erro}</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[40px] font-semibold leading-none text-ink">
                  {dados ? visitas : '—'}
                </span>
                <span className="text-[15px] text-ink-faint">
                  {plural(visitas, 'visita', 'visitas')} desde o início
                </span>
              </div>
              {dados && dados.visitas.janela > 0 && (
                <p className="mt-1.5 text-[13px] text-ink-faint">
                  {dados.visitas.janela} {plural(dados.visitas.janela, 'foi', 'foram')} nos últimos{' '}
                  {dados.janelaDias} dias.
                </p>
              )}
              {dados && visitas === 0 && (
                // Zero real é informação, não falha — e a reação certa não é
                // assinar nada, é compartilhar o endereço da sociedade.
                <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
                  Ninguém abriu a página do escritório ainda. Compartilhe o endereço no site, na
                  assinatura de e-mail da equipe e nas redes institucionais.
                </p>
              )}
            </>
          )}
        </Card>

        {dados?.detalhado && <DetalheDasMetricas dados={dados} alvo="A página do escritório" />}

        {/* Os números do escritório são só da página INSTITUCIONAL. Sem esta
            linha, quem administra leria o gráfico como se fosse o desempenho de
            toda a sociedade — e o perfil de cada advogado é dele, com números
            que só ele vê. */}
        <p className="px-1 text-[11.5px] leading-relaxed text-ink-faint">
          Estes números são apenas da página do escritório. Cada advogado vê os do próprio perfil
          no painel dele — o perfil é da pessoa, e o movimento dele também.
        </p>
      </div>
    </SubPage>
  )
}
