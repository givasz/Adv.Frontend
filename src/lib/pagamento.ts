// O PAGAMENTO — o que a tela do checkout manda ao servidor e o que recebe de volta.
//
// Espelha backend/src/billing/checkout.service.ts. O servidor é quem decide: ele
// confere tudo de novo, calcula o preço e fala com o Asaas. O que mora aqui é o
// que faz a tela ser boa de usar — máscara enquanto digita, erro no campo antes
// de enviar —, nunca o que decide cobrança.
//
// ⚠️ NADA DESTE ARQUIVO GRAVA. Número do cartão, validade, CVV e CPF vivem só no
// estado da tela, vão ao servidor numa requisição e somem. Nada de localStorage,
// sessionStorage, rascunho ou log — a regra "salvar antes de sair" dos editores
// NÃO vale aqui, de propósito.

export type MeioDePagamento = "CREDIT_CARD" | "PIX" | "BOLETO";

export interface PedidoDeAssinatura {
  plano: "pro" | "premium";
  meio: MeioDePagamento;
  cpfCnpj: string;
  cartao?: {
    numero: string;
    nomeImpresso: string;
    mes: string;
    ano: string;
    cvv: string;
  };
  titular?: { cep: string; numeroEndereco: string; telefone: string };
}

export type ResultadoDoCheckout =
  | {
      meio: "CREDIT_CARD";
      situacao: "ativo" | "agendado" | "em_analise";
      plano: "pro" | "premium";
      valor: number;
      vencimento?: string;
      cartao: { final?: string; bandeira?: string };
    }
  | {
      meio: "PIX";
      situacao: "aguardando" | "agendado";
      plano: "pro" | "premium";
      valor: number;
      vencimento?: string;
      pix?: { imagem: string; copiaECola: string; expiraEm?: string };
      fatura?: string;
    }
  | {
      meio: "BOLETO";
      situacao: "aguardando" | "agendado";
      plano: "pro" | "premium";
      valor: number;
      vencimento?: string;
      boleto?: string;
      fatura?: string;
    };

export const digitos = (v: string): string => v.replace(/\D/g, "");

// ---- CPF e CNPJ (mesma conta do servidor: backend/src/billing/documento.ts) ----

function dv(base: string, pesos: number[]): number {
  const soma = base.split("").reduce((t, c, i) => t + Number(c) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function documentoValido(v: string): boolean {
  const d = digitos(v);
  if (/^(\d)\1+$/.test(d)) return false;
  if (d.length === 11) {
    return (
      dv(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) &&
      dv(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10])
    );
  }
  if (d.length === 14) {
    return (
      dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
        Number(d[12]) &&
      dv(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
        Number(d[13])
    );
  }
  return false;
}

// ---- Máscaras enquanto digita -------------------------------------------------
//
// Cada uma recebe o que está no campo e devolve o que deve ficar nele. Aceitam
// colagem com qualquer pontuação: o que importa são os dígitos.

/** CPF até 11 dígitos, CNPJ a partir do 12º — o mesmo campo serve aos dois. */
export function mascaraDocumento(v: string): string {
  const d = digitos(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Número do cartão em grupos de quatro. */
export function mascaraCartao(v: string): string {
  return digitos(v)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Validade no formato MM/AA. */
export function mascaraValidade(v: string): string {
  const d = digitos(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function mascaraCep(v: string): string {
  const d = digitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function mascaraTelefone(v: string): string {
  const d = digitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** "2026-10-29" → "29/10/2026", sem passar por Date (fuso de Brasília não importa aqui). */
export function dataCurta(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** 49 → "R$ 49,00" */
export function reais(valor: number): string {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

// ---- Minha assinatura (espelha backend/src/billing/minha-assinatura.service.ts) ----

export type PlanoDaConta = "free" | "pro" | "premium";
export type SituacaoDaCobranca = "active" | "past_due" | "canceled" | "paused";

export interface ResumoDaAssinatura {
  /** o pagamento on-line está ligado no servidor */
  online: boolean;
  plano: PlanoDaConta;
  vigente: PlanoDaConta;
  status: SituacaoDaCobranca;
  validoAte: string | null;
  planScheduled: PlanoDaConta | null;
  assinatura: null | {
    /** o plano que esta assinatura cobra — o que está sendo comprado, antes do 1º pagamento */
    planoCobrado: PlanoDaConta | null;
    meio: MeioDePagamento;
    valor: number;
    proximaCobranca: string | null;
    cartao?: { final?: string; bandeira?: string };
    emAberto: null | {
      vencimento: string;
      valor: number;
      vencida: boolean;
      fatura?: string;
      boleto?: string;
      pix?: { imagem: string; copiaECola: string };
    };
    arrependimentoAte: string | null;
  };
}

export interface ResultadoDoCancelamento {
  ok: true;
  valeAte: string | null;
  devolucao: "feita" | "pendente" | null;
  valorDevolvido: number;
}

/** Erro do servidor com um código que a tela sabe tratar (ex.: `precisa_cartao`). */
export class ErroComCodigo extends Error {
  constructor(
    message: string,
    readonly codigo?: string,
  ) {
    super(message);
  }
}

/** Bandeira como se escreve: "VISA" → "Visa", "MASTERCARD" → "Mastercard". */
export function nomeDaBandeira(b?: string): string {
  if (!b) return "Cartão";
  const especiais: Record<string, string> = {
    AMEX: "American Express",
    HIPERCARD: "Hipercard",
    ELO: "Elo",
  };
  return (
    especiais[b.toUpperCase()] ??
    b.charAt(0).toUpperCase() + b.slice(1).toLowerCase()
  );
}

/** Um mês antes, no mesmo dia (o início do ciclo mensal que termina em `iso`). */
export function umMesAntes(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  let ano = Number(m[1]);
  let mes = Number(m[2]) - 1;
  if (mes === 0) {
    mes = 12;
    ano -= 1;
  }
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = Math.min(Number(m[3]), ultimo);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
