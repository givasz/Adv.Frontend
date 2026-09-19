import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useRespostasNovas } from '@/lib/support'

// Widget de conta para a barra de navegação. Deslogado: link "Entrar" (leva à
// página /entrar, voltando à página atual). Logado: nome + menu com o painel, o
// perfil público, suporte, dados e "Sair".
//
// "Meu painel" e "Ver meu perfil" entraram aqui porque o nome no canto é onde
// a pessoa clica para "ir para as minhas coisas" — e da home, com o botão
// principal levando ao painel, o perfil público ficava sem porta.
export function AccountMenu({
  compact = false,
  supportTo,
  perfilTo,
  painel = false,
  avatarUrl,
}: {
  compact?: boolean
  /** destino do item "Falar com o suporte" (página, já com o caminho de volta); sem ele, o item não aparece */
  supportTo?: string
  /** endereço do perfil público ("/joao-silva") — abre em nova aba; sem ele, o item não aparece */
  perfilTo?: string
  /** mostra "Meu painel" (não faz sentido dentro do próprio painel) */
  painel?: boolean
  /**
   * A foto do perfil, no lugar da inicial do nome.
   *
   * A sessão (/auth/me) não carrega a foto — ela é um data URI de até algumas
   * centenas de KB, e /auth/me é a primeira coisa que toda página pede. Quem
   * tem o perfil em mãos (painel, editor, home via useMyProfileLink) passa a
   * foto por aqui; quem não tem, fica na inicial. Até 13/09/2026 era SEMPRE a
   * inicial, mesmo com foto no perfil — "aparece só o G".
   */
  avatarUrl?: string
}) {
  const { user, isAuthed, logout } = useAuth()
  const [open, setOpen] = useState(false)
  // Foto que não carregou (endereço externo fora do ar, data URI corrompido):
  // volta para a inicial em vez de deixar um círculo vazio no canto.
  const [fotoQuebrada, setFotoQuebrada] = useState(false)
  const location = useLocation()
  // Resposta do suporte que a pessoa ainda não viu: ponto no botão e o item do
  // menu passa a levar direto à aba de respostas. Só consulta onde o item existe.
  const novas = useRespostasNovas(isAuthed && !!supportTo)

  if (!isAuthed || !user) {
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
  const foto = avatarUrl && !fotoQuebrada ? avatarUrl : undefined

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-2 rounded-full border border-ink/12 bg-paper py-1 pl-1 pr-3 transition-colors hover:border-burgundy/40"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {novas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-burgundy">
            <span className="sr-only">{novas === 1 ? 'Uma resposta nova do suporte' : `${novas} respostas novas do suporte`}</span>
          </span>
        )}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-burgundy/10 text-[13px] font-semibold text-burgundy">
          {foto ? (
            // alt vazio: o nome já está escrito ao lado; repetir seria ruído
            // para quem usa leitor de tela.
            <img
              src={foto}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setFotoQuebrada(true)}
            />
          ) : (
            initial
          )}
        </span>
        <span className="max-w-[120px] truncate text-[13px] font-medium text-ink">{shortName}</span>
      </button>

      {open && (
        <>
          {/* clique fora fecha. z-40/z-50 e não z-10/z-20: na home o menu abria ATRÁS
              do telefone da demonstração — a etiqueta "Exemplo" (z-30) e o entalhe
              (z-20, depois no DOM) cobriam "Meu painel". A barra da home não cria
              contexto próprio, então o menu disputa com a página inteira e precisa
              estar acima de tudo que não é sobreposição de verdade (13/09/2026). */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl2 border border-ink/10 bg-paper shadow-lift"
          >
            <div className="border-b border-ink/10 px-3.5 py-2.5">
              <p className="truncate text-[13px] font-medium text-ink">{user.name || shortName}</p>
              <p className="truncate text-[11.5px] text-ink-faint">{user.email}</p>
            </div>
            {painel && (
              <Link
                to="/painel"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block w-full border-b border-ink/[0.07] px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-burgundy"
              >
                Meu painel
              </Link>
            )}
            {perfilTo && (
              <Link
                to={perfilTo}
                target="_blank"
                rel="noreferrer noopener"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block w-full border-b border-ink/[0.07] px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-burgundy"
              >
                Ver meu perfil
              </Link>
            )}
            {supportTo && (
              <Link
                to={novas > 0 ? `${supportTo}${supportTo.includes('?') ? '&' : '?'}aba=respostas` : supportTo}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between gap-2 border-b border-ink/[0.07] px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-burgundy"
              >
                {novas > 0 ? 'Resposta do suporte' : 'Falar com o suporte'}
                {novas > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-burgundy px-1.5 text-[11px] font-bold tabular-nums text-paper">
                    {novas}
                  </span>
                )}
              </Link>
            )}
            <Link
              to={`/conta/dados?voltar=${encodeURIComponent(location.pathname + location.search)}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block w-full border-b border-ink/[0.07] px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-burgundy"
            >
              Seus dados
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                void logout()
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
