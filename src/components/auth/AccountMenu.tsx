import { useState } from 'react'
import { useAuth } from '@/lib/auth'

// Widget de conta para a barra de navegação. Logado: e-mail + menu com "Sair".
// NOTA: login por e-mail desligado na fase de teste — o link "Entrar" (deslogado)
// está oculto por enquanto. Reativar quando o auth voltar (ver App.tsx).
export function AccountMenu({ compact: _compact = false }: { compact?: boolean }) {
  const { user, isAuthed, logout } = useAuth()
  const [open, setOpen] = useState(false)

  // Enquanto o login está desligado, nada é exibido para o visitante deslogado.
  if (!isAuthed || !user) return null

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
