import type { EtapaDoRascunho } from '@/lib/contratos/rascunhos'

export const ETAPAS: { id: EtapaDoRascunho; rotulo: string }[] = [
  { id: 'dados', rotulo: 'Dados' },
  { id: 'revisao', rotulo: 'Revisão' },
  { id: 'registro', rotulo: 'Registro' },
  { id: 'assinatura', rotulo: 'Assinatura' },
]

// A régua das quatro etapas. Cada etapa é um filete que se preenche de latão —
// o mesmo filete do timbre do painel —, e não uma fila de bolinhas numeradas:
// quatro colunas cabem inteiras numa tela de 320px sem esconder rótulo nenhum.
export function Etapas({
  atual,
  alcancaveis,
  onIr,
}: {
  atual: EtapaDoRascunho
  /** etapas para as quais dá para voltar agora */
  alcancaveis: EtapaDoRascunho[]
  onIr: (e: EtapaDoRascunho) => void
}) {
  const indiceAtual = ETAPAS.findIndex((e) => e.id === atual)
  return (
    <nav aria-label="Etapas do documento">
      <ol className="grid grid-cols-4 gap-2">
        {ETAPAS.map((e, i) => {
          const feita = i < indiceAtual
          const corrente = i === indiceAtual
          const pode = !corrente && alcancaveis.includes(e.id)
          const conteudo = (
            <>
              <span
                className={`block h-1 rounded-full transition-colors duration-300 ${
                  corrente ? 'bg-burgundy' : feita ? 'bg-brass' : 'bg-ink/10'
                }`}
                aria-hidden
              />
              <span
                className={`mt-2 block truncate text-[11.5px] font-semibold tracking-wide ${
                  corrente ? 'text-ink' : feita ? 'text-brass-deep' : 'text-ink-faint'
                }`}
              >
                {/* Abaixo de 400px o número sai: quatro colunas de ~76px não
                    cabem "4 · Assinatura", e a posição na régua já diz a ordem. */}
                <span className="hidden tabular-nums min-[400px]:inline">
                  {i + 1}
                  <span aria-hidden> · </span>
                </span>
                {e.rotulo}
              </span>
            </>
          )
          return (
            <li key={e.id} aria-current={corrente ? 'step' : undefined}>
              {pode ? (
                <button
                  type="button"
                  onClick={() => onIr(e.id)}
                  className="block w-full rounded-md py-1 text-left transition-opacity hover:opacity-80"
                >
                  {conteudo}
                </button>
              ) : (
                <span className="block py-1">{conteudo}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
