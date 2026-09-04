import type { ProblemaDeCampo } from '@/lib/campoUnico'

/**
 * Aviso + conserto de um campo que está carregando MAIS DE UM ASSUNTO — duas
 * áreas num rótulo, duas perguntas numa pergunta. A regra mora em
 * lib/campoUnico.ts; aqui só o desenho.
 *
 * Irmão do `OverLimit` do editor, e de propósito: são os dois casos em que a tela
 * precisa dizer "assim não dá" sem deixar a pessoa na mão. O botão faz o corte
 * que ela faria à mão, e o texto explica o motivo em vez de só apontar o erro —
 * um bloqueio sem saída não corrige o campo, faz desistir dele.
 *
 * Arquivo próprio, e não uma função dentro de Editor.tsx: o FaqCard também usa
 * este aviso, e um componente importando de uma PÁGINA fecha um ciclo
 * (Editor → FaqCard → Editor). Ciclo entre página lazy e componente é como nasce
 * tela branca em produção — o histórico do React #310 deste projeto é esse.
 */
export function CampoUnico({
  problema,
  onFix,
  rotuloDoBotao,
}: {
  problema: ProblemaDeCampo | null
  onFix: (v: string) => void
  rotuloDoBotao: string
}) {
  if (!problema) return null
  return (
    // No celular o botão desce para a linha de baixo. Lado a lado num campo
    // estreito, a explicação virava uma coluna de três palavras por linha e o
    // botão um retângulo alto espremido no canto — o aviso deixava de ser lido
    // justamente por parecer difícil.
    <div className="mt-1.5 flex flex-col gap-2 rounded-lg border border-brass/40 bg-brass/[0.08] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-soft">
        {problema.motivo}
      </span>
      <button
        type="button"
        onClick={() => onFix(problema.sugestao)}
        className="shrink-0 self-start rounded-full border border-brass/50 px-3 py-1.5 text-[12px] font-semibold text-brass-deep transition-colors hover:bg-brass/15 sm:self-center"
      >
        {rotuloDoBotao}
      </button>
    </div>
  )
}
