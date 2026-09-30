import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { copiarTexto } from "@/lib/copiar";
import { PLAN_LABEL } from "@/lib/upsell";
import { PLAN_PRICE } from "@/lib/plans";
import {
  ErroComCodigo,
  nomeDaBandeira,
  reais,
  umMesAntes,
  type ResultadoDoCancelamento,
  type ResumoDaAssinatura,
} from "@/lib/pagamento";
import { SubPage, useVoltar } from "@/components/ui/SubPage";
import {
  CardIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import {
  CamposDoCartao,
  useCartao,
} from "@/components/checkout/CamposDoCartao";

// MINHA ASSINATURA — /assinatura.
//
// O advogado vem aqui para uma de quatro coisas: saber quanto paga e quando,
// pagar o mês que está em aberto, trocar de plano ou de cartão, e cancelar. A
// página responde a primeira sem clique nenhum e deixa as outras a um toque —
// todas NA PÁGINA, sem janela por cima (regra da casa).
//
// A PEÇA DA PÁGINA é a régua do período: uma linha do início do mês pago até a
// próxima cobrança, com o ponto de hoje e, quando existe, a marca do fim do prazo
// de arrependimento. Não é enfeite — é a resposta a "onde eu estou?" desenhada, e
// é o que faz a pessoa confiar no que lê embaixo: as datas que o texto cita estão
// ali, na mesma régua.
//
// O TOM é o de um extrato bem feito. Nada de "Que pena que você vai embora!",
// nada de desconto de última hora, nada de botão de cancelar escondido. O
// cancelamento diz, ANTES do clique, exatamente o que acontece com o dinheiro e
// com a página — e é o mesmo tamanho de botão que qualquer outro.

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

/** "2026-10-28" → "28 de outubro". Sem passar por Date: o fuso não mexe no dia. */
function porExtenso(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]}` : "";
}

/** "2026-10-28" → "28 out" — só na régua, onde a forma longa quebraria no celular. */
function curta(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1].slice(0, 3)}` : "";
}

/** Data de calendário (yyyy-mm-dd) de um instante, em Brasília. */
function diaEmBrasilia(d: Date): string {
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Dias entre duas datas de calendário (yyyy-mm-dd). */
function diasEntre(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000,
  );
}

const eyebrow =
  "text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-faint";
const botaoSecundario =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-burgundy/40 hover:text-burgundy disabled:opacity-60";

// ---- A régua do período -------------------------------------------------------

function ReguaDoPeriodo({
  inicio,
  fim,
  hoje,
  marco,
  rotuloDoFim,
}: {
  inicio: string;
  fim: string;
  hoje: string;
  /** o fim do prazo de arrependimento, se estiver dentro do ciclo */
  marco?: string | null;
  rotuloDoFim: string;
}) {
  const total = Math.max(1, diasEntre(inicio, fim));
  const pos = (d: string) =>
    Math.min(100, Math.max(0, (diasEntre(inicio, d) / total) * 100));
  const agora = pos(hoje);
  const noMarco =
    marco && diasEntre(inicio, marco) >= 0 && diasEntre(marco, fim) >= 0
      ? pos(marco)
      : null;
  const faltam = Math.max(0, diasEntre(hoje, fim));

  return (
    <figure className="mt-5">
      <figcaption className="sr-only">
        Ciclo de {porExtenso(inicio)} a {porExtenso(fim)}. Hoje é{" "}
        {porExtenso(hoje)}; faltam {faltam} dias.
      </figcaption>
      <div aria-hidden className="relative h-5">
        {/* a linha inteira do ciclo */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink/15" />
        {/* o que já passou */}
        <div
          className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-brass"
          style={{ width: `${agora}%` }}
        />
        {/* começo e fim: dois traços, como numa régua */}
        <div className="absolute left-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-ink/35" />
        <div className="absolute right-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-ink/35" />
        {noMarco !== null && (
          <div
            className="absolute top-1/2 h-3.5 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-burgundy/70"
            style={{ left: `${noMarco}%` }}
          />
        )}
        {/* hoje */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-brass-deep shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
          style={{ left: `${agora}%` }}
        />
      </div>
      <div
        aria-hidden
        className="mt-1.5 flex items-start justify-between gap-3 text-[11.5px] leading-tight text-ink-faint"
      >
        <span className="whitespace-nowrap">desde {curta(inicio)}</span>
        <span className="text-right">
          {rotuloDoFim}{" "}
          <span className="whitespace-nowrap font-semibold text-ink">
            {curta(fim)}
          </span>
        </span>
      </div>
    </figure>
  );
}

// ---- O selo da situação --------------------------------------------------------

function Selo({
  tom,
  children,
}: {
  tom: "ok" | "alerta" | "neutro";
  children: ReactNode;
}) {
  const cor =
    tom === "ok"
      ? "border-brass/45 bg-brass/10 text-brass-deep"
      : tom === "alerta"
        ? "border-burgundy/35 bg-burgundy/[0.06] text-burgundy-deep"
        : "border-ink/15 bg-ink/[0.03] text-ink-soft";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-semibold uppercase tracking-[0.08em] ${cor}`}
    >
      {tom !== "neutro" && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${tom === "ok" ? "bg-brass-deep" : "bg-burgundy"}`}
        />
      )}
      {children}
    </span>
  );
}

function Aviso({
  tom,
  children,
}: {
  tom: "ok" | "alerta";
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed ${
        tom === "ok"
          ? "border-brass/40 bg-brass/[0.08] text-ink-soft"
          : "border-burgundy/30 bg-burgundy/5 text-burgundy-deep"
      }`}
    >
      {tom === "ok" && (
        <CheckIcon
          width={15}
          height={15}
          strokeWidth={2.4}
          className="mt-[3px] shrink-0 text-brass-deep"
        />
      )}
      <span>{children}</span>
    </p>
  );
}

// ---- A página ------------------------------------------------------------------

export default function MinhaAssinaturaPage() {
  const voltar = useVoltar("/painel");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [r, setR] = useState<ResumoDaAssinatura | null>(null);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [recado, setRecado] = useState<{
    tom: "ok" | "alerta";
    texto: ReactNode;
  } | null>(null);

  const carregar = useCallback(async () => {
    setErroDeCarga(null);
    try {
      setR(await api.minhaAssinatura());
    } catch (e) {
      setErroDeCarga(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar sua assinatura.",
      );
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Assinatura criada e primeiro pagamento ainda não chegou (Pix, boleto): a tela
  // relê a cada 5 s, com a aba visível, por até 20 min — e mostra o plano ativo
  // sozinha quando o aviso do Asaas chegar ao servidor. Mesma régua do checkout.
  const esperandoPagamento = !!r && r.plano === "free" && !!r.assinatura;
  useEffect(() => {
    if (!esperandoPagamento) return;
    const inicio = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - inicio > 20 * 60 * 1000) return window.clearInterval(id);
      if (!document.hidden) void carregar();
    }, 5000);
    return () => window.clearInterval(id);
  }, [esperandoPagamento, carregar]);

  const moldura = (conteudo: ReactNode) => (
    <SubPage
      title="Minha assinatura"
      subtitle="Quanto você paga, quando, e o que dá para mudar."
      icon={<ShieldIcon width={18} height={18} />}
      backTo={voltar}
      backLabel="Voltar"
      documentTitle="Minha assinatura"
    >
      <div className="space-y-4">
        {recado && <Aviso tom={recado.tom}>{recado.texto}</Aviso>}
        {conteudo}
      </div>
    </SubPage>
  );

  if (erroDeCarga) {
    return moldura(
      <div className="rounded-xl2 border border-ink/10 bg-paper p-6 text-center shadow-card">
        <p className="text-[13.5px] text-ink-soft">{erroDeCarga}</p>
        <button
          type="button"
          onClick={() => void carregar()}
          className={`${botaoSecundario} mt-4`}
        >
          Tentar de novo
        </button>
      </div>,
    );
  }

  if (!r) {
    return moldura(
      <div
        role="status"
        aria-label="Carregando sua assinatura"
        className="rounded-xl2 border border-ink/10 bg-paper p-6 shadow-card"
      >
        <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
        <div className="mt-4 h-8 w-40 animate-pulse rounded bg-ink/10" />
        <div className="mt-6 h-px w-full bg-ink/10" />
        <div className="mt-6 h-3 w-56 animate-pulse rounded bg-ink/10" />
      </div>,
    );
  }

  const hoje = diaEmBrasilia(new Date());
  const nome = PLAN_LABEL[r.plano];
  const a = r.assinatura;

  // ---- Sem assinatura no Asaas ------------------------------------------------
  if (!a) {
    const cancelada =
      r.status === "canceled" && r.vigente !== "free" && r.validoAte;
    return moldura(
      <section className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className={eyebrow}>Seu plano</span>
          {cancelada ? (
            <Selo tom="neutro">Cancelada</Selo>
          ) : r.vigente !== "free" ? (
            <Selo tom="ok">Ativo</Selo>
          ) : null}
        </div>
        <p className="mt-2 font-display text-[30px] font-semibold leading-none text-ink">
          {PLAN_LABEL[r.vigente]}
        </p>

        {!r.online ? (
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
            O pagamento on-line ainda não está disponível. Quando estiver, é
            aqui que você acompanha a cobrança, troca de plano e cancela.
          </p>
        ) : cancelada ? (
          <>
            <ReguaDoPeriodo
              inicio={umMesAntes(r.validoAte!.slice(0, 10))}
              fim={r.validoAte!.slice(0, 10)}
              hoje={hoje}
              rotuloDoFim="termina em"
            />
            <p className="mt-5 text-[13.5px] leading-relaxed text-ink-soft">
              Você cancelou, e nada mais será cobrado. O {nome} continua até{" "}
              {porExtenso(r.validoAte)} — depois, sua página volta ao Free sem
              perder nada.
            </p>
            <Link
              to={`/assinar/${r.plano}`}
              className="btn-primary mt-5 w-full !py-3"
            >
              Continuar com o {nome}
            </Link>
            <p className="mt-2 text-center text-[12px] text-ink-faint">
              A primeira cobrança só acontece em {porExtenso(r.validoAte)},
              quando termina o que você já pagou.
            </p>
          </>
        ) : r.vigente === "free" ? (
          <>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
              Você está no plano gratuito. Nada é cobrado.
            </p>
            <Link to="/planos" className="btn-primary mt-5 w-full !py-3">
              Ver os planos
            </Link>
          </>
        ) : (
          <>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
              Seu {nome} foi ativado antes de existir o pagamento on-line, e por
              isso não tem cobrança ligada a ele. Para mantê-lo, assine — a
              partir daí, é aqui que você acompanha tudo.
            </p>
            <Link
              to={`/assinar/${r.plano}`}
              className="btn-primary mt-5 w-full !py-3"
            >
              Assinar o {nome}
            </Link>
          </>
        )}
      </section>,
    );
  }

  // ---- Assinatura criada, primeiro pagamento ainda não chegou ---------------------
  //
  // O Pix gerado e não pago, o boleto a compensar. O plano contratado ainda é o
  // Free; o que a pessoa precisa ver é o que está comprando e como terminar.
  if (r.plano === "free") {
    const comprando = PLAN_LABEL[a.planoCobrado ?? "pro"];
    return moldura(
      <>
        <section className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className={`${eyebrow} whitespace-nowrap`}>
              Sua assinatura
            </span>
            <Selo tom="neutro">Aguardando</Selo>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <p className="font-display text-[30px] font-semibold leading-none text-ink">
              {comprando}
            </p>
            <p className="font-display text-[22px] font-semibold tabular-nums text-ink">
              {reais(a.valor)}
              <span className="ml-1 font-sans text-[12.5px] font-medium text-ink-faint">
                por mês
              </span>
            </p>
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
            O {comprando} abre assim que o primeiro pagamento for confirmado —
            no Pix, em segundos; no boleto, em até 3 dias úteis. Esta página
            mostra o plano ativo sozinha quando isso acontecer.
          </p>
        </section>
        {a.emAberto && <CobrancaEmAberto cobranca={a.emAberto} />}
        <Desistir
          aoDesistir={() => {
            setRecado({
              tom: "ok",
              texto: "Assinatura desfeita. Nada foi cobrado.",
            });
            void carregar();
          }}
        />
      </>,
    );
  }

  // ---- Com assinatura ------------------------------------------------------------
  const fimDoCiclo = a.proximaCobranca ?? hoje;
  const inicio = umMesAntes(fimDoCiclo);
  const pendente = r.status === "past_due" || !!a.emAberto?.vencida;
  const agendado =
    r.planScheduled && r.planScheduled !== r.plano ? r.planScheduled : null;

  return moldura(
    <>
      {/* A ASSINATURA — o extrato */}
      <section className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className={eyebrow}>Seu plano</span>
          {pendente ? (
            <Selo tom="alerta">Pagamento pendente</Selo>
          ) : r.status === "paused" ? (
            <Selo tom="neutro">Cobrança suspensa</Selo>
          ) : (
            <Selo tom="ok">Em dia</Selo>
          )}
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="font-display text-[30px] font-semibold leading-none text-ink">
            {nome}
          </p>
          <p className="font-display text-[22px] font-semibold tabular-nums text-ink">
            {reais(a.valor)}
            <span className="ml-1 font-sans text-[12.5px] font-medium text-ink-faint">
              por mês
            </span>
          </p>
        </div>

        <ReguaDoPeriodo
          inicio={inicio}
          fim={fimDoCiclo}
          hoje={hoje}
          marco={
            a.arrependimentoAte
              ? diaEmBrasilia(new Date(a.arrependimentoAte))
              : null
          }
          rotuloDoFim={
            agendado
              ? `muda para o ${PLAN_LABEL[agendado]} em`
              : "próxima cobrança em"
          }
        />

        {a.arrependimentoAte && (
          <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
            <span
              aria-hidden
              className="mt-[5px] h-2.5 w-[2px] shrink-0 rounded-full bg-burgundy/70"
            />
            Até {porExtenso(diaEmBrasilia(new Date(a.arrependimentoAte)))}, se
            você cancelar, devolvemos o valor pago por inteiro.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <p className="flex items-center gap-2.5 text-[13.5px] text-ink">
            <CardIcon
              width={18}
              height={18}
              className="shrink-0 text-ink-faint"
            />
            {a.meio === "CREDIT_CARD" ? (
              <span>
                {nomeDaBandeira(a.cartao?.bandeira)}
                {a.cartao?.final && (
                  <span className="tabular-nums text-ink-soft">
                    {" "}
                    •••• {a.cartao.final}
                  </span>
                )}
              </span>
            ) : a.meio === "PIX" ? (
              <span>Pix, uma cobrança por mês</span>
            ) : (
              <span>Boleto, um por mês</span>
            )}
          </p>
          {a.meio !== "CREDIT_CARD" && (
            <span className="text-[12px] text-ink-faint">
              chega por e-mail antes do vencimento
            </span>
          )}
        </div>
      </section>

      {a.emAberto && <CobrancaEmAberto cobranca={a.emAberto} />}

      {/* As três ações num cartão só: mudar de plano, cartão, cancelar. Três
          cartões empilhados pesavam mais que o extrato lá em cima — e o extrato é
          a peça da página. */}
      <div className="divide-y divide-ink/10 overflow-hidden rounded-xl2 border border-ink/10 bg-paper shadow-card">
        <TrocarPlano
          r={r}
          preSelecionado={params.get("trocar")}
          aoMudar={(novo, texto) => {
            setR(novo);
            setRecado({ tom: "ok", texto });
          }}
        />

        {a.meio === "CREDIT_CARD" && (
          <TrocarCartao
            aoTrocar={(novo) => {
              setR(novo);
              setRecado({
                tom: "ok",
                texto: `Cartão ${nomeDaBandeira(novo.assinatura?.cartao?.bandeira)} •••• ${novo.assinatura?.cartao?.final ?? ""} salvo. As próximas cobranças vão nele.`,
              });
            }}
          />
        )}

        <Cancelar
          r={r}
          aoCancelar={(res) => {
            const valor = reais(res.valorDevolvido);
            setRecado(
              res.devolucao === "feita"
                ? {
                    tom: "ok",
                    texto: `Assinatura cancelada. Devolvemos ${valor}: no cartão, o estorno aparece na fatura em até 10 dias úteis; no Pix, o valor volta para a conta de onde saiu.`,
                  }
                : res.devolucao === "pendente"
                  ? {
                      tom: "alerta",
                      texto: (
                        <>
                          Assinatura cancelada, e nada mais será cobrado. A
                          devolução de {valor} não pôde ser feita
                          automaticamente agora: abrimos um chamado e a equipe
                          vai concluí-la.{" "}
                          <Link
                            to="/suporte"
                            className="font-semibold underline underline-offset-2"
                          >
                            Acompanhe em Suporte
                          </Link>
                          .
                        </>
                      ),
                    }
                  : {
                      tom: "ok",
                      texto: `Assinatura cancelada. Nada mais será cobrado, e o ${nome} continua até ${porExtenso(res.valeAte)}.`,
                    },
            );
            void carregar();
            window.scrollTo({ top: 0 });
          }}
        />
      </div>

      <p className="px-1 text-center text-[11.5px] leading-relaxed text-ink-faint">
        Pagamento processado pelo Asaas. O advoc.me não guarda os dados do seu
        cartão.{" "}
        <button
          type="button"
          onClick={() => navigate("/legal/termos")}
          className="underline underline-offset-2 hover:text-ink"
        >
          Condições de cobrança
        </button>
      </p>
    </>,
  );
}

// ---- Cobrança em aberto --------------------------------------------------------

function CobrancaEmAberto({
  cobranca,
}: {
  cobranca: NonNullable<
    NonNullable<ResumoDaAssinatura["assinatura"]>["emAberto"]
  >;
}) {
  const [verQr, setVerQr] = useState(false);
  const [copiado, setCopiado] = useState(false);
  return (
    <section
      className={`rounded-xl2 border p-5 shadow-card ${cobranca.vencida ? "border-burgundy/30 bg-burgundy/[0.03]" : "border-ink/10 bg-paper"}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className={eyebrow}>
          {cobranca.vencida ? "Cobrança vencida" : "Cobrança do mês"}
        </span>
        <span className="font-display text-[18px] font-semibold tabular-nums text-ink">
          {reais(cobranca.valor)}
        </span>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
        {cobranca.vencida
          ? `Venceu em ${porExtenso(cobranca.vencimento)}. Seu plano segue ativo durante a carência — pague para que nada mude.`
          : `Vence em ${porExtenso(cobranca.vencimento)}.`}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {cobranca.pix && (
          <button
            type="button"
            aria-expanded={verQr}
            onClick={() => setVerQr((v) => !v)}
            className="btn-primary !px-4 !py-2 !text-[13px]"
          >
            {verQr ? "Esconder o Pix" : "Pagar com Pix"}
          </button>
        )}
        {cobranca.boleto && (
          <a
            href={cobranca.boleto}
            target="_blank"
            rel="noreferrer"
            className="btn-primary !px-4 !py-2 !text-[13px]"
          >
            Abrir o boleto
          </a>
        )}
        {cobranca.fatura && (
          <a
            href={cobranca.fatura}
            target="_blank"
            rel="noreferrer"
            className={botaoSecundario}
          >
            Página de pagamento
            <ExternalLinkIcon width={13} height={13} />
          </a>
        )}
      </div>

      {verQr && cobranca.pix && (
        <div className="mt-4 border-t border-ink/10 pt-4 text-center">
          <img
            src={`data:image/png;base64,${cobranca.pix.imagem}`}
            alt="QR Code do Pix"
            width={200}
            height={200}
            className="mx-auto rounded-lg border border-ink/10"
          />
          <div className="mt-3 flex items-stretch gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-left text-[12px] text-ink">
              {cobranca.pix.copiaECola}
            </code>
            <button
              type="button"
              onClick={async () =>
                setCopiado(await copiarTexto(cobranca.pix!.copiaECola))
              }
              className={botaoSecundario}
            >
              <CopyIcon width={13} height={13} />
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-ink-faint">
            O pagamento é reconhecido sozinho em alguns segundos.
          </p>
        </div>
      )}
    </section>
  );
}

// ---- Trocar de plano -----------------------------------------------------------

function TrocarPlano({
  r,
  preSelecionado,
  aoMudar,
}: {
  r: ResumoDaAssinatura;
  preSelecionado: string | null;
  aoMudar: (novo: ResumoDaAssinatura, texto: string) => void;
}) {
  const a = r.assinatura!;
  const atual = r.plano as "pro" | "premium";
  const outro = atual === "pro" ? "premium" : "pro";
  const subir = outro === "premium";
  const agendado =
    r.planScheduled && r.planScheduled !== r.plano ? r.planScheduled : null;
  const [aberto, setAberto] = useState(preSelecionado === outro && subir);
  const [pedeCartao, setPedeCartao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cartao = useCartao();

  async function subirPlano() {
    if (salvando) return;
    if (pedeCartao) {
      const p = cartao.problema(true);
      if (p) return setErro(p);
    }
    setSalvando(true);
    setErro(null);
    try {
      const novo = (await api.trocarPlano(
        pedeCartao
          ? { plano: "premium", ...cartao.pedido() }
          : { plano: "premium" },
      )) as ResumoDaAssinatura;
      cartao.apagarSensiveis();
      aoMudar(
        novo,
        `Pronto: você está no Max. A partir de ${porExtenso(a.proximaCobranca)}, ${reais(PLAN_PRICE.premium)} por mês.`,
      );
      setAberto(false);
    } catch (e) {
      cartao.apagarCvv();
      if (e instanceof ErroComCodigo && e.codigo === "precisa_cartao") {
        setPedeCartao(true);
        setErro(null);
      } else {
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível trocar de plano agora.",
        );
      }
    } finally {
      setSalvando(false);
    }
  }

  async function manterPlano() {
    setSalvando(true);
    setErro(null);
    try {
      const novo = (await api.trocarPlano({
        plano: atual,
      })) as ResumoDaAssinatura;
      aoMudar(
        novo,
        `A mudança foi desfeita. Você continua no ${PLAN_LABEL[atual]}.`,
      );
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível desfazer agora.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="p-5 sm:px-6">
      <span className={eyebrow}>Mudar de plano</span>

      {agendado ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-start gap-2 text-[13.5px] leading-relaxed text-ink-soft">
            <ClockIcon
              width={15}
              height={15}
              className="mt-[3px] shrink-0 text-brass-deep"
            />
            <span>
              Em {porExtenso(a.proximaCobranca)} você passa para o{" "}
              {PLAN_LABEL[agendado]} (
              {reais(PLAN_PRICE[agendado as "pro" | "premium"])} por mês). Até
              lá, o {PLAN_LABEL[atual]} segue inteiro.
            </span>
          </p>
          <button
            type="button"
            onClick={() => void manterPlano()}
            disabled={salvando}
            className={botaoSecundario}
          >
            Manter o {PLAN_LABEL[atual]}
          </button>
        </div>
      ) : subir ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              O <span className="font-semibold text-ink">Max</span> custa{" "}
              {reais(PLAN_PRICE.premium)} por mês.
            </p>
            <button
              type="button"
              aria-expanded={aberto}
              onClick={() => setAberto((v) => !v)}
              className={botaoSecundario}
            >
              {aberto ? "Fechar" : "Mudar para o Max"}
            </button>
          </div>
          {aberto && (
            <div className="mt-4 border-t border-ink/10 pt-4">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                O Max começa agora. A diferença deste mês não é cobrada: o novo
                valor vale a partir de{" "}
                <span className="font-semibold text-ink">
                  {porExtenso(a.proximaCobranca)}
                </span>
                .
              </p>
              {pedeCartao && (
                <div className="mt-4">
                  <p className="mb-3 text-[12.5px] leading-relaxed text-ink-faint">
                    Para mudar de plano no cartão, confirme os dados do cartão.
                    Nada é cobrado agora.
                  </p>
                  <CamposDoCartao estado={cartao} comCartao prefixo="troca" />
                </div>
              )}
              {erro && (
                <p
                  role="alert"
                  className="mt-3 text-[12.5px] text-burgundy-deep"
                >
                  {erro}
                </p>
              )}
              <button
                type="button"
                onClick={() => void subirPlano()}
                disabled={salvando}
                className="btn-primary mt-4 w-full !py-3 disabled:opacity-60"
              >
                {salvando ? "Mudando…" : "Confirmar: mudar para o Max"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            O <span className="font-semibold text-ink">Pro</span> custa{" "}
            {reais(PLAN_PRICE.pro)} por mês. A mudança acontece no fim do mês
            que você já pagou.
          </p>
          <Link
            to="/plano/mudar/pro?voltar=/assinatura"
            className={botaoSecundario}
          >
            Ver o que muda
          </Link>
        </div>
      )}
      {erro && !aberto && (
        <p role="alert" className="mt-3 text-[12.5px] text-burgundy-deep">
          {erro}
        </p>
      )}
    </section>
  );
}

// ---- Trocar o cartão -----------------------------------------------------------

function TrocarCartao({
  aoTrocar,
}: {
  aoTrocar: (novo: ResumoDaAssinatura) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cartao = useCartao();

  async function salvar() {
    if (salvando) return;
    const p = cartao.problema(true);
    if (p) return setErro(p);
    setSalvando(true);
    setErro(null);
    try {
      const novo = await api.trocarCartao(cartao.pedido());
      cartao.apagarSensiveis();
      setAberto(false);
      aoTrocar(novo);
    } catch (e) {
      cartao.apagarCvv();
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível trocar o cartão agora.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="p-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className={eyebrow}>Cartão</span>
          <p className="mt-1 text-[13px] text-ink-soft">
            As próximas cobranças vão no cartão que você salvar aqui.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
          className={botaoSecundario}
        >
          {aberto ? "Fechar" : "Trocar o cartão"}
        </button>
      </div>
      {aberto && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <CamposDoCartao estado={cartao} comCartao prefixo="novo" />
          {erro && (
            <p role="alert" className="mt-3 text-[12.5px] text-burgundy-deep">
              {erro}
            </p>
          )}
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="btn-primary mt-4 w-full !py-3 disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar o novo cartão"}
          </button>
        </div>
      )}
    </section>
  );
}

// ---- Desistir (antes do primeiro pagamento) -------------------------------------

function Desistir({ aoDesistir }: { aoDesistir: () => void }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <section className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
      <span className={eyebrow}>Mudou de ideia?</span>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        Como nada foi pago ainda, desfazer a assinatura não custa nada: a
        cobrança em aberto é cancelada.
      </p>
      {erro && (
        <p role="alert" className="mt-2 text-[12.5px] text-burgundy-deep">
          {erro}
        </p>
      )}
      <button
        type="button"
        disabled={salvando}
        onClick={async () => {
          setSalvando(true);
          setErro(null);
          try {
            await api.cancelarAssinatura();
            aoDesistir();
          } catch (e) {
            setErro(
              e instanceof Error
                ? e.message
                : "Não foi possível desfazer agora.",
            );
            setSalvando(false);
          }
        }}
        className={`${botaoSecundario} mt-4`}
      >
        {salvando ? "Desfazendo…" : "Desfazer a assinatura"}
      </button>
    </section>
  );
}

// ---- Cancelar ------------------------------------------------------------------

function Cancelar({
  r,
  aoCancelar,
}: {
  r: ResumoDaAssinatura;
  aoCancelar: (res: ResultadoDoCancelamento) => void;
}) {
  const a = r.assinatura!;
  const nome = PLAN_LABEL[r.plano];
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const prazo = a.arrependimentoAte
    ? diaEmBrasilia(new Date(a.arrependimentoAte))
    : null;

  async function cancelar() {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      aoCancelar(await api.cancelarAssinatura());
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível cancelar agora.",
      );
      setSalvando(false);
    }
  }

  // O que acontece — dito antes do clique, com o dinheiro e a data.
  const oQueAcontece = prazo
    ? `Você está no prazo de arrependimento, até ${porExtenso(prazo)}. Ao cancelar agora, devolvemos ${reais(a.valor)} por inteiro, e o ${nome} termina hoje. Sua página volta ao Free sem perder nada.`
    : `Nada mais será cobrado. O ${nome} continua até ${porExtenso(a.proximaCobranca)}, o fim do mês que você já pagou; depois, sua página volta ao Free sem perder nada — o que passar do Free fica guardado. O endereço do perfil ganha um número no fim 7 dias depois, com a data avisada no painel.`;

  return (
    <section className="p-5 sm:px-6">
      <span className={eyebrow}>Cancelar</span>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        {oQueAcontece}
      </p>
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className={`${botaoSecundario} mt-4`}
        >
          Cancelar a assinatura
        </button>
      ) : (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="text-[13px] font-medium text-ink">
            {prazo
              ? `Cancelar e receber ${reais(a.valor)} de volta?`
              : `Cancelar o ${nome}?`}
          </p>
          {erro && (
            <p role="alert" className="mt-2 text-[12.5px] text-burgundy-deep">
              {erro}
            </p>
          )}
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={salvando}
              className="btn-primary flex-1 !py-3"
            >
              Manter a assinatura
            </button>
            <button
              type="button"
              onClick={() => void cancelar()}
              disabled={salvando}
              className="flex-1 rounded-full border border-ink/15 py-3 text-[13.5px] font-semibold text-ink transition-colors hover:border-burgundy/40 hover:text-burgundy disabled:opacity-60"
            >
              {salvando ? "Cancelando…" : "Confirmar o cancelamento"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
