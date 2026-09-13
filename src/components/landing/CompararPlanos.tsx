import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Plan } from '@/lib/types'
import {
  PLAN_COMPARE,
  RESUMO_DA_COBRANCA,
  offerOf,
  type CompareRow,
  type CompareValue,
} from '@/lib/planOffer'
import {
  escalaDaLinha,
  ganhoSobreAnterior,
  ganhosDoPlano,
  gruposVisiveis,
  numeroDaCelula,
  planoAnterior,
  PLANOS_COMPARADOS,
  type Ganho,
} from '@/lib/comparaPlanos'
import { ArrowRight, CheckIcon, ClockIcon } from '@/components/ui/icons'

// "Compare em detalhe" — a tabela que responde o que os cartões não cabem.
//
// DUAS FORMAS, uma para cada tela, e as duas leem as mesmas células
// (lib/planOffer.ts, PLAN_COMPARE — calculadas dos limites que o editor aplica):
//
//   • Do sm para cima, a TABELA: três planos lado a lado cabem, e lado a lado é
//     a forma mais rápida de comparar.
//   • No celular, UM PLANO POR VEZ. A tabela ali virava uma janela que rolava de
//     lado: a coluna do recurso comia metade da tela, o Free aparecia cortado
//     ("ee", "40") e Pro e Max ficavam escondidos atrás de um "deslize para ver".
//     Ninguém compara o que não enxerga. No lugar, um seletor de plano, e a
//     comparação volta por dois caminhos (lib/comparaPlanos.ts): a régua de cada
//     limite, na escala do maior plano, e a marca do que o plano acrescenta ao
//     anterior.

export function CompararPlanos() {
  return (
    <>
      <div className="sm:hidden">
        <CompararNoCelular />
      </div>
      <div className="hidden sm:block">
        <TabelaComparativa />
      </div>
    </>
  )
}

/** "1200" → "1.200". Número de tabela lido em português. */
function numeroLegivel(v: string): string {
  return /^\d+$/.test(v) ? Number(v).toLocaleString('pt-BR') : v
}

/**
 * "R$ 49" com espaço que não quebra: o preço nunca se divide em duas linhas.
 * `fromCharCode(160)` e não o caractere colado entre aspas — um espaço rígido
 * literal no fonte é invisível, e a próxima pessoa o "corrige" para espaço comum.
 */
const ESPACO_RIGIDO = String.fromCharCode(160)
function precoInteiro(preco: string): string {
  return preco.replace(' ', ESPACO_RIGIDO)
}

// ---- Celular ----------------------------------------------------------------

function CompararNoCelular() {
  // Abre no Pro: é o plano em destaque nos cartões logo acima, e o que tem mais
  // a mostrar contra o Free — abrir no Free começaria pela lista sem novidade.
  const [plano, setPlano] = useState<Plan>('pro')
  const [soOQueMuda, setSoOQueMuda] = useState(false)
  const abas = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()

  const indice = PLANOS_COMPARADOS.indexOf(plano)
  const anterior = planoAnterior(plano)
  const oferta = offerOf(plano)
  const ganhos = ganhosDoPlano(plano)
  const grupos = gruposVisiveis(plano, soOQueMuda)

  // Setas, Home e End movem entre as abas, como num seletor de verdade — e o
  // foco vai junto, senão quem navega pelo teclado troca o plano sem saber onde
  // está.
  const aoTeclar = (e: React.KeyboardEvent) => {
    const total = PLANOS_COMPARADOS.length
    const alvo =
      e.key === 'ArrowRight'
        ? (indice + 1) % total
        : e.key === 'ArrowLeft'
          ? (indice - 1 + total) % total
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? total - 1
              : -1
    if (alvo < 0) return
    e.preventDefault()
    setPlano(PLANOS_COMPARADOS[alvo])
    abas.current[alvo]?.focus()
  }

  return (
    <div>
      {/* O seletor GRUDA no topo enquanto a lista passa: são mais de vinte
          linhas, e trocar de plano no meio delas é justamente a comparação.
          (Só gruda porque a raiz da home é overflow-x-clip — ver Landing.)
          O `after:` é um esmaecido curto logo abaixo: sem ele, a borda dos
          cartões que passam por baixo aparece cortada a seco rente à barra. */}
      <div className="sticky top-0 z-20 -mx-5 bg-paper/95 px-5 pb-3 pt-3 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-gradient-to-b after:from-paper/95 after:to-transparent">
        <div
          role="tablist"
          aria-label="Escolha um plano para ver o que ele inclui"
          className="relative grid grid-cols-3 rounded-full border border-ink/10 bg-paper-deep/80 p-1"
        >
          {/* A pílula desliza por transform — composta pelo celular, sem
              repintar a barra — e só por transform: `transition-transform`,
              nunca `transition-all`. */}
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-burgundy shadow-card transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${indice * 100}%)` }}
          />
          {PLANOS_COMPARADOS.map((p, i) => {
            const o = offerOf(p)
            const ativo = p === plano
            return (
              <button
                key={p}
                ref={(el) => {
                  abas.current[i] = el
                }}
                type="button"
                role="tab"
                id={`${id}-aba-${p}`}
                aria-selected={ativo}
                aria-controls={`${id}-painel`}
                tabIndex={ativo ? 0 : -1}
                onClick={() => setPlano(p)}
                onKeyDown={aoTeclar}
                className={`relative z-10 flex min-h-[50px] flex-col items-center justify-center rounded-full px-2 transition-colors duration-200 ${
                  ativo ? 'text-paper' : 'text-ink-soft'
                }`}
              >
                <span className="font-display text-[15.5px] font-semibold leading-none">{o.name}</span>
                <span
                  className={`mt-1 text-[11px] leading-none tabular-nums ${
                    ativo ? 'text-paper/80' : 'text-ink-faint'
                  }`}
                >
                  {precoInteiro(o.price)}
                  {o.period === '/mês' ? '/mês' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div role="tabpanel" id={`${id}-painel`} aria-labelledby={`${id}-aba-${plano}`}>
        {/* O resumo: quanto este plano acrescenta, contado das linhas abaixo. */}
        <div
          key={plano}
          className="troca-de-plano mt-1 rounded-xl2 border border-ink/10 bg-paper-soft/80 px-4 py-4"
        >
          {anterior ? (
            <p className="flex items-baseline gap-2 text-[13.5px] leading-snug text-ink-soft">
              <span className="font-display text-[30px] font-semibold leading-none text-burgundy tabular-nums">
                {ganhos}
              </span>
              <span>
                {ganhos === 1 ? 'item' : 'itens'} a mais que o {offerOf(anterior).name}
              </span>
            </p>
          ) : (
            <p className="font-display text-[19px] font-semibold leading-tight text-ink">
              O que já vem sem pagar
            </p>
          )}
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">{oferta.pitch}</p>
        </div>

        <div className="mt-3 flex min-h-[40px] items-center justify-between gap-3">
          <p className="min-w-0 text-[11.5px] leading-snug text-ink-faint">
            Nas barras, os tracinhos marcam os outros planos.
          </p>
          {/* O filtro só existe onde há degrau abaixo para comparar. */}
          {anterior && (
            <button
              type="button"
              aria-pressed={soOQueMuda}
              onClick={() => setSoOQueMuda((v) => !v)}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border border-ink/15 px-3 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink/30 aria-pressed:border-burgundy/40 aria-pressed:bg-burgundy/[0.06] aria-pressed:text-burgundy"
            >
              <span
                aria-hidden
                className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                  soOQueMuda ? 'bg-burgundy' : 'bg-ink/20'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-paper-soft transition-transform duration-200 ${
                    soOQueMuda ? 'translate-x-3' : ''
                  }`}
                />
              </span>
              Só o que muda
            </button>
          )}
        </div>

        {grupos.map((g) => (
          <section key={g.title} className="mt-5">
            <h4 className="flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
              <span className="shrink-0">{g.title}</span>
              <span aria-hidden className="h-px flex-1 bg-brass/30" />
            </h4>
            <ul className="mt-2 divide-y divide-ink/[0.07] rounded-xl2 border border-ink/10 bg-paper-soft/70">
              {g.rows.map((r) => (
                <LinhaDoPlano
                  key={r.label}
                  row={r}
                  plano={plano}
                  nomeDoAnterior={anterior ? offerOf(anterior).name : ''}
                />
              ))}
            </ul>
          </section>
        ))}

        {/* O fim da comparação é uma decisão — e o botão é do plano que está
            na tela, com o mesmo destino do cartão lá em cima. */}
        <div
          key={`fim-${plano}`}
          className="troca-de-plano mt-6 rounded-xl2 bg-ink px-5 py-5 text-paper"
        >
          <p className="font-display text-[20px] font-semibold leading-tight">
            {oferta.name}{' '}
            <span className="font-sans text-[14px] font-medium text-paper/70 tabular-nums">
              · {precoInteiro(oferta.price)}
              {oferta.period === '/mês' ? '/mês' : ` · ${oferta.period}`}
            </span>
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-paper/75">
            {anterior ? RESUMO_DA_COBRANCA : 'Sem cartão. Troque de plano quando quiser.'}
          </p>
          <Link to={oferta.ctaTo} className="btn-primary mt-4 w-full">
            {oferta.ctaLabel}
            <ArrowRight width={18} height={18} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function LinhaDoPlano({
  row,
  plano,
  nomeDoAnterior,
}: {
  row: CompareRow
  plano: Plan
  nomeDoAnterior: string
}) {
  const valor = row.values[plano]
  const escala = escalaDaLinha(row)
  const ganho = ganhoSobreAnterior(row, plano)

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] leading-snug ${valor === false ? 'text-ink-faint' : 'text-ink'}`}>
            {row.label}
          </p>
          {row.hint && <p className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">{row.hint}</p>}
        </div>
        {/* `key` pelo plano: trocar de plano remonta o valor e ele sobe de
            novo — o olho vê o que mudou em vez de um número trocado em silêncio. */}
        <div key={plano} className="troca-de-plano flex max-w-[45%] shrink-0 flex-col items-end gap-1 pt-px">
          <ValorNoCelular valor={valor} emPreparo={row.emPreparo} />
          {ganho && <SeloDeGanho ganho={ganho} nomeDoAnterior={nomeDoAnterior} />}
        </div>
      </div>
      {escala !== null && <Regua row={row} plano={plano} escala={escala} />}
    </li>
  )
}

function ValorNoCelular({ valor, emPreparo }: { valor: CompareValue; emPreparo?: boolean }) {
  if (valor === true) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brass/15 text-brass-deep">
        <CheckIcon width={14} height={14} strokeWidth={2.8} aria-hidden />
        <span className="sr-only">incluído</span>
      </span>
    )
  }
  if (valor === false) {
    return (
      <span className="text-[15px] leading-6 text-ink-faint/70">
        <span aria-hidden>—</span>
        <span className="sr-only">não incluído</span>
      </span>
    )
  }
  if (emPreparo) {
    return (
      <span className="inline-flex items-center gap-1 text-right text-[12px] text-ink-faint">
        <ClockIcon width={13} height={13} aria-hidden />
        {valor}
      </span>
    )
  }
  if (numeroDaCelula(valor) !== null) {
    return (
      <span className="font-display text-[18px] font-semibold leading-6 text-ink tabular-nums">
        {numeroLegivel(valor)}
      </span>
    )
  }
  return <span className="text-right text-[13px] font-medium leading-snug text-ink">{valor}</span>
}

function SeloDeGanho({ ganho, nomeDoAnterior }: { ganho: Ganho; nomeDoAnterior: string }) {
  const visivel = ganho.tipo === 'novo' ? 'novo' : `+${ganho.delta.toLocaleString('pt-BR')}`
  const lido =
    ganho.tipo === 'novo'
      ? `novo em relação ao ${nomeDoAnterior}`
      : `${ganho.delta.toLocaleString('pt-BR')} a mais que o ${nomeDoAnterior}`
  return (
    <span className="rounded-full bg-burgundy/[0.08] px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-burgundy tabular-nums">
      <span aria-hidden>{visivel}</span>
      <span className="sr-only">{lido}</span>
    </span>
  )
}

/**
 * A régua de um limite: a barra do plano escolhido na escala do maior plano, e
 * um tracinho onde ficam os outros dois. É o que devolve a comparação a quem
 * está vendo um plano só — "600" sozinho não diz nada; perto do fim da régua
 * de 1.200, diz.
 *
 * `aria-hidden`: o número já está escrito ao lado, em texto. Uma barra lida em
 * voz alta só repetiria o valor com outra roupa.
 */
function Regua({ row, plano, escala }: { row: CompareRow; plano: Plan; escala: number }) {
  const fracao = (p: Plan) => (numeroDaCelula(row.values[p]) ?? 0) / escala
  return (
    <div aria-hidden className="relative mt-3 h-1.5 rounded-full bg-ink/[0.07]">
      {/* scaleX, e não width: a barra cresce por transform, que não recalcula
          layout a cada quadro. */}
      <div
        className="absolute inset-0 origin-left rounded-full bg-burgundy transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `scaleX(${fracao(plano)})` }}
      />
      {PLANOS_COMPARADOS.filter((p) => p !== plano).map((p) => (
        <span
          key={p}
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-ink/35"
          style={{ left: `calc(${fracao(p) * 100}% - 0.5px)` }}
        />
      ))}
    </div>
  )
}

// ---- Tela larga ---------------------------------------------------------------

/**
 * A tabela, do sm para cima. Os três planos cabem lado a lado; a rolagem
 * horizontal fica só como rede de segurança para uma janela estreita demais.
 */
function TabelaComparativa() {
  return (
    <div className="overflow-x-auto rounded-xl2 border border-ink/10 bg-paper-soft/60">
      <table className="w-full min-w-[520px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-ink/10">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-paper-soft px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-ink-faint"
            >
              Recurso
            </th>
            {PLANOS_COMPARADOS.map((p) => (
              <th
                key={p}
                scope="col"
                className={`px-3 py-3 text-center font-display text-[16px] font-semibold ${
                  p === 'pro' ? 'bg-burgundy/[0.05] text-burgundy' : 'text-ink'
                }`}
              >
                {offerOf(p).name}
              </th>
            ))}
          </tr>
        </thead>
        {PLAN_COMPARE.map((g) => (
          <tbody key={g.title}>
            <tr>
              <th
                scope="colgroup"
                colSpan={1 + PLANOS_COMPARADOS.length}
                className="sticky left-0 bg-paper-soft px-4 pb-1.5 pt-4 text-left text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brass-deep"
              >
                {g.title}
              </th>
            </tr>
            {g.rows.map((r) => (
              <tr key={r.label} className="border-t border-ink/[0.07]">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-paper-soft px-4 py-2.5 text-left font-normal text-ink"
                >
                  {r.label}
                  {r.hint && <span className="block text-[11.5px] text-ink-faint">{r.hint}</span>}
                </th>
                {PLANOS_COMPARADOS.map((p) => (
                  <td
                    key={p}
                    className={`px-3 py-2.5 text-center tabular-nums ${p === 'pro' ? 'bg-burgundy/[0.05]' : ''}`}
                  >
                    <CelulaDaTabela value={r.values[p]} emPreparo={r.emPreparo} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function CelulaDaTabela({ value, emPreparo }: { value: CompareValue; emPreparo?: boolean }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center text-brass-deep">
        <CheckIcon width={17} height={17} strokeWidth={2.6} aria-hidden />
        <span className="sr-only">incluído</span>
      </span>
    )
  }
  if (value === false) {
    return (
      <span className="text-ink-faint/70">
        <span aria-hidden>—</span>
        <span className="sr-only">não incluído</span>
      </span>
    )
  }
  if (emPreparo) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-ink-faint">
        <ClockIcon width={13} height={13} aria-hidden />
        {value}
      </span>
    )
  }
  return <span className="text-ink-soft">{numeroLegivel(value)}</span>
}
