import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

// Widget de conta para a barra de navegação. Deslogado: link "Entrar" (leva à
// página /entrar). Logado: e-mail + menu com "Sair". Sem modal.
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, isAuthed, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  if (!isAuthed || !user) {
    // Volta para a página atual após entrar.
    const next = encodeURIComponent(location.pathname + location.search)
    return (
      <Link
        to={`/entrar?next=${next}`}
        className={`font-medium text-ink-soft transition-colors hover:text-ink ${
          compact ? 'text-[13px]' : 'text-sm'
        }`}
      >
        Entrar
      </Link>
    )
  }

  const shortName = user.name?.split(' ')[0] || user.email.split('@')[0]
  const initial = (user.name || user.email).charAt(0).toUpperCase()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-ink/12 bg-paper py-1 pl-1 pr-3 transition-colors hover:border-burgundy/40"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-burgundy/10 text-[13px] font-semibold text-burgundy">
          {initial}
        </span>
        <span className="max-w-[120px] truncate text-[13px] font-medium text-ink">{shortName}</span>
      </button>

      {open && (
        <>
          {/* clique fora fecha */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl2 border border-ink/10 bg-paper shadow-lift"
          >
            <div className="border-b border-ink/10 px-3.5 py-2.5">
              <p className="truncate text-[13px] font-medium text-ink">{user.name || shortName}</p>
              <p className="truncate text-[11.5px] text-ink-faint">{user.email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                logout()
              }}
              className="block w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-burgundy"
            >
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  )
}
