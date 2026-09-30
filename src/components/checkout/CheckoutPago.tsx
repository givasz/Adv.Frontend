import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Profile } from "@/lib/types";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { copiarTexto } from "@/lib/copiar";
import { PLAN_PRICE } from "@/lib/plans";
import { REGRAS_DE_COBRANCA, offerOf } from "@/lib/planOffer";
import { getTheme, isThemeUnlocked, type ThemeId } from "@/lib/themes";
import {
  dataCurta,
  reais,
  type MeioDePagamento,
  type ResultadoDoCheckout,
} from "@/lib/pagamento";
import { ConfirmarEmailCartao } from "@/components/auth/EmailDaConta";
import { Marca } from "@/components/ui/Marca";
import {
  ArrowLeft,
  CardIcon,
  CheckIcon,
  ChevronDown,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  LockIcon,
} from "@/components/ui/icons";
import { PlanoAtivado } from "./PlanoAtivado";
import { CamposDoCartao, useCartao } from "./CamposDoCartao";

// O CHECKOUT PAGO — cartão, Pix ou boleto, pelo Asaas.
//
// Só aparece com o pagamento on-line ligado (PAGAMENTO_ONLINE_DISPONIVEL). Sem
// ele, CheckoutPage segue ativando o plano como sempre fez.
//
// POR QUE ESTA TELA NÃO SE PARECE COM O RESTO DO PRODUTO
// ------------------------------------------------------
// O resto do advoc.me é papel, tinta, latão e vinho — a vitrine de um escritório.
// Aqui a pessoa digita o cartão, e o que ela precisa sentir é outra coisa: que
// está num ambiente FINANCEIRO sério. Isso se diz com o que ela já conhece de
// banco e de checkout: fundo neutro frio, folha branca, texto azul-marinho,
// campos do cartão num bloco só, a bandeira reconhecida enquanto digita, o valor
// escrito no botão e o cadeado. A casa aparece em dois pontos só: a marca no
// cabeçalho e o SELO dourado da garantia de 7 dias, desenhado como um carimbo —
// o mundo do advogado dizendo "isto está garantido". Decidido em 30/09/2026, a
// pedido: "mais profissional, que transpasse confiança". Não é descuido com o
// design system; é a exceção de propósito.
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

type Fase =
  | "conferindo"
  | "formulario"
  | "enviando"
  | "esperando"
  | "agendado"
  | "ativado";

const MEIOS: { id: MeioDePagamento; titulo: string; detalhe: string }[] = [
  {
    id: "CREDIT_CARD",
    titulo: "Cartão",
    detalhe: "Aprovado na hora e renovado automaticamente todo mês.",
  },
  {
    id: "PIX",
    titulo: "Pix",
    detalhe:
      "O QR Code aparece na próxima tela. A cada mês, uma nova cobrança Pix chega por e-mail.",
  },
  {
    id: "BOLETO",
    titulo: "Boleto",
    detalhe:
      "Compensa em até 3 dias úteis. A cada mês, um novo boleto chega por e-mail.",
  },
];

/** Quanto tempo a tela espera o Pix cair antes de dizer que pode ser fechada. */
const ESPERA_MAXIMA_MS = 20 * 60 * 1000;
const INTERVALO_MS = 5000;

// A paleta desta tela — e só desta (ver o cabeçalho do arquivo).
//   fundo #f3f5f8 · folha branca · linhas #e3e8ef
//   texto #0f172a / #475569 / #64748b · extrato #0e1a2b
//   dourado do selo #c8a96a · verde só em sinal de segurança #15803d

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-10-30" → "30 de outubro". */
function porExtenso(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return a && m && d ? `${d} de ${MESES[m - 1]}` : "";
}

/** Hoje em Brasília, yyyy-mm-dd — a mesma régua do servidor. */
function hojeEmBrasilia(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Hoje + 1 mês (o dia 31 vira o último dia do mês seguinte), como o Asaas renova. */
function daquiAUmMes(): string {
  const [a, m, d] = hojeEmBrasilia().split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(d, ultimo)))
    .toISOString()
    .slice(0, 10);
}

// ---- Peças visuais ------------------------------------------------------------

/** O selo da garantia: um carimbo circular, o único dourado da tela. */
function SeloDaGarantia() {
  return (
    <svg
      aria-hidden
      width="72"
      height="72"
      viewBox="0 0 76 76"
      className="shrink-0"
    >
      <defs>
        <path
          id="selo-garantia-arco"
          d="M 38,38 m -28,0 a 28,28 0 1,1 56,0 a 28,28 0 1,1 -56,0"
        />
      </defs>
      <circle
        cx="38"
        cy="38"
        r="36.5"
        fill="none"
        stroke="#c8a96a"
        strokeWidth="1"
      />
      <circle
        cx="38"
        cy="38"
        r="34"
        fill="none"
        stroke="#c8a96a"
        strokeOpacity="0.45"
        strokeWidth="0.6"
      />
      <circle
        cx="38"
        cy="38"
        r="20.5"
        fill="none"
        stroke="#c8a96a"
        strokeOpacity="0.7"
        strokeWidth="0.6"
      />
      <text
        fontSize="5.9"
        letterSpacing="1.25"
        fill="#c8a96a"
        fontFamily="'IBM Plex Sans', system-ui, sans-serif"
        fontWeight="600"
      >
        <textPath href="#selo-garantia-arco" startOffset="1">
          GARANTIA · DEVOLUÇÃO INTEGRAL ·
        </textPath>
      </text>
      <text
        x="38"
        y="42"
        textAnchor="middle"
        fontSize="18"
        fill="#ecdcb6"
        fontFamily="Fraunces, Georgia, serif"
        fontWeight="600"
      >
        7
      </text>
      <text
        x="38"
        y="50"
        textAnchor="middle"
        fontSize="5.4"
        letterSpacing="1.3"
        fill="#c8a96a"
        fontFamily="'IBM Plex Sans', system-ui, sans-serif"
        fontWeight="600"
      >
        DIAS
      </text>
    </svg>
  );
}

function IconeDoMeio({ meio }: { meio: MeioDePagamento }) {
  if (meio === "CREDIT_CARD") return <CardIcon width={17} height={17} />;
  if (meio === "PIX") {
    return (
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <path d="M8 1.6 14.4 8 8 14.4 1.6 8Z" />
        <path d="M5.4 8h5.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden width="17" height="17" viewBox="0 0 17 17" fill="currentColor">
      <rect x="1.5" y="3" width="1.3" height="11" rx="0.3" />
      <rect x="4" y="3" width="0.7" height="11" />
      <rect x="6" y="3" width="1.8" height="11" rx="0.3" />
      <rect x="9" y="3" width="0.7" height="11" />
      <rect x="11" y="3" width="1.3" height="11" rx="0.3" />
      <rect x="13.5" y="3" width="2" height="11" rx="0.3" />
    </svg>
  );
}

/** A moldura do checkout: cabeçalho próprio e enxuto, e as duas colunas. */
function Moldura({
  voltar,
  resumo,
  children,
}: {
  voltar: string;
  resumo: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#f3f5f8] font-ui text-[#0f172a] antialiased">
      <header className="border-b border-[#e3e8ef] bg-white">
        <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
          <Link
            to={voltar}
            className="inline-flex items-center gap-1.5 justify-self-start rounded-md py-2 pr-2 text-[13px] font-medium text-[#475569] transition-colors hover:text-[#0f172a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/20"
          >
            <ArrowLeft width={15} height={15} />
            Voltar
          </Link>
          <span className="flex items-center gap-2">
            <Marca size={18} />
            <span className="text-[14.5px] font-semibold tracking-tight">
              advoc.me
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 justify-self-end text-[12px] font-medium text-[#15803d]">
            <LockIcon width={13} height={13} strokeWidth={2.2} />
            <span className="hidden sm:inline">Pagamento seguro</span>
            <span className="sr-only sm:hidden">Pagamento seguro</span>
          </span>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl items-start gap-4 px-4 pb-12 pt-4 sm:px-6 sm:pt-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:pt-12">
        {resumo}
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  );
}

/** O resumo do pedido — o extrato escuro à esquerda (no celular, em cima). */
function ResumoDoPedido({
  label,
  pitch,
  itens,
  valor,
  inicioFuturo,
}: {
  label: string;
  pitch: string;
  itens: string[];
  valor: number;
  /** quem cancelou e ainda tem dias pagos: a primeira cobrança é nessa data */
  inicioFuturo: string | null;
}) {
  const lista = (
    <ul className="space-y-2.5">
      {itens.map((t) => (
        <li
          key={t}
          className="flex items-start gap-2.5 text-[13px] leading-snug text-[#cbd5e1]"
        >
          <CheckIcon
            width={14}
            height={14}
            strokeWidth={2.4}
            className="mt-[2px] shrink-0 text-[#c8a96a]"
          />
          {t}
        </li>
      ))}
    </ul>
  );
  return (
    <aside
      aria-label="Resumo do pedido"
      className="rounded-2xl bg-[#0e1a2b] p-5 text-[#e8edf3] shadow-[0_30px_60px_-35px_rgba(14,26,43,0.6)] sm:p-8 lg:sticky lg:top-8"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c8a96a]">
        Você está assinando
      </p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-[34px] font-semibold leading-none text-white">
            {label}
          </p>
          <p className="mt-2 text-[13px] leading-snug text-[#94a3b8]">
            {pitch}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-[26px] font-semibold leading-none tabular-nums text-white">
            {reais(valor)}
          </span>
          <span className="mt-1.5 block text-[12px] text-[#94a3b8]">
            por mês
          </span>
        </p>
      </div>

      {/* O que o plano entrega: aberto no computador, recolhido no celular — no
          celular o formulário precisa aparecer sem rolar meia tela. */}
      <div className="mt-7 hidden border-t border-white/[0.08] pt-6 lg:block">
        <p className="mb-3.5 text-[12px] font-medium text-[#94a3b8]">
          Incluso no plano
        </p>
        {lista}
      </div>
      <details className="group mt-5 border-t border-white/[0.08] pt-4 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-[#cbd5e1] [&::-webkit-details-marker]:hidden">
          O que está incluso
          <ChevronDown
            width={16}
            height={16}
            className="text-[#94a3b8] transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="mt-3.5">{lista}</div>
      </details>

      <dl className="mt-6 space-y-2.5 border-t border-white/[0.08] pt-5 text-[13.5px]">
        <div className="flex justify-between gap-3 text-[#cbd5e1]">
          <dt>Plano {label} · mensal</dt>
          <dd className="tabular-nums">{reais(valor)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-[15px] font-semibold text-white">
          <dt>{inicioFuturo ? "Cobrado hoje" : "Total hoje"}</dt>
          <dd className="tabular-nums">{reais(inicioFuturo ? 0 : valor)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[12px] leading-relaxed text-[#94a3b8]">
        {inicioFuturo
          ? `A primeira cobrança é em ${porExtenso(inicioFuturo)}, quando terminam os dias que você já pagou.`
          : `Renova em ${porExtenso(daquiAUmMes())}. Sem fidelidade: cancele quando quiser.`}
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-[#c8a96a]/25 bg-white/[0.03] p-4">
        <SeloDaGarantia />
        <p className="text-[12.5px] leading-relaxed text-[#cbd5e1]">
          <span className="font-semibold text-white">Garantia de 7 dias.</span>{" "}
          Cancele em até 7 dias pelo próprio site e receba o valor integral de
          volta, sem precisar pedir a ninguém.
        </p>
      </div>
    </aside>
  );
}

/** A folha branca da coluna da direita. */
function Folha({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e3e8ef] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-26px_rgba(15,23,42,0.25)] sm:p-8">
      {children}
    </div>
  );
}

const botaoEscuro =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.7)] transition-colors hover:bg-[#1e293b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0f172a]/20";

function Girando({ tamanho = 12 }: { tamanho?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho }}
      className="inline-block shrink-0 animate-spin rounded-full border-2 border-[#e3e8ef] border-t-[#0f172a]"
    />
  );
}

// As regras da assinatura são as mesmas da home e dos Termos (planOffer.ts). A do
// Asaas sai daqui porque a linha de segurança logo acima do botão já diz isso.
const REGRAS = REGRAS_DE_COBRANCA.filter(
  (r) => !r.startsWith("Pagamento processado"),
);

// ---- O checkout ------------------------------------------------------------------

export function CheckoutPago({
  plan,
  label,
  tema,
  voltar,
}: {
  plan: "pro" | "premium";
  label: string;
  tema: ThemeId | null;
  voltar: string;
}) {
  const navigate = useNavigate();
  const { emailPending } = useAuth();
  const oferta = offerOf(plan);
  const valor = PLAN_PRICE[plan];
  // O que o plano entrega, da MESMA oferta da vitrine (planOffer.ts): o resumo
  // não pode prometer nada que a página de planos não promete. Sem os itens em
  // preparo e sem o "Tudo do Pro, e mais:", que é título e não recurso.
  const itens = oferta.items
    .filter((i) => !i.emPreparo && !i.text.startsWith("Tudo do "))
    .slice(0, 5)
    .map((i) => i.text);

  const [fase, setFase] = useState<Fase>("conferindo");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoDoCheckout | null>(null);
  const [cansou, setCansou] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [meio, setMeio] = useState<MeioDePagamento>("CREDIT_CARD");
  const [inicioFuturo, setInicioFuturo] = useState<string | null>(null);
  const cartao = useCartao();

  useEffect(() => {
    document.title = `Assinar ${label} · advoc.me`;
  }, [label]);

  // Quem JÁ tem assinatura ativa (o Pro que clicou em "Assinar o Max") não
  // assina de novo: troca de plano. A página leva direto à tela certa, com o
  // plano escolhido — em vez de um formulário que terminaria num erro. E quem
  // cancelou e ainda tem dias pagos vê no resumo que a primeira cobrança só
  // acontece quando esses dias acabam (é o que o servidor faz: checkout.service).
  useEffect(() => {
    let viva = true;
    api
      .minhaAssinatura()
      .then((r) => {
        if (!viva) return;
        if (r.assinatura && r.status !== "canceled") {
          navigate(`/assinatura?trocar=${plan}`, { replace: true });
          return;
        }
        const ate = r.validoAte?.slice(0, 10);
        if (
          r.status === "canceled" &&
          r.vigente !== "free" &&
          ate &&
          ate > hojeEmBrasilia()
        )
          setInicioFuturo(ate);
      })
      .catch(() => {})
      .finally(() => {
        if (viva) setFase((f) => (f === "conferindo" ? "formulario" : f));
      });
    return () => {
      viva = false;
    };
  }, [plan]);

  /**
   * Quem assinou PROVANDO um tema fica com ele (mesma regra do checkout antigo):
   * pedir para escolher de novo depois de pagar seria perder o que motivou a compra.
   */
  async function aplicarTema(perfil: Profile) {
    if (
      tema &&
      isThemeUnlocked(getTheme(tema), plan) &&
      perfil.theme !== tema
    ) {
      await api.saveDraft({ ...perfil, theme: tema }).catch(() => {});
    }
  }

  // Pix, boleto e cartão em análise: relê o perfil até o plano aparecer. Pausa com
  // a aba escondida (não há por que consultar o servidor para ninguém ver) e
  // desiste depois de 20 minutos — o plano abre do mesmo jeito, só não há mais
  // motivo para esta aba ficar perguntando.
  useEffect(() => {
    if (fase !== "esperando") return;
    let viva = true;
    const inicio = Date.now();
    const id = window.setInterval(async () => {
      if (document.hidden) return;
      if (Date.now() - inicio > ESPERA_MAXIMA_MS) {
        window.clearInterval(id);
        if (viva) setCansou(true);
        return;
      }
      const perfil = await api.getDraft().catch(() => null);
      if (!viva || !perfil || perfil.plan !== plan) return;
      window.clearInterval(id);
      await aplicarTema(perfil);
      if (viva) setFase("ativado");
    }, INTERVALO_MS);
    return () => {
      viva = false;
      window.clearInterval(id);
    };
  }, [fase, plan]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (fase === "enviando") return;
    const comCartao = meio === "CREDIT_CARD";
    const p = cartao.problema(comCartao);
    if (p) {
      setErro(p);
      return;
    }
    setErro(null);
    setFase("enviando");
    try {
      const r = await api.assinar(
        comCartao
          ? { plano: plan, meio, ...cartao.pedido() }
          : { plano: plan, meio, cpfCnpj: cartao.documento() },
      );
      // O que era do cartão sai da tela assim que o servidor responde.
      cartao.apagarSensiveis();
      setResultado(r);
      if (r.meio === "CREDIT_CARD" && r.situacao === "ativo") {
        const perfil = await api.getDraft().catch(() => null);
        if (perfil) await aplicarTema(perfil);
        setFase("ativado");
        return;
      }
      setFase(r.situacao === "agendado" ? "agendado" : "esperando");
    } catch (err) {
      // O CVV nunca sobrevive a uma tentativa, nem à que falhou.
      cartao.apagarCvv();
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir o pagamento agora.",
      );
      setFase("formulario");
    }
  }

  if (fase === "ativado")
    return <PlanoAtivado plan={plan} label={label} voltar={voltar} />;

  const emMoldura = (conteudo: ReactNode) => (
    <Moldura
      voltar={voltar}
      resumo={
        <ResumoDoPedido
          label={label}
          pitch={oferta.pitch}
          itens={itens}
          valor={valor}
          inicioFuturo={inicioFuturo}
        />
      }
    >
      {conteudo}
    </Moldura>
  );

  if (fase === "conferindo") {
    return emMoldura(
      <Folha>
        <div role="status" aria-label="Preparando o pagamento" className="space-y-4">
          <div className="h-5 w-44 animate-pulse rounded bg-[#e9eef4]" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-[#f1f4f8]" />
          <div className="h-28 w-full animate-pulse rounded-xl bg-[#f1f4f8]" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-[#e9eef4]" />
        </div>
      </Folha>,
    );
  }

  if (fase === "enviando") {
    return emMoldura(
      <Folha>
        <div
          role="status"
          className="flex flex-col items-center gap-4 py-16 text-center"
        >
          <Girando tamanho={40} />
          <p className="text-[15px] font-semibold">
            {meio === "CREDIT_CARD"
              ? "Processando o pagamento…"
              : `Gerando ${meio === "PIX" ? "o Pix" : "o boleto"}…`}
          </p>
          <p className="text-[12.5px] text-[#64748b]">
            Não feche nem recarregue esta página.
          </p>
        </div>
      </Folha>,
    );
  }

  if (fase === "agendado" && resultado) {
    return emMoldura(
      <Folha>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f1f4f8] text-[#0f172a]">
          <ClockIcon width={22} height={22} />
        </span>
        <h1 className="mt-4 font-ui text-[21px] font-semibold tracking-tight">
          Assinatura marcada
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#475569]">
          Sua assinatura {label} começa em{" "}
          <span className="font-semibold text-[#0f172a]">
            {dataCurta(resultado.vencimento)}
          </span>
          , quando terminam os dias que você já pagou. Nada é cobrado antes
          disso.
        </p>
        <button
          type="button"
          onClick={() => navigate("/assinatura")}
          className={`${botaoEscuro} mt-7`}
        >
          Ver minha assinatura
        </button>
      </Folha>,
    );
  }

  if (fase === "esperando" && resultado) {
    return emMoldura(
      <Folha>
        {resultado.meio === "PIX" && (
          <>
            <h1 className="font-ui text-[21px] font-semibold tracking-tight">
              Pague com Pix
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#475569]">
              Abra o app do seu banco, escolha pagar com Pix e aponte a câmera
              para o código.
            </p>
            <div className="mt-5 flex items-baseline justify-between gap-3 rounded-xl bg-[#f6f8fb] px-4 py-3">
              <span className="text-[13px] text-[#475569]">
                Plano {label} · mensal
              </span>
              <span className="text-[17px] font-semibold tabular-nums">
                {reais(resultado.valor)}
              </span>
            </div>
            {resultado.pix ? (
              <>
                <div className="mt-6 flex justify-center">
                  <div className="rounded-2xl border border-[#e3e8ef] bg-white p-3 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.3)]">
                    <img
                      src={`data:image/png;base64,${resultado.pix.imagem}`}
                      alt="QR Code do Pix"
                      width={212}
                      height={212}
                      className="block"
                    />
                  </div>
                </div>
                <p className="mt-6 text-[12.5px] font-medium text-[#475569]">
                  Ou use o Pix copia e cola
                </p>
                <div className="mt-2 flex items-stretch gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl border border-[#e3e8ef] bg-[#f8fafc] px-3.5 py-3 text-[12px] text-[#334155]">
                    {resultado.pix.copiaECola}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      if (resultado.meio !== "PIX" || !resultado.pix) return;
                      setCopiado(await copiarTexto(resultado.pix.copiaECola));
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0f172a] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1e293b]"
                  >
                    {copiado ? (
                      <CheckIcon width={14} height={14} strokeWidth={2.6} />
                    ) : (
                      <CopyIcon width={14} height={14} />
                    )}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-5 text-[13.5px] text-[#475569]">
                O QR Code não carregou. Use a página de pagamento abaixo.
              </p>
            )}
            {resultado.fatura && (
              <a
                href={resultado.fatura}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0f172a] underline decoration-[#cbd5e1] underline-offset-4 hover:decoration-[#0f172a]"
              >
                Abrir a página de pagamento
                <ExternalLinkIcon width={13} height={13} />
              </a>
            )}
          </>
        )}

        {resultado.meio === "BOLETO" && (
          <>
            <h1 className="font-ui text-[21px] font-semibold tracking-tight">
              Seu boleto está pronto
            </h1>
            <div className="mt-5 flex items-baseline justify-between gap-3 rounded-xl bg-[#f6f8fb] px-4 py-3">
              <span className="text-[13px] text-[#475569]">
                Vence em {dataCurta(resultado.vencimento)}
              </span>
              <span className="text-[17px] font-semibold tabular-nums">
                {reais(resultado.valor)}
              </span>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-[#475569]">
              A compensação leva até 3 dias úteis, e o plano abre sozinho quando
              o banco confirmar. Pode fechar esta página.
            </p>
            {(resultado.boleto || resultado.fatura) && (
              <a
                href={resultado.boleto || resultado.fatura}
                target="_blank"
                rel="noreferrer"
                className={`${botaoEscuro} mt-6`}
              >
                Abrir o boleto
                <ExternalLinkIcon width={14} height={14} />
              </a>
            )}
          </>
        )}

        {resultado.meio === "CREDIT_CARD" && (
          <>
            <h1 className="font-ui text-[21px] font-semibold tracking-tight">
              Pagamento em análise
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#475569]">
              O emissor do cartão ainda está analisando o pagamento. O plano
              abre sozinho quando for aprovado.
            </p>
          </>
        )}

        <p
          role="status"
          aria-live="polite"
          className="mt-7 flex items-center justify-center gap-2 border-t border-[#eef2f6] pt-5 text-center text-[12.5px] leading-relaxed text-[#64748b]"
        >
          {cansou ? (
            "Ainda não recebemos a confirmação. Se você já pagou, ela chega sozinha e o plano abre — pode fechar esta página."
          ) : (
            <>
              <Girando />
              Esta página atualiza sozinha quando o pagamento for confirmado.
            </>
          )}
        </p>
      </Folha>,
    );
  }

  // ---- Formulário -----------------------------------------------------------------
  const escolhido = MEIOS.find((m) => m.id === meio) ?? MEIOS[0];
  const rotuloDoBotao = inicioFuturo
    ? `Agendar assinatura de ${reais(valor)}/mês`
    : meio === "CREDIT_CARD"
      ? `Pagar ${reais(valor)}`
      : `Gerar ${meio === "PIX" ? "Pix" : "boleto"} de ${reais(valor)}`;

  return emMoldura(
    <>
      <form onSubmit={enviar} noValidate>
        <Folha>
          <h1 className="font-ui text-[19px] font-semibold tracking-tight">
            Forma de pagamento
          </h1>

          <div
            role="radiogroup"
            aria-label="Forma de pagamento"
            className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-[#eef2f6] p-1"
          >
            {MEIOS.map((m) => {
              const ativo = meio === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => {
                    setMeio(m.id);
                    setErro(null);
                  }}
                  className={`flex h-11 items-center justify-center gap-2 rounded-[10px] text-[13.5px] font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/25 ${
                    ativo
                      ? "bg-white text-[#0f172a] shadow-[0_1px_3px_rgba(15,23,42,0.14)]"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <IconeDoMeio meio={m.id} />
                  {m.titulo}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-[#64748b]">
            {escolhido.detalhe}
          </p>

          <div className="mt-6">
            <CamposDoCartao estado={cartao} comCartao={meio === "CREDIT_CARD"} />
          </div>

          <ConfirmarEmailCartao contexto="assinar" neutro className="mt-5" />

          {erro && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 text-[13px] leading-relaxed text-[#b91c1c]"
            >
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={emailPending}
            className={`${botaoEscuro} mt-6 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none`}
          >
            <LockIcon width={15} height={15} strokeWidth={2.2} />
            {rotuloDoBotao}
          </button>

          {/* O cadeado vai DENTRO da frase: numa linha que quebra, um ícone ao
              lado do bloco centralizado fica solto na margem. */}
          <p className="mt-4 text-balance text-center text-[12px] leading-relaxed text-[#64748b]">
            <LockIcon
              width={12}
              height={12}
              strokeWidth={2.2}
              className="-mt-[2px] mr-1.5 inline text-[#15803d]"
            />
            Pagamento criptografado e processado pelo Asaas. O advoc.me não
            guarda os seus dados de pagamento.
          </p>
          <ul
            aria-label="Formas aceitas"
            className="mt-3 flex flex-wrap items-center justify-center gap-1.5"
          >
            {["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Pix", "Boleto"].map(
              (b) => (
                <li
                  key={b}
                  className="rounded-md border border-[#e3e8ef] px-2 py-[3px] text-[10.5px] font-semibold tracking-wide text-[#64748b]"
                >
                  {b}
                </li>
              ),
            )}
          </ul>
        </Folha>
      </form>

      {/* As condições ficam à vista, fora do formulário e sem sanfona: é aqui que a
          pessoa decide, e compromisso escondido não é compromisso. */}
      <section className="mt-5 px-1 sm:px-2">
        <h2 className="font-ui text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
          Condições da assinatura
        </h2>
        <ul className="mt-3 space-y-2">
          {REGRAS.map((r) => (
            <li
              key={r}
              className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[#64748b]"
            >
              <CheckIcon
                width={13}
                height={13}
                strokeWidth={2.4}
                className="mt-[4px] shrink-0 text-[#94a3b8]"
              />
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] leading-relaxed text-[#94a3b8]">
          Ao confirmar, você autoriza a cobrança de {reais(valor)} por mês até
          cancelar e aceita os{" "}
          <a
            href="/legal/termos"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-[#475569]"
          >
            Termos de Uso
          </a>
          , inclusive as condições de cobrança e cancelamento.
        </p>
      </section>
    </>,
  );
}
