// A fila de contestações.
//
// É uma fila com relógio, não um mural: o que vence primeiro vem na frente, e o
// que está perto de vencer aparece em vermelho. O motivo é duro — **se a
// plataforma não responder no prazo, a medida cai sozinha**. Não é ameaça de
// tela; é como o prazo foi implementado (o `moderationUntil` da medida foi
// encurtado na abertura da contestação), e é o que torna o contraditório real
// em vez de decorativo. Ver docs/politica-de-sancoes.md § 5.

import { useEffect, useState } from 'react'
import { decidirContestacao, listarContestacoes, type AdminAppeal } from '@/lib/adminApi'
import { CheckIcon, XIcon } from '@/components/ui/icons'
import {
  Aviso,
  Botao,
  Cartao,
  Carregando,
  Chip,
  LinhaClicavel,
  Motivo,
  Rotulo,
  Segmentos,
  Tabela,
  Td,
  Th,
  TituloDaPagina,
  Vazio,
  fmtData,
  useTelaLarga,
  type Tom,
} from './pecas'
import { Rodape } from './Paginacao'
import { usePaginado } from './usePaginado'
import { useContadores } from './contadores'
import { SECOES } from './Console'
import { FragmentoDeLinha } from './DenunciasTab'

const MEDIDA: Record<string, string> = {
  warn: 'aviso',
  partial: 'ocultação parcial',
  restrict: 'perfil fora do ar',
  suspend: 'conta suspensa',
  close: 'conta encerrada',
}

const SITUACAO: Record<string, { label: string; tom: Tom }> = {
  open: { label: 'Aguardando', tom: 'aviso' },
  accepted: { label: 'Medida derrubada', tom: 'ok' },
  rejected: { label: 'Medida mantida', tom: 'neutro' },
  expired: { label: 'Venceu sem resposta', tom: 'perigo' },
}

const FILTROS = [
  { id: 'open', label: 'Aguardando' },
  { id: 'all', label: 'Todas' },
] as const

/** Quanto falta, em dias. Negativo = já venceu. */
function faltam(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

export default function ContestacoesTab({ podeDecidir }: { podeDecidir: boolean }) {
  const [filtro, setFiltro] = useState<string>('open')
  const [aberta, setAberta] = useState<string | null>(null)
  const { contadores, atualizar } = useContadores()
  const larga = useTelaLarga()
  const secao = SECOES.find((s) => s.id === 'contestacoes')!

  const lista = usePaginado<AdminAppeal>(
    (offset) => listarContestacoes(filtro, offset),
    'Falha ao carregar as contestações.',
  )
  const { itens, erro, recomecar } = lista

  useEffect(() => {
    void recomecar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  return (
    <div>
      <TituloDaPagina
        titulo={secao.label}
        descricao={secao.descricao}
        acoes={
          <Botao tamanho="sm" onClick={() => void recomecar()}>
            Atualizar
          </Botao>
        }
      />

      {contadores.contestacoesVencendo > 0 && (
        <Aviso tom="erro">
          <strong>
            {contadores.contestacoesVencendo === 1
              ? '1 contestação vence'
              : `${contadores.contestacoesVencendo} contestações vencem`}{' '}
            em até 2 dias.
          </strong>{' '}
          Sem resposta, a medida cai sozinha.
        </Aviso>
      )}

      <Cartao
        semPreenchimento
        titulo="Fila"
        acoes={
          <Segmentos
            rotulo="Recorte das contestações"
            opcoes={FILTROS.map((f) => (f.id === 'open' ? { ...f, contagem: contadores.contestacoes } : f))}
            valor={filtro}
            onChange={setFiltro}
          />
        }
      >
        {erro && (
          <div className="px-4 pt-4">
            <Aviso>{erro}</Aviso>
          </div>
        )}
        {!itens && !erro && (
          <div className="px-4">
            <Carregando />
          </div>
        )}
        {itens?.length === 0 && (
          <div className="p-4">
            <Vazio>Nenhuma contestação {filtro === 'open' ? 'aguardando resposta' : 'registrada'}.</Vazio>
          </div>
        )}

        {itens && itens.length > 0 && (
          <Tabela minima="md:min-w-[720px]">
            <thead>
              <tr>
                <Th>Quem contestou</Th>
                <Th largura="11rem" oculta>
                  Medida
                </Th>
                <Th largura="10rem" oculta>
                  Situação
                </Th>
                <Th largura="9rem" className="text-right">
                  Prazo
                </Th>
              </tr>
            </thead>
            <tbody>
              {itens.map((c) => {
                const dias = faltam(c.respondeAte)
                const urgente = c.status === 'open' && dias <= 2
                const estaAberta = aberta === c.id
                const sit = SITUACAO[c.status] ?? { label: c.status, tom: 'neutro' as Tom }
                return (
                  <FragmentoDeLinha key={c.id}>
                    <LinhaClicavel
                      aberta={estaAberta}
                      destaque={urgente}
                      onClick={() => setAberta(estaAberta ? null : c.id)}
                    >
                      <Td>
                        <span className="block truncate font-medium text-adm-ink">
                          {c.user.profile?.name || c.user.email}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-adm-muted">
                          {c.user.profile ? `advoc.me/${c.user.profile.slug} · ` : ''}
                          {c.user.email} · contestou em {fmtData(c.createdAt)}
                        </span>
                      </Td>
                      <Td className="text-adm-soft" oculta>
                        {MEDIDA[c.medida] ?? c.medida}
                      </Td>
                      <Td oculta>
                        <Chip tom={sit.tom}>{sit.label}</Chip>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {c.status === 'open' ? (
                          <span className={`text-[12.5px] ${urgente ? 'font-semibold text-adm-danger' : 'text-adm-soft'}`}>
                            {dias < 0
                              ? `venceu há ${Math.abs(dias)}d`
                              : dias === 0
                                ? 'vence hoje'
                                : `${dias}d para responder`}
                          </span>
                        ) : (
                          <span className="text-[12.5px] text-adm-faint">{fmtData(c.decidedAt)}</span>
                        )}
                      </Td>
                    </LinhaClicavel>
                    {estaAberta && (
                      <tr>
                        <Td colSpan={larga ? 4 : 2} className="bg-adm-bg/60 p-0">
                          <Detalhe
                            contestacao={c}
                            podeDecidir={podeDecidir}
                            onDecidiu={() => {
                              setAberta(null)
                              void recomecar()
                              atualizar()
                            }}
                            onErro={lista.setErro}
                          />
                        </Td>
                      </tr>
                    )}
                  </FragmentoDeLinha>
                )
              })}
            </tbody>
          </Tabela>
        )}

        <Rodape
          mostrando={itens?.length ?? 0}
          total={lista.total}
          temMais={lista.temMais}
          carregando={lista.carregando}
          onMais={() => void lista.mais()}
          nome="contestações"
        />
      </Cartao>
    </div>
  )
}

function Detalhe({
  contestacao: c,
  podeDecidir,
  onDecidiu,
  onErro,
}: {
  contestacao: AdminAppeal
  podeDecidir: boolean
  onDecidiu: () => void
  onErro: (m: string) => void
}) {
  const [resposta, setResposta] = useState(c.resposta ?? '')
  const [ocupado, setOcupado] = useState(false)
  const semResposta = resposta.trim().length < 5
  const decidida = c.status !== 'open'

  async function decidir(aceita: boolean) {
    setOcupado(true)
    try {
      await decidirContestacao(c.id, aceita, resposta.trim())
      onDecidiu()
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Não deu para responder.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="grid gap-px border-t border-adm-border bg-adm-border lg:grid-cols-2">
      <div className="bg-white px-4 py-4">
        <Rotulo>O que motivou a medida</Rotulo>
        <p className="mb-4 rounded-md border-l-2 border-adm-faint bg-adm-raised px-3 py-2 text-[12.5px] leading-relaxed text-adm-soft">
          {c.user.profile?.moderationNote || '(o motivo não está mais no perfil)'}
        </p>

        <Rotulo>O que o advogado respondeu</Rotulo>
        <p className="whitespace-pre-wrap rounded-md border-l-2 border-adm-accent/60 bg-adm-raised px-3 py-2.5 text-[13px] leading-relaxed text-adm-ink">
          {c.texto}
        </p>
      </div>

      <div className="bg-white px-4 py-4">
        {decidida ? (
          <>
            <Rotulo>Decisão</Rotulo>
            <p className="mb-2 text-[13px] font-semibold text-adm-ink">
              {c.status === 'expired'
                ? 'Venceu sem resposta — a medida caiu sozinha.'
                : c.status === 'accepted'
                  ? 'Contestação aceita: a medida foi derrubada.'
                  : 'Contestação recusada: a medida foi mantida.'}
            </p>
            {c.resposta && (
              <p className="whitespace-pre-wrap rounded-md bg-adm-raised px-3 py-2 text-[12.5px] leading-relaxed text-adm-soft">
                {c.resposta}
              </p>
            )}
            <p className="mt-2 text-[11.5px] tabular-nums text-adm-muted">{fmtData(c.decidedAt)}</p>
          </>
        ) : (
          <>
            <Rotulo>Decisão</Rotulo>
            <Motivo
              id={`resp-${c.id}`}
              valor={resposta}
              onChange={setResposta}
              label="Sua resposta (obrigatória)"
              dica="É o que o advogado vai ler. Se recusar, diga o que continua irregular; se aceitar, diga o que mudou."
              linhas={5}
            />
            {!podeDecidir && <Aviso tom="ok">Seu papel lê a fila, mas não decide contestação.</Aviso>}
            <div className="flex flex-wrap gap-2">
              <Botao
                variante="sucesso"
                onClick={() => void decidir(true)}
                disabled={ocupado || !podeDecidir || semResposta}
              >
                <CheckIcon width={14} height={14} /> Aceitar e derrubar a medida
              </Botao>
              <Botao onClick={() => void decidir(false)} disabled={ocupado || !podeDecidir || semResposta}>
                <XIcon width={14} height={14} /> Manter a medida
              </Botao>
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-adm-muted">
              Aceitar derruba tudo o que veio com a medida — inclusive a suspensão da conta e a pausa da
              cobrança. Manter devolve o prazo que a medida tinha antes da contestação.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
