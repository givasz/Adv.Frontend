import { useNavigate } from 'react-router-dom'
import { ShareIcon } from '@/components/ui/icons'

// Botão "Compartilhar" no alto do perfil.
//
// Quando o navegador tem compartilhamento nativo (celular), é ele que abre — é o
// caminho que a pessoa conhece. Quando não tem (desktop), vai para a PÁGINA de
// compartilhamento (/:slug/compartilhar), que antes era um painel sobreposto.
//
// ESTÁTICO, não fixo (13/09/2026). Ele flutuava preso à janela e, conforme a
// página rolava, cobria o que passasse pelo canto: a linha "número informado
// pelo próprio profissional", um título de área, o rodapé. Compartilhar é um
// gesto de quem chegou e gostou — não precisa perseguir a rolagem. Agora ele
// mora no alto e vai embora junto com o conteúdo.
//
// `-mb-10` é a conta que faz ele custar só 12 px de altura: o contêiner tem
// 52 px (12 de respiro + 40 do botão), o negativo devolve 40, e o perfil abaixo
// começa exatamente na borda inferior do botão — nenhum cabeçalho de tema
// (centralizado, timbre ou à esquerda) passa por baixo dele. `z-20` porque o
// perfil que vem depois é `position: relative` com fundo próprio, e sem camada
// o botão ficaria coberto pela faixa em que os dois se sobrepõem.
export function ShareBar({
  slug,
  name,
  vars,
}: {
  slug: string
  name: string
  /**
   * As variáveis do perfil (profileVars): o respiro de 12 px acima do botão é
   * pintado com o `--c-bg` do tema, senão sobra um filete da cor do app entre a
   * barra do topo e o fundo do perfil — num tema escuro, uma linha bege.
   */
  vars: React.CSSProperties
}) {
  const navigate = useNavigate()
  const url = `${window.location.origin}/${slug}`

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} · advoc.me`, url })
        return
      } catch (e) {
        // Fechar a folha do sistema é resposta, não falha: a pessoa desistiu, e
        // levá-la a outra página ignoraria o gesto. Só a RECUSA do navegador (sem
        // permissão, sem suporte ao que foi pedido) cai para a página.
        if ((e as { name?: string } | null)?.name === 'AbortError') return
      }
    }
    navigate(`/${slug}/compartilhar`)
  }

  return (
    <div
      className="relative z-20 -mb-10 flex justify-end px-4 pt-3"
      style={{ ...vars, background: 'var(--c-bg)' }}
    >
      <button
        type="button"
        onClick={share}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/10 bg-paper-soft/80 px-4 text-sm font-medium text-ink shadow-card backdrop-blur transition-colors hover:border-brass/50"
        aria-label="Compartilhar perfil"
      >
        {/* O `gap-1.5` da classe já esperava por este ícone. `aria-hidden` porque o
            botão já se anuncia pelo aria-label — o ícone repetiria a mesma palavra
            para quem usa leitor de tela.

            `text-burgundy` (paleta do APP) e não `t-accent` (paleta do TEMA): este
            botão é montado FORA do ProfileView, então `--c-accent` não existe aqui
            e `t-accent` cairia no valor de reserva — que hoje é o mesmo burgundy,
            por coincidência. Todo o resto do botão (fundo, borda, texto) também é
            do app: ele fica SOBRE o perfil, não faz parte dele. */}
        <ShareIcon width={16} height={16} className="text-burgundy" aria-hidden />
        Compartilhar
      </button>
    </div>
  )
}
