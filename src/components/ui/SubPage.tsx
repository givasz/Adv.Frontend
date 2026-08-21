import { useEffect, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ScaleIcon } from '@/components/ui/icons'

// Esqueleto das PÁGINAS que substituíram os modais do app.
//
// Por que sair dos modais: janela sobreposta quebra o que o navegador já resolve
// sozinho — o botão voltar, o endereço que dá para compartilhar, a rolagem da
// página por baixo, o teclado do celular empurrando o conteúdo, o foco preso.
// Cada tela agora é um endereço de verdade: voltar volta, recarregar não perde a
// tela, e no celular ela ocupa a largura inteira em vez de uma folha espremida.
//
// Como a volta funciona: quem abre a página manda `?voltar=<caminho>`. Sem isso,
// usa o `fallback` de quem renderiza. O botão nunca fica sem destino.

/**
 * Valida o destino de volta. Só caminho INTERNO: um `?voltar=https://...` (ou
 * `//outro.site`) transformaria estas páginas em trampolim de redirecionamento
 * para fora — é o tipo de brecha que se abre sem querer ao trocar modal por rota.
 *
 * A barra invertida conta junto com a barra dupla: o navegador lê `/\outro.site`
 * como o mesmo endereço externo que `//outro.site`, e checar só a barra dupla
 * deixava a porta aberta — é a mesma variação publicada como falha do próprio
 * react-router. Caractere de controle (quebra de linha, tabulação) também é
 * recusado: serve para contrabandear um segundo destino no meio do caminho.
 */
export function caminhoDeVolta(raw: string | null | undefined, fallback: string): string {
  const destino = (raw ?? '').trim()
  if (!destino.startsWith('/')) return fallback
  if (/^\/[/\\]/.test(destino)) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(destino)) return fallback
  return destino
}

/** Lê o destino de volta da URL (`?voltar=`), com um destino de reserva. */
export function useVoltar(fallback: string): string {
  const [params] = useSearchParams()
  return caminhoDeVolta(params.get('voltar'), fallback)
}

/** Monta a URL de uma subpágina já com o caminho de volta embutido. */
export function comVolta(to: string, voltar: string): string {
  const sep = to.includes('?') ? '&' : '?'
  return `${to}${sep}voltar=${encodeURIComponent(voltar)}`
}

export function SubPage({
  title,
  subtitle,
  icon,
  backTo,
  backLabel = 'Voltar',
  documentTitle,
  wide = false,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  /** marca do assunto da página (a mesma do botão que trouxe a pessoa até aqui) */
  icon?: ReactNode
  backTo: string
  backLabel?: string
  /** título da aba; sem ele, usa o título da página */
  documentTitle?: string
  /** conteúdo mais largo (comparações, planos) */
  wide?: boolean
  children: ReactNode
  /** ações fixas no rodapé (enviar, confirmar) — no celular ficam ao alcance do polegar */
  footer?: ReactNode
}) {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = `${documentTitle ?? title} · advoc.me`
  }, [documentTitle, title])

  // Esc continua fechando, como no modal: o gesto já estava no dedo de quem usa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(backTo)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [backTo, navigate])

  return (
    <div className="grain flex min-h-dvh flex-col overflow-x-hidden bg-paper-deep">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className={`mx-auto flex w-full items-center gap-3 px-4 py-3 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
          {/* Alvo de 40px: é o botão mais clicado destas páginas no celular. */}
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-ink/[0.05] hover:text-burgundy"
          >
            <ArrowRight width={15} height={15} className="rotate-180" aria-hidden />
            {backLabel}
          </button>
          <span className="ml-auto flex items-center gap-1.5 text-[13px] font-semibold text-ink-faint">
            <ScaleIcon width={16} height={16} className="text-burgundy/70" aria-hidden />
            advoc.me
          </span>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-5 pb-10 pt-6 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className="flex items-start gap-3">
          {icon && (
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl2 bg-burgundy/10 text-burgundy">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-[24px] font-semibold leading-tight text-ink">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">{children}</div>
      </main>

      {footer && (
        // Barra de ação colada embaixo: no celular o botão principal fica sempre
        // ao alcance, sem depender de rolar até o fim do formulário.
        <div className="sticky bottom-0 z-10 border-t border-ink/10 bg-paper/90 backdrop-blur">
          <div
            className={`mx-auto flex w-full items-center justify-end gap-2 px-5 py-3 ${
              wide ? 'max-w-4xl' : 'max-w-2xl'
            }`}
          >
            {footer}
          </div>
        </div>
      )}
    </div>
  )
}
