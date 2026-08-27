// Contestar uma medida de moderação.
//
// A página existe porque a sanção mais grave tira o canal de recorrer dela:
// conta suspensa não loga, e sem logar não há como escrever. Então esta tela
// atende os dois casos com um formulário só —
//
//   • **quem consegue entrar** (aviso, ocultação, restrição) chega logado, e a
//     página já sabe o que há para contestar;
//   • **quem foi suspenso ou encerrado** prova quem é com e-mail e senha, e
//     **não ganha sessão nenhuma**: é ouvido sem ganhar acesso a mais nada.
//
// O prazo é dito em voz alta porque é ele que torna o contraditório real: a
// plataforma tem 10 dias para responder e, se não responder, a medida cai.
// Ver docs/politica-de-sancoes.md § 5.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SubPage } from '@/components/ui/SubPage'
import { useAuth } from '@/lib/auth'
import {
  abrirContestacao,
  contestarSemSessao,
  minhasContestacoes,
  type MinhasContestacoes,
} from '@/lib/appeals'
import { ScaleIcon } from '@/components/ui/icons'

/** Data e hora em português, tolerante a valor inválido. */
function quando(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const campo =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

const MEDIDA_NOME: Record<string, string> = {
  warn: 'o aviso que você recebeu',
  partial: 'a ocultação de partes do seu perfil',
  restrict: 'a retirada do seu perfil do ar',
  suspend: 'a suspensão da sua conta',
  close: 'o encerramento da sua conta',
}

export default function ContestarPage() {
  const { user } = useAuth()
  const [dados, setDados] = useState<MinhasContestacoes | null>(null)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!user) return
    void minhasContestacoes()
      .then(setDados)
      .catch(() => setDados(null))
  }, [user])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    try {
      const r = user
        ? await abrirContestacao(texto)
        : await contestarSemSessao(email.trim(), senha, texto)
      setPronto(r.respondeAte)
      setTexto('')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar.')
    } finally {
      setOcupado(false)
    }
  }

  const emAberto = dados?.contestacoes.find((c) => c.status === 'open')
  const curto = texto.trim().length < 20

  return (
    <SubPage title="Contestar uma decisão" backTo="/painel" documentTitle="Contestar">
      {pronto ? (
        <div className="rounded-xl2 border border-brass/40 bg-brass/[0.08] px-4 py-4">
          <p className="font-display text-[16px] font-semibold text-brass-deep">
            Contestação registrada.
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            Respondemos até <strong>{quando(pronto)}</strong>. Se não
            respondermos nesse prazo, a medida cai — é o que faz o prazo valer
            alguma coisa.
          </p>
          <p className="mt-2 text-[12.5px] text-ink-faint">
            A resposta aparece aqui e no seu painel.
          </p>
        </div>
      ) : emAberto ? (
        <div className="rounded-xl2 border border-ink/15 bg-paper-soft px-4 py-4">
          <p className="text-[14px] font-semibold text-ink">
            Você já tem uma contestação em aberto.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            Enviada em {quando(emAberto.createdAt)}. Respondemos até{' '}
            <strong>{quando(emAberto.respondeAte)}</strong>.
          </p>
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 text-[12.5px] leading-relaxed text-ink-soft">
            {emAberto.texto}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl2 border border-ink/10 bg-paper-soft px-4 py-3.5">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <ScaleIcon width={15} height={15} className="text-brass-deep" />
              Como funciona
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-soft">
              <li>• Escreva por que discorda, apontando o ponto concreto.</li>
              <li>
                • <strong>Temos 10 dias para responder.</strong> Se não
                respondermos nesse prazo, a medida cai sozinha.
              </li>
              <li>• Quem analisa não é quem decidiu, sempre que houver mais de um responsável.</li>
              <li>• A resposta é registrada, com motivo, como qualquer outra decisão.</li>
            </ul>
          </div>

          {dados && !dados.podeContestar && (
            <p className="mb-4 rounded-lg border border-ink/15 bg-paper px-3 py-2.5 text-[13px] text-ink-soft">
              Não há medida em vigor sobre o seu perfil. Se você discorda de algo
              que já venceu, fale pelo <Link to="/suporte" className="underline">suporte</Link>.
            </p>
          )}

          <form onSubmit={enviar}>
            {!user && (
              <>
                <p className="mb-3 rounded-lg border border-brass/40 bg-brass/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-brass-deep">
                  Se a sua conta foi suspensa ou encerrada, você não consegue
                  entrar — mas continua podendo contestar. Confirme quem você é
                  abaixo; isto <strong>não</strong> abre sessão nem devolve acesso.
                </p>
                <label htmlFor="c-email" className="mb-1.5 block text-[13px] font-semibold text-ink">
                  Seu e-mail
                </label>
                <input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  className={`mb-3 ${campo}`}
                />
                <label htmlFor="c-senha" className="mb-1.5 block text-[13px] font-semibold text-ink">
                  Sua senha
                </label>
                <input
                  id="c-senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  className={`mb-4 ${campo}`}
                />
              </>
            )}

            {dados?.medida && (
              <p className="mb-1.5 text-[12.5px] text-ink-faint">
                Você está contestando {MEDIDA_NOME[dados.medida] ?? 'a medida em vigor'}.
              </p>
            )}
            <label htmlFor="c-texto" className="mb-1.5 block text-[13px] font-semibold text-ink">
              Por que você discorda
            </label>
            <textarea
              id="c-texto"
              rows={6}
              value={texto}
              maxLength={4000}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Aponte o ponto concreto: o que foi entendido de forma diferente, o que você já corrigiu, ou por que o trecho não viola a norma indicada."
              className={`${campo} resize-none`}
            />
            <p className="mt-1 text-[11.5px] text-ink-faint">
              Mínimo de 20 caracteres. É o texto que o revisor vai ler.
            </p>

            {erro && (
              <p role="alert" className="mt-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={ocupado || curto || (!user && (!email.trim() || !senha))}
              className="btn-primary mt-4 w-full disabled:opacity-50"
            >
              {ocupado ? 'Enviando…' : 'Enviar contestação'}
            </button>
          </form>
        </>
      )}
    </SubPage>
  )
}
