import type { AchadoNaPergunta } from '@/lib/triagemDados'
import { InfoIcon, LockIcon } from '@/components/ui/icons'

/**
 * O que uma pergunta de triagem está pedindo — e o que fazer a respeito.
 *
 * Irmão do `CampoUnico` e do `MarginNotes`: os três são a mesma ideia, que é a
 * regra do editor inteiro — avisar sem bloquear, explicar o motivo e deixar a
 * correção a um toque. Um aviso que só aponta o erro não corrige o campo, faz
 * desistir dele.
 *
 * Duas alturas, e a diferença é visível:
 *   • AVISO (âmbar) — "para a triagem inicial, prefira X". Grava do mesmo jeito;
 *     quem decide se aquele dado é mesmo necessário é o advogado, que conhece o
 *     próprio escritório. A plataforma não sabe, e não finge saber.
 *   • BLOQUEIO (vinho, com cadeado) — senha, código, cartão e conta bancária. O
 *     servidor recusa gravar, e a tela diz isso ANTES de a pessoa tentar salvar.
 *
 * A regra mora em lib/triagemDados.ts, espelhada no servidor. Aqui só o desenho.
 */
export function AvisoDaPergunta({
  achados,
  onUsarSugestao,
}: {
  achados: AchadoNaPergunta[]
  /** troca o enunciado pela reescrita sugerida */
  onUsarSugestao: (texto: string) => void
}) {
  if (!achados.length) return null
  return (
    <div className="mt-1.5 space-y-1.5">
      {achados.map((a) => {
        const trava = a.risco === 'bloqueio'
        return (
          <div
            key={`${a.tipo}-${a.risco}`}
            className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
              trava
                ? 'border-burgundy/40 bg-burgundy/[0.06]'
                : 'border-brass/40 bg-brass/[0.08]'
            }`}
          >
            <span className="flex min-w-0 flex-1 items-start gap-2 text-[12px] leading-relaxed text-ink-soft">
              {trava ? (
                <LockIcon width={14} height={14} className="mt-0.5 shrink-0 text-burgundy" />
              ) : (
                <InfoIcon width={14} height={14} className="mt-0.5 shrink-0 text-brass-deep" />
              )}
              <span>
                <span className={`font-semibold ${trava ? 'text-burgundy-deep' : 'text-brass-deep'}`}>
                  {trava ? 'Esta pergunta não pode ser publicada.' : 'Esta pergunta pede um dado pessoal.'}
                </span>{' '}
                {a.motivo}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onUsarSugestao(a.sugestao)}
              className={`shrink-0 self-start rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors sm:self-center ${
                trava
                  ? 'border-burgundy/50 text-burgundy-deep hover:bg-burgundy/10'
                  : 'border-brass/50 text-brass-deep hover:bg-brass/15'
              }`}
            >
              Usar a sugestão
            </button>
          </div>
        )
      })}
    </div>
  )
}
