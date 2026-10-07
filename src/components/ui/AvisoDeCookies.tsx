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
// Faixa no topo, como a dos Termos (sem modais): empurra a página, não cobre.
// "Recusar" tem o mesmo peso de "Aceitar" — recusa escondida não é escolha.

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
    <div className="border-b border-ink/10 bg-paper-soft">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <p className="text-[13px] leading-snug text-ink-soft">
          Usamos o Pixel da Meta nesta página para medir os nossos anúncios.
          Nunca nos perfis dos advogados.{" "}
          <Link
            to="/legal/cookies"
            className="font-semibold text-burgundy hover:underline"
          >
            Saiba mais
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
