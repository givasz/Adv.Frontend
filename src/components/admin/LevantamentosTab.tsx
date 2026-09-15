import { useEffect, useState } from 'react'
import { carregarLevantamentos, type Levantamentos } from '@/lib/adminApi'
import { Aviso, Carregando, Segmentos, TituloDaPagina } from './pecas'
import { BarrasNomeadas, ColunasEmpilhadas, Ficha, Figura, Legenda, PLANO_COR, PLANO_NOME } from './graficos'
import { SECOES } from './Console'

// OS NÚMEROS DA PLATAFORMA.
//
// A ordem da tela responde às perguntas na ordem em que elas são feitas:
// quantos somos hoje → como chegamos aqui → quem está entrando → quanto usam →
// onde estão. O que a série NÃO cobre vem no rodapé de cada gráfico, não num
// rodapé geral que ninguém associa ao que acabou de ler.
//
// UMA COISA QUE ESTA TELA NÃO FAZ: inventar volume. Com quatro perfis e oito
// dias de história, o honesto é mostrar quatro perfis e oito dias — não suavizar
// a curva, não completar o mês, não desenhar eixo onde não há medida. A rotina
// de BI (backend/src/bi) foi escrita com a mesma regra, e o `cobertura` que ela
// devolve existe justamente para esta tela poder dizer "daqui para trás não há
// retrato" em vez de deixar o gráfico sugerir que a plataforma não existia.

const RECORTES = [
  { id: '30', label: '30 dias' },
  { id: '90', label: '90 dias' },
  { id: '365', label: '1 ano' },
] as const

const COBRANCA_NOME: Record<string, string> = {
  active: 'Em dia',
  past_due: 'Cobrança falhou',
  canceled: 'Cancelada',
  paused: 'Suspensa por moderação',
}

const MODERACAO_NOME: Record<string, string> = {
  active: 'Sem restrição',
  warned: 'Avisado',
  partial: 'Seções ocultas',
  restricted: 'Fora do ar',
}

// Nomes curtos de propósito: a coluna de rótulo não trunca (ver BarrasNomeadas),
// então um nome longo empurraria a barra para um fiapo no celular.
const EVENTO_NOME: Record<string, string> = {
  view: 'Visitas',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  scheduling: 'Agendar',
  social: 'Redes sociais',
  card: 'Cartão digital',
}

export default function LevantamentosTab() {
  const [dias, setDias] = useState<string>('90')
  const [dados, setDados] = useState<Levantamentos | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const secao = SECOES.find((s) => s.id === 'levantamentos')!

  useEffect(() => {
    let vivo = true
    setErro(null)
    carregarLevantamentos(Number(dias))
      .then((d) => vivo && setDados(d))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : 'Falha ao carregar.'))
    return () => {
      vivo = false
    }
  }, [dias])

  return (
    <div>
      <TituloDaPagina
        titulo={secao.label}
        descricao={secao.descricao}
        acoes={<Segmentos rotulo="Recorte de tempo" opcoes={RECORTES} valor={dias} onChange={setDias} />}
      />

      {erro && <Aviso>{erro}</Aviso>}
      {!dados && !erro && <Carregando />}
      {dados && <Corpo dados={dados} />}
    </div>
  )
}

function Corpo({ dados }: { dados: Levantamentos }) {
  const { agora, serie, novasContas, eventosMes, porUf, cobertura } = dados
  const pagos = (agora.porPlano.pro ?? 0) + (agora.porPlano.premium ?? 0)

  return (
    <div className="space-y-4">
      {/* ---- O retrato de hoje ---- */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Ficha rotulo="Contas" valor={agora.contas} destaque />
        <Ficha rotulo="Perfis no ar" valor={agora.publicados} nota={`${agora.rascunhos} em rascunho`} />
        <Ficha
          rotulo="Planos pagos"
          valor={pagos}
          nota={agora.emCortesia > 0 ? `${agora.emCortesia} de pé só pela carência` : 'todos com cobrança em dia'}
        />
        <Ficha rotulo="Escritórios" valor={agora.escritorios} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---- Distribuição por plano ---- */}
        <Figura
          titulo="Perfis por plano"
          descricao="O plano que vale HOJE — contratado cruzado com a situação da cobrança. Quem tem assinatura vencida mas ainda dentro da carência aparece no plano que está usando."
        >
          <BarrasNomeadas
            larguraRotulo="w-16"
            itens={['premium', 'pro', 'free'].map((p) => ({
              nome: PLANO_NOME[p],
              valor: agora.porPlano[p] ?? 0,
              cor: PLANO_COR[p],
            }))}
          />
        </Figura>

        {/* ---- Entradas ---- */}
        <Figura
          titulo="Contas novas por semana"
          descricao="Cada semana começa na segunda-feira. Por semana e não por dia: no volume atual, um gráfico diário seria uma fileira de zeros com dois picos de 1."
          vazio={novasContas.length === 0 ? 'Nenhuma conta criada dentro deste recorte de tempo.' : null}
        >
          <BarrasNomeadas
            larguraRotulo="w-20"
            itens={novasContas.map((s) => ({ nome: fmtSemana(s.semana), valor: s.total }))}
          />
        </Figura>
      </div>

      {/* ---- Evolução ---- */}
      <Figura
        titulo="Evolução dos perfis por plano"
        descricao={
          cobertura.desde
            ? `Um retrato por dia. A série começa em ${fmtDia(cobertura.desde)} — antes disso não há retrato, porque a rotina que os guarda subiu nesse dia.`
            : undefined
        }
        legenda={<Legenda itens={['premium', 'pro', 'free'].map((p) => ({ cor: PLANO_COR[p], nome: PLANO_NOME[p] }))} />}
        vazio={
          serie.length === 0
            ? 'Ainda não há retratos diários neste recorte. A rotina de BI grava um por dia; volte amanhã.'
            : serie.length === 1
              ? 'Só um dia medido até agora. Um ponto não é uma evolução — o gráfico aparece a partir do segundo dia.'
              : null
        }
      >
        <>
          <ColunasEmpilhadas
            dados={serie.map((d) => ({
              rotulo: d.dia,
              valores: { premium: d.premium, pro: d.pro, free: d.free },
            }))}
            series={['premium', 'pro', 'free'].map((p) => ({ chave: p, nome: PLANO_NOME[p], cor: PLANO_COR[p] }))}
            formataRotulo={fmtDia}
          />
          {cobertura.buracos.length > 0 && (
            // Buraco na série é dito, não emendado: completar o dia que não foi
            // medido com o valor do dia anterior deixaria o gráfico bonito e falso.
            <p className="mt-2 rounded-md bg-adm-warn-soft/60 px-3 py-2 text-[12px] leading-relaxed text-adm-warn">
              {cobertura.buracos.length === 1
                ? `Falta o dia ${fmtDia(cobertura.buracos[0])}: a rotina não rodou. `
                : `Faltam ${cobertura.buracos.length} dias na série (a rotina não rodou neles). `}
              O gráfico não preenche o que não foi medido.
            </p>
          )}
        </>
      </Figura>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---- Uso ---- */}
        <Figura
          titulo="Uso dos perfis, por mês"
          descricao="Contamos acontecimentos, nunca pessoas: quantas vezes um perfil foi aberto e quantas vezes um botão foi tocado. Não existe 'visitantes únicos' aqui, e é de propósito."
          vazio={eventosMes.length === 0 ? 'Nenhum acontecimento registrado ainda.' : null}
        >
          <div className="space-y-4">
            {eventosMes
              .slice()
              .reverse()
              .map((m) => (
                <div key={m.mes}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-adm-muted">{fmtMes(m.mes)}</p>
                  <BarrasNomeadas
                    larguraRotulo="w-24"
                    itens={Object.entries(m.eventos)
                      .sort((a, b) => b[1] - a[1])
                      .map(([e, v]) => ({ nome: EVENTO_NOME[e] ?? e, valor: v }))}
                  />
                </div>
              ))}
          </div>
        </Figura>

        {/* ---- Onde estão ---- */}
        <Figura
          titulo="Perfis publicados por UF"
          descricao="Só os que estão no ar — um rascunho sem UF entraria como 'sem UF' e inventaria uma concentração que não existe."
          vazio={porUf.length === 0 ? 'Nenhum perfil publicado ainda.' : null}
        >
          <BarrasNomeadas larguraRotulo="w-10" itens={porUf.map((u) => ({ nome: u.uf, valor: u.total }))} />
        </Figura>
      </div>

      {/* ---- Situações ---- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Figura titulo="Situação da cobrança">
          <Contagens nomes={COBRANCA_NOME} valores={agora.porCobranca} />
        </Figura>
        <Figura titulo="Situação de moderação">
          <Contagens nomes={MODERACAO_NOME} valores={agora.porModeracao} />
        </Figura>
        <Figura
          titulo="Aceite dos Termos"
          descricao="Quem ainda não aceitou a versão vigente continua com acesso à conta; o que fica travado é publicar."
        >
          <Contagens
            nomes={{ emDia: 'Aceitaram a versão vigente', pendente: 'Aceite pendente' }}
            valores={{ emDia: agora.aceiteEmDia, pendente: agora.aceitePendente }}
          />
        </Figura>
      </div>
    </div>
  )
}

/**
 * Contagem nomeada — lista, não gráfico.
 *
 * Quatro estados com números de um dígito não pedem barra nenhuma: a barra só
 * acrescentaria tinta a uma informação que o número já entrega inteira.
 */
function Contagens({ nomes, valores }: { nomes: Record<string, string>; valores: Record<string, number> }) {
  const linhas = Object.entries(valores).filter(([, v]) => v > 0)
  if (!linhas.length) {
    return <p className="text-[12.5px] text-adm-muted">Nada a mostrar.</p>
  }
  return (
    <dl className="divide-y divide-adm-line">
      {linhas
        .sort((a, b) => b[1] - a[1])
        .map(([chave, valor]) => (
          <div key={chave} className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-[12.5px] text-adm-soft">{nomes[chave] ?? chave}</dt>
            <dd className="text-[14px] font-semibold tabular-nums text-adm-ink">{valor}</dd>
          </div>
        ))}
    </dl>
  )
}

function fmtDia(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}${a !== String(new Date().getFullYear()) ? `/${a.slice(2)}` : ''}`
}

/** Só a data da segunda-feira: o título do gráfico já disse "por semana". */
function fmtSemana(iso: string): string {
  return fmtDia(iso)
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

function fmtMes(iso: string): string {
  const [a, m] = iso.split('-')
  return `${MESES[Number(m) - 1]} de ${a}`
}
