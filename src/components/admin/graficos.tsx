import { useId, useState, type ReactNode } from 'react'

// GRÁFICOS DO CONSOLE — HTML e CSS à mão, sem biblioteca.
//
// Não é teimosia. A CSP do projeto é `script-src 'self'` (ver netlify.toml): uma
// biblioteca de CDN seria bloqueada em silêncio, e uma empacotada no bundle
// custaria dezenas de KB para desenhar três formas que cabem em duzentas
// linhas. O console tem meia dúzia de gráficos, todos simples.
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
// A rampa é o azul do acento do console, em três luminosidades conferidas por
// script sobre o branco da superfície (monotonia de luminosidade, distância
// entre degraus e contraste da ponta clara contra o fundo ≥ 1,5:1). O acento
// puro é o degrau do meio, para o gráfico e o botão "principal" dizerem a
// mesma coisa com a mesma cor.
//
// Série única (contas novas, visitas) usa o degrau do meio e NÃO leva legenda:
// há uma cor só, e o título já diz o que é.
const RAMPA = {
  free: '#93b4f5',
  pro: '#2563eb',
  premium: '#14306e',
} as const

/** Cor de série única. É o degrau do meio da mesma rampa. */
export const COR_UNICA = RAMPA.pro

/** A superfície dos cartões. Os vãos entre marcas são desenhados NESTA cor. */
const SUPERFICIE = '#ffffff'

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
  acoes,
  children,
  vazio,
  className = '',
}: {
  titulo: string
  descricao?: string
  legenda?: ReactNode
  acoes?: ReactNode
  children: ReactNode
  /** Texto do estado vazio. Quando presente, substitui o gráfico. */
  vazio?: string | null
  className?: string
}) {
  return (
    <figure className={`rounded-lg border border-adm-border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${className}`}>
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-adm-ink">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-[12px] leading-relaxed text-adm-muted">{descricao}</p>}
        </div>
        {acoes}
      </figcaption>
      {legenda}
      {vazio ? (
        // Estado vazio com o MOTIVO, não um gráfico em branco. "Ainda não há
        // dado" e "o dado existe e é zero" são coisas diferentes, e um eixo
        // vazio desenhado bonito faz as duas parecerem a mesma.
        <p className="rounded-md border border-dashed border-adm-border px-3 py-6 text-center text-[12.5px] leading-relaxed text-adm-muted">
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
        <li key={i.nome} className="flex items-center gap-1.5 text-[12px] text-adm-soft">
          {/* A cor vive na marca ao lado do texto, nunca NO texto: um degrau
              claro da rampa é ilegível como letra sobre o branco. */}
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: i.cor }} />
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
      {/* HTML, não SVG: em HTML a largura é pixel de verdade, o vão é uma borda
          que não escala e o arredondado é arredondado. */}
      <div
        className="flex h-44 items-end gap-[2px] border-b border-adm-line"
        role="img"
        aria-label={`Evolução por plano em ${dados.length} dias`}
      >
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
              className={`flex h-full flex-1 cursor-default flex-col justify-end rounded-sm outline-none transition-colors ${
                ativo === i ? 'bg-adm-line' : ''
              }`}
            >
              <div
                className="mx-auto flex w-full max-w-[18px] flex-col-reverse justify-start"
                style={{ height: `${(total / maximo) * 100}%` }}
              >
                {/* `flex-col-reverse` põe o PRIMEIRO filho embaixo. Como a lista
                    chega do maior plano para o menor, Max ancora na linha de
                    base e Free fica no topo: quem se lê aqui é o plano pago; ele
                    precisa da linha de base. */}
                {series.map((sv, idx) => {
                  const v = d.valores[sv.chave] ?? 0
                  if (!v) return null
                  return (
                    <div
                      key={sv.chave}
                      style={{
                        height: `${(v / total) * 100}%`,
                        background: sv.cor,
                        // O VÃO É A SUPERFÍCIE, não uma borda desenhada.
                        borderBottom: idx === 0 ? undefined : `2px solid ${SUPERFICIE}`,
                      }}
                      className={idx === series.length - 1 ? 'rounded-t-[3px]' : ''}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Eixo do tempo: só as pontas. Um rótulo por dia vira borrão. */}
      {dados.length > 0 && (
        <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-adm-muted">
          <span>{rotulo(dados[0].rotulo)}</span>
          {dados.length > 1 && <span>{rotulo(dados[dados.length - 1].rotulo)}</span>}
        </div>
      )}

      <p id={`${idBase}-dica`} role="status" className="mt-2 min-h-[1.25rem] text-[12px] text-adm-soft">
        {ativo !== null && dados[ativo] ? (
          <>
            <span className="font-semibold text-adm-ink">{rotulo(dados[ativo].rotulo)}</span>
            {series.map((sv) => (
              <span key={sv.chave} className="ml-3 inline-flex items-center gap-1 tabular-nums">
                <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: sv.cor }} />
                {sv.nome} {dados[ativo].valores[sv.chave] ?? 0}
              </span>
            ))}
          </>
        ) : (
          <span className="text-adm-faint">Passe o cursor sobre uma coluna para ver o dia.</span>
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
 * cor só: a categoria aqui é identidade, não magnitude.
 */
export function BarrasNomeadas({
  itens,
  larguraRotulo = 'w-28 sm:w-40',
}: {
  /** `cor` só quando as categorias TÊM ordem (a escada de planos). */
  itens: { nome: string; valor: number; cor?: string }[]
  larguraRotulo?: string
}) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor))
  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-3">
          <span className={`${larguraRotulo} shrink-0 text-[12.5px] leading-snug text-adm-soft`}>{i.nome}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-sm bg-adm-line">
            <span
              className="block h-full rounded-sm"
              style={{ width: `${(i.valor / maximo) * 100}%`, background: i.cor ?? COR_UNICA }}
            />
          </span>
          {/* Valor na ponta, em tinta — nunca na cor da série. */}
          <span className="w-12 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-adm-ink">
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
 * Só o número, grande, com o rótulo em cima. O destaque é TAMANHO, não cor:
 * número colorido é a porta de entrada para o leitor achar que a cor significa
 * alguma coisa.
 */
export function Ficha({
  rotulo,
  valor,
  nota,
  destaque = false,
  tom,
  onClick,
}: {
  rotulo: string
  valor: number | string
  nota?: ReactNode
  destaque?: boolean
  /** Um filete colorido à esquerda, quando a ficha é uma fila com gente esperando. */
  tom?: 'perigo' | 'aviso' | 'acento' | 'ok'
  onClick?: () => void
}) {
  const filete =
    tom === 'perigo'
      ? 'border-l-adm-danger'
      : tom === 'aviso'
        ? 'border-l-adm-warn'
        : tom === 'acento'
          ? 'border-l-adm-accent'
          : tom === 'ok'
            ? 'border-l-adm-ok'
            : ''
  const corpo = (
    <>
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-adm-muted">{rotulo}</p>
      <p className={`mt-1.5 font-ui font-semibold leading-none tabular-nums text-adm-ink ${destaque ? 'text-[32px]' : 'text-[26px]'}`}>
        {typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor}
      </p>
      {nota && <p className="mt-1.5 text-[12px] leading-snug text-adm-muted">{nota}</p>}
    </>
  )
  const cls = `rounded-lg border border-adm-border bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${
    filete ? `border-l-[3px] ${filete}` : ''
  }`
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} w-full transition-colors hover:bg-adm-raised`}>
        {corpo}
      </button>
    )
  }
  return <div className={cls}>{corpo}</div>
}
