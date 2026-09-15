// O console de administração — a rota escondida.
//
// Esta página faz três coisas: pergunta ao servidor quem está logado, desenha a
// tela de entrada se ninguém estiver, e monta a moldura (components/admin/
// Console) com a seção escolhida. A seção vive na URL (`?s=denuncias`), então
// recarregar, voltar e mandar o link de uma fila para um colega funcionam como
// em qualquer ferramenta de trabalho.
//
// Quem decide o que cada papel abre é o servidor; a tela desenha o que ele
// disser. Ver components/admin/Console.tsx.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminLogin, adminLogout, adminSessao, type AdminMe, PrecisaSegundoFator } from '@/lib/adminApi'
import { Console, SECOES, secoesDe, type SecaoId } from '@/components/admin/Console'
import { ProvedorDeContadores } from '@/components/admin/contadores'
import VisaoGeral from '@/components/admin/VisaoGeral'
import DenunciasTab from '@/components/admin/DenunciasTab'
import ContestacoesTab from '@/components/admin/ContestacoesTab'
import SuporteTab from '@/components/admin/SuporteTab'
import AdvogadosTab from '@/components/admin/AdvogadosTab'
import HistoricoTab from '@/components/admin/HistoricoTab'
import LevantamentosTab from '@/components/admin/LevantamentosTab'
import EquipeTab from '@/components/admin/EquipeTab'
import MinhaConta from '@/components/admin/MinhaConta'
import SegundoFator from '@/components/admin/SegundoFator'
import { Botao, entrada } from '@/components/admin/pecas'
import { LockIcon } from '@/components/ui/icons'
import { Marca } from '@/components/ui/Marca'

export default function AdminPanel() {
  // `undefined` = ainda perguntando ao servidor. A sessão do console é um cookie
  // HttpOnly: recarregar a página apaga tudo o que esta tela sabia, e só o
  // servidor pode dizer se ela continua aberta — e para QUEM. Sem o estado
  // intermediário, o console piscaria a tela de login em toda recarga.
  const [me, setMe] = useState<AdminMe | null | undefined>(undefined)

  // Uma fonte só para "o que este papel abre": o servidor. A tela desenha o que
  // ele disser; quem recusa de verdade continua sendo a API.
  const reconferir = () => void adminSessao().then(setMe)

  useEffect(() => {
    let vivo = true
    void adminSessao().then((r) => {
      if (vivo) setMe(r)
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    document.title = 'Console · advoc.me'
    // Rota escondida: impede indexação por buscadores mesmo que o link vaze.
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  if (me === undefined) return <Conferindo />
  if (!me) return <Entrada onLogin={setMe} />
  return (
    <ProvedorDeContadores me={me}>
      <Painel
        me={me}
        onAtualizar={reconferir}
        onLogout={() => {
          void adminLogout()
          setMe(null)
        }}
      />
    </ProvedorDeContadores>
  )
}

/** Meio segundo de "conferindo" em vez de um piscar de tela de login. */
function Conferindo() {
  return (
    <div className="console flex min-h-dvh items-center justify-center bg-adm-bg px-6 font-ui">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-adm-side text-white">
          <LockIcon width={18} height={18} />
        </span>
        <p className="text-[12.5px] text-adm-muted">Conferindo a sessão…</p>
      </div>
    </div>
  )
}

// ---- Entrada ----------------------------------------------------------------

function Entrada({ onLogin }: { onLogin: (me: AdminMe) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // O campo do código só aparece depois que a senha passou. Mostrá-lo de saída
  // faria toda entrada parecer exigir um aplicativo que nem todo papel usa.
  const [pedeCodigo, setPedeCodigo] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onLogin(await adminLogin(username, password, codigo))
    } catch (err) {
      if (err instanceof PrecisaSegundoFator) {
        setPedeCodigo(true)
        setError(codigo ? 'Código incorreto. Tente o próximo.' : null)
      } else {
        setError(err instanceof Error ? err.message : 'Usuário ou senha inválidos.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="console grid min-h-dvh bg-adm-side font-ui lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      {/* A metade escura: identidade e o que este lugar é. */}
      <div className="hidden flex-col justify-between p-10 text-slate-300 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/95">
            <Marca size={18} />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-white">advoc.me</span>
            <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Console
            </span>
          </span>
        </div>
        <div className="max-w-md">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-white">
            Moderação, suporte e os números da plataforma.
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-400">
            Toda decisão tomada aqui fica registrada com nome, data e motivo — e o motivo é o mesmo texto
            que a pessoa afetada lê.
          </p>
        </div>
        <p className="text-[11.5px] text-slate-500">Acesso restrito à equipe. Sessão de 8 horas, em cookie protegido.</p>
      </div>

      {/* A metade clara: o formulário. */}
      <div className="flex items-center justify-center bg-adm-bg px-6 py-10">
        <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-adm-border bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-adm-side">
              <Marca size={16} className="brightness-0 invert" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold text-adm-ink">advoc.me</span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-adm-muted">
                Console
              </span>
            </span>
          </div>
          <h2 className="text-[18px] font-semibold text-adm-ink">Entrar</h2>
          <p className="mb-5 text-[12.5px] text-adm-muted">Acesso restrito à equipe.</p>

          <label htmlFor="admin-user" className="mb-1 block text-[12.5px] font-medium text-adm-soft">
            E-mail
          </label>
          <input
            id="admin-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="none"
            disabled={pedeCodigo}
            className={`mb-3 ${entrada}`}
          />
          <label htmlFor="admin-pass" className="mb-1 block text-[12.5px] font-medium text-adm-soft">
            Senha
          </label>
          <input
            id="admin-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            spellCheck={false}
            disabled={pedeCodigo}
            className={`mb-4 ${entrada}`}
          />

          {pedeCodigo && (
            <>
              <label htmlFor="admin-totp" className="mb-1 block text-[12.5px] font-medium text-adm-soft">
                Código de 6 dígitos
              </label>
              <input
                id="admin-totp"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                className={`mb-1 ${entrada} font-mono tracking-[0.3em]`}
              />
              <p className="mb-4 text-[11.5px] text-adm-muted">O que está no seu aplicativo de autenticação agora.</p>
            </>
          )}

          {error && (
            <p role="alert" className="mb-3 rounded-md border border-adm-danger/30 bg-adm-danger-soft/60 px-3 py-2 text-[12.5px] text-adm-danger">
              {error}
            </p>
          )}
          <Botao type="submit" variante="primario" className="w-full" disabled={busy || (pedeCodigo && codigo.length !== 6)}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Botao>
        </form>
      </div>
    </div>
  )
}

// ---- Painel -----------------------------------------------------------------

const IDS = new Set<string>(SECOES.map((s) => s.id))

function Painel({
  me,
  onAtualizar,
  onLogout,
}: {
  me: AdminMe
  onAtualizar: () => void
  onLogout: () => void
}) {
  const [params, setParams] = useSearchParams()
  const secoes = secoesDe(me)
  const pedido = params.get('s')
  // Uma seção que o papel não abre (ou que não existe) cai na visão geral: a
  // URL pode ter vindo de outra pessoa, com outro papel.
  const secao: SecaoId =
    pedido && IDS.has(pedido) && secoes.some((s) => s.id === pedido) ? (pedido as SecaoId) : 'inicio'

  function ir(s: SecaoId) {
    setParams(s === 'inicio' ? {} : { s })
    window.scrollTo(0, 0)
  }

  const podeDecidir = me.permissoes.includes('moderacao:decidir')
  const podeResponder = me.permissoes.includes('suporte:responder')
  const podeSancionar = me.permissoes.includes('contas:sancionar')

  return (
    <Console me={me} secao={secao} onSecao={ir} onLogout={onLogout}>
      {me.totpPendente && <SegundoFator onPronto={onAtualizar} />}
      {me.emergencia && <FaixaEmergencia producao={me.producao} onIr={ir} />}

      {secao === 'inicio' && <VisaoGeral me={me} onIr={ir} />}
      {secao === 'denuncias' && <DenunciasTab podeDecidir={podeDecidir} podeSancionar={podeSancionar} />}
      {secao === 'contestacoes' && <ContestacoesTab podeDecidir={podeDecidir} />}
      {secao === 'suporte' && <SuporteTab podeResponder={podeResponder} />}
      {secao === 'advogados' && <AdvogadosTab podeDecidir={podeDecidir} podeSancionar={podeSancionar} />}
      {secao === 'historico' && <HistoricoTab />}
      {secao === 'levantamentos' && <LevantamentosTab />}
      {secao === 'equipe' && <EquipeTab eu={me} />}
      {secao === 'conta' && <MinhaConta me={me} onAtualizar={onAtualizar} />}
    </Console>
  )
}

/**
 * Você entrou pela credencial do .env, que só vale enquanto não existe
 * administrador nenhum. Enquanto for assim, nenhuma decisão tem autor de
 * verdade — então a faixa não é decorativa, é a primeira tarefa do console.
 */
function FaixaEmergencia({ producao, onIr }: { producao: boolean; onIr: (s: SecaoId) => void }) {
  return (
    <section className="mb-5 rounded-lg border border-adm-danger/40 bg-adm-danger-soft/50 p-4">
      <h2 className="mb-1 text-[14px] font-semibold text-adm-danger">Ninguém administra este console ainda</h2>
      <p className="max-w-prose text-[13px] leading-relaxed text-adm-soft">
        Você entrou pela credencial de emergência do ambiente. Ela existe só para criar o primeiro acesso
        — e para de valer sozinha assim que ele existir. Enquanto isso, as decisões ficam registradas sem
        um nome por trás.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Botao variante="primario" tamanho="sm" onClick={() => onIr('equipe')}>
          Criar o meu acesso
        </Botao>
        {!producao && <span className="text-[12px] text-adm-muted">ou `npm run admin:create` no servidor</span>}
      </div>
    </section>
  )
}
