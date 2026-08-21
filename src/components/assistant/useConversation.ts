import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { sleep } from './pieces'

// Motor da conversa guiada: quem fala, quando, e o "digitando…" no meio. É a parte
// que o perfil e o escritório têm exatamente igual — o que muda entre os dois é o
// ROTEIRO, que fica em cada componente.
//
// Nada aqui interpreta texto: o assistente só empurra falas fixas e registra as
// escolhas do visitante. Não é IA, e não pode virar (Prov. 205/2021 — resposta
// automática a dúvida jurídica é consulta, não publicidade).

export interface Msg {
  id: number
  from: 'bot' | 'user'
  text: string
}

export function useConversation({ pace = 1 }: { pace?: number } = {}) {
  const reduced = !!useReducedMotion()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  // Cada "geração" invalida os temporizadores da anterior — evita mensagens fantasma
  // ao recomeçar a conversa ou ao desmontar o componente.
  const genRef = useRef(0)

  const push = useCallback((from: Msg['from'], text: string) => {
    idRef.current += 1
    setMsgs((m) => [...m, { id: idRef.current, from, text }])
  }, [])

  // Fala do assistente: uma linha por vez, com "digitando…" proporcional ao tamanho
  // do texto. Em prefers-reduced-motion, tudo aparece imediatamente.
  const say = useCallback(
    async (lines: string[], onEnd?: () => void) => {
      const gen = genRef.current
      for (const line of lines) {
        if (!reduced) {
          setTyping(true)
          // "digitando…" proporcional ao tamanho da fala, com teto — uma frase
          // longa não pode virar uma espera interminável.
          await sleep(Math.min(1100, 380 + line.length * 11) * pace)
          if (genRef.current !== gen) return
          setTyping(false)
        }
        push('bot', line)
        // Respiro entre falas: sem ele, duas mensagens seguidas aparecem coladas
        // e o olho não acompanha que são duas.
        if (!reduced) await sleep(140 * pace)
        if (genRef.current !== gen) return
      }
      onEnd?.()
    },
    [push, reduced, pace],
  )

  /** Zera a conversa e invalida o que a geração anterior ainda ia dizer. */
  const reset = useCallback(() => {
    genRef.current += 1
    setTyping(false)
    setMsgs([])
  }, [])

  // Desmontou no meio de uma fala: nada mais deve chegar.
  useEffect(
    () => () => {
      genRef.current += 1
    },
    [],
  )

  return { msgs, typing, push, say, reset, reduced, listRef }
}

/**
 * Mantém a conversa colada no fim, como em qualquer mensageiro. Além da mensagem
 * nova, a própria área de resposta muda de altura (chips ↔ campo de texto) e encolhe
 * a lista DEPOIS do quadro seguinte — daí o ResizeObserver, que re-ancora no fim.
 */
export function usePinnedToBottom(
  listRef: React.RefObject<HTMLDivElement | null>,
  deps: unknown[],
) {
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const pin = () => {
      el.scrollTop = el.scrollHeight
    }
    const id = requestAnimationFrame(pin)
    const ro = new ResizeObserver(pin)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
