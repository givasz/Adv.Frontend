// Os contadores das filas — o que o menu mostra ao lado de cada seção.
//
// Um lugar só para três perguntas ("quantas denúncias abertas?", "quantas
// contestações aguardando, e quantas vencendo?", "quantos chamados abertos?"),
// porque elas aparecem em três telas — menu, visão geral e cabeçalho de cada
// fila — e três fontes discordariam entre si a cada clique.
//
// O que a tela faz depois de decidir (arquivar, responder, resolver) chama
// `atualizar()`; fora isso, os números se renovam sozinhos a cada minuto.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { contadoresContestacoes, listReports, ticketCounts, type AdminMe } from '@/lib/adminApi'

export interface Contadores {
  /** Perfis com ao menos uma denúncia aberta. */
  denuncias: number
  /** Contestações aguardando resposta da plataforma. */
  contestacoes: number
  /** Das aguardando, quantas vencem em até 2 dias. */
  contestacoesVencendo: number
  /** Chamados abertos (sem resposta). */
  chamados: number
  /** Chamados em análise. */
  chamadosEmAnalise: number
  /** Quando foi a última leitura, para o cabeçalho dizer "atualizado há…". */
  lidoEm: number | null
}

const VAZIO: Contadores = {
  denuncias: 0,
  contestacoes: 0,
  contestacoesVencendo: 0,
  chamados: 0,
  chamadosEmAnalise: 0,
  lidoEm: null,
}

const Ctx = createContext<{ contadores: Contadores; atualizar: () => void }>({
  contadores: VAZIO,
  atualizar: () => {},
})

export function ProvedorDeContadores({ me, children }: { me: AdminMe; children: ReactNode }) {
  const [contadores, setContadores] = useState<Contadores>(VAZIO)
  // Guarda as permissões numa ref: o intervalo não precisa ser recriado quando
  // o objeto `me` muda de identidade sem mudar de conteúdo.
  const permissoes = useRef(me.permissoes)
  permissoes.current = me.permissoes

  const atualizar = useCallback(() => {
    const pode = (p: string) => permissoes.current.includes(p)
    // Cada fonte falha sozinha: um 403 nas denúncias não apaga o número dos
    // chamados. O que não puder ser lido fica em zero, e o menu esconde a seção
    // de qualquer jeito.
    void Promise.all([
      pode('moderacao:ler') ? listReports('open', 0, 1).then((r) => r.total).catch(() => 0) : 0,
      pode('moderacao:ler')
        ? contadoresContestacoes().catch(() => ({ abertas: 0, vencendo: 0 }))
        : { abertas: 0, vencendo: 0 },
      pode('suporte:ler')
        ? ticketCounts().catch(() => ({}) as Record<string, number>)
        : ({} as Record<string, number>),
    ]).then(([denuncias, apelos, chamados]) => {
      setContadores({
        denuncias,
        contestacoes: apelos.abertas,
        contestacoesVencendo: apelos.vencendo,
        chamados: chamados.open ?? 0,
        chamadosEmAnalise: chamados.in_progress ?? 0,
        lidoEm: Date.now(),
      })
    })
  }, [])

  useEffect(() => {
    atualizar()
    const t = setInterval(atualizar, 60_000)
    return () => clearInterval(t)
  }, [atualizar])

  return <Ctx.Provider value={{ contadores, atualizar }}>{children}</Ctx.Provider>
}

export function useContadores() {
  return useContext(Ctx)
}
