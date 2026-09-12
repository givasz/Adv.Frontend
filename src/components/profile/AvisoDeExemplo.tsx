import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { XIcon } from '@/components/ui/icons'

// O aviso que um botão de perfil de EXEMPLO mostra no lugar de sair da página.
//
// Por que existe (e por que não basta o botão não fazer nada): ver lib/exemplo.ts.
//
// É um contexto, e não uma prop, porque os botões que precisam dele estão
// espalhados — ProfileView, CnaLink, o fim da conversa do assistente — e a
// conversa da demonstração é montada num PORTAL (fora do DOM do telefone). Um
// contexto do React atravessa portal; uma prop teria de atravessar quatro
// componentes que não têm nada com isso.
//
// `onde` decide só a geometria:
//   • 'moldura' → preso à caixa do celularzinho da home (quem o monta precisa
//     ser filho do elemento `relative` da moldura — ver PhonePreview);
//   • 'pagina'  → preso à janela, no pé da tela (perfil de exemplo aberto inteiro).

type Avisar = (texto: string) => void

const Contexto = createContext<Avisar | null>(null)

/** O avisador do perfil de exemplo mais próximo — `null` fora de um. */
export function useAvisoDeExemplo(): Avisar | null {
  return useContext(Contexto)
}

/** Quanto o aviso fica na tela. Dá para ler duas linhas sem pressa. */
const DURACAO_MS = 5000

export function AvisoDeExemplo({
  onde,
  children,
}: {
  onde: 'moldura' | 'pagina'
  children: ReactNode
}) {
  const [aviso, setAviso] = useState<{ n: number; texto: string } | null>(null)
  const contador = useRef(0)

  // O contador troca a `key` do cartão: tocar num segundo botão enquanto o
  // primeiro aviso está na tela reinicia a animação e o prazo, em vez de trocar
  // o texto por baixo de quem ainda estava lendo.
  const avisar = useCallback((texto: string) => {
    contador.current += 1
    setAviso({ n: contador.current, texto })
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), DURACAO_MS)
    return () => window.clearTimeout(t)
  }, [aviso])

  const posicao =
    onde === 'moldura'
      ? 'absolute inset-x-3 bottom-3 z-50'
      : 'fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm'

  return (
    <Contexto.Provider value={avisar}>
      {children}
      {/* A região `status` fica SEMPRE no DOM, vazia quando não há aviso: leitor
          de tela só anuncia mudança numa região que já existia antes dela. */}
      <div role="status" aria-live="polite" className={`pointer-events-none ${posicao}`}>
        {aviso && (
          <div
            key={aviso.n}
            className="aviso-exemplo pointer-events-auto flex items-start gap-2.5 rounded-2xl bg-ink px-3.5 py-3 text-left text-paper shadow-lift"
          >
            <span className="mt-[3px] shrink-0 rounded-md bg-burgundy px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-paper">
              Exemplo
            </span>
            <p className="min-w-0 flex-1 text-[12.5px] leading-snug">
              {aviso.texto} Aqui nada sai desta página.
            </p>
            <button
              type="button"
              onClick={() => setAviso(null)}
              aria-label="Fechar o aviso"
              className="-m-1 shrink-0 rounded-full p-1 text-paper/70 transition-colors hover:text-paper"
            >
              <XIcon width={14} height={14} />
            </button>
          </div>
        )}
      </div>
    </Contexto.Provider>
  )
}
