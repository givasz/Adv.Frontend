// Quem administra a plataforma.
//
// O que esta tela resolve, em ordem de importância:
//
//   • dar um papel a cada pessoa (quem atende suporte não tira perfil do ar);
//   • desligar o acesso de quem saiu — derrubando as sessões no mesmo ato;
//   • deixar visível quem ainda não configurou o segundo fator.
//
// Painéis em linha, nunca sobrepostos: abrir uma decisão não pode esconder a
// lista em que ela foi tomada.

import { useEffect, useState } from 'react'
import {
  atualizarAdmin,
  criarAdmin,
  listarAdmins,
  revogarSessoesAdmin,
  type AdminConta,
  type AdminMe,
  type PapelInfo,
} from '@/lib/adminApi'
import { LockIcon } from '@/components/ui/icons'
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Carregando,
  Chip,
  Etiqueta,
  LinhaClicavel,
  Motivo,
  Tabela,
  Td,
  Th,
  TituloDaPagina,
  entrada,
  fmtData,
  fmtRelativo,
  iniciais,
  useTelaLarga,
} from './pecas'
import { SECOES } from './Console'
import { FragmentoDeLinha } from './DenunciasTab'

export default function EquipeTab({ eu }: { eu: AdminMe }) {
  const [admins, setAdmins] = useState<AdminConta[] | null>(null)
  const [papeis, setPapeis] = useState<PapelInfo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const larga = useTelaLarga()
  const secao = SECOES.find((s) => s.id === 'equipe')!

  async function recarregar() {
    setErro(null)
    try {
      const r = await listarAdmins()
      setAdmins(r.admins)
      setPapeis(r.papeis)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para carregar a equipe.')
    }
  }

  useEffect(() => {
    void recarregar()
  }, [])

  const semFator = (admins ?? []).filter((a) => a.active && !a.totpEnabled && (a.role === 'owner' || a.role === 'moderator'))

  return (
    <div>
      <TituloDaPagina
        titulo={secao.label}
        descricao={secao.descricao}
        acoes={
          <Botao variante={criando ? 'secundario' : 'primario'} onClick={() => setCriando((v) => !v)}>
            {criando ? 'Cancelar' : 'Adicionar pessoa'}
          </Botao>
        }
      />

      {erro && <Aviso>{erro}</Aviso>}

      {semFator.length > 0 && (
        <Aviso tom="nota">
          <strong>
            {semFator.length === 1 ? '1 pessoa decide' : `${semFator.length} pessoas decidem`} sem segundo fator.
          </strong>{' '}
          Até configurarem, nenhuma decisão delas é aplicada.
        </Aviso>
      )}

      {criando && (
        <NovoAdmin
          papeis={papeis}
          onPronto={() => {
            setCriando(false)
            void recarregar()
          }}
        />
      )}

      <Cartao
        semPreenchimento
        titulo="Pessoas com acesso"
        descricao={admins ? `${admins.length} ${admins.length === 1 ? 'conta' : 'contas'} · ${admins.filter((a) => a.active).length} ativas` : undefined}
      >
        {!admins && !erro && (
          <div className="px-4">
            <Carregando />
          </div>
        )}
        {admins && (
          <Tabela minima="md:min-w-[720px]">
            <thead>
              <tr>
                <Th>Pessoa</Th>
                <Th largura="8rem">Papel</Th>
                <Th largura="8rem" oculta>
                  2º fator
                </Th>
                <Th largura="9rem" oculta>
                  Último acesso
                </Th>
                <Th largura="7rem" className="text-right" oculta>
                  Sessões
                </Th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const estaAberto = aberto === a.id
                const precisaFator = a.role === 'owner' || a.role === 'moderator'
                return (
                  <FragmentoDeLinha key={a.id}>
                    <LinhaClicavel aberta={estaAberto} onClick={() => setAberto(estaAberto ? null : a.id)}>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                              a.active ? 'bg-adm-side text-white' : 'bg-adm-line text-adm-faint'
                            }`}
                          >
                            {iniciais(a.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className={`truncate font-medium ${a.active ? 'text-adm-ink' : 'text-adm-faint line-through'}`}>
                                {a.name}
                              </span>
                              {a.id === eu.id && <Chip>você</Chip>}
                              {!a.active && <Chip tom="perigo">desligado</Chip>}
                            </span>
                            <span className="block truncate text-[12px] text-adm-muted">{a.email}</span>
                          </span>
                        </span>
                      </Td>
                      <Td>
                        <Etiqueta papel={a.role} />
                      </Td>
                      <Td oculta>
                        {a.totpEnabled ? (
                          <span className="inline-flex items-center gap-1 text-[12.5px] text-adm-ok">
                            <LockIcon width={12} height={12} /> ligado
                          </span>
                        ) : precisaFator && a.active ? (
                          <Chip tom="perigo">pendente</Chip>
                        ) : (
                          <span className="text-[12.5px] text-adm-faint">—</span>
                        )}
                      </Td>
                      <Td className="text-[12.5px] text-adm-soft" oculta>
                        <span title={fmtData(a.lastLoginAt)}>{a.lastLoginAt ? fmtRelativo(a.lastLoginAt) : 'nunca'}</span>
                      </Td>
                      <Td className="text-right tabular-nums text-adm-soft" oculta>
                        {a.sessoes}
                      </Td>
                    </LinhaClicavel>
                    {estaAberto && (
                      <tr>
                        <Td colSpan={larga ? 5 : 2} className="bg-adm-bg/60 p-0">
                          <DetalheAdmin
                            conta={a}
                            papeis={papeis}
                            euSou={eu}
                            onMudou={() => void recarregar()}
                            onErro={setErro}
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
      </Cartao>
    </div>
  )
}

function NovoAdmin({ papeis, onPronto }: { papeis: PapelInfo[]; onPronto: () => void }) {
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [papel, setPapel] = useState('support')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    try {
      await criarAdmin({ email, name: nome, password: senha, role: papel })
      onPronto()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para criar.')
    } finally {
      setOcupado(false)
    }
  }

  const escolhido = papeis.find((p) => p.id === papel)

  return (
    <Cartao titulo="Novo acesso" descricao="A pessoa entra com o e-mail e a senha inicial, e troca a senha depois." className="mb-4">
      <form onSubmit={enviar} className="grid gap-x-4 sm:grid-cols-2">
        <Campo id="novo-nome" label="Nome">
          <input id="novo-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={entrada} />
        </Campo>
        <Campo id="novo-email" label="E-mail" dica="É com ele que a pessoa entra no console.">
          <input
            id="novo-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={entrada}
          />
        </Campo>
        <Campo
          id="novo-senha"
          label="Senha inicial"
          dica="Mínimo de 12 caracteres. Combine por um canal seguro — ninguém aqui consegue ver esta senha depois."
        >
          <input
            id="novo-senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            className={entrada}
          />
        </Campo>
        <Campo id="novo-papel" label="Papel" dica={escolhido?.descricao}>
          <select id="novo-papel" value={papel} onChange={(e) => setPapel(e.target.value)} className={entrada}>
            {papeis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Campo>
        <div className="sm:col-span-2">
          {erro && <Aviso>{erro}</Aviso>}
          <Botao type="submit" variante="primario" disabled={ocupado}>
            {ocupado ? 'Criando…' : 'Criar acesso'}
          </Botao>
        </div>
      </form>
    </Cartao>
  )
}

function DetalheAdmin({
  conta,
  papeis,
  euSou,
  onMudou,
  onErro,
}: {
  conta: AdminConta
  papeis: PapelInfo[]
  euSou: AdminMe
  onMudou: () => void
  onErro: (m: string) => void
}) {
  const [papel, setPapel] = useState(conta.role as string)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  // O servidor recusa mexer na própria conta (seria perder o acesso com um
  // clique). A tela avisa antes, para o "não" não chegar depois do clique.
  const souEu = conta.id === euSou.id
  const semMotivo = motivo.trim().length < 5

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true)
    try {
      await fn()
      setMotivo('')
      onMudou()
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Não deu para aplicar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="grid gap-px border-t border-adm-border bg-adm-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="bg-white px-4 py-4">
        {souEu && (
          <Aviso tom="nota">
            Esta é a sua conta. Mudar o próprio papel ou desativar a si mesmo é recusado — peça a outro
            responsável.
          </Aviso>
        )}
        <Campo id={`papel-${conta.id}`} label="Papel" dica={papeis.find((p) => p.id === papel)?.descricao}>
          <select
            id={`papel-${conta.id}`}
            value={papel}
            onChange={(e) => setPapel(e.target.value)}
            disabled={souEu}
            className={entrada}
          >
            {papeis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Campo>
        <dl className="grid grid-cols-2 gap-x-4 text-[12.5px]">
          <div>
            <dt className="text-adm-muted">Criado em</dt>
            <dd className="font-medium text-adm-ink">{fmtData(conta.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-adm-muted">Último acesso</dt>
            <dd className="font-medium text-adm-ink">{fmtData(conta.lastLoginAt)}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white px-4 py-4">
        <Motivo id={`motivo-${conta.id}`} valor={motivo} onChange={setMotivo} label="Motivo (obrigatório)" dica="Vai para o histórico com o seu nome." />
        <div className="flex flex-wrap gap-2">
          <Botao
            variante="primario"
            onClick={() => void acao(() => atualizarAdmin(conta.id, { role: papel, reason: motivo }))}
            disabled={ocupado || souEu || papel === conta.role || semMotivo}
          >
            Mudar papel
          </Botao>
          <Botao
            onClick={() => void acao(() => revogarSessoesAdmin(conta.id, motivo))}
            disabled={ocupado || conta.sessoes === 0 || semMotivo}
          >
            Derrubar sessões{conta.sessoes ? ` (${conta.sessoes})` : ''}
          </Botao>
          {conta.active ? (
            <Botao
              variante="perigo"
              onClick={() => void acao(() => atualizarAdmin(conta.id, { active: false, reason: motivo }))}
              disabled={ocupado || souEu || semMotivo}
            >
              Desligar acesso
            </Botao>
          ) : (
            <Botao
              variante="sucesso"
              onClick={() => void acao(() => atualizarAdmin(conta.id, { active: true, reason: motivo }))}
              disabled={ocupado || semMotivo}
            >
              Reativar
            </Botao>
          )}
        </div>
        <p className="mt-2 text-[11.5px] text-adm-muted">
          Desligar o acesso encerra as sessões abertas no mesmo ato.
        </p>
      </div>
    </div>
  )
}
