// As peças do console — o sistema de desenho do painel interno.
//
// O console NÃO segue o "Papel & Tinta" do produto público, e é de propósito:
// ele é ferramenta de operação (fila, decisão, suporte, números), não vitrine.
// O que vale aqui é densidade, leitura rápida e estados inequívocos:
//
//   • neutros frios (cinza-azulado) e UM acento (azul) para a ação principal;
//   • cores semânticas fixas — verde = resolvido/ok, âmbar = atenção/prazo,
//     vermelho = grave/irreversível — que o produto público não usa;
//   • cantos curtos (6–8px), sem pílulas, sem grão, sem serifa;
//   • toda lista é tabela; toda ação que afeta alguém tem motivo e um botão que
//     diz o que vai acontecer.
//
// Tudo o que uma tela do console precisa deve sair daqui. Trinta classes do
// Tailwind repetidas em cada input é o que este arquivo evita.

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { AdminRole } from '@/lib/adminApi'

// ---- tons -------------------------------------------------------------------

export type Tom = 'neutro' | 'info' | 'ok' | 'aviso' | 'perigo' | 'acento'

const TOM_CHIP: Record<Tom, string> = {
  neutro: 'bg-adm-line text-adm-soft ring-adm-border',
  info: 'bg-adm-info-soft text-adm-info ring-adm-info/20',
  ok: 'bg-adm-ok-soft text-adm-ok ring-adm-ok/20',
  aviso: 'bg-adm-warn-soft text-adm-warn ring-adm-warn/25',
  perigo: 'bg-adm-danger-soft text-adm-danger ring-adm-danger/20',
  acento: 'bg-adm-accent-soft text-adm-accent-deep ring-adm-accent/20',
}

/** Etiqueta curta de estado: "Aberto", "Restrito", "Max"… */
export function Chip({
  tom = 'neutro',
  children,
  className = '',
  title,
}: {
  tom?: Tom
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold leading-4 ring-1 ring-inset ${TOM_CHIP[tom]} ${className}`}
    >
      {children}
    </span>
  )
}

/** Bolinha de contagem — nos itens do menu e nos filtros. */
export function Contador({ valor, tom = 'neutro' }: { valor: number; tom?: Tom }) {
  if (!valor) return null
  const cls =
    tom === 'perigo'
      ? 'bg-adm-danger text-white'
      : tom === 'aviso'
        ? 'bg-adm-warn text-white'
        : tom === 'acento'
          ? 'bg-adm-accent text-white'
          : 'bg-adm-line text-adm-soft'
  return (
    <span
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold tabular-nums leading-none ${cls}`}
    >
      {valor > 99 ? '99+' : valor}
    </span>
  )
}

// ---- papéis -----------------------------------------------------------------

export const ROLE_TOM: Record<AdminRole, Tom> = {
  owner: 'acento',
  moderator: 'info',
  support: 'ok',
  readonly: 'neutro',
}

export const ROLE_NOME: Record<AdminRole, string> = {
  owner: 'Responsável',
  moderator: 'Moderação',
  support: 'Suporte',
  readonly: 'Só leitura',
}

export function Etiqueta({ papel }: { papel: AdminRole }) {
  return <Chip tom={ROLE_TOM[papel]}>{ROLE_NOME[papel]}</Chip>
}

// ---- botões -----------------------------------------------------------------

type Variante = 'primario' | 'secundario' | 'perigo' | 'sucesso' | 'aviso' | 'fantasma'

const VARIANTE: Record<Variante, string> = {
  primario: 'bg-adm-accent text-white shadow-sm hover:bg-adm-accent-deep',
  secundario:
    'border border-adm-border bg-white text-adm-ink shadow-sm hover:border-adm-faint hover:bg-adm-raised',
  perigo: 'bg-adm-danger text-white shadow-sm hover:bg-red-800',
  sucesso: 'bg-adm-ok text-white shadow-sm hover:bg-green-800',
  aviso: 'border border-amber-300 bg-adm-warn-soft text-adm-warn hover:bg-amber-100',
  fantasma: 'text-adm-muted hover:bg-adm-line hover:text-adm-ink',
}

export function Botao({
  variante = 'secundario',
  tamanho = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  tamanho?: 'sm' | 'md'
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        tamanho === 'sm' ? 'h-8 px-2.5 text-[12.5px]' : 'h-9 px-3.5 text-[13px]'
      } ${VARIANTE[variante]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Link externo desenhado como botão secundário pequeno. */
export function LinkExterno({
  href,
  children,
  className = '',
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener nofollow"
      className={`inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md border border-adm-border bg-white px-2.5 text-[12.5px] font-medium text-adm-soft shadow-sm transition-colors hover:border-adm-faint hover:text-adm-ink ${className}`}
    >
      {children}
    </a>
  )
}

// ---- superfícies ------------------------------------------------------------

/** Cartão do console: superfície branca, borda fina, sombra quase nula. */
export function Cartao({
  titulo,
  descricao,
  acoes,
  children,
  className = '',
  semPreenchimento = false,
}: {
  titulo?: ReactNode
  descricao?: ReactNode
  acoes?: ReactNode
  children: ReactNode
  className?: string
  /** Para tabelas e listas que encostam na borda. */
  semPreenchimento?: boolean
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-adm-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${className}`}
    >
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-adm-line px-4 py-3">
          <div className="min-w-0">
            {titulo && <h2 className="font-ui text-[14px] font-semibold text-adm-ink">{titulo}</h2>}
            {descricao && <p className="mt-0.5 text-[12.5px] leading-relaxed text-adm-muted">{descricao}</p>}
          </div>
          {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
        </header>
      )}
      <div className={semPreenchimento ? '' : 'p-4'}>{children}</div>
    </section>
  )
}

/** Rótulo de seção dentro de uma ficha: pequeno, caixa alta, cinza. */
export function Rotulo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-adm-muted ${className}`}>
      {children}
    </p>
  )
}

/** Cabeçalho de página: título, descrição e ações à direita. */
export function TituloDaPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string
  descricao?: ReactNode
  acoes?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-ui text-[20px] font-semibold leading-tight tracking-[-0.01em] text-adm-ink">
          {titulo}
        </h1>
        {descricao && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-adm-muted">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}

// ---- filtros ----------------------------------------------------------------

/**
 * Controle segmentado — o filtro de toda fila.
 *
 * Um grupo só, com o item ativo em tinta escura: lê-se de relance qual recorte
 * está na tela, sem pílula colorida competindo com os estados das linhas.
 */
export function Segmentos<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: readonly { id: T; label: string; contagem?: number }[]
  valor: T
  onChange: (v: T) => void
  rotulo: string
}) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className="inline-flex max-w-full overflow-x-auto rounded-md border border-adm-border bg-white p-0.5 shadow-sm"
    >
      {opcoes.map((o) => {
        const ativo = o.id === valor
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={ativo}
            className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded px-2.5 text-[12.5px] font-medium transition-colors ${
              ativo ? 'bg-adm-ink text-white' : 'text-adm-muted hover:bg-adm-line hover:text-adm-ink'
            }`}
          >
            {o.label}
            {typeof o.contagem === 'number' && o.contagem > 0 && (
              <span
                className={`rounded px-1 text-[10.5px] font-semibold tabular-nums ${
                  ativo ? 'bg-white/20 text-white' : 'bg-adm-line text-adm-soft'
                }`}
              >
                {o.contagem}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---- tabelas ----------------------------------------------------------------

/**
 * Tabela do console.
 *
 * Tabela de verdade, com cabeçalho: um chamado, uma denúncia e um advogado são
 * linhas com colunas comparáveis — nome, situação, quando, quem —, e cartão
 * empilhado esconde exatamente a comparação. No celular ela rola na horizontal
 * dentro da própria moldura; a página nunca rola.
 */
export function Tabela({ children, minima = 'md:min-w-[640px]' }: { children: ReactNode; minima?: string }) {
  // No celular a tabela NÃO tem largura mínima: as colunas secundárias somem
  // (`oculta` em Th/Td) e a ficha que abre sob a linha fica inteira na tela,
  // em vez de rolar na horizontal dentro da moldura.
  return (
    <div className="overflow-x-auto">
      <table className={`w-full table-fixed border-collapse text-[13px] ${minima}`}>{children}</table>
    </div>
  )
}

/**
 * A tela é larga (≥ md)? Quem precisa saber é o `colSpan` da linha de detalhe:
 * com `table-fixed`, um colSpan maior que o número de colunas VISÍVEIS cria
 * colunas fantasmas que roubam largura das reais — foi assim que a tabela
 * apareceu com metade da largura no celular.
 */
export function useTelaLarga(): boolean {
  const consulta = '(min-width: 768px)'
  const [larga, setLarga] = useState(
    () => typeof window !== 'undefined' && 'matchMedia' in window && window.matchMedia(consulta).matches,
  )
  useEffect(() => {
    if (!('matchMedia' in window)) return
    const mq = window.matchMedia(consulta)
    const ouvir = () => setLarga(mq.matches)
    ouvir()
    // Safari antigo (< 14) só tem a API antiga (addListener).
    const antiga = mq as unknown as { addListener?: (f: () => void) => void; removeListener?: (f: () => void) => void }
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', ouvir)
      return () => mq.removeEventListener('change', ouvir)
    }
    antiga.addListener?.(ouvir)
    return () => antiga.removeListener?.(ouvir)
  }, [])
  return larga
}

export function Th({
  children,
  className = '',
  largura,
  oculta = false,
}: {
  children?: ReactNode
  className?: string
  largura?: string
  /** Coluna secundária: some abaixo de `md`. */
  oculta?: boolean
}) {
  return (
    <th
      scope="col"
      style={largura ? { width: largura } : undefined}
      className={`border-b border-adm-border bg-adm-raised px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-adm-muted ${
        oculta ? 'hidden md:table-cell' : ''
      } ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className = '',
  colSpan,
  oculta = false,
}: {
  children?: ReactNode
  className?: string
  colSpan?: number
  /** Célula de coluna secundária: some abaixo de `md`. */
  oculta?: boolean
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-adm-line px-3 py-2.5 align-top ${oculta ? 'hidden md:table-cell' : ''} ${className}`}
    >
      {children}
    </td>
  )
}

/** Linha clicável da tabela: abre a ficha logo abaixo. */
export function LinhaClicavel({
  aberta,
  onClick,
  children,
  destaque = false,
}: {
  aberta: boolean
  onClick: () => void
  children: ReactNode
  destaque?: boolean
}) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      tabIndex={0}
      aria-expanded={aberta}
      className={`cursor-pointer transition-colors ${
        aberta ? 'bg-adm-accent-soft/40' : destaque ? 'bg-adm-danger-soft/30 hover:bg-adm-danger-soft/50' : 'hover:bg-adm-raised'
      }`}
    >
      {children}
    </tr>
  )
}

// ---- formulários ------------------------------------------------------------

export const entrada =
  'w-full rounded-md border border-adm-border bg-white px-3 py-2 text-[13px] text-adm-ink shadow-sm placeholder:text-adm-faint focus:border-adm-accent focus:outline-none focus:ring-2 focus:ring-adm-accent/20 disabled:bg-adm-raised disabled:text-adm-muted'

export function Campo({
  id,
  label,
  dica,
  children,
  className = '',
}: {
  id: string
  label: string
  dica?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mb-3 ${className}`}>
      <label htmlFor={id} className="mb-1 block text-[12.5px] font-medium text-adm-soft">
        {label}
      </label>
      {children}
      {dica && <p className="mt-1 text-[11.5px] leading-snug text-adm-muted">{dica}</p>}
    </div>
  )
}

/**
 * A caixa de motivo.
 *
 * Aparece em toda ação que afeta alguém, e não é burocracia: o texto escrito aqui
 * é o que a pessoa afetada lê. Sem ele o servidor recusa a ação — então a tela
 * também recusa, para o "não" chegar antes do clique e não depois.
 */
export function Motivo({
  id,
  valor,
  onChange,
  label = 'Motivo',
  dica = 'É o que a pessoa afetada vai ler. Mínimo de 5 caracteres.',
  linhas = 2,
}: {
  id: string
  valor: string
  onChange: (v: string) => void
  label?: string
  dica?: string
  linhas?: number
}) {
  return (
    <Campo id={id} label={label} dica={dica}>
      <textarea
        id={id}
        rows={linhas}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`${entrada} resize-y leading-relaxed`}
      />
    </Campo>
  )
}

// ---- avisos e estados -------------------------------------------------------

export function Aviso({
  tom = 'erro',
  children,
  className = '',
}: {
  tom?: 'erro' | 'nota' | 'ok'
  children: ReactNode
  className?: string
}) {
  const cls =
    tom === 'erro'
      ? 'border-adm-danger/30 bg-adm-danger-soft/60 text-adm-danger'
      : tom === 'ok'
        ? 'border-adm-border bg-adm-raised text-adm-soft'
        : 'border-amber-300/70 bg-adm-warn-soft/70 text-adm-warn'
  return (
    <p
      className={`mb-3 rounded-md border px-3 py-2 text-[12.5px] leading-relaxed ${cls} ${className}`}
      role={tom === 'erro' ? 'alert' : undefined}
    >
      {children}
    </p>
  )
}

/** Estado vazio com o MOTIVO — "não há" e "ainda não buscou" são diferentes. */
export function Vazio({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-md border border-dashed border-adm-border px-4 py-8 text-center text-[13px] text-adm-muted ${className}`}
    >
      {children}
    </div>
  )
}

/** Carregando — barra que pulsa, em vez de texto solto no meio da tela. */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-6 text-[12.5px] text-adm-muted" role="status" aria-live="polite">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-adm-line">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-adm-accent/60" />
      </span>
      {texto}
    </div>
  )
}

/** Par rótulo/valor em linha, para fichas. */
export function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12.5px]">
      <dt className="shrink-0 text-adm-muted">{rotulo}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-adm-ink">{children}</dd>
    </div>
  )
}

// ---- utilidades -------------------------------------------------------------

export function fmtData(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** "há 3 min", "há 2 h", "ontem", ou a data curta quando é longe. */
export function fmtRelativo(iso?: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (isNaN(t)) return '—'
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  if (d === 1) return 'ontem'
  if (d < 7) return `há ${d} dias`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/** Iniciais para o avatar da equipe. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}
