// O histórico do console — quem fez o quê, quando, e por quê.
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
import { Aviso, Cartao, Carregando, Chip, Segmentos, Tabela, Td, Th, TituloDaPagina, Vazio, fmtData, type Tom } from './pecas'
import { RodapeTrilha } from './Paginacao'
import { SECOES } from './Console'

/** Um nome de ação em linguagem de gente. O prefixo é o assunto. */
export const NOME_ACAO: Record<string, string> = {
  'sessao.abrir': 'entrou no console',
  'moderacao.warn': 'avisou o dono do perfil',
  'moderacao.partial': 'ocultou seções do perfil',
  'moderacao.restrict': 'retirou o perfil do ar',
  'moderacao.clear': 'liberou o perfil',
  'moderacao.arquivar-denuncia': 'arquivou uma denúncia',
  'suporte.open': 'reabriu um chamado',
  'suporte.in_progress': 'assumiu um chamado',
  'suporte.resolved': 'resolveu um chamado',
  'admin.criar': 'criou um acesso ao console',
  'admin.editar': 'mudou o papel de alguém',
  'admin.desativar': 'desligou um acesso',
  'admin.reativar': 'reativou um acesso',
  'admin.derrubar-sessoes': 'derrubou as sessões de alguém',
  'admin.trocar-senha': 'trocou a própria senha',
  'admin.totp-ligar': 'ligou o segundo fator',
  'admin.totp-desligar': 'desligou o segundo fator',
}

/** As ações que TIRAM alguma coisa do ar merecem destaque na lista. */
export const ACAO_GRAVE = new Set(['moderacao.restrict', 'moderacao.partial', 'admin.desativar'])

const ASSUNTO: Record<string, { label: string; tom: Tom }> = {
  moderacao: { label: 'Moderação', tom: 'aviso' },
  suporte: { label: 'Suporte', tom: 'info' },
  admin: { label: 'Acessos', tom: 'acento' },
  sessao: { label: 'Entrada', tom: 'neutro' },
}

const FILTROS = [
  { id: '', label: 'Tudo' },
  { id: 'moderacao', label: 'Moderação' },
  { id: 'suporte', label: 'Suporte' },
  // "Acessos" e não "Equipe": a seção do console já se chama Equipe, e dois
  // controles com o mesmo nome na mesma tela confundem quem navega por teclado
  // ou leitor de tela tanto quanto confundiram o teste de fumaça.
  { id: 'admin', label: 'Acessos' },
  { id: 'sessao', label: 'Entradas' },
] as const

export function assuntoDe(action: string) {
  return ASSUNTO[action.split('.')[0]] ?? { label: action, tom: 'neutro' as Tom }
}

export default function HistoricoTab() {
  const [acoes, setAcoes] = useState<AdminAcao[] | null>(null)
  const [filtro, setFiltro] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [proximo, setProximo] = useState<string | null>(null)
  const [temMais, setTemMais] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const secao = SECOES.find((s) => s.id === 'historico')!

  // Trocar de filtro recomeça a trilha do topo — o cursor da anterior não vale
  // nada num recorte diferente.
  useEffect(() => {
    let vivo = true
    setAcoes(null)
    setErro(null)
    void listarAcoes({ action: filtro || undefined, limite: 50 })
      .then((r) => {
        if (!vivo) return
        setAcoes(r.itens)
        setProximo(r.proximo)
        setTemMais(r.temMais)
      })
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : 'Falha ao carregar.'))
    return () => {
      vivo = false
    }
  }, [filtro])

  async function mais() {
    if (!proximo || carregando) return
    setCarregando(true)
    try {
      const r = await listarAcoes({ action: filtro || undefined, limite: 50, cursor: proximo })
      setAcoes((atual) => [...(atual ?? []), ...r.itens])
      setProximo(r.proximo)
      setTemMais(r.temMais)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar mais.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div>
      <TituloDaPagina titulo={secao.label} descricao={secao.descricao} />

      <Cartao
        semPreenchimento
        titulo="Trilha"
        acoes={<Segmentos rotulo="Assunto do histórico" opcoes={FILTROS} valor={filtro} onChange={setFiltro} />}
      >
        {erro && (
          <div className="px-4 pt-4">
            <Aviso>{erro}</Aviso>
          </div>
        )}
        {!acoes && !erro && (
          <div className="px-4">
            <Carregando />
          </div>
        )}
        {acoes?.length === 0 && (
          <div className="p-4">
            <Vazio>Nada registrado ainda neste recorte.</Vazio>
          </div>
        )}

        {acoes && acoes.length > 0 && (
          <Tabela minima="md:min-w-[720px]">
            <thead>
              <tr>
                <Th largura="9.5rem">Quando</Th>
                <Th largura="7rem" oculta>
                  Assunto
                </Th>
                <Th>O que aconteceu</Th>
                <Th largura="16rem" oculta>
                  Alvo
                </Th>
              </tr>
            </thead>
            <tbody>
              {acoes.map((a) => {
                const assunto = assuntoDe(a.action)
                const grave = ACAO_GRAVE.has(a.action)
                return (
                  <tr key={a.id} className="hover:bg-adm-raised">
                    <Td className="whitespace-nowrap text-[12px] tabular-nums text-adm-muted">{fmtData(a.createdAt)}</Td>
                    <Td oculta>
                      <Chip tom={assunto.tom}>{assunto.label}</Chip>
                    </Td>
                    <Td>
                      <span className="font-medium text-adm-ink">{a.adminLabel}</span>{' '}
                      <span className={grave ? 'font-semibold text-adm-danger' : 'text-adm-soft'}>
                        {NOME_ACAO[a.action] ?? a.action}
                      </span>
                      {a.reason && (
                        <span className="mt-1 block border-l-2 border-adm-line pl-2 text-[12.5px] leading-relaxed text-adm-muted">
                          “{a.reason}”
                        </span>
                      )}
                    </Td>
                    <Td className="font-mono text-[11px] text-adm-muted" oculta>
                      {a.targetType || a.after ? (
                        <span className="block truncate" title={`${a.targetType} ${a.targetId} ${a.after}`.trim()}>
                          {a.targetType}
                          {a.targetId ? ` ${a.targetId}` : ''}
                          {a.after ? ` · ${a.after}` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        )}

        <RodapeTrilha
          mostrando={acoes?.length ?? 0}
          temMais={temMais}
          carregando={carregando}
          onMais={() => void mais()}
        />
      </Cartao>
    </div>
  )
}
