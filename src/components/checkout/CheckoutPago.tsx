import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { copiarTexto } from '@/lib/copiar'
import { PLAN_PRICE } from '@/lib/plans'
import { REGRAS_DE_COBRANCA, offerOf } from '@/lib/planOffer'
import { getTheme, isThemeUnlocked, type ThemeId } from '@/lib/themes'
import {
  dataCurta,
  digitos,
  documentoValido,
  mascaraCartao,
  mascaraCep,
  mascaraDocumento,
  mascaraTelefone,
  mascaraValidade,
  reais,
  type MeioDePagamento,
  type ResultadoDoCheckout,
} from '@/lib/pagamento'
import { ConfirmarEmailCartao } from '@/components/auth/EmailDaConta'
import { SubPage } from '@/components/ui/SubPage'
import { CheckIcon, ClockIcon, ScaleIcon } from '@/components/ui/icons'
import { PlanoAtivado } from './PlanoAtivado'

// O CHECKOUT PAGO — cartão, Pix ou boleto, pelo Asaas.
//
// Só aparece com o pagamento on-line ligado (PAGAMENTO_ONLINE_DISPONIVEL). Sem
// ele, CheckoutPage segue ativando o plano como sempre fez.
//
// QUEM ABRE O PLANO é o pagamento confirmado, não esta tela. No cartão aprovado,
// o servidor já abriu quando a resposta chega. No Pix e no boleto, a tela fica
// esperando e relê o perfil de tempos em tempos: quando o Asaas avisar o servidor
// que o dinheiro entrou, o plano aparece aqui sozinho.
//
// ⚠️ NADA DO QUE SE DIGITA AQUI É GUARDADO — nem no navegador, nem em rascunho,
// nem em log. Número, validade e CVV vivem no estado desta tela, vão ao servidor
// numa requisição e são apagados logo depois. Há teste em lib/pagamento.spec.ts
// que barra armazenamento do navegador neste arquivo.

type Fase = 'formulario' | 'enviando' | 'esperando' | 'agendado' | 'ativado'

const MEIOS: { id: MeioDePagamento; titulo: string; detalhe: string }[] = [
  { id: 'CREDIT_CARD', titulo: 'Cartão de crédito', detalhe: 'Aprovado na hora. Renova sozinho todo mês.' },
  { id: 'PIX', titulo: 'Pix', detalhe: 'Pague agora pelo QR Code. A cada mês, uma nova cobrança Pix.' },
  { id: 'BOLETO', titulo: 'Boleto', detalhe: 'Compensa em até 3 dias úteis. A cada mês, um novo boleto.' },
]

/** Quanto tempo a tela espera o Pix cair antes de dizer que pode ser fechada. */
const ESPERA_MAXIMA_MS = 20 * 60 * 1000
const INTERVALO_MS = 5000

const inputClass =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

function Campo({ id, rotulo, dica, children }: { id: string; rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <div className="block">
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink">{rotulo}</span>
        {dica && <span className="text-[11.5px] text-ink-faint">{dica}</span>}
      </label>
      {children}
    </div>
  )
}

export function CheckoutPago({
  plan,
  label,
  tema,
  voltar,
}: {
  plan: 'pro' | 'premium'
  label: string
  tema: ThemeId | null
  voltar: string
}) {
  const navigate = useNavigate()
  const { emailPending } = useAuth()
  const oferta = offerOf(plan)
  const valor = PLAN_PRICE[plan]

  const [fase, setFase] = useState<Fase>('formulario')
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoDoCheckout | null>(null)
  const [cansou, setCansou] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const [meio, setMeio] = useState<MeioDePagamento>('CREDIT_CARD')
  const [documento, setDocumento] = useState('')
  const [numero, setNumero] = useState('')
  const [nome, setNome] = useState('')
  const [validade, setValidade] = useState('')
  const [cvv, setCvv] = useState('')
  const [cep, setCep] = useState('')
  const [numeroEndereco, setNumeroEndereco] = useState('')
  const [telefone, setTelefone] = useState('')

  /**
   * Quem assinou PROVANDO um tema fica com ele (mesma regra do checkout antigo):
   * pedir para escolher de novo depois de pagar seria perder o que motivou a compra.
   */
  async function aplicarTema(perfil: Profile) {
    if (tema && isThemeUnlocked(getTheme(tema), plan) && perfil.theme !== tema) {
      await api.saveDraft({ ...perfil, theme: tema }).catch(() => {})
    }
  }

  // Pix, boleto e cartão em análise: relê o perfil até o plano aparecer. Pausa com
  // a aba escondida (não há por que consultar o servidor para ninguém ver) e
  // desiste depois de 20 minutos — o plano abre do mesmo jeito, só não há mais
  // motivo para esta aba ficar perguntando.
  useEffect(() => {
    if (fase !== 'esperando') return
    let viva = true
    const inicio = Date.now()
    const id = window.setInterval(async () => {
      if (document.hidden) return
      if (Date.now() - inicio > ESPERA_MAXIMA_MS) {
        window.clearInterval(id)
        if (viva) setCansou(true)
        return
      }
      const perfil = await api.getDraft().catch(() => null)
      if (!viva || !perfil || perfil.plan !== plan) return
      window.clearInterval(id)
      await aplicarTema(perfil)
      if (viva) setFase('ativado')
    }, INTERVALO_MS)
    return () => {
      viva = false
      window.clearInterval(id)
    }
  }, [fase, plan])

  /** A primeira coisa a corrigir, na ordem em que os campos aparecem. */
  function problema(): string | null {
    if (!documentoValido(documento)) return 'Confira o CPF ou CNPJ: o número não é válido.'
    if (meio !== 'CREDIT_CARD') return null
    const n = digitos(numero)
    if (n.length < 13 || n.length > 19) return 'Confira o número do cartão.'
    if (nome.trim().length < 2) return 'Informe o nome como está impresso no cartão.'
    const v = /^(\d{2})\/(\d{2})$/.exec(validade)
    if (!v || Number(v[1]) < 1 || Number(v[1]) > 12) return 'Confira a validade do cartão (MM/AA).'
    if (digitos(cvv).length < 3 || digitos(cvv).length > 4) return 'Confira o código de segurança do cartão.'
    if (digitos(cep).length !== 8) return 'Confira o CEP do endereço da fatura do cartão.'
    if (!numeroEndereco.trim()) return 'Informe o número do endereço da fatura do cartão.'
    const t = digitos(telefone)
    if (t.length < 10 || t.length > 11) return 'Confira o telefone, com DDD.'
    return null
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (fase === 'enviando') return
    const p = problema()
    if (p) {
      setErro(p)
      return
    }
    setErro(null)
    setFase('enviando')
    const [mes, ano] = validade.split('/')
    try {
      const r = await api.assinar({
        plano: plan,
        meio,
        cpfCnpj: digitos(documento),
        ...(meio === 'CREDIT_CARD'
          ? {
              cartao: { numero: digitos(numero), nomeImpresso: nome.trim(), mes, ano, cvv: digitos(cvv) },
              titular: { cep: digitos(cep), numeroEndereco: numeroEndereco.trim(), telefone: digitos(telefone) },
            }
          : {}),
      })
      // O que era do cartão sai da tela assim que o servidor responde.
      setNumero('')
      setValidade('')
      setCvv('')
      setResultado(r)
      if (r.meio === 'CREDIT_CARD' && r.situacao === 'ativo') {
        const perfil = await api.getDraft().catch(() => null)
        if (perfil) await aplicarTema(perfil)
        setFase('ativado')
        return
      }
      setFase(r.situacao === 'agendado' ? 'agendado' : 'esperando')
    } catch (err) {
      // O CVV nunca sobrevive a uma tentativa, nem à que falhou.
      setCvv('')
      setErro(err instanceof Error ? err.message : 'Não foi possível concluir o pagamento agora.')
      setFase('formulario')
    }
  }

  if (fase === 'ativado') return <PlanoAtivado plan={plan} label={label} voltar={voltar} />

  if (fase === 'enviando') {
    return (
      <SubPage title="Processando…" backTo={voltar} backLabel="Voltar" documentTitle={`Assinar ${label}`}>
        <div
          role="status"
          className="flex flex-col items-center gap-4 rounded-xl2 border border-ink/10 bg-paper px-6 py-16 text-center shadow-card"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
          <p className="text-[14px] font-medium text-ink">
            {meio === 'CREDIT_CARD' ? 'Processando o pagamento…' : `Gerando ${meio === 'PIX' ? 'o Pix' : 'o boleto'}…`}
          </p>
          <p className="text-[12px] text-ink-faint">Não feche esta página.</p>
        </div>
      </SubPage>
    )
  }

  if (fase === 'agendado' && resultado) {
    return (
      <SubPage title="Assinatura marcada" backTo={voltar} backLabel="Voltar" documentTitle={`Assinar ${label}`}>
        <div className="rounded-xl2 border border-ink/10 bg-paper p-6 text-center shadow-card">
          <ClockIcon width={30} height={30} className="mx-auto text-brass-deep" />
          <p className="mt-3 text-[14px] leading-relaxed text-ink">
            Sua assinatura {label} começa em{' '}
            <span className="font-semibold">{dataCurta(resultado.vencimento)}</span>, quando termina o período
            que você já pagou.
          </p>
          <p className="mt-1.5 text-[12.5px] text-ink-faint">Nada é cobrado antes disso.</p>
          <button type="button" onClick={() => navigate(voltar)} className="btn-primary mt-5 w-full !py-3">
            Voltar
          </button>
        </div>
      </SubPage>
    )
  }

  if (fase === 'esperando' && resultado) {
    return (
      <SubPage
        title={resultado.meio === 'PIX' ? 'Pague com Pix' : resultado.meio === 'BOLETO' ? 'Pague o boleto' : 'Pagamento em análise'}
        backTo={voltar}
        backLabel="Voltar"
        documentTitle={`Assinar ${label}`}
      >
        <div className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-3">
            <span className="text-[13.5px] text-ink-soft">Plano {label} · mensal</span>
            <span className="font-display text-[20px] font-semibold tabular-nums text-ink">{reais(resultado.valor)}</span>
          </div>

          {resultado.meio === 'PIX' && (
            <div className="pt-4 text-center">
              {resultado.pix ? (
                <>
                  <img
                    src={`data:image/png;base64,${resultado.pix.imagem}`}
                    alt="QR Code do Pix"
                    width={220}
                    height={220}
                    className="mx-auto rounded-lg border border-ink/10"
                  />
                  <p className="mt-3 text-[12.5px] text-ink-soft">Ou copie o código e cole no app do banco:</p>
                  <div className="mt-2 flex items-stretch gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-left text-[12px] text-ink">
                      {resultado.pix.copiaECola}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        if (resultado.meio !== 'PIX' || !resultado.pix) return
                        setCopiado(await copiarTexto(resultado.pix.copiaECola))
                      }}
                      className="btn-primary !px-4 !py-2 !text-[13px]"
                    >
                      {copiado ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-ink-soft">O QR Code não carregou. Use a página de pagamento abaixo.</p>
              )}
              {resultado.fatura && (
                <a
                  href={resultado.fatura}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-[12.5px] font-semibold text-burgundy underline underline-offset-2"
                >
                  Abrir a página de pagamento
                </a>
              )}
            </div>
          )}

          {resultado.meio === 'BOLETO' && (
            <div className="pt-4">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                Pague até <span className="font-semibold text-ink">{dataCurta(resultado.vencimento)}</span>. A
                compensação leva até 3 dias úteis, e o plano abre sozinho quando o banco confirmar — pode fechar
                esta página.
              </p>
              {(resultado.boleto || resultado.fatura) && (
                <a
                  href={resultado.boleto || resultado.fatura}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary mt-4 w-full !py-3"
                >
                  Abrir o boleto
                </a>
              )}
            </div>
          )}

          {resultado.meio === 'CREDIT_CARD' && (
            <p className="pt-4 text-[13px] leading-relaxed text-ink-soft">
              O emissor do cartão ainda está analisando o pagamento. O plano abre sozinho quando for aprovado.
            </p>
          )}

          <p role="status" aria-live="polite" className="mt-4 flex items-center justify-center gap-2 text-[12px] text-ink-faint">
            {cansou ? (
              'Ainda não recebemos a confirmação. Se você já pagou, ela chega sozinha e o plano abre — pode fechar esta página.'
            ) : (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
                Esta página atualiza sozinha quando o pagamento for confirmado.
              </>
            )}
          </p>
        </div>
      </SubPage>
    )
  }

  // ---- Formulário -------------------------------------------------------------
  return (
    <SubPage
      title={`Assinar ${label}`}
      subtitle={oferta.pitch}
      icon={<ScaleIcon width={18} height={18} />}
      backTo={voltar}
      backLabel="Voltar"
      documentTitle={`Assinar ${label}`}
    >
      <form onSubmit={enviar} noValidate className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
        <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-3">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-faint">Resumo da assinatura</span>
          <span className="font-display text-[22px] font-semibold text-ink">
            {reais(valor)}
            <span className="ml-0.5 font-sans text-[13px] font-medium text-ink-faint">/mês</span>
          </span>
        </div>
        <p className="py-3 text-[13.5px] text-ink-soft">Plano {label} · renovação mensal</p>

        <fieldset className="border-t border-ink/10 pt-3.5">
          <legend className="mb-2 text-[12.5px] font-medium text-ink">Forma de pagamento</legend>
          <div role="radiogroup" className="grid gap-2">
            {MEIOS.map((m) => {
              const escolhido = meio === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={escolhido}
                  onClick={() => {
                    setMeio(m.id)
                    setErro(null)
                  }}
                  className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                    escolhido ? 'border-burgundy bg-burgundy/[0.04]' : 'border-ink/15 hover:border-ink/30'
                  }`}
                >
                  <span
                    className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      escolhido ? 'border-burgundy' : 'border-ink/30'
                    }`}
                  >
                    {escolhido && <span className="h-2 w-2 rounded-full bg-burgundy" />}
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-medium text-ink">{m.titulo}</span>
                    <span className="block text-[12px] leading-snug text-ink-faint">{m.detalhe}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="mt-4 space-y-3.5">
          <Campo id="doc" rotulo="CPF ou CNPJ" dica="exigido para emitir a cobrança">
            <input
              id="doc"
              value={documento}
              onChange={(e) => setDocumento(mascaraDocumento(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              className={inputClass}
            />
          </Campo>

          {meio === 'CREDIT_CARD' && (
            <>
              <Campo id="cc-numero" rotulo="Número do cartão">
                <input
                  id="cc-numero"
                  value={numero}
                  onChange={(e) => setNumero(mascaraCartao(e.target.value))}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                  className={inputClass}
                />
              </Campo>
              <Campo id="cc-nome" rotulo="Nome impresso no cartão">
                <input
                  id="cc-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value.toUpperCase())}
                  autoComplete="cc-name"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={inputClass}
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo id="cc-validade" rotulo="Validade">
                  <input
                    id="cc-validade"
                    value={validade}
                    onChange={(e) => setValidade(mascaraValidade(e.target.value))}
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/AA"
                    className={inputClass}
                  />
                </Campo>
                <Campo id="cc-cvv" rotulo="Código de segurança">
                  <input
                    id="cc-cvv"
                    value={cvv}
                    onChange={(e) => setCvv(digitos(e.target.value).slice(0, 4))}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="CVV"
                    className={inputClass}
                  />
                </Campo>
              </div>
              <p className="text-[12px] text-ink-faint">Endereço e telefone de quem recebe a fatura do cartão:</p>
              <div className="grid grid-cols-2 gap-3">
                <Campo id="cc-cep" rotulo="CEP">
                  <input
                    id="cc-cep"
                    value={cep}
                    onChange={(e) => setCep(mascaraCep(e.target.value))}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="00000-000"
                    className={inputClass}
                  />
                </Campo>
                <Campo id="cc-numero-endereco" rotulo="Número">
                  <input
                    id="cc-numero-endereco"
                    value={numeroEndereco}
                    onChange={(e) => setNumeroEndereco(e.target.value.slice(0, 10))}
                    autoComplete="off"
                    placeholder="123"
                    className={inputClass}
                  />
                </Campo>
              </div>
              <Campo id="cc-telefone" rotulo="Telefone">
                <input
                  id="cc-telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(00) 00000-0000"
                  className={inputClass}
                />
              </Campo>
            </>
          )}
        </div>

        {/* As regras da assinatura, as mesmas da home e dos Termos de Uso. */}
        <ul className="mt-4 space-y-1.5 border-t border-ink/10 pt-3.5">
          {REGRAS_DE_COBRANCA.map((r) => (
            <li key={r} className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
              <CheckIcon width={13} height={13} strokeWidth={2.4} className="mt-[3px] shrink-0 text-brass-deep" />
              {r}
            </li>
          ))}
        </ul>

        <ConfirmarEmailCartao contexto="assinar" className="mt-4" />

        {erro && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-[12.5px] text-burgundy-deep"
          >
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={emailPending}
          className="btn-primary mt-4 w-full !py-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {meio === 'CREDIT_CARD'
            ? `Pagar ${reais(valor)} e assinar`
            : `Gerar ${meio === 'PIX' ? 'Pix' : 'boleto'} de ${reais(valor)}`}
        </button>
        <button
          type="button"
          onClick={() => navigate(voltar)}
          className="mt-2 w-full py-2 text-[13px] font-medium text-ink-faint hover:text-ink"
        >
          Agora não
        </button>
        <p className="mt-3 text-center text-[11.5px] leading-relaxed text-ink-faint">
          Pagamento processado pelo Asaas. O advoc.me não guarda os dados do seu cartão nem o seu CPF.
          <br />
          Ao confirmar você aceita os{' '}
          <a href="/legal/termos" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
            Termos de Uso
          </a>
          , inclusive as condições de cobrança e cancelamento.
        </p>
      </form>
    </SubPage>
  )
}
