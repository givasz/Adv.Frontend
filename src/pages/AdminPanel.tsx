import { useEffect, useState } from 'react'
import {
  adminLogin,
  adminLogout,
  decideOab,
  dismissReport,
  getAdminToken,
  getModerationProfile,
  listPendingOab,
  listReports,
  moderateProfile,
  searchProfiles,
  type AdminProfile,
  type ModerationProfile,
  type PendingOab,
  type ReportGroup,
} from '@/lib/adminApi'
import { REASON_LABEL } from '@/lib/reportReasons'
import type { ModerationStatus } from '@/lib/types'
import { CheckIcon, ExternalLinkIcon, LockIcon, ScaleIcon, SearchIcon, XIcon } from '@/components/ui/icons'

const STATUS_META: Record<ModerationStatus, { label: string; cls: string }> = {
  active: { label: 'Ativo', cls: 'bg-ink/[0.06] text-ink-faint' },
  warned: { label: 'Avisado', cls: 'bg-brass/15 text-brass-deep' },
  partial: { label: 'Censura parcial', cls: 'bg-brass/20 text-brass-deep' },
  restricted: { label: 'Restrito', cls: 'bg-burgundy/10 text-burgundy-deep' },
}

function fmtDate(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState<boolean>(() => !!getAdminToken())

  useEffect(() => {
    document.title = 'Painel · advoc.me'
    // Rota escondida: impede indexação por buscadores mesmo que o link vaze.
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />
  return <Dashboard onLogout={() => { adminLogout(); setAuthed(false) }} />
}

// ---- Login ----

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminLogin(username, password)
      onLogin()
    } catch {
      setError('Usuário ou senha inválidos.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grain flex min-h-dvh items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-ink/10 bg-paper p-6 shadow-card"
      >
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
            <LockIcon width={20} height={20} />
          </span>
          <h1 className="font-display text-lg font-semibold text-ink">Painel de moderação</h1>
          <p className="text-[12px] text-ink-faint">Acesso restrito à equipe advoc.me</p>
        </div>
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink">Usuário</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="mb-3 w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />
        <label className="mb-1.5 block text-[12.5px] font-medium text-ink">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
        />
        {error && (
          <p className="mb-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

// ---- Dashboard ----

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'reports' | 'search' | 'oab'>('reports')
  const TAB_LABEL = { reports: 'Denúncias', search: 'Advogados', oab: 'Conferência OAB' } as const

  return (
    <div className="min-h-dvh bg-paper-deep">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 font-display text-lg font-semibold">
            <ScaleIcon width={20} height={20} className="text-burgundy" />
            Moderação
          </span>
          <button onClick={onLogout} className="text-[13px] font-medium text-ink-faint hover:text-burgundy">
            Sair
          </button>
        </div>
        <div className="mx-auto flex max-w-4xl gap-1 px-4">
          {(['reports', 'search', 'oab'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-3 py-2 text-[13.5px] font-medium transition-colors ${
                tab === t
                  ? 'border-burgundy text-burgundy'
                  : 'border-transparent text-ink-faint hover:text-ink'
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {tab === 'reports' ? <ReportsTab /> : tab === 'search' ? <SearchTab /> : <OabTab />}
      </main>
    </div>
  )
}

// ---- Aba: Denúncias ----

function ReportsTab() {
  const [groups, setGroups] = useState<ReportGroup[] | null>(null)
  const [status, setStatus] = useState<'open' | 'all'>('open')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setError(null)
    try {
      setGroups(await listReports(status))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar denúncias.')
    }
  }

  useEffect(() => {
    setGroups(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['open', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                status === s ? 'bg-burgundy text-paper-soft' : 'bg-ink/[0.06] text-ink-faint hover:bg-ink/10'
              }`}
            >
              {s === 'open' ? 'Abertas' : 'Todas'}
            </button>
          ))}
        </div>
        <button onClick={reload} className="text-[12.5px] font-medium text-ink-faint hover:text-burgundy">
          Atualizar
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
          {error}
        </p>
      )}

      {!groups ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">Carregando…</p>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">Nenhuma denúncia {status === 'open' ? 'aberta' : ''}.</p>
      ) : (
        <ul className="space-y-2.5">
          {groups.map((g) => (
            <li key={g.profile.id} className="overflow-hidden rounded-xl2 border border-ink/10 bg-paper">
              <button
                onClick={() => setSelected(selected === g.profile.id ? null : g.profile.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.02]"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{g.profile.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_META[g.profile.moderationStatus].cls}`}>
                      {STATUS_META[g.profile.moderationStatus].label}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-faint">
                    advoc.me/{g.profile.slug} · {g.profile.oabNumber}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {g.openCount > 0 && (
                    <span className="rounded-full bg-burgundy px-2 py-0.5 text-[11px] font-semibold text-paper-soft">
                      {g.openCount} aberta{g.openCount > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-[11px] text-ink-faint">{g.total} no total</span>
                </span>
              </button>
              {selected === g.profile.id && (
                <ModerationDetail
                  profileId={g.profile.id}
                  onChanged={reload}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const SECTIONS: { key: string; label: string }[] = [
  { key: 'avatar', label: 'Foto' },
  { key: 'headline', label: 'Frase de apresentação' },
  { key: 'bio', label: 'Bio' },
  { key: 'regionNote', label: 'Observação de região' },
  { key: 'areas', label: 'Todas as áreas' },
  { key: 'highlights', label: 'Experiência / destaques' },
  { key: 'socials', label: 'Redes e site' },
]

function ModerationDetail({ profileId, onChanged }: { profileId: string; onChanged: () => void }) {
  const [profile, setProfile] = useState<ModerationProfile | null>(null)
  const [note, setNote] = useState('')
  const [sections, setSections] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const p = await getModerationProfile(profileId)
      setProfile(p)
      setNote(p.moderationNote ?? '')
      try {
        const parsed = JSON.parse(p.hiddenSections || '[]')
        setSections(new Set(Array.isArray(parsed) ? parsed : []))
      } catch {
        setSections(new Set())
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar o perfil.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  function toggle(key: string) {
    setSections((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function apply(action: 'warn' | 'partial' | 'restrict' | 'clear') {
    setBusy(true)
    setError(null)
    try {
      const updated = await moderateProfile(profileId, {
        action,
        note: note.trim() || undefined,
        hiddenSections: action === 'partial' ? Array.from(sections) : undefined,
      })
      setProfile(updated)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao aplicar a moderação.')
    } finally {
      setBusy(false)
    }
  }

  async function dismiss(id: string) {
    setBusy(true)
    try {
      await dismissReport(id)
      await load()
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  if (!profile) {
    return <div className="border-t border-ink/10 px-4 py-4 text-[12.5px] text-ink-faint">Carregando perfil…</div>
  }

  return (
    <div className="border-t border-ink/10 bg-paper-soft/50 px-4 py-4">
      {error && (
        <p className="mb-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
          {error}
        </p>
      )}

      {/* Denúncias */}
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        Denúncias ({profile.reports.length})
      </h3>
      <ul className="mb-5 space-y-2">
        {profile.reports.map((r) => (
          <li key={r.id} className="rounded-lg border border-ink/10 bg-paper p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{REASON_LABEL[r.reason] ?? r.reason}</p>
                {r.details && (
                  <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-soft">{r.details}</p>
                )}
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  {fmtDate(r.createdAt)}
                  {r.reporterEmail ? ` · ${r.reporterEmail}` : ' · anônima'}
                  {r.status !== 'open' ? ` · ${r.status}${r.resolution ? ` (${r.resolution})` : ''}` : ''}
                </p>
              </div>
              {r.status === 'open' && (
                <button
                  onClick={() => dismiss(r.id)}
                  disabled={busy}
                  className="shrink-0 rounded-lg border border-ink/10 px-2 py-1 text-[11.5px] font-medium text-ink-faint transition-colors hover:border-ink/30 hover:text-ink"
                >
                  Arquivar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Conteúdo do perfil (para avaliar) */}
      <ProfileSnapshot profile={profile} />

      {/* Aviso / motivo */}
      <label className="mb-1.5 mt-4 block text-[12.5px] font-medium text-ink">
        Aviso ao titular / motivo da decisão
      </label>
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Texto que o dono do perfil verá no editor (ex.: qual regra foi violada e o que corrigir)."
        className="mb-4 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2.5 text-[13px] focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
      />

      {/* Censura parcial */}
      <p className="mb-2 text-[12.5px] font-medium text-ink">Censurar partes do perfil</p>
      <div className="mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <SectionCheck key={s.key} label={s.label} checked={sections.has(s.key)} onToggle={() => toggle(s.key)} />
        ))}
        {profile.areas.map((a) => (
          <SectionCheck
            key={a.id}
            label={`Área: ${a.label || '—'}`}
            checked={sections.has(`area:${a.id}`) || sections.has('areas')}
            disabled={sections.has('areas')}
            onToggle={() => toggle(`area:${a.id}`)}
          />
        ))}
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => apply('warn')}
          disabled={busy}
          className="rounded-full bg-brass/20 px-4 py-2 text-[13px] font-semibold text-brass-deep transition-colors hover:bg-brass/30 disabled:opacity-50"
        >
          Enviar aviso
        </button>
        <button
          onClick={() => apply('partial')}
          disabled={busy || sections.size === 0}
          className="rounded-full bg-brass/20 px-4 py-2 text-[13px] font-semibold text-brass-deep transition-colors hover:bg-brass/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Censurar selecionadas
        </button>
        <button
          onClick={() => apply('restrict')}
          disabled={busy}
          className="rounded-full bg-burgundy px-4 py-2 text-[13px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep disabled:opacity-50"
        >
          Restringir perfil inteiro
        </button>
        {profile.moderationStatus !== 'active' && (
          <button
            onClick={() => apply('clear')}
            disabled={busy}
            className="rounded-full border border-ink/15 px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
          >
            Remover restrições
          </button>
        )}
      </div>
    </div>
  )
}

function SectionCheck({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
        disabled
          ? 'cursor-not-allowed border-ink/10 text-ink-faint/60'
          : checked
            ? 'cursor-pointer border-burgundy/40 bg-burgundy/[0.05] text-ink'
            : 'cursor-pointer border-ink/10 text-ink-soft hover:border-ink/25'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="h-3.5 w-3.5 accent-burgundy"
      />
      <span className="truncate">{label}</span>
    </label>
  )
}

// Prévia enxuta do conteúdo textual do perfil, para o moderador avaliar.
function ProfileSnapshot({ profile }: { profile: ModerationProfile }) {
  return (
    <details className="rounded-lg border border-ink/10 bg-paper">
      <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-medium text-ink-soft">
        Ver conteúdo do perfil
      </summary>
      <div className="space-y-2 border-t border-ink/10 px-3 py-3 text-[12.5px] text-ink-soft">
        {profile.headline && <p><span className="text-ink-faint">Frase:</span> {profile.headline}</p>}
        {profile.bio && <p><span className="text-ink-faint">Bio:</span> {profile.bio}</p>}
        {profile.areas.length > 0 && (
          <div>
            <span className="text-ink-faint">Áreas:</span>
            <ul className="mt-0.5 list-disc pl-5">
              {profile.areas.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.label}</span>
                  {a.description ? ` — ${a.description}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {profile.highlights.length > 0 && (
          <div>
            <span className="text-ink-faint">Destaques:</span>
            <ul className="mt-0.5 list-disc pl-5">
              {profile.highlights.map((h) => (
                <li key={h.id}>
                  <span className="font-medium">{h.title}</span>
                  {h.detail ? ` — ${h.detail}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {profile.socials.length > 0 && (
          <p><span className="text-ink-faint">Redes:</span> {profile.socials.map((s) => s.url).join(', ')}</p>
        )}
      </div>
    </details>
  )
}

// ---- Aba: Advogados (busca) ----

function SearchTab() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<AdminProfile[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [tick, setTick] = useState(0) // bump para re-buscar após moderar

  useEffect(() => {
    const term = q.trim()
    setError(null)
    if (term.length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      searchProfiles(term)
        .then((r) => setResults(r))
        .catch((e) => setError(e instanceof Error ? e.message : 'Falha na busca.'))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q, tick])

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-full border border-ink/15 bg-paper px-4 py-1 shadow-card focus-within:border-burgundy">
        <SearchIcon width={18} height={18} className="text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, OAB, cidade ou endereço…"
          aria-label="Buscar advogados"
          autoFocus
          className="w-full bg-transparent py-2.5 text-[14px] placeholder:text-ink-faint/60 focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
          {error}
        </p>
      )}

      {q.trim().length < 2 ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">
          Digite ao menos 2 caracteres para buscar.
        </p>
      ) : loading && !results ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">Buscando…</p>
      ) : results && results.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-faint">Nenhum advogado encontrado.</p>
      ) : (
        <ul className="space-y-2.5">
          {(results ?? []).map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl2 border border-ink/10 bg-paper">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  onClick={() => setOpen(open === p.id ? null : p.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-ink">{p.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_META[p.moderationStatus].cls}`}
                    >
                      {STATUS_META[p.moderationStatus].label}
                    </span>
                    {!p.published && (
                      <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-ink-faint">
                        não publicado
                      </span>
                    )}
                    <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-ink-faint uppercase">
                      {p.plan}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-faint">
                    advoc.me/{p.slug} · {p.oabNumber} · {p.city}/{p.state}
                  </span>
                </button>
                <a
                  href={`/${p.slug}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-brass/50 hover:text-brass-deep"
                >
                  Ver perfil
                  <ExternalLinkIcon width={12} height={12} strokeWidth={1.8} />
                </a>
              </div>
              {open === p.id && (
                <ModerationDetail profileId={p.id} onChanged={() => setTick((n) => n + 1)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---- Aba: Conferência OAB ----

function OabTab() {
  const [pending, setPending] = useState<PendingOab[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function reload() {
    setError(null)
    try {
      setPending(await listPendingOab())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar a fila.')
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function decide(id: string, decision: 'verify' | 'reject') {
    setBusy(id)
    try {
      await decideOab(id, decision)
      await reload()
    } finally {
      setBusy(null)
    }
  }

  if (error) {
    return <p className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">{error}</p>
  }
  if (!pending) return <p className="py-10 text-center text-[13px] text-ink-faint">Carregando…</p>
  if (pending.length === 0) return <p className="py-10 text-center text-[13px] text-ink-faint">Nenhuma conferência pendente.</p>

  return (
    <ul className="space-y-2.5">
      {pending.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl2 border border-ink/10 bg-paper px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{p.name}</p>
            <p className="truncate text-[12px] text-ink-faint">{p.oabNumber} · {p.city}/{p.state} · advoc.me/{p.slug}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => decide(p.id, 'verify')}
              disabled={busy === p.id}
              className="inline-flex items-center gap-1 rounded-full bg-brass/20 px-3 py-1.5 text-[12.5px] font-semibold text-brass-deep hover:bg-brass/30 disabled:opacity-50"
            >
              <CheckIcon width={13} height={13} strokeWidth={2.6} /> Conferir
            </button>
            <button
              onClick={() => decide(p.id, 'reject')}
              disabled={busy === p.id}
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-faint hover:border-burgundy/40 hover:text-burgundy disabled:opacity-50"
            >
              <XIcon width={13} height={13} /> Rejeitar
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
