import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  escolhaDeCookies,
  gravarEscolha,
  ouvirEscolha,
  registrarVisita,
  rotaComPixel,
} from "@/lib/metaPixel";

// A FAIXA DE COOKIES — o consentimento que o Pixel da Meta exige (ver
// lib/metaPixel.ts). Só aparece onde o pixel pode medir; no perfil de um
// advogado não há nada a consentir, porque lá nada é carregado.
//
// Aviso no rodapé, no formato que todo site usa: o texto da faixa antiga
// ("Usamos o Pixel da Meta… nunca nos perfis") assustava mais do que informava,
// e no topo empurrava a home para baixo. Ele não bloqueia a página: dá para ler
// e rolar sem responder, e sem resposta o pixel simplesmente não carrega.
// "Recusar" tem o mesmo peso de "Aceitar" — recusa escondida não é escolha.
// O detalhe (o que é, onde roda, para quem vai) fica na Política de Cookies.

function useEscolha() {
  const [escolha, setEscolha] = useState(escolhaDeCookies);
  useEffect(() => ouvirEscolha(() => setEscolha(escolhaDeCookies())), []);
  return escolha;
}

export function AvisoDeCookies() {
  const { pathname } = useLocation();
  const escolha = useEscolha();
  if (escolha !== null || !rotaComPixel(pathname)) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl2 border border-ink/10 bg-paper px-4 py-3 shadow-lg">
        <p className="min-w-0 flex-1 basis-60 text-[13px] leading-snug text-ink-soft">
          Usamos cookies para o site funcionar bem e para medir os nossos
          anúncios.{" "}
          <Link
            to="/legal/cookies"
            className="font-semibold text-burgundy hover:underline"
          >
            Política de cookies
          </Link>
        </p>
        <BotoesDeEscolha />
      </div>
    </div>
  );
}

function BotoesDeEscolha() {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => gravarEscolha("recusado")}
        className="btn-ghost !py-2 !text-[13px]"
      >
        Recusar
      </button>
      <button
        type="button"
        onClick={() => gravarEscolha("aceito")}
        className="btn-primary !py-2 !text-[13px]"
      >
        Aceitar
      </button>
    </div>
  );
}

/** Na Política de Cookies: mostra a escolha atual e deixa trocar. */
export function PreferenciaDeCookies() {
  const escolha = useEscolha();
  const texto =
    escolha === "aceito"
      ? "Você aceitou o Pixel da Meta neste navegador."
      : escolha === "recusado"
        ? "Você recusou o Pixel da Meta neste navegador."
        : "Você ainda não escolheu. Sem escolha, o pixel não é carregado.";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-ink/10 bg-paper-soft/60 p-4">
      <p className="text-[13.5px] text-ink-soft">{texto}</p>
      <BotoesDeEscolha />
    </div>
  );
}

/** Dispara o PageView a cada troca de rota permitida (depois do aceite). */
export function PixelDaMeta() {
  const { pathname } = useLocation();
  const escolha = useEscolha();
  // A espera curta descarta a rota que só passou pela tela: "Criar grátis" leva
  // a /comecar, que sem sessão redireciona na hora para /criar-conta — sem ela,
  // um clique contava duas visitas.
  useEffect(() => {
    const t = window.setTimeout(() => registrarVisita(pathname), 400);
    return () => window.clearTimeout(t);
  }, [pathname, escolha]);
  return null;
}
