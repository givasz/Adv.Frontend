// A visão geral — a primeira tela depois de entrar.
//
// Responde a duas perguntas, nesta ordem: **quem está esperando por nós?** (as
// filas, com os números e o atalho para cada uma) e **como a plataforma está
// hoje?** (o retrato dos levantamentos). Depois, a atividade recente do próprio
// console, para quem chega e quer saber o que os outros já fizeram.
//
// Cada bloco só aparece para quem tem a permissão de ler a fonte dele; o
// servidor recusaria de qualquer jeito, mas uma ficha com "erro 403" no meio da
// primeira tela é o pior cartão de visita possível.

import { useEffect, useState } from 'react'
import { carregarLevantamentos, listarAcoes, type AdminAcao, type AdminMe, type Levantamentos } from '@/lib/adminApi'
import { ArrowRight } from '@/components/ui/icons'
import { Botao, Cartao, Carregando, Chip, Rotulo, TituloDaPagina, Vazio, fmtRelativo } from './pecas'
import { Ficha } from './graficos'
import { useContadores } from './contadores'
import type { SecaoId } from './Console'
import { ACAO_GRAVE, NOME_ACAO, assuntoDe } from './HistoricoTab'

export default function VisaoGeral({ me, onIr }: { me: AdminMe; onIr: (s: SecaoId) => void }) {
  const { contadores, atualizar } = useContadores()
  const pode = (p: string) => me.permissoes.includes(p)

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = me.name.split(/\s+/)[0]

  const temFila = pode('moderacao:ler') || pode('suporte:ler')
  const esperando = contadores.denuncias + contadores.contestacoes + contadores.chamados

  return (
    <div>
      <TituloDaPagina
        titulo={`${saudacao}, ${primeiroNome}.`}
        descricao={
          temFila
            ? esperando === 0
              ? 'Nenhuma fila com gente esperando. Bom momento para os números.'
              : `${esperando} ${esperando === 1 ? 'item espera' : 'itens esperam'} resposta nas filas.`
            : 'Seu papel consulta o console. As filas ficam com a moderação e o suporte.'
        }
        acoes={
          <Botao tamanho="sm" onClick={atualizar}>
            Atualizar
          </Botao>
        }
      />

      {temFila && (
        <section className="mb-5">
          <Rotulo>Filas</Rotulo>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {pode('moderacao:ler') && (
              <Ficha
                rotulo="Denúncias abertas"
                valor={contadores.denuncias}
                tom={contadores.denuncias > 0 ? 'perigo' : undefined}
                nota={contadores.denuncias > 0 ? 'perfis com denúncia sem decisão' : 'fila limpa'}
                onClick={() => onIr('denuncias')}
              />
            )}
            {pode('moderacao:ler') && (
              <Ficha
                rotulo="Contestações"
                valor={contadores.contestacoes}
                tom={contadores.contestacoesVencendo > 0 ? 'perigo' : contadores.contestacoes > 0 ? 'aviso' : undefined}
                nota={
                  contadores.contestacoesVencendo > 0
                    ? `${contadores.contestacoesVencendo} vence${contadores.contestacoesVencendo > 1 ? 'm' : ''} em até 2 dias`
                    : contadores.contestacoes > 0
                      ? 'aguardando resposta'
                      : 'nenhuma aguardando'
                }
                onClick={() => onIr('contestacoes')}
              />
            )}
            {pode('suporte:ler') && (
              <Ficha
                rotulo="Chamados abertos"
                valor={contadores.chamados}
                tom={contadores.chamados > 0 ? 'acento' : undefined}
                nota={contadores.chamados > 0 ? 'sem resposta ainda' : 'nenhum sem resposta'}
                onClick={() => onIr('suporte')}
              />
            )}
            {pode('suporte:ler') && (
              <Ficha
                rotulo="Em análise"
                valor={contadores.chamadosEmAnalise}
                nota="chamados assumidos e não resolvidos"
                onClick={() => onIr('suporte')}
              />
            )}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {pode('metricas:ler') && <Plataforma onIr={onIr} />}
        {pode('auditoria:ler') && <Recente onIr={onIr} />}
      </div>
    </div>
  )
}

/** O retrato de hoje, em quatro números. O resto está em Levantamentos. */
function Plataforma({ onIr }: { onIr: (s: SecaoId) => void }) {
  const [dados, setDados] = useState<Levantamentos | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    carregarLevantamentos(30)
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setErro(true))
    return () => {
      vivo = false
    }
  }, [])

  const agora = dados?.agora
  const pagos = agora ? (agora.porPlano.pro ?? 0) + (agora.porPlano.premium ?? 0) : 0
  const restritos = agora ? (agora.porModeracao.restricted ?? 0) + (agora.porModeracao.partial ?? 0) : 0

  return (
    <Cartao
      titulo="Plataforma hoje"
      descricao="O retrato do momento. Evolução, uso e distribuição ficam em Levantamentos."
      acoes={
        <Botao tamanho="sm" variante="fantasma" onClick={() => onIr('levantamentos')}>
          Levantamentos <ArrowRight width={13} height={13} />
        </Botao>
      }
    >
      {erro ? (
        <Vazio>Não deu para ler os números agora.</Vazio>
      ) : !agora ? (
        <Carregando />
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Numero rotulo="Contas" valor={agora.contas} />
          <Numero rotulo="Perfis no ar" valor={agora.publicados} nota={`${agora.rascunhos} em rascunho`} />
          <Numero rotulo="Planos pagos" valor={pagos} nota={agora.emCortesia > 0 ? `${agora.emCortesia} em carência` : undefined} />
          <Numero rotulo="Escritórios" valor={agora.escritorios} />
          <Numero rotulo="Com restrição" valor={restritos} nota="parcial ou fora do ar" />
          <Numero rotulo="Aceite pendente" valor={agora.aceitePendente} nota="dos Termos vigentes" />
        </dl>
      )}
    </Cartao>
  )
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: number; nota?: string }) {
  return (
    <div>
      <dt className="text-[11.5px] font-medium text-adm-muted">{rotulo}</dt>
      <dd className="mt-0.5 text-[22px] font-semibold leading-none tabular-nums text-adm-ink">
        {valor.toLocaleString('pt-BR')}
      </dd>
      {nota && <p className="mt-1 text-[11.5px] text-adm-faint">{nota}</p>}
    </div>
  )
}

/** As últimas ações do console — o que os outros fizeram desde a sua última vez. */
function Recente({ onIr }: { onIr: (s: SecaoId) => void }) {
  const [acoes, setAcoes] = useState<AdminAcao[] | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    listarAcoes({ limite: 8 })
      .then((r) => vivo && setAcoes(r.itens))
      .catch(() => vivo && setErro(true))
    return () => {
      vivo = false
    }
  }, [])

  return (
    <Cartao
      semPreenchimento
      titulo="Atividade recente"
      acoes={
        <Botao tamanho="sm" variante="fantasma" onClick={() => onIr('historico')}>
          Histórico <ArrowRight width={13} height={13} />
        </Botao>
      }
    >
      {erro ? (
        <div className="p-4">
          <Vazio>Não deu para ler o histórico agora.</Vazio>
        </div>
      ) : !acoes ? (
        <div className="px-4">
          <Carregando />
        </div>
      ) : acoes.length === 0 ? (
        <div className="p-4">
          <Vazio>Nada registrado ainda.</Vazio>
        </div>
      ) : (
        <ol className="divide-y divide-adm-line">
          {acoes.map((a) => {
            const assunto = assuntoDe(a.action)
            return (
              <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                <Chip tom={assunto.tom} className="mt-0.5 w-[4.5rem] justify-center">
                  {assunto.label}
                </Chip>
                <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                  <span className="font-medium text-adm-ink">{a.adminLabel}</span>{' '}
                  <span className={ACAO_GRAVE.has(a.action) ? 'font-semibold text-adm-danger' : 'text-adm-soft'}>
                    {NOME_ACAO[a.action] ?? a.action}
                  </span>
                  {a.reason && <span className="block truncate text-adm-muted">“{a.reason}”</span>}
                </span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-adm-faint">{fmtRelativo(a.createdAt)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </Cartao>
  )
}
