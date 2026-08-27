// Quem administra a plataforma.
//
// Antes esta tela não existia porque não havia o que mostrar: um usuário e uma
// senha no .env. O que ela resolve, em ordem de importância:
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
import { Aviso, Campo, Etiqueta, Motivo, entrada, fmtData } from './pecas'
import { LockIcon } from '@/components/ui/icons'

export default function EquipeTab({ eu }: { eu: AdminMe }) {
  const [admins, setAdmins] = useState<AdminConta[] | null>(null)
  const [papeis, setPapeis] = useState<PapelInfo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

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

  if (erro && !admins) return <Aviso>{erro}</Aviso>
  if (!admins) return <p className="text-[13px] text-ink-faint">Carregando…</p>

  return (
    <div>
      {erro && <Aviso>{erro}</Aviso>}

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-faint">
          {admins.length} {admins.length === 1 ? 'pessoa' : 'pessoas'} com acesso ao painel
        </p>
        <button onClick={() => setCriando((v) => !v)} className="btn-primary">
          {criando ? 'Cancelar' : 'Adicionar'}
        </button>
      </div>

      {criando && (
        <NovoAdmin
          papeis={papeis}
          onPronto={() => {
            setCriando(false)
            void recarregar()
          }}
        />
      )}

      <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl2 border border-ink/10 bg-paper">
        {admins.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => setAberto((v) => (v === a.id ? null : a.id))}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper-soft"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`text-[14px] font-semibold ${a.active ? 'text-ink' : 'text-ink-faint line-through'}`}>
                    {a.name}
                  </span>
                  <Etiqueta papel={a.role} />
                  {a.id === eu.id && (
                    <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-ink-faint">
                      você
                    </span>
                  )}
                  {!a.totpEnabled && (a.role === 'owner' || a.role === 'moderator') && (
                    <span className="rounded-full bg-burgundy/10 px-2 py-0.5 text-[10.5px] font-semibold text-burgundy-deep">
                      sem segundo fator
                    </span>
                  )}
                  {a.totpEnabled && <LockIcon width={13} height={13} className="text-ink-faint" />}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-ink-faint">
                  {a.email} · último acesso {fmtData(a.lastLoginAt)} ·{' '}
                  {a.sessoes === 0 ? 'nenhuma sessão aberta' : `${a.sessoes} sessão(ões) aberta(s)`}
                </span>
              </span>
            </button>
            {aberto === a.id && (
              <DetalheAdmin
                conta={a}
                papeis={papeis}
                euSou={eu}
                onMudou={() => void recarregar()}
                onErro={setErro}
              />
            )}
          </li>
        ))}
      </ul>
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
    <form onSubmit={enviar} className="mb-4 rounded-xl2 border border-ink/10 bg-paper-soft p-4">
      <Campo id="novo-nome" label="Nome">
        <input id="novo-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={entrada} />
      </Campo>
      <Campo id="novo-email" label="E-mail" dica="É com ele que a pessoa entra no painel.">
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
        dica="Mínimo de 12 caracteres. Combine com a pessoa por um canal seguro — ninguém aqui consegue ver esta senha depois."
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
      {erro && <Aviso>{erro}</Aviso>}
      <button type="submit" disabled={ocupado} className="btn-primary">
        {ocupado ? 'Criando…' : 'Criar acesso'}
      </button>
    </form>
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
    <div className="border-t border-ink/10 bg-paper-soft/60 px-4 py-4">
      {souEu && (
        <Aviso tom="nota">
          Esta é a sua conta. Mudar o próprio papel ou desativar a si mesmo é
          recusado — peça a outro responsável.
        </Aviso>
      )}

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Campo id={`papel-${conta.id}`} label="Papel">
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
        <div className="text-[12px] text-ink-faint">
          <p className="mb-1">Criado em {fmtData(conta.createdAt)}</p>
          <p>{papeis.find((p) => p.id === papel)?.descricao}</p>
        </div>
      </div>

      <Motivo id={`motivo-${conta.id}`} valor={motivo} onChange={setMotivo} label="Motivo (obrigatório)" />

      {motivo.trim().length < 5 && (
        <p className="mb-3 rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-[12.5px] text-brass-deep">
          <strong>Escreva o motivo acima</strong> para liberar os botões. Ele vai
          para o histórico com o seu nome.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void acao(() => atualizarAdmin(conta.id, { role: papel, reason: motivo }))}
          disabled={ocupado || souEu || papel === conta.role || motivo.trim().length < 5}
          className="rounded-full bg-brass/20 px-4 py-2 text-[13px] font-semibold text-brass-deep transition-colors hover:bg-brass/30 disabled:cursor-not-allowed disabled:bg-ink/[0.07] disabled:text-ink-faint disabled:border-transparent disabled:opacity-100"
        >
          Mudar papel
        </button>
        <button
          onClick={() => void acao(() => revogarSessoesAdmin(conta.id, motivo))}
          disabled={ocupado || conta.sessoes === 0 || motivo.trim().length < 5}
          className="rounded-full border border-ink/15 px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:bg-ink/[0.07] disabled:text-ink-faint disabled:border-transparent disabled:opacity-100"
        >
          Derrubar sessões
        </button>
        {conta.active ? (
          <button
            onClick={() => void acao(() => atualizarAdmin(conta.id, { active: false, reason: motivo }))}
            disabled={ocupado || souEu || motivo.trim().length < 5}
            className="rounded-full bg-burgundy px-4 py-2 text-[13px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep disabled:cursor-not-allowed disabled:bg-ink/[0.07] disabled:text-ink-faint disabled:border-transparent disabled:opacity-100"
          >
            Desligar acesso
          </button>
        ) : (
          <button
            onClick={() => void acao(() => atualizarAdmin(conta.id, { active: true, reason: motivo }))}
            disabled={ocupado || motivo.trim().length < 5}
            className="rounded-full border border-ink/15 px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:bg-ink/[0.07] disabled:text-ink-faint disabled:border-transparent disabled:opacity-100"
          >
            Reativar
          </button>
        )}
      </div>
      <p className="mt-2 text-[11.5px] text-ink-faint">
        Desligar o acesso encerra as sessões abertas no mesmo ato.
      </p>
    </div>
  )
}
