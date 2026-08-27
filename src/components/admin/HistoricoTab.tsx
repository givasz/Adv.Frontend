// O histórico do painel — quem fez o quê, quando, e por quê.
//
// Existe para os dois lados. Sem ele o advogado não tem como contestar uma
// decisão (não há a quem perguntar o motivo), e quem administra não tem como se
// defender de uma acusação de censura arbitrária. Nenhuma rota da aplicação
// apaga estas linhas.
//
// A leitura é cronológica e o filtro é por tipo de ação, porque a pergunta que
// se faz aqui quase sempre é uma das duas: "o que aconteceu hoje?" ou "o que já
// foi feito com este perfil?".

import { useEffect, useState } from 'react'
import { listarAcoes, type AdminAcao } from '@/lib/adminApi'
import { Aviso, fmtData } from './pecas'

/** Um nome de ação em linguagem de gente. O prefixo é o assunto. */
const NOME: Record<string, string> = {
  'sessao.abrir': 'entrou no painel',
  'moderacao.warn': 'avisou o dono do perfil',
  'moderacao.partial': 'censurou partes do perfil',
  'moderacao.restrict': 'retirou o perfil do ar',
  'moderacao.clear': 'liberou o perfil',
  'moderacao.arquivar-denuncia': 'arquivou uma denúncia',
  'suporte.open': 'reabriu um chamado',
  'suporte.in_progress': 'assumiu um chamado',
  'suporte.resolved': 'resolveu um chamado',
  'admin.criar': 'criou um acesso ao painel',
  'admin.editar': 'mudou o papel de alguém',
  'admin.desativar': 'desligou um acesso',
  'admin.reativar': 'reativou um acesso',
  'admin.derrubar-sessoes': 'derrubou as sessões de alguém',
  'admin.trocar-senha': 'trocou a própria senha',
  'admin.totp-ligar': 'ligou o segundo fator',
  'admin.totp-desligar': 'desligou o segundo fator',
}

/** As ações que TIRAM alguma coisa do ar merecem destaque na lista. */
const GRAVE = new Set(['moderacao.restrict', 'moderacao.partial', 'admin.desativar'])

const FILTROS = [
  { id: '', label: 'Tudo' },
  { id: 'moderacao', label: 'Moderação' },
  { id: 'suporte', label: 'Suporte' },
  // "Acessos" e não "Equipe": a aba do painel já se chama Equipe, e dois
  // controles com o mesmo nome na mesma tela confundem quem navega por teclado
  // ou leitor de tela tanto quanto confundiram o teste de fumaça.
  { id: 'admin', label: 'Acessos' },
  { id: 'sessao', label: 'Entradas' },
] as const

export default function HistoricoTab() {
  const [acoes, setAcoes] = useState<AdminAcao[] | null>(null)
  const [filtro, setFiltro] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setAcoes(null)
    setErro(null)
    void listarAcoes({ action: filtro || undefined, limite: 200 })
      .then((r) => vivo && setAcoes(r))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : 'Falha ao carregar.'))
    return () => {
      vivo = false
    }
  }, [filtro])

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              filtro === f.id
                ? 'bg-burgundy text-paper-soft'
                : 'border border-ink/15 text-ink-faint hover:border-ink/40 hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {!acoes && !erro && <p className="text-[13px] text-ink-faint">Carregando…</p>}
      {acoes?.length === 0 && (
        <p className="rounded-xl2 border border-dashed border-ink/15 px-4 py-8 text-center text-[13px] text-ink-faint">
          Nada registrado ainda neste recorte.
        </p>
      )}

      <ol className="divide-y divide-ink/10 overflow-hidden rounded-xl2 border border-ink/10 bg-paper">
        {acoes?.map((a) => (
          <li key={a.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[13.5px] font-semibold text-ink">{a.adminLabel}</span>
              <span
                className={`text-[13.5px] ${GRAVE.has(a.action) ? 'font-semibold text-burgundy-deep' : 'text-ink-soft'}`}
              >
                {NOME[a.action] ?? a.action}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[11.5px] text-ink-faint">
                {fmtData(a.createdAt)}
              </span>
            </div>
            {a.reason && <p className="mt-1 text-[12.5px] text-ink-soft">“{a.reason}”</p>}
            {(a.targetType || a.after) && (
              <p className="mt-1 truncate font-mono text-[11px] text-ink-faint">
                {a.targetType}
                {a.targetId ? ` ${a.targetId}` : ''}
                {a.after ? ` · ${a.after}` : ''}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
