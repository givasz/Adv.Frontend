import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DirectoryResult } from '@/lib/types'
import { api } from '@/lib/api'
import { allAreas } from '@/lib/mockData'
import { Avatar } from '@/components/ui/Avatar'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { PinIcon, ScaleIcon, SearchIcon } from '@/components/ui/icons'

export default function Directory() {
  const [query, setQuery] = useState('')
  const [area, setArea] = useState<string | null>(null)
  const [results, setResults] = useState<DirectoryResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Buscar advogados · advoc.me'
  }, [])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      api.searchDirectory(query, area).then((r) => {
        setResults(r)
        setLoading(false)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [query, area])

  return (
    <div className="grain min-h-dvh overflow-x-hidden">
      <header className="border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            advoc.me
          </Link>
          <Link to="/editor" className="btn-ghost !py-2 text-[13px]">
            Criar meu perfil
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <h1 className="text-center font-display text-3xl font-semibold sm:text-4xl">
          Encontre um advogado
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center text-ink-faint">
          Busque por área de atuação e cidade. Perfis informativos, dentro das normas da OAB.
        </p>

        {/* Busca */}
        <div className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-full border border-ink/15 bg-paper-soft px-4 py-1 shadow-card focus-within:border-burgundy">
          <SearchIcon width={18} height={18} className="text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, cidade ou área…"
            aria-label="Buscar por nome, cidade ou área"
            className="w-full bg-transparent py-2.5 text-[15px] placeholder:text-ink-faint/60 focus:outline-none"
          />
        </div>

        {/* Filtros de área */}
        <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
          <Chip active={area === null} onClick={() => setArea(null)}>
            Todas
          </Chip>
          {allAreas.slice(0, 9).map((a) => (
            <Chip key={a} active={area === a} onClick={() => setArea(area === a ? null : a)}>
              {a}
            </Chip>
          ))}
        </div>

        {/* Status para leitores de tela */}
        <p className="sr-only" role="status" aria-live="polite">
          {loading ? 'Buscando…' : `${results.length} advogado(s) encontrado(s)`}
        </p>

        {/* Resultados */}
        <div className="mx-auto mt-8 max-w-3xl">
          {loading ? (
            <p className="text-center text-ink-faint">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="text-center text-ink-faint">Nenhum advogado encontrado para esse filtro.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map((r) => (
                <li key={r.slug}>
                  <Link
                    to={`/${r.slug}`}
                    className="flex items-start gap-3 rounded-xl2 border border-ink/10 bg-paper-soft p-4 transition-all hover:-translate-y-0.5 hover:border-brass/50 hover:shadow-lift"
                  >
                    <Avatar src={r.avatarUrl} name={r.name} size={52} ring={false} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{r.name}</span>
                        {r.oabVerified && <VerifiedBadge compact />}
                      </div>
                      <p className="text-[13px] text-ink-soft">{r.headline}</p>
                      <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-faint">
                        <PinIcon width={13} height={13} />
                        {r.city}/{r.state}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.areas.slice(0, 3).map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[11px] text-ink-soft"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? 'border-burgundy bg-burgundy text-paper-soft'
          : 'border-ink/15 text-ink-soft hover:border-ink/40'
      }`}
    >
      {children}
    </button>
  )
}
