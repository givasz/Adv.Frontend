import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { SectionIcon } from '@/components/editor/sectionIcons'
import { ArrowRight, LockIcon } from '@/components/ui/icons'

// As PEÇAS do painel — três formas e só três, para a página ter ritmo:
//
//   • Grupo   → o rótulo em versalete e, ao lado, para que o grupo serve.
//   • Atalho  → uma porta com peso: plaqueta de tinta, título em serifa, uma
//               linha do que acontece lá dentro. Poucos por grupo.
//   • Linha   → uma porta leve, dentro de uma lista num cartão só. É para o
//               que é muito e se visita pouco (as seções do perfil).
//
// Antes o painel tinha uma forma só (o mesmo cartão, 25 vezes), e o olho não
// sabia onde parar: a agenda da semana pesava o mesmo que o botão flutuante.

/** Um grupo do painel: o rótulo e, se preciso, para que ele serve. */
export function Grupo({
  titulo,
  subtitulo,
  children,
  id,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section id={id} aria-label={titulo} className="scroll-mt-6">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-0.5">
        <h2 className="eyebrow font-sans">{titulo}</h2>
        {subtitulo && <p className="text-[12.5px] text-ink-faint">{subtitulo}</p>}
      </div>
      {children}
    </section>
  )
}

/** O nome do plano que abre o recurso, carimbado — só para quem ainda não o tem. */
export function SeloDoPlano({ plano }: { plano: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[4px] bg-burgundy px-1.5 py-[3px] text-[9.5px] font-bold uppercase leading-none tracking-[0.14em] text-paper-soft">
      <LockIcon width={9} height={9} aria-hidden />
      {plano}
    </span>
  )
}

/**
 * A plaqueta do ícone. Liberado: tinta com a sombra de latão (o "selo").
 * Travado: contorno bordô vazado — a mesma forma, sem o peso de coisa pronta.
 */
export function Plaqueta({ Icone, travado = false }: { Icone: SectionIcon; travado?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
        travado
          ? 'border border-dashed border-burgundy/45 bg-burgundy/[0.04] text-burgundy'
          : 'bg-ink text-paper-soft shadow-selo'
      }`}
    >
      <Icone width={20} height={20} />
    </span>
  )
}

/**
 * Um atalho do painel. `coluna`: na tela larga o ícone vai para cima e o texto
 * ganha a largura toda — três lado a lado não cabem como linha. No celular é
 * sempre linha, com a seta à direita.
 */
export function Atalho({
  to,
  Icone,
  titulo,
  texto,
  selo,
  coluna = false,
  nivel = 3,
  destaque,
}: {
  to: string
  Icone: SectionIcon
  titulo: string
  texto: ReactNode
  /** plano que o recurso exige, mostrado a quem ainda não o tem */
  selo?: string
  coluna?: boolean
  /** o título é um cabeçalho de verdade (h3) — leitor de tela navega por eles */
  nivel?: 3 | 4
  /** número ou estado em destaque, abaixo do texto (ex.: "50 horários livres") */
  destaque?: ReactNode
}) {
  const Titulo = nivel === 3 ? 'h3' : 'h4'
  return (
    <Link
      to={to}
      className={`card-paper group flex h-full min-w-0 items-center gap-3.5 p-4 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-lift active:translate-y-0 sm:p-5 ${
        coluna ? 'sm:flex-col sm:items-start sm:gap-3.5' : 'sm:gap-4'
      }`}
    >
      <Plaqueta Icone={Icone} travado={!!selo} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Titulo className="font-display text-[16.5px] font-semibold leading-tight text-ink sm:text-[17.5px]">
            {titulo}
          </Titulo>
          {selo && <SeloDoPlano plano={selo} />}
        </span>
        <span className="mt-1 block text-[12.5px] leading-snug text-ink-faint">{texto}</span>
        {destaque && <span className="mt-2 block text-[12.5px] font-semibold text-ink">{destaque}</span>}
      </span>
      <ArrowRight
        width={17}
        height={17}
        className={`shrink-0 text-burgundy transition-transform duration-300 group-hover:translate-x-0.5 ${
          coluna ? 'sm:hidden' : ''
        }`}
      />
    </Link>
  )
}

/**
 * Uma linha da lista "Seu perfil": ícone leve, nome, o que está preenchido e,
 * se falta algo que o plano já deixa preencher, o ponto de latão.
 */
export function Linha({
  to,
  Icone,
  titulo,
  texto,
  selo,
  pendente = false,
  extra,
}: {
  to: string
  Icone: SectionIcon
  titulo: string
  texto: string
  selo?: string
  pendente?: boolean
  extra?: ReactNode
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-[64px] min-w-0 items-start gap-3 bg-paper-soft px-4 py-3.5 transition-colors hover:bg-paper sm:px-5"
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
          selo ? 'border-dashed border-burgundy/40 text-burgundy' : 'border-brass/35 bg-brass/[0.08] text-brass-deep'
        }`}
      >
        <Icone width={16} height={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-[15px] font-semibold leading-tight text-ink">{titulo}</span>
          {selo && <SeloDoPlano plano={selo} />}
        </span>
        <span
          className={`mt-0.5 flex items-start gap-1.5 text-[12.5px] leading-snug ${pendente ? 'text-ink' : 'text-ink-faint'}`}
        >
          {pendente && (
            <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-label="Falta preencher" />
          )}
          <span className="line-clamp-2 min-w-0 break-words">{texto}</span>
        </span>
        {extra}
      </span>
      <ArrowRight
        width={15}
        height={15}
        className="mt-2 shrink-0 text-ink-faint transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:text-burgundy"
      />
    </Link>
  )
}

/**
 * A lista de linhas num cartão só. As divisórias saem do vão de 1px entre as
 * células (o fundo do cartão aparece por ele), então funcionam em uma ou duas
 * colunas sem regra de borda por posição. Com número ímpar, uma célula vazia
 * fecha a grade no desktop — sem ela o vão da última linha ficaria à mostra.
 */
export function ListaEmCartao({ children, impar }: { children: ReactNode; impar: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl2 border border-ink/[0.12] bg-ink/[0.09] shadow-card">
      <div className="grid gap-px sm:grid-cols-2">
        {children}
        {impar && <span aria-hidden className="hidden bg-paper-soft sm:block" />}
      </div>
    </div>
  )
}
