import { useId, useState, type ReactNode } from 'react'

// GRÁFICOS DO PAINEL — HTML e CSS à mão, sem biblioteca.
//
// Não é teimosia. A CSP do projeto é `script-src 'self'` (ver lib/csp.ts): uma
// biblioteca de CDN seria bloqueada em silêncio, e uma empacotada no bundle
// custaria dezenas de KB para desenhar três formas que cabem em duzentas
// linhas. O painel tem meia dúzia de gráficos, todos simples.
//
// ---------------------------------------------------------------------------
// AS DECISÕES DE COR, E POR QUE ELAS SÃO ESTAS
//
// Free → Pro → Max é uma ESCADA, não três categorias soltas. Escada pede rampa
// sequencial de UMA cor (claro → escuro), não três matizes diferentes: o leitor
// vê "mais escuro = plano maior" sem consultar legenda. Três matizes obrigariam
// a decorar qual é qual, e ainda gastariam o canal de cor com informação que a
// ordem já dá.
//
// A rampa saiu do bordô da marca e foi CONFERIDA por script sobre o papel
// (#f5f0e6), não escolhida no olho: monotonia de luminosidade, distância entre
// degraus e contraste da ponta clara contra o fundo. O dourado da marca ficou de
// fora — é dessaturado demais e o mesmo script o reprova como cor de série
// (lê-se como cinza, e some ao lado do bordô para quem não distingue vermelho).
//
// Série única (contas novas, visitas) usa o degrau do meio e NÃO leva legenda:
// há uma cor só, e o título já diz o que é.
const RAMPA = {
  free: '#bd7280',
  pro: '#9c3d51',
  premium: '#4f1724',
} as const

/** Cor de série única. É o degrau do meio da mesma rampa. */
export const COR_UNICA = RAMPA.pro

/** O papel do painel. Os vãos entre marcas são desenhados NESTA cor. */
const SUPERFICIE = '#f5f0e6'

export const PLANO_NOME: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  premium: 'Max',
}
export const PLANO_COR: Record<string, string> = RAMPA

// ---------------------------------------------------------------------------

/** Moldura comum: título, subtítulo e o corpo do gráfico. */
export function Figura({
  titulo,
  descricao,
  legenda,
  children,
  vazio,
}: {
  titulo: string
  descricao?: string
  legenda?: ReactNode
  children: ReactNode
  /** Texto do estado vazio. Quando presente, substitui o gráfico. */
  vazio?: string | null
}) {
  return (
    <figure className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-5">
      <figcaption className="mb-3">
        <h3 className="font-display text-[15.5px] font-semibold text-ink">{titulo}</h3>
        {descricao && (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">{descricao}</p>
        )}
      </figcaption>
      {legenda}
      {vazio ? (
        // Estado vazio com o MOTIVO, não um gráfico em branco. "Ainda não há
        // dado" e "o dado existe e é zero" são coisas diferentes, e um eixo
        // vazio desenhado bonito faz as duas parecerem a mesma.
        <p className="rounded-lg border border-dashed border-ink/15 px-3 py-6 text-center text-[12.5px] leading-relaxed text-ink-faint">
          {vazio}
        </p>
      ) : (
        children
      )}
    </figure>
  )
}

/** Legenda de identidade. Só aparece com DUAS ou mais séries. */
export function Legenda({ itens }: { itens: { cor: string; nome: string }[] }) {
  if (itens.length < 2) return null
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-1.5 text-[12px] text-ink-soft">
          {/* A cor vive na marca ao lado do texto, nunca NO texto: um degrau
              claro da rampa é ilegível como letra sobre o papel. */}
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: i.cor }}
          />
          {i.nome}
        </li>
      ))}
    </ul>
  )
}

/**
 * Colunas empilhadas ao longo do tempo — a evolução dos perfis por plano.
 *
 * Colunas e não área: com poucos dias, uma área desenha uma rampa contínua entre
 * dois pontos e sugere que houve movimento no meio. Coluna por dia mostra o que
 * foi medido e só isso — e um dia que não foi medido simplesmente não tem
 * coluna, que é o comportamento certo (ver `cobertura` no backend).
 */
export function ColunasEmpilhadas({
  dados,
  series,
  formataRotulo,
}: {
  dados: { rotulo: string; valores: Record<string, number> }[]
  series: { chave: string; nome: string; cor: string }[]
  formataRotulo?: (r: string) => string
}) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const idBase = useId()
  const maximo = Math.max(1, ...dados.map((d) => soma(d.valores, series)))
  const rotulo = formataRotulo ?? String

  return (
    <div>
      {/* HTML, não SVG.
          O primeiro desenho foi um <svg> com viewBox e preserveAspectRatio
          "none": as colunas esticavam junto com a largura do painel (viravam
          barrigudas de 40px onde a especificação pede no máximo 24), o vão de
          2px entre segmentos encolhia com a escala e canto arredondado teria
          saído oval. Em HTML a largura é pixel de verdade, o vão é uma borda
          que não escala e o arredondado é arredondado. */}
      <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={`Evolução por plano em ${dados.length} dias`}>
        {dados.map((d, i) => {
          const total = soma(d.valores, series)
          return (
            <div
              key={d.rotulo}
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              tabIndex={0}
              aria-describedby={`${idBase}-dica`}
              // A faixa inteira é o alvo; a coluna dentro dela é fina. Uma
              // coluna de 8px não se acerta com o dedo, e o alvo maior é o que
              // faz a dica funcionar no toque.
              className={`flex h-full flex-1 cursor-default flex-col justify-end rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-burgundy/30 ${
                ativo === i ? 'bg-ink/[0.045]' : ''
              }`}
            >
              <div
                className="mx-auto flex w-full max-w-[18px] flex-col-reverse justify-start"
                style={{ height: `${(total / maximo) * 100}%` }}
              >
                {/* `flex-col-reverse` põe o PRIMEIRO filho embaixo. Como a lista
                    chega do maior plano para o menor, Max ancora na linha de
                    base e Free fica no topo.
                    Isso é o contrário do arranjo intuitivo (o grupo maior por
                    baixo) e é de propósito: segmento que flutua sobre uma base
                    variável não dá para comparar entre dias. Quem se lê aqui é
                    o plano pago; ele precisa da linha de base. O Free, que é o
                    maior e o menos interessante, é quem aguenta ficar por cima. */}
                {series.map((sv, idx) => {
                    const v = d.valores[sv.chave] ?? 0
                    if (!v) return null
                    return (
                      <div
                        key={sv.chave}
                        style={{
                          height: `${(v / total) * 100}%`,
                          background: sv.cor,
                          // O VÃO É A SUPERFÍCIE, não uma borda desenhada: 2px
                          // de papel separando um segmento do outro. Contorno
                          // acrescentaria tinta que não é dado.
                          borderBottom: idx === 0 ? undefined : `2px solid ${SUPERFICIE}`,
                        }}
                        // Ponta arredondada só no topo da pilha, quadrada na base.
                        className={idx === series.length - 1 ? 'rounded-t-[4px]' : ''}
                      />
                    )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Eixo do tempo: só as pontas. Um rótulo por dia vira borrão e ninguém
          lê — o valor de cada dia está na dica abaixo. */}
      {dados.length > 0 && (
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint">
          <span>{rotulo(dados[0].rotulo)}</span>
          {dados.length > 1 && <span>{rotulo(dados[dados.length - 1].rotulo)}</span>}
        </div>
      )}

      <p
        id={`${idBase}-dica`}
        role="status"
        className="mt-2 min-h-[1.25rem] text-[12px] text-ink-soft"
      >
        {ativo !== null && dados[ativo] ? (
          <>
            <span className="font-semibold text-ink">{rotulo(dados[ativo].rotulo)}</span>
            {series.map((sv) => (
              <span key={sv.chave} className="ml-3 inline-flex items-center gap-1">
                <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: sv.cor }} />
                {sv.nome} {dados[ativo].valores[sv.chave] ?? 0}
              </span>
            ))}
          </>
        ) : (
          <span className="text-ink-faint">Passe o cursor sobre uma coluna para ver o dia.</span>
        )}
      </p>
    </div>
  )
}

function soma(v: Record<string, number>, series: { chave: string }[]) {
  return series.reduce((t, s) => t + (v[s.chave] ?? 0), 0)
}

/**
 * Barras horizontais para poucas linhas nomeadas (UF, uso por mês).
 *
 * Horizontal porque o rótulo é texto e cabe à esquerda sem virar de lado. Uma
 * cor só: a categoria aqui é identidade, não magnitude — pintar cada barra de um
 * tom diferente conforme o tamanho seria codificar duas vezes o que o
 * comprimento já diz.
 */
export function BarrasNomeadas({
  itens,
  larguraRotulo = 'w-28 sm:w-40',
}: {
  /** `cor` só quando as categorias TÊM ordem (a escada de planos). Sem ela,
   *  uma cor só: pintar cada barra conforme o tamanho codificaria duas vezes o
   *  que o comprimento já diz. */
  itens: { nome: string; valor: number; cor?: string }[]
  larguraRotulo?: string
}) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor))
  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-3">
          {/* Sem `truncate`: um rótulo cortado em "Toques no Wha…" é pior que um
              rótulo em duas linhas. A coluna cresce no desktop e quebra no
              celular. */}
          <span className={`${larguraRotulo} shrink-0 text-[12.5px] leading-snug text-ink-soft`}>
            {i.nome}
          </span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(i.valor / maximo) * 100}%`, background: i.cor ?? COR_UNICA }}
            />
          </span>
          {/* Valor na ponta, em tinta — nunca na cor da série. */}
          <span className="w-12 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-ink">
            {i.valor.toLocaleString('pt-BR')}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Ficha de número — a forma certa quando o dado é UM valor.
 *
 * Um gráfico de barra única e uma pizza de duas fatias são as duas maneiras mais
 * comuns de transformar um número em decoração. Aqui ele é só o número, grande,
 * com o rótulo embaixo.
 */
export function Ficha({
  rotulo,
  valor,
  nota,
  destaque = false,
}: {
  rotulo: string
  valor: number | string
  nota?: string
  destaque?: boolean
}) {
  return (
    <div className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card">
      <p className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">{rotulo}</p>
      {/* O destaque é TAMANHO, não cor. Número em bordô ficaria a um passo dos
          degraus da rampa das séries, e valor colorido é a porta de entrada para
          o leitor achar que a cor significa alguma coisa. Texto usa tinta. */}
      <p
        className={`mt-1 font-sans font-semibold leading-none tabular-nums text-ink ${
          destaque ? 'text-[34px]' : 'text-[26px]'
        }`}
      >
        {typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor}
      </p>
      {nota && <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">{nota}</p>}
    </div>
  )
}

