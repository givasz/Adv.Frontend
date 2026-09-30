import { useState, type ReactNode } from "react";
import {
  digitos,
  documentoValido,
  mascaraCartao,
  mascaraCep,
  mascaraDocumento,
  mascaraTelefone,
  mascaraValidade,
  type PedidoDeAssinatura,
} from "@/lib/pagamento";

// OS CAMPOS DO CARTÃO — uma peça só para os três lugares que pedem cartão:
// assinar (CheckoutPago), trocar o cartão e trocar de plano no cartão
// (MinhaAssinaturaPage). Três formulários com os mesmos campos divergem na
// primeira correção de texto, e divergência em formulário de pagamento é o tipo
// de detalhe que faz o advogado desconfiar da página.
//
// ⚠️ O estado vive aqui, na memória da tela, e em nenhum outro lugar. Nada de
// armazenamento do navegador (há teste em lib/pagamento.spec.ts que barra).

export const inputClass =
  "w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15";

export function Campo({
  id,
  rotulo,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline justify-between gap-2"
      >
        <span className="text-[12.5px] font-medium text-ink">{rotulo}</span>
        {dica && <span className="text-[11.5px] text-ink-faint">{dica}</span>}
      </label>
      {children}
    </div>
  );
}

const VAZIO = {
  documento: "",
  numero: "",
  nome: "",
  validade: "",
  cvv: "",
  cep: "",
  numeroEndereco: "",
  telefone: "",
};
type Dados = typeof VAZIO;

export function useCartao() {
  const [d, setD] = useState<Dados>(VAZIO);
  const set = (campo: keyof Dados) => (valor: string) =>
    setD((s) => ({ ...s, [campo]: valor }));

  /** A primeira coisa a corrigir, na ordem em que os campos aparecem. */
  function problema(comCartao: boolean): string | null {
    if (!documentoValido(d.documento))
      return "Confira o CPF ou CNPJ: o número não é válido.";
    if (!comCartao) return null;
    const n = digitos(d.numero);
    if (n.length < 13 || n.length > 19) return "Confira o número do cartão.";
    if (d.nome.trim().length < 2)
      return "Informe o nome como está impresso no cartão.";
    const v = /^(\d{2})\/(\d{2})$/.exec(d.validade);
    if (!v || Number(v[1]) < 1 || Number(v[1]) > 12)
      return "Confira a validade do cartão (MM/AA).";
    if (digitos(d.cvv).length < 3 || digitos(d.cvv).length > 4)
      return "Confira o código de segurança do cartão.";
    if (digitos(d.cep).length !== 8)
      return "Confira o CEP do endereço da fatura do cartão.";
    if (!d.numeroEndereco.trim())
      return "Informe o número do endereço da fatura do cartão.";
    const t = digitos(d.telefone);
    if (t.length < 10 || t.length > 11) return "Confira o telefone, com DDD.";
    return null;
  }

  /** O que vai ao servidor. Só chame depois de `problema()` devolver null. */
  function pedido(): {
    cpfCnpj: string;
    cartao: NonNullable<PedidoDeAssinatura["cartao"]>;
    titular: NonNullable<PedidoDeAssinatura["titular"]>;
  } {
    const [mes, ano] = d.validade.split("/");
    return {
      cpfCnpj: digitos(d.documento),
      cartao: {
        numero: digitos(d.numero),
        nomeImpresso: d.nome.trim(),
        mes,
        ano,
        cvv: digitos(d.cvv),
      },
      titular: {
        cep: digitos(d.cep),
        numeroEndereco: d.numeroEndereco.trim(),
        telefone: digitos(d.telefone),
      },
    };
  }

  return {
    d,
    set,
    problema,
    pedido,
    documento: () => digitos(d.documento),
    /** Depois que o servidor responde: número, validade e CVV saem da tela. */
    apagarSensiveis: () =>
      setD((s) => ({ ...s, numero: "", validade: "", cvv: "" })),
    /** O CVV nunca sobrevive a uma tentativa, nem à que falhou. */
    apagarCvv: () => setD((s) => ({ ...s, cvv: "" })),
  };
}

export type EstadoDoCartao = ReturnType<typeof useCartao>;

export function CamposDoCartao({
  estado,
  comCartao,
  prefixo = "cc",
  mostrarDocumento = true,
}: {
  estado: EstadoDoCartao;
  comCartao: boolean;
  /** ids distintos quando há dois formulários na mesma página */
  prefixo?: string;
  mostrarDocumento?: boolean;
}) {
  const { d, set } = estado;
  return (
    <div className="space-y-3.5">
      {mostrarDocumento && (
        <Campo
          id={`${prefixo}-doc`}
          rotulo="CPF ou CNPJ"
          dica="exigido para emitir a cobrança"
        >
          <input
            id={`${prefixo}-doc`}
            value={d.documento}
            onChange={(e) => set("documento")(mascaraDocumento(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            className={inputClass}
          />
        </Campo>
      )}

      {comCartao && (
        <>
          <Campo id={`${prefixo}-numero`} rotulo="Número do cartão">
            <input
              id={`${prefixo}-numero`}
              value={d.numero}
              onChange={(e) => set("numero")(mascaraCartao(e.target.value))}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              className={inputClass}
            />
          </Campo>
          <Campo id={`${prefixo}-nome`} rotulo="Nome impresso no cartão">
            <input
              id={`${prefixo}-nome`}
              value={d.nome}
              onChange={(e) => set("nome")(e.target.value.toUpperCase())}
              autoComplete="cc-name"
              autoCapitalize="characters"
              spellCheck={false}
              className={inputClass}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id={`${prefixo}-validade`} rotulo="Validade">
              <input
                id={`${prefixo}-validade`}
                value={d.validade}
                onChange={(e) =>
                  set("validade")(mascaraValidade(e.target.value))
                }
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
                className={inputClass}
              />
            </Campo>
            <Campo id={`${prefixo}-cvv`} rotulo="Código de segurança">
              <input
                id={`${prefixo}-cvv`}
                value={d.cvv}
                onChange={(e) =>
                  set("cvv")(digitos(e.target.value).slice(0, 4))
                }
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVV"
                className={inputClass}
              />
            </Campo>
          </div>
          <p className="text-[12px] text-ink-faint">
            Endereço e telefone de quem recebe a fatura do cartão:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo id={`${prefixo}-cep`} rotulo="CEP">
              <input
                id={`${prefixo}-cep`}
                value={d.cep}
                onChange={(e) => set("cep")(mascaraCep(e.target.value))}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
                className={inputClass}
              />
            </Campo>
            <Campo id={`${prefixo}-numero-endereco`} rotulo="Número">
              <input
                id={`${prefixo}-numero-endereco`}
                value={d.numeroEndereco}
                onChange={(e) =>
                  set("numeroEndereco")(e.target.value.slice(0, 10))
                }
                autoComplete="off"
                placeholder="123"
                className={inputClass}
              />
            </Campo>
          </div>
          <Campo id={`${prefixo}-telefone`} rotulo="Telefone">
            <input
              id={`${prefixo}-telefone`}
              value={d.telefone}
              onChange={(e) => set("telefone")(mascaraTelefone(e.target.value))}
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </Campo>
        </>
      )}
    </div>
  );
}
