import { useState, type ReactNode } from 'react'
import {
  bandeiraDoNumero,
  digitos,
  documentoValido,
  mascaraCartao,
  mascaraCep,
  mascaraDocumento,
  mascaraTelefone,
  mascaraValidade,
  type Bandeira,
  type PedidoDeAssinatura,
} from '@/lib/pagamento'

// OS CAMPOS DO CARTÃO — uma peça só para os três lugares que pedem cartão:
// assinar (CheckoutPago), trocar o cartão e mudar de plano no cartão
// (MinhaAssinaturaPage). Três formulários com os mesmos campos divergem na
// primeira correção de texto, e divergência em formulário de pagamento é o tipo
// de detalhe que faz o advogado desconfiar da página.
//
// O DESENHO segue o que a pessoa já viu em todo checkout sério: número, validade
// e código num bloco só, a bandeira reconhecida enquanto digita, e os dados do
// titular numa grade curta. Os rótulos existem para leitor de tela (e para os
// testes) mesmo quando o bloco os esconde da vista.
//
// ⚠️ O estado vive aqui, na memória da tela, e em nenhum outro lugar. Nada de
// armazenamento do navegador (há teste em lib/pagamento.spec.ts que barra).

export const inputClass =
  'h-11 w-full rounded-lg border border-[#d5dce6] bg-white px-3.5 text-[14px] text-[#0f172a] placeholder:text-[#94a3b8] transition-[border-color,box-shadow] focus:border-[#0f172a] focus:outline-none focus:ring-4 focus:ring-[#0f172a]/[0.06]'

export function Campo({ id, rotulo, dica, children }: { id: string; rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <div className="block min-w-0">
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-[#475569]">{rotulo}</span>
        {dica && <span className="text-[11.5px] text-[#64748b]">{dica}</span>}
      </label>
      {children}
    </div>
  )
}

const NOME_DA_BANDEIRA: Record<Bandeira, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'Amex',
  hipercard: 'Hipercard',
}

/** O selo da bandeira no canto do campo — aparece quando os dígitos a revelam. */
function SeloDaBandeira({ bandeira }: { bandeira: Bandeira | null }) {
  if (!bandeira) {
    return (
      <svg aria-hidden width="26" height="18" viewBox="0 0 26 18" className="text-[#cbd5e1]">
        <rect x="0.75" y="0.75" width="24.5" height="16.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="0.75" y="4.5" width="24.5" height="3" fill="currentColor" />
      </svg>
    )
  }
  if (bandeira === 'mastercard') {
    return (
      <span className="flex items-center gap-1.5">
        <svg aria-hidden width="24" height="15" viewBox="0 0 24 15">
          <circle cx="8.5" cy="7.5" r="7" fill="#eb001b" />
          <circle cx="15.5" cy="7.5" r="7" fill="#f79e1b" fillOpacity="0.9" />
        </svg>
        <span className="sr-only">Mastercard</span>
      </span>
    )
  }
  return (
    <span
      className={`rounded px-1.5 py-[1px] text-[11px] font-bold tracking-wide ${
        bandeira === 'visa' ? 'italic text-[#1a1f71]' : 'border border-[#cbd5e1] text-[#475569]'
      }`}
    >
      {bandeira === 'visa' ? 'VISA' : NOME_DA_BANDEIRA[bandeira]}
    </span>
  )
}

const VAZIO = {
  documento: '',
  numero: '',
  nome: '',
  validade: '',
  cvv: '',
  cep: '',
  numeroEndereco: '',
  telefone: '',
}
type Dados = typeof VAZIO

export function useCartao() {
  const [d, setD] = useState<Dados>(VAZIO)
  const set = (campo: keyof Dados) => (valor: string) => setD((s) => ({ ...s, [campo]: valor }))

  /** A primeira coisa a corrigir, na ordem em que os campos aparecem. */
  function problema(comCartao: boolean): string | null {
    if (!comCartao) return documentoValido(d.documento) ? null : 'Confira o CPF ou CNPJ: o número não é válido.'
    const n = digitos(d.numero)
    if (n.length < 13 || n.length > 19) return 'Confira o número do cartão.'
    const v = /^(\d{2})\/(\d{2})$/.exec(d.validade)
    if (!v || Number(v[1]) < 1 || Number(v[1]) > 12) return 'Confira a validade do cartão (MM/AA).'
    if (digitos(d.cvv).length < 3 || digitos(d.cvv).length > 4) return 'Confira o código de segurança do cartão.'
    if (d.nome.trim().length < 2) return 'Informe o nome como está impresso no cartão.'
    if (!documentoValido(d.documento)) return 'Confira o CPF ou CNPJ: o número não é válido.'
    const t = digitos(d.telefone)
    if (t.length < 10 || t.length > 11) return 'Confira o telefone, com DDD.'
    if (digitos(d.cep).length !== 8) return 'Confira o CEP do endereço da fatura do cartão.'
    if (!d.numeroEndereco.trim()) return 'Informe o número do endereço da fatura do cartão.'
    return null
  }

  /** O que vai ao servidor. Só chame depois de `problema()` devolver null. */
  function pedido(): {
    cpfCnpj: string
    cartao: NonNullable<PedidoDeAssinatura['cartao']>
    titular: NonNullable<PedidoDeAssinatura['titular']>
  } {
    const [mes, ano] = d.validade.split('/')
    return {
      cpfCnpj: digitos(d.documento),
      cartao: { numero: digitos(d.numero), nomeImpresso: d.nome.trim(), mes, ano, cvv: digitos(d.cvv) },
      titular: { cep: digitos(d.cep), numeroEndereco: d.numeroEndereco.trim(), telefone: digitos(d.telefone) },
    }
  }

  return {
    d,
    set,
    problema,
    pedido,
    documento: () => digitos(d.documento),
    /** Depois que o servidor responde: número, validade e CVV saem da tela. */
    apagarSensiveis: () => setD((s) => ({ ...s, numero: '', validade: '', cvv: '' })),
    /** O CVV nunca sobrevive a uma tentativa, nem à que falhou. */
    apagarCvv: () => setD((s) => ({ ...s, cvv: '' })),
  }
}

export type EstadoDoCartao = ReturnType<typeof useCartao>

/** Campo sem moldura, para viver dentro do bloco agrupado do cartão. */
const semMoldura =
  'h-12 w-full min-w-0 bg-transparent px-4 text-[15px] text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none'

export function CamposDoCartao({
  estado,
  comCartao,
  prefixo = 'cc',
}: {
  estado: EstadoDoCartao
  comCartao: boolean
  /** ids distintos quando há dois formulários na mesma página */
  prefixo?: string
}) {
  const { d, set } = estado
  const id = (s: string) => `${prefixo}-${s}`

  const documento = (
    <Campo id={id('doc')} rotulo="CPF ou CNPJ">
      <input
        id={id('doc')}
        value={d.documento}
        onChange={(e) => set('documento')(mascaraDocumento(e.target.value))}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        className={inputClass}
      />
    </Campo>
  )

  if (!comCartao) {
    return (
      <div>
        {documento}
        <p className="mt-2 text-[12px] leading-relaxed text-[#64748b]">
          Exigido para emitir a cobrança. Vai para o processador de pagamento e não fica guardado no advoc.me.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-1.5 text-[12.5px] font-medium text-[#475569]">Dados do cartão</legend>
        {/* O bloco agrupado: uma moldura só, que acende inteira quando qualquer
            um dos três campos está em foco. */}
        <div className="overflow-hidden rounded-xl border border-[#d5dce6] bg-white transition-[border-color,box-shadow] focus-within:border-[#0f172a] focus-within:ring-4 focus-within:ring-[#0f172a]/[0.06]">
          <div className="flex items-center border-b border-[#e6ebf2] pr-3.5">
            <label htmlFor={id('numero')} className="sr-only">
              Número do cartão
            </label>
            <input
              id={id('numero')}
              value={d.numero}
              onChange={(e) => set('numero')(mascaraCartao(e.target.value))}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="Número do cartão"
              className={`${semMoldura} tabular-nums tracking-[0.04em]`}
            />
            <SeloDaBandeira bandeira={bandeiraDoNumero(d.numero)} />
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#e6ebf2]">
            <div>
              <label htmlFor={id('validade')} className="sr-only">
                Validade
              </label>
              <input
                id={id('validade')}
                value={d.validade}
                onChange={(e) => set('validade')(mascaraValidade(e.target.value))}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="Validade (MM/AA)"
                className={`${semMoldura} tabular-nums`}
              />
            </div>
            <div>
              <label htmlFor={id('cvv')} className="sr-only">
                Código de segurança
              </label>
              <input
                id={id('cvv')}
                value={d.cvv}
                onChange={(e) => set('cvv')(digitos(e.target.value).slice(0, 4))}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVV"
                className={`${semMoldura} tabular-nums`}
              />
            </div>
          </div>
        </div>
      </fieldset>

      <Campo id={id('nome')} rotulo="Nome impresso no cartão">
        <input
          id={id('nome')}
          value={d.nome}
          onChange={(e) => set('nome')(e.target.value.toUpperCase())}
          autoComplete="cc-name"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="COMO ESTÁ NO CARTÃO"
          className={`${inputClass} tracking-[0.02em]`}
        />
      </Campo>

      <fieldset>
        <legend className="mb-3 text-[12.5px] font-medium text-[#475569]">
          Titular da fatura <span className="font-normal text-[#64748b]">— exigido pela operadora do cartão</span>
        </legend>
        {/* No celular, CPF/CNPJ e telefone ocupam a linha (o CNPJ mascarado não
            cabe em meia coluna) e CEP + número dividem uma — uma linha a menos
            de formulário antes do botão. */}
        <div className="grid grid-cols-2 gap-3 [&>*:nth-child(-n+2)]:col-span-2 sm:[&>*:nth-child(-n+2)]:col-span-1">
          {documento}
          <Campo id={id('telefone')} rotulo="Telefone">
            <input
              id={id('telefone')}
              value={d.telefone}
              onChange={(e) => set('telefone')(mascaraTelefone(e.target.value))}
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </Campo>
          <Campo id={id('cep')} rotulo="CEP">
            <input
              id={id('cep')}
              value={d.cep}
              onChange={(e) => set('cep')(mascaraCep(e.target.value))}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              className={inputClass}
            />
          </Campo>
          <Campo id={id('numero-endereco')} rotulo="Número">
            <input
              id={id('numero-endereco')}
              value={d.numeroEndereco}
              onChange={(e) => set('numeroEndereco')(e.target.value.slice(0, 10))}
              autoComplete="off"
              placeholder="Nº do endereço"
              className={inputClass}
            />
          </Campo>
        </div>
      </fieldset>
    </div>
  )
}
