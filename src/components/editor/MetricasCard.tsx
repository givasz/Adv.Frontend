import { useEffect, useState } from 'react'
import {
  carregarMetricas,
  diaCurto,
  horarioDePico,
  rotuloDoEvento,
  type Metricas,
} from '@/lib/metricas'
import { Card } from '@/components/editor/fields'
import { UpsellCard } from '@/components/editor/UpsellCard'
import { Link } from 'react-router-dom'

// "Quem visita você" — a tela que existia e não mostrava nada.
//
// Ela lia `Profile.views`: uma coluna do banco que NENHUMA linha do código
// incrementava. Todo advogado via 0 visitas, para sempre, enquanto a visita real
// já era gravada em LinkEvent desde o começo e nunca era lida. O cartão de venda
// do Pro, nesta mesma tela, prometia "origem das visitas, horários de maior
// movimento, botões e links mais clicados" e usava aquele zero na frase: "Você já
// recebeu 0 visitas. Atualize para entender de onde elas vêm."
//
// Agora o número é real e os três itens do cartão viraram dois — que existem.
// "Origem das visitas" saiu: saber de onde a pessoa veio exige guardar de onde
// ela veio, e a plataforma não guarda dado de visitante (ver a decisão de 21/08
// que removeu a agenda nativa, e backend/src/analytics/eventos.ts). Prometer o
// que não vamos fazer é o que o planOffer.ts existe para impedir; esta tela
// estava fora dessa regra porque a regra chegou pela home e não passou por aqui.

/**
 * Não recebe o perfil de propósito: tanto os números quanto o RECORTE por plano
 * vêm do servidor (`detalhado`). O plano lido do objeto local seria o plano que a
 * página acha que tem — e foi assim que a rota de IA vazou recurso pago um dia
 * (SEGURANCA.md, item 4).
 */
export function MetricasCard() {
  const [dados, setDados] = useState<Metricas | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    carregarMetricas()
      .then((m) => vivo && setDados(m))
      .catch(() => vivo && setErro(true))
    return () => {
      vivo = false
    }
  }, [])

  const visitas = dados?.visitas.total ?? 0
  const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos)

  return (
    <div className="space-y-4">
      <Card title="Visitas ao seu perfil">
        {erro ? (
          <p className="text-[13px] text-ink-faint">
            Não foi possível carregar agora. Tente recarregar a página.
          </p>
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
              // Zero real é uma informação, não uma falha — e a reação certa não é
              // assinar nada, é compartilhar o link. Dizer isso aqui vale mais que
              // um cartão de venda.
              <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
                Ninguém abriu seu perfil ainda. Compartilhe o link na sua bio do Instagram, na
                assinatura de e-mail ou no seu cartão — é ali que ele trabalha.
              </p>
            )}
          </>
        )}
      </Card>

      {dados?.detalhado && <Detalhe dados={dados} />}

      {dados && !dados.detalhado && (
        <UpsellCard
          plan="pro"
          title="Veja o que fazem no seu perfil"
          body={
            visitas > 0
              ? `Seu perfil já foi aberto ${visitas} ${plural(visitas, 'vez', 'vezes')}. Descubra o que as pessoas fazem depois de entrar.`
              : 'Quando as visitas começarem, veja o que as pessoas fazem depois de entrar.'
          }
          bullets={[
            'Quais botões são usados (WhatsApp, agendar, redes)',
            'Quantas visitas viram tentativa de contato',
            'Em que horários seu perfil é mais procurado',
          ]}
        />
      )}
    </div>
  )
}

function Detalhe({ dados }: { dados: Metricas }) {
  const pico = horarioDePico(dados.porHora)
  const maiorDia = Math.max(1, ...dados.porDia.map((d) => d.visitas))

  return (
    <>
      <Card title={`O que aconteceu nos últimos ${dados.janelaDias} dias`}>
        <div className="grid grid-cols-2 gap-3">
          <Numero valor={dados.contatos} rotulo="tentativas de contato" />
          <Numero
            valor={dados.taxaDeContato === null ? '—' : `${dados.taxaDeContato}%`}
            rotulo="das visitas viraram contato"
          />
        </div>
        {pico && (
          <p className="text-[13px] text-ink-faint">
            Seu perfil é mais procurado entre <span className="font-medium text-ink">{pico}</span>.
          </p>
        )}
      </Card>

      <Card title="Botões mais usados">
        {dados.cliques.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-faint">
            Ninguém tocou nos botões ainda. Eles aparecem aqui assim que alguém usar o WhatsApp,
            agendar ou abrir uma das suas redes.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {dados.cliques.map((c) => {
              const maior = dados.cliques[0].total
              return (
                <li key={c.evento}>
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="truncate text-ink-soft">{rotuloDoEvento(c.evento)}</span>
                    <span className="shrink-0 font-medium text-ink">{c.total}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                    <div
                      className="h-full rounded-full bg-brass"
                      style={{ width: `${Math.round((c.total / maior) * 100)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Movimento por dia">
        {/* Barras em CSS puro: um gráfico destes não justifica uma biblioteca de
            300 kB no pacote que todo visitante de perfil baixa. */}
        <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={resumoDoGrafico(dados)}>
          {dados.porDia.map((d) => (
            <div
              key={d.dia}
              title={`${diaCurto(d.dia)}: ${d.visitas} ${d.visitas === 1 ? 'visita' : 'visitas'}`}
              className="flex-1 rounded-sm bg-ink/[0.08]"
              style={{
                // Altura mínima visível para o dia vazio continuar sendo um dia:
                // sem ela, uma semana parada some do gráfico e a linha do tempo mente.
                height: `${Math.max(3, Math.round((d.visitas / maiorDia) * 100))}%`,
                background: d.visitas > 0 ? 'rgb(176 141 87 / 0.75)' : undefined,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[11.5px] text-ink-faint">
          <span>{dados.porDia[0] && diaCurto(dados.porDia[0].dia)}</span>
          <span>{dados.porDia.length > 0 && diaCurto(dados.porDia[dados.porDia.length - 1].dia)}</span>
        </div>
      </Card>

      {/* Este aviso é para o DONO, e não para o visitante (esse é o papel do
          PrivacyNote). Ele existe porque a pergunta seguinte a qualquer painel de
          métricas é "e quem foi?" — e a resposta aqui é que não sabemos, de
          propósito. Melhor dizer antes de ser perguntado. */}
      <p className="px-1 text-[11.5px] leading-relaxed text-ink-faint">
        Contamos acontecimentos, não pessoas: quantas vezes o perfil foi aberto e quais botões
        foram tocados. Não guardamos quem visitou, de onde veio, nem gravamos cookie no aparelho
        de quem entra — por isso não há "visitantes únicos" aqui.{' '}
        <Link
          to="/legal/privacidade"
          target="_blank"
          className="font-medium underline underline-offset-2 hover:opacity-80"
        >
          Como tratamos seus dados
        </Link>
      </p>
    </>
  )
}

function Numero({ valor, rotulo }: { valor: number | string; rotulo: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-paper-soft/60 p-3">
      <div className="font-display text-[26px] font-semibold leading-none text-ink">{valor}</div>
      <div className="mt-1 text-[12px] leading-snug text-ink-faint">{rotulo}</div>
    </div>
  )
}

/** Texto do gráfico para quem usa leitor de tela — a barra sozinha não diz nada. */
function resumoDoGrafico(dados: Metricas): string {
  const total = dados.porDia.reduce((s, d) => s + d.visitas, 0)
  return `Movimento diário dos últimos ${dados.janelaDias} dias: ${total} ${
    total === 1 ? 'visita' : 'visitas'
  } no período.`
}
