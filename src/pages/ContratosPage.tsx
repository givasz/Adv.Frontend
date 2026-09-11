import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canUseContratos } from '@/lib/plans'
import {
  MODELOS,
  ORDEM_DOS_MODELOS,
  type ModeloId,
} from '@/lib/contratos/modelos'
import {
  apagarRascunho,
  apagarTodosOsRascunhos,
  novoId,
  salvarRascunho,
  useRascunhos,
  type Rascunho,
} from '@/lib/contratos/rascunhos'
import { contextoDoPerfil, nomeDaParte } from '@/lib/contratos/contexto'
import { listarRegistros, type RegistroDoServidor } from '@/lib/contratos/registros'
import { dataCurtaDeTela, dataEHora } from '@/lib/contratos/entrega'
import { SubPage, comVolta, useVoltar } from '@/components/ui/SubPage'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { ArrowRight, FingerprintIcon, LockIcon, PenIcon, TrashIcon } from '@/components/ui/icons'
import { CARTAO, ROTULO_DE_SECAO } from '@/components/contratos/estilos'

// /contratos — a mesa de documentos do advogado.
//
// Três coisas nesta tela, nesta ordem: começar um documento, retomar o que está
// NESTE aparelho, e ver os registros da CONTA (que existem em qualquer aparelho).
// A separação entre as duas listas não é detalhe de implementação — é a resposta
// honesta a "onde está meu contrato?": o texto fica onde foi escrito; aqui fica
// só a prova de que ele existiu.

const SITUACAO: Record<Rascunho['etapa'], string> = {
  dados: 'Preenchendo',
  revisao: 'Em revisão',
  registro: 'Pronto para registrar',
  assinatura: 'Registrado',
}

export default function ContratosPage() {
  const navigate = useNavigate()
  const voltar = useVoltar('/painel')
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const [perfil, setPerfil] = useState<Profile | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [registros, setRegistros] = useState<RegistroDoServidor[] | null>(null)
  const [falhaRegistros, setFalhaRegistros] = useState(false)
  const [apagando, setApagando] = useState<string | null>(null)
  const [apagandoTudo, setApagandoTudo] = useState(false)
  const rascunhos = useRascunhos(userId)

  useEffect(() => {
    api
      .getDraft()
      .then(setPerfil)
      .catch((e: unknown) => {
        if (e instanceof SessaoExpirada) return
        setErro(e instanceof Error ? e.message : 'Falha ao carregar o perfil.')
      })
    listarRegistros()
      .then(setRegistros)
      .catch(() => {
        setRegistros([])
        setFalhaRegistros(true)
      })
  }, [])

  // Registros agrupados por código: a minuta revisada e as versões assinadas dela.
  const grupos = useMemo(() => {
    const mapa = new Map<string, RegistroDoServidor[]>()
    for (const r of registros ?? []) mapa.set(r.codigo, [...(mapa.get(r.codigo) ?? []), r])
    return [...mapa.entries()].map(([codigo, lista]) => ({
      codigo,
      revisado: lista.find((x) => x.etapa === 'revisado'),
      assinadas: lista.filter((x) => x.etapa === 'assinado').length,
      local: rascunhos.find((r) => r.registro?.codigo === codigo),
    }))
  }, [registros, rascunhos])

  if (erro) return <FalhaAoCarregar mensagem={erro} />

  if (!perfil) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy"
          role="status"
          aria-label="Carregando"
        />
      </div>
    )
  }

  const liberado = canUseContratos(perfil.plan)
  const semIdentidade = !perfil.name.trim() || !perfil.oabNumber.trim()

  const comecar = (modelo: ModeloId) => {
    const m = MODELOS[modelo]
    const agora = new Date().toISOString()
    const r: Rascunho = {
      id: novoId(),
      modelo,
      modeloVersao: m.versao,
      dados: m.iniciais(contextoDoPerfil(perfil)),
      documento: null,
      etapa: 'dados',
      criadoEm: agora,
      atualizadoEm: agora,
    }
    salvarRascunho(userId, r)
    navigate(comVolta(`/contratos/rascunho/${r.id}`, '/contratos'))
  }

  return (
    <SubPage
      title="Contratos e procurações"
      subtitle="A minuta sai de um modelo, a revisão é sua, e a impressão digital do PDF fica registrada."
      icon={<PenIcon width={20} height={20} aria-hidden />}
      backTo={voltar}
      documentTitle="Contratos e procurações"
    >
      {/* Como funciona — três passos, em uma faixa. Some a dúvida "a plataforma
          faz o contrato por mim?" antes de a pessoa tocar em qualquer coisa. */}
      <ol className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
        {[
          ['Monte', 'Preencha os dados e escolha as opções do modelo.'],
          ['Revise', 'Leia e edite cada cláusula. O texto final é seu.'],
          ['Registre e assine', 'Baixe o PDF com código e assine com gov.br ou certificado.'],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3 rounded-xl2 border border-ink/10 bg-paper/60 p-3.5 min-[480px]:flex-col min-[480px]:gap-1.5">
            <span className="font-display text-[22px] font-semibold leading-none tabular-nums text-brass" aria-hidden>
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink">{t}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">{d}</span>
            </span>
          </li>
        ))}
      </ol>

      {!liberado && (
        <section className="rounded-xl2 border border-brass/30 bg-gradient-to-b from-brass/[0.07] to-transparent p-5">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-brass-deep">
            <LockIcon width={11} height={11} aria-hidden />
            Plano Max
          </p>
          <h2 className="mt-2.5 text-balance font-display text-[19px] font-semibold leading-snug text-ink">
            Montar e registrar documentos faz parte do Max
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            Você pode ver os modelos abaixo. Para montar a minuta e registrar o PDF, é preciso o plano
            Max. Registros que você já fez continuam valendo e aparecem aqui em qualquer plano.
          </p>
          <Link
            to={comVolta(`/planos?recurso=contratos&plano=${perfil.plan}`, '/contratos')}
            className="btn-primary mt-4 w-full !py-3 text-[14px] sm:w-auto"
          >
            Ver o plano Max
            <ArrowRight width={15} height={15} aria-hidden />
          </Link>
        </section>
      )}

      {liberado && semIdentidade && (
        <p className="rounded-xl2 border border-burgundy/25 bg-burgundy/[0.04] p-4 text-[13.5px] leading-relaxed text-ink-soft" role="status">
          Seu nome e sua inscrição na OAB entram em todo documento, e faltam no seu perfil.{' '}
          <Link to="/editor?section=identidade" className="font-semibold text-burgundy underline underline-offset-2">
            Completar no perfil
          </Link>
        </p>
      )}

      {/* Novo documento */}
      <section aria-labelledby="novo-documento">
        <h2 id="novo-documento" className={`${ROTULO_DE_SECAO} px-1`}>
          Novo documento
        </h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {ORDEM_DOS_MODELOS.map((id) => {
            const m = MODELOS[id]
            return (
              <button
                key={id}
                type="button"
                disabled={!liberado}
                onClick={() => comecar(id)}
                className="group relative flex flex-col items-start overflow-hidden rounded-xl2 border border-ink/10 bg-paper p-4 pr-8 text-left shadow-card transition-[transform,border-color,box-shadow] duration-300 enabled:hover:-translate-y-0.5 enabled:hover:border-brass/50 enabled:hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-70"
              >
                {/* Canto dobrado da folha — decorativo. */}
                <span
                  className="absolute right-0 top-0 h-6 w-6 bg-[linear-gradient(225deg,#ebe3d3_50%,rgba(216,185,133,0.55)_50%)]"
                  aria-hidden
                />
                <span className="font-display text-[16px] font-semibold leading-tight text-ink">{m.nome}</span>
                <span className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{m.resumo}</span>
                <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-faint">
                  <PenIcon width={13} height={13} aria-hidden />
                  Assina: {m.quemAssina.toLowerCase()}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Neste aparelho */}
      <section aria-labelledby="neste-aparelho" className="pt-2">
        <h2 id="neste-aparelho" className={`${ROTULO_DE_SECAO} px-1`}>
          Neste aparelho
        </h2>
        {rascunhos.length === 0 ? (
          <p className="mt-3 rounded-xl2 border border-dashed border-ink/15 px-4 py-5 text-center text-[13px] text-ink-faint">
            Nenhum documento começado neste navegador.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rascunhos.map((r) => {
              const m = MODELOS[r.modelo]
              const parte = nomeDaParte(r)
              return (
                <li key={r.id} className="rounded-xl2 border border-ink/10 bg-paper shadow-card">
                  <div className="flex items-center gap-2 p-2 pl-4">
                    <Link
                      to={comVolta(`/contratos/rascunho/${r.id}`, '/contratos')}
                      className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[15px] font-semibold text-ink">
                          {m?.nome ?? 'Documento'}
                          {parte ? <span className="font-sans font-normal text-ink-soft"> · {parte}</span> : null}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-faint">
                          <span
                            className={`font-semibold ${r.registro ? 'text-brass-deep' : 'text-ink-soft'}`}
                          >
                            {SITUACAO[r.etapa]}
                          </span>
                          {r.registro && <span translate="no" className="font-mono">{r.registro.codigo}</span>}
                          <span>{dataCurtaDeTela(r.atualizadoEm)}</span>
                        </span>
                      </span>
                      <ArrowRight
                        width={15}
                        height={15}
                        className="shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                    {apagando === r.id ? null : (
                      <button
                        type="button"
                        onClick={() => setApagando(r.id)}
                        aria-label={`Apagar ${m?.nome ?? 'documento'}${parte ? ` de ${parte}` : ''} deste aparelho`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-burgundy/[0.06] hover:text-burgundy"
                      >
                        <TrashIcon width={16} height={16} aria-hidden />
                      </button>
                    )}
                  </div>
                  {apagando === r.id && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 bg-burgundy/[0.03] px-4 py-3 text-[13px]" role="group" aria-label="Confirmar exclusão">
                      <span className="mr-auto text-ink-soft">
                        {r.registro
                          ? 'O texto sai deste aparelho. O registro da impressão digital continua na conta.'
                          : 'O rascunho sai deste aparelho, e não há outra cópia.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setApagando(null)}
                        className="btn-ghost !py-2 text-[13px]"
                      >
                        Manter
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          apagarRascunho(userId, r.id)
                          setApagando(null)
                        }}
                        className="inline-flex items-center justify-center rounded-full bg-burgundy px-4 py-2 font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep"
                      >
                        Apagar
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* A ressalva que não pode ficar escondida num tooltip. */}
        <div className="mt-3 rounded-xl2 bg-ink/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-ink-faint">
          <p>
            O texto dos documentos e os dados dos seus clientes ficam só neste navegador — não vão para
            o servidor. Em computador compartilhado, apague ao terminar.
          </p>
          {rascunhos.length > 0 &&
            (apagandoTudo ? (
              <span className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar apagar tudo">
                <span className="text-ink-soft">Apagar os {rascunhos.length} documentos deste aparelho?</span>
                <button type="button" onClick={() => setApagandoTudo(false)} className="btn-ghost !py-1.5 text-[12.5px]">
                  Manter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    apagarTodosOsRascunhos(userId)
                    setApagandoTudo(false)
                  }}
                  className="rounded-full bg-burgundy px-3.5 py-1.5 font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep"
                >
                  Apagar tudo
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setApagandoTudo(true)}
                className="mt-1 inline-block py-1.5 font-medium text-burgundy underline underline-offset-2 hover:text-burgundy-deep"
              >
                Apagar tudo deste aparelho
              </button>
            ))}
        </div>
      </section>

      {/* Registros da conta */}
      <section aria-labelledby="registros-da-conta" className="pt-2">
        <h2 id="registros-da-conta" className={`${ROTULO_DE_SECAO} px-1`}>
          Registros da conta
        </h2>
        {registros === null ? (
          <p className="mt-3 px-1 text-[13px] text-ink-faint" role="status">
            Carregando registros…
          </p>
        ) : falhaRegistros ? (
          <p className="mt-3 rounded-xl2 border border-burgundy/20 px-4 py-3 text-[13px] text-ink-soft" role="alert">
            Não foi possível carregar os registros agora. Recarregue a página para tentar de novo.
          </p>
        ) : grupos.length === 0 ? (
          <p className="mt-3 rounded-xl2 border border-dashed border-ink/15 px-4 py-5 text-center text-[13px] text-ink-faint">
            Nenhum documento registrado ainda.
          </p>
        ) : (
          <ul className={`mt-3 divide-y divide-ink/[0.07] overflow-hidden !p-0 ${CARTAO}`}>
            {grupos.map((g) => (
              <li key={g.codigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[14px] font-semibold tracking-wide text-ink" translate="no">
                    {g.codigo}
                  </span>
                  <span className="block text-[12px] leading-snug text-ink-faint">
                    {MODELOS[g.revisado?.modelo as ModeloId]?.nome ?? 'Documento'}
                    {g.revisado ? ` · ${dataEHora(g.revisado.registradoEm)}` : ''}
                    {g.assinadas ? ` · ${g.assinadas} ${g.assinadas === 1 ? 'versão assinada' : 'versões assinadas'}` : ''}
                  </span>
                </span>
                {g.local ? (
                  <Link
                    to={comVolta(`/contratos/rascunho/${g.local.id}`, '/contratos')}
                    className="py-2 text-[13px] font-semibold text-burgundy hover:text-burgundy-deep"
                  >
                    Abrir
                  </Link>
                ) : (
                  <span className="text-[12px] text-ink-faint">texto em outro aparelho</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        to={comVolta('/contratos/conferir', '/contratos')}
        className="group flex items-center gap-3 rounded-xl2 border border-ink/10 bg-paper/60 p-4 transition-[transform,border-color,background-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-brass/50 hover:bg-paper hover:shadow-card"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brass/25 bg-brass/[0.07] text-brass-deep" aria-hidden>
          <FingerprintIcon width={17} height={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[14.5px] font-semibold text-ink">Conferir um arquivo</span>
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-soft">
            Veja se um PDF é idêntico ao registrado. Qualquer pessoa pode usar — o link não pede conta.
          </span>
        </span>
        <ArrowRight width={15} height={15} className="shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </SubPage>
  )
}
