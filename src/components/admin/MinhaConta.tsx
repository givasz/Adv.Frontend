// Minha conta — a senha e o segundo fator de quem está logado.
//
// Antes não havia tela para trocar a própria senha: quem recebia a senha
// inicial pelo canal combinado ficava com ela para sempre, ou pedia um `--reset`
// a quem tem acesso ao servidor. A troca é feita com a senha atual, e o
// servidor registra a ação no histórico (sem o texto da senha, claro).

import { useState } from 'react'
import { totpDesligar, trocarSenhaAdmin, type AdminMe } from '@/lib/adminApi'
import { LockIcon } from '@/components/ui/icons'
import { Aviso, Botao, Campo, Cartao, Chip, Etiqueta, TituloDaPagina, entrada, iniciais } from './pecas'
import { SECOES } from './Console'

export default function MinhaConta({ me, onAtualizar }: { me: AdminMe; onAtualizar: () => void }) {
  const secao = SECOES.find((s) => s.id === 'conta')!
  return (
    <div>
      <TituloDaPagina titulo={secao.label} descricao={secao.descricao} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Cartao titulo="Quem você é">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-adm-side text-[15px] font-bold text-white">
              {iniciais(me.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-adm-ink">{me.name}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <Etiqueta papel={me.role} />
                {me.totpPendente ? (
                  <Chip tom="perigo">segundo fator pendente</Chip>
                ) : (
                  <Chip tom="ok">
                    <LockIcon width={10} height={10} /> segundo fator
                  </Chip>
                )}
              </span>
            </span>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-adm-muted">
            O que o seu papel abre está decidido no servidor. Para mudar de papel, peça a um responsável na
            seção Equipe.
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {me.permissoes.map((p) => (
              <li key={p}>
                <Chip>{p}</Chip>
              </li>
            ))}
          </ul>
        </Cartao>

        <div className="space-y-4">
          <TrocarSenha />
          {!me.totpPendente && <DesligarFator onPronto={onAtualizar} />}
        </div>
      </div>
    </div>
  )
}

function TrocarSenha() {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const curta = nova.length > 0 && nova.length < 12
  const diferente = confirma.length > 0 && confirma !== nova

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setOk(false)
    setOcupado(true)
    try {
      await trocarSenhaAdmin(atual, nova)
      setAtual('')
      setNova('')
      setConfirma('')
      setOk(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para trocar a senha.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Cartao titulo="Trocar a senha" descricao="Mínimo de 12 caracteres. As outras sessões abertas continuam valendo.">
      <form onSubmit={enviar} className="max-w-sm">
        <Campo id="senha-atual" label="Senha atual">
          <input
            id="senha-atual"
            type="password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            autoComplete="current-password"
            className={entrada}
          />
        </Campo>
        <Campo id="senha-nova" label="Senha nova" dica={curta ? 'Ainda curta: são 12 caracteres no mínimo.' : undefined}>
          <input
            id="senha-nova"
            type="password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            autoComplete="new-password"
            className={entrada}
          />
        </Campo>
        <Campo id="senha-confirma" label="Repita a senha nova" dica={diferente ? 'As duas não batem.' : undefined}>
          <input
            id="senha-confirma"
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            autoComplete="new-password"
            className={entrada}
          />
        </Campo>
        {erro && <Aviso>{erro}</Aviso>}
        {ok && <Aviso tom="ok">Senha trocada.</Aviso>}
        <Botao
          type="submit"
          variante="primario"
          disabled={ocupado || !atual || nova.length < 12 || nova !== confirma}
        >
          {ocupado ? 'Trocando…' : 'Trocar a senha'}
        </Botao>
      </form>
    </Cartao>
  )
}

function DesligarFator({ onPronto }: { onPronto: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setOcupado(true)
    try {
      await totpDesligar(senha, codigo)
      setAberto(false)
      setSenha('')
      setCodigo('')
      onPronto()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para desligar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Cartao
      titulo="Segundo fator"
      descricao="Ligado. Desligar só faz sentido para trocar de aparelho — e, se o seu papel exige, o console pede para religar na hora."
      acoes={
        <Botao tamanho="sm" variante={aberto ? 'secundario' : 'aviso'} onClick={() => setAberto((v) => !v)}>
          {aberto ? 'Cancelar' : 'Desligar…'}
        </Botao>
      }
    >
      {!aberto ? (
        <p className="text-[12.5px] text-adm-muted">Nada a fazer aqui enquanto o aparelho continuar o mesmo.</p>
      ) : (
        <form onSubmit={enviar} className="max-w-sm">
          <Campo id="totp-senha" label="Sua senha">
            <input
              id="totp-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              className={entrada}
            />
          </Campo>
          <Campo id="totp-off" label="Código de 6 dígitos">
            <input
              id="totp-off"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${entrada} font-mono tracking-[0.3em]`}
            />
          </Campo>
          {erro && <Aviso>{erro}</Aviso>}
          <Botao type="submit" variante="perigo" disabled={ocupado || !senha || codigo.length !== 6}>
            {ocupado ? 'Desligando…' : 'Desligar o segundo fator'}
          </Botao>
        </form>
      )}
    </Cartao>
  )
}
