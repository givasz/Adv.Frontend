import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { ShieldIcon, DocIcon, LockIcon, TrashIcon, CheckIcon } from '@/components/ui/icons'
import { baixarComoArquivo, excluirConta, exportarDados } from '@/lib/account'
import { countOpenSessions, logoutEverywhere, useAuth } from '@/lib/auth'

// "Seus dados" — /conta/dados.
//
// Os direitos que a LGPD dá ao titular (art. 18) só existem de verdade quando dá
// para exercê-los sem pedir por favor: ver o que a plataforma guarda, levar uma
// cópia, encerrar as sessões e apagar tudo. Antes isso era um e-mail para o
// suporte e alguém mexendo no banco à mão.
//
// A exclusão pede a senha e obriga a escrever a palavra: é irreversível, e o
// tamanho do gesto tem que ser do tamanho da consequência. Não é atrito por
// atrito — é a única tela do produto onde um clique errado não tem volta.

const PALAVRA = 'EXCLUIR'

export default function DadosPage() {
  const navigate = useNavigate()
  const voltar = useVoltar('/painel')
  const { user } = useAuth()

  const [baixando, setBaixando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [sessoes, setSessoes] = useState<number | null>(null)

  const [abrindoExclusao, setAbrindoExclusao] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    countOpenSessions().then(setSessoes)
  }, [])

  async function baixar() {
    setBaixando(true)
    setErro(null)
    setAviso(null)
    try {
      baixarComoArquivo(await exportarDados())
      setAviso('Arquivo gerado. Confira a pasta de downloads.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível reunir seus dados.')
    } finally {
      setBaixando(false)
    }
  }

  async function encerrarSessoes() {
    setErro(null)
    try {
      await logoutEverywhere()
      navigate('/entrar')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível encerrar as sessões.')
    }
  }

  async function excluir(e: React.FormEvent) {
    e.preventDefault()
    setExcluindo(true)
    setErro(null)
    try {
      await excluirConta(senha)
      navigate('/?conta=excluida', { replace: true })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir a conta.')
    } finally {
      setExcluindo(false)
    }
  }

  const podeExcluir = !excluindo && confirmacao.trim().toUpperCase() === PALAVRA && senha.length > 0

  return (
    <SubPage
      title="Seus dados"
      subtitle="O que o advoc.me guarda sobre você — e o que você pode fazer com isso."
      icon={<ShieldIcon width={18} height={18} />}
      backTo={voltar}
      documentTitle="Seus dados"
    >
      <div className="space-y-4">
        {/* O que guardamos, em português — antes de qualquer botão. */}
        <section className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-5">
          <h2 className="font-display text-[17px] font-semibold text-ink">O que guardamos</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-soft">
            <li>
              <strong className="font-semibold text-ink">Sua conta:</strong> e-mail e a data em que
              você se cadastrou. A senha fica só como hash — nem nós conseguimos lê-la.
            </li>
            <li>
              <strong className="font-semibold text-ink">Seu perfil:</strong> tudo o que você
              escreveu nele, mais a trilha do que foi salvo e publicado.
            </li>
            <li>
              <strong className="font-semibold text-ink">Seus chamados</strong> de suporte e as
              respostas que você recebeu.
            </li>
          </ul>
          <p className="mt-3 border-t border-ink/[0.07] pt-3 text-[12.5px] leading-relaxed text-ink-faint">
            Não guardamos dado de quem visita o seu perfil: o contato vai do aparelho do visitante
            direto para o seu WhatsApp, sem passar por aqui.
          </p>
        </section>

        {/* Levar uma cópia. */}
        <section className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass-deep">
              <DocIcon width={18} height={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[17px] font-semibold text-ink">Baixar uma cópia</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                Um arquivo com tudo o que está acima, em formato aberto (JSON) — seu para guardar
                ou levar para outro lugar.
              </p>
              <button
                type="button"
                onClick={baixar}
                disabled={baixando}
                className="btn-ghost mt-3 !py-2 text-[13px] disabled:opacity-60"
              >
                {baixando ? 'Reunindo…' : 'Baixar meus dados'}
              </button>
            </div>
          </div>
        </section>

        {/* Sessões abertas. */}
        <section className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink-soft">
              <LockIcon width={18} height={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[17px] font-semibold text-ink">Aparelhos conectados</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                {sessoes === null
                  ? 'Sua conta pode estar aberta em mais de um aparelho.'
                  : sessoes === 1
                    ? 'Sua conta está aberta só neste aparelho.'
                    : `Sua conta está aberta em ${sessoes} aparelhos.`}{' '}
                Se algum deles não é seu — um computador emprestado, um celular perdido — encerre
                tudo e entre de novo.
              </p>
              <button
                type="button"
                onClick={encerrarSessoes}
                className="btn-ghost mt-3 !py-2 text-[13px]"
              >
                Encerrar em todos os aparelhos
              </button>
            </div>
          </div>
        </section>

        {/* Excluir — por último, e visualmente separado. */}
        <section className="rounded-xl2 border border-burgundy/25 bg-burgundy/[0.03] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy/10 text-burgundy">
              <TrashIcon width={18} height={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[17px] font-semibold text-ink">Excluir minha conta</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                Apaga a conta, o perfil publicado, as perguntas frequentes, a trilha de auditoria e
                os chamados de suporte. O endereço do seu perfil deixa de existir e fica livre para
                outra pessoa. <strong className="font-semibold text-ink">Não há como desfazer.</strong>
              </p>

              {!abrindoExclusao ? (
                <button
                  type="button"
                  onClick={() => setAbrindoExclusao(true)}
                  className="mt-3 rounded-lg border border-burgundy/40 px-3.5 py-2 text-[13px] font-semibold text-burgundy transition-colors hover:bg-burgundy/[0.06]"
                >
                  Quero excluir
                </button>
              ) : (
                <form onSubmit={excluir} className="mt-4 space-y-3" noValidate>
                  <div>
                    <label
                      htmlFor="senha-exclusao"
                      className="block text-[12.5px] font-semibold text-ink"
                    >
                      Sua senha
                    </label>
                    <input
                      id="senha-exclusao"
                      type="password"
                      autoComplete="current-password"
                      value={senha}
                      onChange={(ev) => setSenha(ev.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
                      placeholder="Para confirmar que é você"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="palavra-exclusao"
                      className="block text-[12.5px] font-semibold text-ink"
                    >
                      Escreva {PALAVRA} para confirmar
                    </label>
                    <input
                      id="palavra-exclusao"
                      type="text"
                      autoComplete="off"
                      value={confirmacao}
                      onChange={(ev) => setConfirmacao(ev.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15"
                      placeholder={PALAVRA}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={!podeExcluir}
                      className="rounded-lg bg-burgundy px-4 py-2.5 text-[13px] font-semibold text-paper transition-opacity disabled:opacity-40"
                    >
                      {excluindo ? 'Excluindo…' : 'Excluir definitivamente'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAbrindoExclusao(false)
                        setSenha('')
                        setConfirmacao('')
                        setErro(null)
                      }}
                      className="btn-ghost !py-2.5 text-[13px]"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {aviso && (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-brass-deep">
            <CheckIcon width={15} height={15} strokeWidth={2.4} />
            {aviso}
          </p>
        )}
        {erro && <p className="text-[13px] font-medium text-burgundy">{erro}</p>}

        <p className="pt-1 text-center text-[12px] leading-relaxed text-ink-faint">
          Conta de {user?.email ?? 'quem está logado'}. Dúvida sobre dados?{' '}
          <a href="/legal/privacidade" className="underline hover:text-ink-soft">
            Política de privacidade
          </a>
          .
        </p>
      </div>
    </SubPage>
  )
}
