import type { ReactNode } from 'react'
import type { Profile } from '@/lib/types'
import { SECTIONS, editorPath, sectionUnlocked, type SectionId } from '@/lib/editorSections'
import { THEMES, isThemeUnlocked } from '@/lib/themes'
import { SECTION_ICON } from '@/components/editor/sectionIcons'
import { Atalho, Linha } from './pecas'

// As portas do painel que levam ao editor — uma por seção, com o que ESTÁ
// PREENCHIDO escrito embaixo do nome. Tudo sai de lib/editorSections.ts: nome,
// ícone, trava de plano e resumo, para painel e editor nunca divergirem.
//
// Duas formas para a mesma fonte: a LINHA (seções do perfil, que são muitas e
// ficam numa lista) e o ATALHO (ferramentas, que são poucas e têm peso).

function dadosDaSecao(id: SectionId, profile: Profile) {
  const meta = SECTIONS[id]
  const aberta = sectionUnlocked(id, profile.plan)
  const r = meta.resumo(profile)
  return {
    to: editorPath(id),
    titulo: meta.short,
    texto: r.texto,
    Icone: SECTION_ICON[id],
    selo: aberta ? undefined : meta.plan === 'premium' ? 'Max' : 'Pro',
    pendente: aberta && !!r.pendente,
  }
}

/** A linha de UMA seção do perfil, com o resumo do que está preenchido. */
export function SecaoLinha({ id, profile }: { id: SectionId; profile: Profile }) {
  const d = dadosDaSecao(id, profile)
  return <Linha {...d} extra={id === 'aparencia' ? <Amostras plan={profile.plan} /> : undefined} />
}

/** O atalho de uma seção-ferramenta (story, QR, cartão, documentos). */
export function SecaoAtalho({
  id,
  profile,
  coluna,
  texto,
}: {
  id: SectionId
  profile: Profile
  coluna?: boolean
  /** substitui o resumo quando o painel tem algo melhor a dizer */
  texto?: ReactNode
}) {
  const { pendente: _p, ...d } = dadosDaSecao(id, profile)
  return <Atalho {...d} texto={texto ?? d.texto} coluna={coluna} />
}

// Os temas em miniatura dentro da linha de tema — 7 dos 8 são de plano pago,
// e ver as cores é o que faz querer experimentar.
function Amostras({ plan }: { plan: Profile['plan'] }) {
  return (
    <span className="mt-2 flex flex-wrap gap-1" aria-hidden>
      {THEMES.map((t) => {
        const livre = isThemeUnlocked(t, plan)
        return (
          <span
            key={t.id}
            className="relative h-4 w-4 overflow-hidden rounded-[4px] border border-ink/15"
            style={{ background: t.swatch.bg }}
            title={t.name}
          >
            <span className="absolute bottom-[3px] left-[3px] h-[2px] w-2 rounded-full" style={{ background: t.swatch.accent }} />
            {!livre && <span className="absolute inset-0 bg-ink/40" />}
          </span>
        )
      })}
    </span>
  )
}
