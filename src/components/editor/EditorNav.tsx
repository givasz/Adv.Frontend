import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Plan } from '@/lib/types'
import {
  buscarNoEditor,
  GROUP_LABEL,
  SECTIONS,
  SECTIONS_BY_GROUP,
  editorPath,
  sectionUnlocked,
  type SectionGroup,
  type SectionId,
} from '@/lib/editorSections'
import { SECTION_ICON } from './sectionIcons'
import { ArrowRight, LockIcon, SearchIcon, XIcon } from '@/components/ui/icons'

// A navegação do editor — busca + chips das seções.
//
// O editor já abria UMA seção por vez (?section=), mas não tinha como ir de uma
// para outra sem voltar ao painel: quem estava na bio e lembrava de trocar o
// WhatsApp fazia três telas. E a seção padrão era a maior de todas.
//
// A busca leva ao CAMPO, não à seção: "foto" abre "Dados e foto" já rolado até
// a foto, com o campo em destaque (ver o efeito de âncora em pages/Editor.tsx).
// É o "ir direto ao ponto" que uma lista de treze seções não entrega sozinha.
//
// No celular os chips correm numa linha só; a partir de lg viram uma coluna à
// esquerda, agrupada. É o mesmo componente — só o CSS muda de eixo.

const GRUPOS: SectionGroup[] = ['perfil', 'ferramentas', 'conta']

export function EditorNav({ section, plan }: { section: SectionId; plan: Plan }) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const achados = useMemo(() => buscarNoEditor(q), [q])
  const trilho = useRef<HTMLDivElement>(null)

  // No celular, o chip ativo se traz para o meio do trilho — sem isso, abrir
  // "Cartão impresso" pelo painel deixava o chip escondido à direita e a linha
  // parecia começar em "Dados e foto".
  //
  // Só rolagem HORIZONTAL, calculada na mão: scrollIntoView também rola a
  // página na vertical e brigava com a âncora do campo.
  useEffect(() => {
    const el = trilho.current
    if (!el || window.matchMedia('(min-width: 1024px)').matches) return
    const ativo = el.querySelector<HTMLElement>('[aria-current="page"]')
    if (!ativo) return
    const left = ativo.offsetLeft - el.clientWidth / 2 + ativo.clientWidth / 2
    el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [section])

  function irAoPrimeiro(e: React.FormEvent) {
    e.preventDefault()
    if (!achados[0]) return
    navigate(achados[0].to)
    setQ('')
  }

  return (
    <nav aria-label="Seções do editor" className="space-y-3 lg:sticky lg:top-[80px] lg:self-start">
      <form role="search" onSubmit={irAoPrimeiro}>
        <label className="relative block">
          <span className="sr-only">O que você quer mudar?</span>
          <SearchIcon
            width={15}
            height={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQ('')
            }}
            placeholder="O que você quer mudar? foto, WhatsApp, tema…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-full border border-ink/15 bg-paper py-2.5 pl-9 pr-9 text-[13.5px] text-ink placeholder:text-ink-faint/70 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              <XIcon width={14} height={14} />
            </button>
          )}
        </label>
      </form>

      {/* Resultados EM LINHA, não flutuando: empurram os chips para baixo e
          nada fica por cima de nada — a regra de "sem modais" vale aqui. */}
      {q.trim().length >= 2 && (
        <ul
          role="list"
          aria-label="Resultados da busca"
          aria-live="polite"
          className="divide-y divide-ink/[0.07] overflow-hidden rounded-xl2 border border-ink/10 bg-paper shadow-card"
        >
          {achados.length === 0 ? (
            <li className="px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-faint">
              Nada com “{q.trim()}”. Tente “foto”, “WhatsApp”, “endereço”, “tema”…
            </li>
          ) : (
            achados.map((a) => {
              const Icon = SECTION_ICON[a.section]
              return (
                <li key={a.to}>
                  <Link
                    to={a.to}
                    onClick={() => setQ('')}
                    className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-brass/[0.06]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brass/[0.08] text-brass-deep" aria-hidden>
                      <Icon width={15} height={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{a.label}</span>
                      {a.onde && (
                        <span className="block truncate text-[11.5px] text-ink-faint">em {a.onde}</span>
                      )}
                    </span>
                    <ArrowRight width={14} height={14} className="shrink-0 text-ink-faint" aria-hidden />
                  </Link>
                </li>
              )
            })
          )}
        </ul>
      )}

      <div
        ref={trilho}
        className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {GRUPOS.map((g, i) => (
          <Fragment key={g}>
            {i > 0 && <span className="mx-0.5 w-px shrink-0 self-stretch bg-ink/10 lg:hidden" aria-hidden />}
            <span
              className={`hidden px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep lg:block ${
                i > 0 ? 'pt-3' : ''
              }`}
            >
              {GROUP_LABEL[g]}
            </span>
            {SECTIONS_BY_GROUP[g].map((id) => (
              <Chip key={id} id={id} ativo={id === section} travado={!sectionUnlocked(id, plan)} />
            ))}
          </Fragment>
        ))}
      </div>
    </nav>
  )
}

function Chip({ id, ativo, travado }: { id: SectionId; ativo: boolean; travado: boolean }) {
  const Icon = SECTION_ICON[id]
  return (
    <Link
      to={editorPath(id)}
      aria-current={ativo ? 'page' : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors lg:w-full lg:rounded-lg lg:px-2.5 lg:py-2 ${
        ativo
          ? 'border-burgundy bg-burgundy text-paper-soft'
          : 'border-ink/12 bg-paper text-ink-soft hover:border-burgundy/40 hover:text-burgundy'
      }`}
    >
      <Icon width={14} height={14} className={ativo ? 'opacity-90' : 'text-brass-deep'} />
      {SECTIONS[id].short}
      {travado && <LockIcon width={11} height={11} className="ml-auto opacity-70" aria-label="Recurso de plano pago" />}
    </Link>
  )
}
