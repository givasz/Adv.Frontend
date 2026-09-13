import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { SECTIONS, editorPath, sectionUnlocked, type SectionId } from '@/lib/editorSections'
import { THEMES, isThemeUnlocked } from '@/lib/themes'
import { SECTION_ICON, type SectionIcon } from '@/components/editor/sectionIcons'
import { ArrowRight, LockIcon } from '@/components/ui/icons'

// Os cartões do painel que levam ao editor — um por seção, com o que ESTÁ
// PREENCHIDO escrito embaixo do nome.
//
// Antes o painel só listava recursos ("Seu vídeo", "Perguntas frequentes") e,
// quando os passos do índice acabavam, não sobrava porta para mexer no nome, na
// bio ou no WhatsApp. Aqui cada seção do perfil tem um cartão permanente, e o
// resumo diz se falta algo sem a pessoa precisar abrir para conferir.

/** Um cartão genérico do painel: ícone, título, linha de estado e seta. */
export function Tile({
  to,
  title,
  texto,
  icon: Icon,
  selo,
  pendente = false,
  extra,
}: {
  to: string
  title: string
  texto: string
  icon: SectionIcon
  /** plano que o recurso exige, mostrado a quem ainda não o tem */
  selo?: string
  /** falta algo que o plano já deixa preencher — o texto ganha um ponto de atenção */
  pendente?: boolean
  /** conteúdo extra abaixo da linha de estado (amostra de temas, por exemplo) */
  extra?: ReactNode
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl2 border border-ink/10 bg-paper/60 p-4 transition-[transform,border-color,background-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-brass/50 hover:bg-paper hover:shadow-card"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brass/25 bg-brass/[0.07] text-brass-deep transition-colors group-hover:bg-brass/15"
        aria-hidden
      >
        <Icon width={17} height={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-[14.5px] font-semibold leading-tight text-ink">{title}</span>
          {selo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              <LockIcon width={10} height={10} aria-hidden />
              {selo}
            </span>
          )}
        </span>
        <span
          className={`mt-0.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed ${
            pendente ? 'text-ink' : 'text-ink-soft'
          }`}
        >
          {pendente && (
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-label="Falta preencher" />
          )}
          <span className="min-w-0 break-words">{texto}</span>
        </span>
        {extra}
      </span>
      <ArrowRight
        width={15}
        height={15}
        className="mt-2 shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5"
      />
    </Link>
  )
}

/** O cartão de UMA seção do editor, com o resumo do que está preenchido. */
export function SecaoTile({ id, profile }: { id: SectionId; profile: Profile }) {
  const meta = SECTIONS[id]
  const aberta = sectionUnlocked(id, profile.plan)
  const r = meta.resumo(profile)
  return (
    <Tile
      to={editorPath(id)}
      title={meta.short}
      texto={r.texto}
      icon={SECTION_ICON[id]}
      selo={aberta ? undefined : meta.plan === 'premium' ? 'Max' : 'Pro'}
      pendente={aberta && !!r.pendente}
      extra={id === 'aparencia' ? <Amostras plan={profile.plan} /> : undefined}
    />
  )
}

// Os temas em miniatura dentro do cartão de tema — 7 dos 8 são de plano pago,
// e ver as cores é o que faz querer experimentar.
function Amostras({ plan }: { plan: Profile['plan'] }) {
  return (
    <span className="mt-2 flex gap-1.5" aria-hidden>
      {THEMES.map((t) => {
        const livre = isThemeUnlocked(t, plan)
        return (
          <span
            key={t.id}
            className="relative h-5 w-5 overflow-hidden rounded-md border border-ink/10"
            style={{ background: t.swatch.bg }}
            title={t.name}
          >
            <span className="absolute bottom-[3px] left-[3px] h-[3px] w-2.5 rounded-full" style={{ background: t.swatch.accent }} />
            {!livre && <span className="absolute inset-0 bg-ink/40" />}
          </span>
        )
      })}
    </span>
  )
}
