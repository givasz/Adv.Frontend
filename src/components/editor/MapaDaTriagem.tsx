import { Fragment, useId, useMemo, useState } from 'react'
import type { Profile } from '@/lib/types'
import {
  ligarResposta,
  mapaDaTriagem,
  TRIAGEM_VAZIA,
  triagemEmEdicao,
  type EtapaFixa,
  type ItemDoMapa,
  type OpcaoDeTriagem,
  type PerguntaDeTriagem,
  type PerguntaNoMapa,
  type RamoNoMapa,
  type RespostaNoMapa,
} from '@/lib/triagem'
import { TIPO_META } from '@/lib/triagemModelos'
import { resolveSchedulingMode } from '@/lib/booking'
import { buildAssistantDays, resolveAssistantConfig } from '@/lib/assistant'

// O FLUXOGRAMA DA TRIAGEM — mora no lugar da prévia do celular, só nesta seção.
//
// A prévia mostrava o perfil, e a pergunta que o advogado faz aqui não é "como
// fica o meu perfil?", é "por onde a conversa passa?". Com perguntas que só
// abrem para uma resposta, uma lista numerada mente: quem respondeu "Família"
// não vê a pergunta 2, e a lista não diz isso. O fluxograma diz.
//
// Como se lê, de cima para baixo:
//   • caixa em vinho = uma pergunta do advogado, com as respostas embaixo;
//   • losango colorido = um trecho que só abre para quem deu aquela resposta —
//     a MESMA cor marca a resposta na caixa de cima, que é o que liga as duas
//     coisas sem uma linha cruzando a tela;
//   • tracejado à direita = quem respondeu outra coisa pula o trecho.
//
// E se EDITA daqui: tocar numa resposta abre, logo abaixo da caixa, a lista das
// perguntas seguintes para ligar a ela (e o "encerra a triagem aqui"). Painel em
// linha, não janela — ver advocme-sem-modais. O dado é o mesmo que o editor da
// pergunta mexe ("Quem recebe esta pergunta"): `ligarResposta` é a fonte única.
//
// Tudo que decide caminho vem de lib/triagem.ts (`mapaDaTriagem`), que usa as
// mesmas funções da conversa do visitante. Este arquivo só desenha.

/**
 * As cores das ligações. Escuras o bastante para texto sobre o papel do editor
 * e distantes entre si — a oitava ligação repete a primeira, e a tela não
 * depende só da cor: a resposta sempre diz "→ 3" e o trecho diz qual resposta.
 */
const CORES = ['#2F7D78', '#4F5FB0', '#A8661A', '#8E4FA3', '#56782A', '#B04A2B', '#2D6FA3', '#A34A67']
const NEUTRA = '#8C8479'

/** `#rrggbb` + transparência — para o fundo e a borda do losango. */
const alfa = (cor: string, a: number) =>
  `${cor}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`

interface Contexto {
  cores: Map<string, string>
  aberta: { pergunta: string; resposta: string } | null
  destacadas: Set<string>
  preview: boolean
  alternar: (pergunta: string, resposta: string) => void
  painel: (no: PerguntaNoMapa, resposta: RespostaNoMapa) => React.ReactNode
}

export function MapaDaTriagem({
  profile,
  set,
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  /** espectro sob o cadeado: desenha, mas não deixa mexer */
  preview?: boolean
}) {
  const tituloId = useId()
  const config = useMemo(() => triagemEmEdicao(profile.triage ?? TRIAGEM_VAZIA), [profile.triage])
  const perguntas = config.questions
  const assistenteLigado = resolveSchedulingMode(profile) === 'assistant'
  // A MESMA conta da conversa (buildAssistantDays): uma grade cheia pode não ter
  // nenhum horário dentro da antecedência mínima.
  const comHorarios = useMemo(
    () =>
      assistenteLigado && buildAssistantDays(resolveAssistantConfig(profile.assistant)).length > 0,
    [assistenteLigado, profile.assistant],
  )
  const dosDoisJeitos = profile.serviceMode.inPerson && profile.serviceMode.online
  const recebeNoPainel = profile.plan === 'premium' && !!profile.meetingInboxEnabled
  const mapa = useMemo(
    () => mapaDaTriagem(perguntas, { comHorarios, dosDoisJeitos, semEtapas: config.semEtapas, destino: recebeNoPainel ? 'painel' : 'whatsapp' }),
    [perguntas, comHorarios, dosDoisJeitos, config.semEtapas, recebeNoPainel],
  )
  const fixosAtivos = mapa.depois.filter((p) => !p.removida)
  const fixosTirados = mapa.depois.filter((p) => p.removida)
  const [aberta, setAberta] = useState<Contexto['aberta']>(null)

  // Uma cor por resposta que abre alguma coisa, na ordem em que aparecem.
  const cores = useMemo(() => {
    const m = new Map<string, string>()
    const visitar = (itens: ItemDoMapa[]) => {
      for (const item of itens) {
        if (item.tipo === 'ramo') {
          visitar(item.itens)
          continue
        }
        for (const r of item.respostas) {
          if (r.abre.length) m.set(`${item.id}:${r.id}`, CORES[m.size % CORES.length])
        }
      }
    }
    visitar(mapa.itens)
    return m
  }, [mapa])

  // Com uma resposta aberta, as perguntas ligadas a ela ganham destaque: o olho
  // encontra na hora o que o toque vai mudar.
  const destacadas = useMemo(
    () =>
      new Set(
        aberta
          ? perguntas
              .filter(
                (q) => q.condicao?.pergunta === aberta.pergunta && q.condicao.opcoes.includes(aberta.resposta),
              )
              .map((q) => q.id)
          : [],
      ),
    [aberta, perguntas],
  )

  const gravar = (questions: PerguntaDeTriagem[]) => {
    if (preview) return
    set({ triage: triagemEmEdicao({ ...config, questions }) })
  }

  /** Tira da conversa (ou devolve) uma pergunta que o assistente faz sozinho. */
  const alternarEtapa = (etapa: EtapaFixa) => {
    if (preview) return
    const tiradas = new Set(config.semEtapas ?? [])
    if (tiradas.has(etapa)) tiradas.delete(etapa)
    else tiradas.add(etapa)
    set({ triage: triagemEmEdicao({ ...config, semEtapas: [...tiradas] }) })
  }

  const encerrar = (perguntaId: string, respostaId: string, ligar: boolean) =>
    gravar(
      perguntas.map((q) =>
        q.id !== perguntaId
          ? q
          : {
              ...q,
              options: (q.options ?? []).map((o): OpcaoDeTriagem => {
                if (o.id !== respostaId) return o
                if (ligar) return { ...o, encerra: true }
                const { encerra: _fora, ...resto } = o
                return resto
              }),
            },
      ),
    )

  const painel = (no: PerguntaNoMapa, r: RespostaNoMapa) => {
    const indice = perguntas.findIndex((q) => q.id === no.id)
    // As perguntas DEPOIS desta, e só as que já têm enunciado — ligar a uma
    // pergunta em branco seria ligar a nada que se possa reconhecer.
    const alvos = perguntas.map((q, i) => ({ q, i })).filter(({ q, i }) => i > indice && q.label.trim())
    return (
      <div className="ml-7 mt-2.5 rounded-lg border border-ink/10 bg-paper px-3 py-2.5">
        <p className="text-[12.5px] font-semibold text-ink [overflow-wrap:anywhere]">
          Quem responder “{r.texto}”…
        </p>
        {/* Múltipla escolha não encerra: quem marca várias pode ter marcado outra
            que abre uma pergunta, e não há desempate honesto. */}
        {no.kind !== 'multipla' && (
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug text-ink-soft">
            <input
              type="checkbox"
              checked={r.encerra}
              onChange={(e) => encerrar(no.id, r.id, e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-burgundy"
            />
            encerra a triagem aqui e vai direto para {comHorarios && !(config.semEtapas ?? []).includes('horario') ? 'os horários' : 'o envio'}
          </label>
        )}
        {r.encerra ? (
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
            Com a triagem encerrada nesta resposta, ela não abre mais nenhuma pergunta.
          </p>
        ) : alvos.length ? (
          <fieldset className="mt-2.5">
            <legend className="text-[11.5px] leading-relaxed text-ink-faint">
              …recebe as perguntas marcadas. Elas passam a ser só de quem responder assim:
            </legend>
            <ul className="mt-1.5 space-y-1.5">
              {alvos.map(({ q, i }) => {
                const c = q.condicao
                const ligada = c?.pergunta === no.id && c.opcoes.includes(r.id)
                const outra = c && c.pergunta !== no.id ? perguntas.findIndex((x) => x.id === c.pergunta) + 1 : 0
                return (
                  <li key={q.id}>
                    <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug text-ink">
                      <input
                        type="checkbox"
                        checked={ligada}
                        onChange={(e) => gravar(ligarResposta(perguntas, no.id, r.id, q.id, e.target.checked))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-burgundy"
                      />
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        <span className="font-semibold tabular-nums">{i + 1}.</span> {q.label.trim()}
                        {/* Uma pergunta depende de UMA pergunta só: marcar aqui troca
                            a dependência, e isso tem de estar escrito antes do toque. */}
                        {outra > 0 && (
                          <span className="block text-[11px] text-ink-faint">
                            hoje depende da pergunta {outra} — marcar aqui troca
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        ) : (
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
            Não há pergunta depois desta. Adicione uma pergunta abaixo dela para ligá-la a esta
            resposta.
          </p>
        )}
        <button
          type="button"
          onClick={() => setAberta(null)}
          className="mt-2.5 text-[12.5px] font-semibold text-burgundy underline-offset-4 hover:underline"
        >
          Pronto
        </button>
      </div>
    )
  }

  const ctx: Contexto = {
    cores,
    aberta,
    destacadas,
    preview,
    alternar: (pergunta, resposta) =>
      setAberta((a) => (a?.pergunta === pergunta && a.resposta === resposta ? null : { pergunta, resposta })),
    painel,
  }

  const avisoDeEstado = preview
    ? null
    : !config.enabled
      ? 'A triagem está desligada: este é o desenho, mas ele ainda não aparece no seu perfil.'
      : !assistenteLigado
        ? 'O assistente virtual está desligado em Sua agenda — por enquanto ninguém chega a estas perguntas.'
        : null

  return (
    // `data-mapa`: é por aqui que o teste de fumaça lê o fluxograma de volta.
    <section
      data-mapa
      aria-labelledby={tituloId}
      className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-5 lg:max-h-[calc(100dvh-104px)] lg:overflow-y-auto"
    >
      <h3 id={tituloId} className="font-display text-lg font-semibold">
        Fluxograma da conversa
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
        O caminho de quem visita, pergunta por pergunta.
        {!preview &&
          ' Toque numa resposta para escolher quais perguntas ela abre, e no × para tirar uma pergunta que o assistente faz sozinho. A abertura, com o aviso para não enviar documentos, fica sempre.'}
      </p>
      {avisoDeEstado && (
        <p className="mt-2.5 rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2 text-[12px] leading-relaxed text-brass-deep">
          {avisoDeEstado}
        </p>
      )}

      <div className="mt-4">
        <PassoFixo texto={mapa.inicio.texto} />
        <Seta />
        {mapa.itens.length ? (
          <Sequencia itens={mapa.itens} ctx={ctx} />
        ) : (
          <div className="rounded-xl border border-dashed border-ink/15 px-3 py-4 text-center text-[12px] leading-relaxed text-ink-faint">
            Nenhuma pergunta pronta ainda. Cada pergunta que você escrever entra aqui, na ordem da
            conversa.
          </div>
        )}
        {fixosAtivos.map((p) => (
          <Fragment key={p.texto}>
            <Seta />
            <PassoFixo
              texto={p.texto}
              // As perguntas que o assistente faz sozinho saem com um toque. A
              // abertura (aviso de segurança) e o envio não têm etapa: ficam.
              onTirar={p.etapa && !preview ? () => alternarEtapa(p.etapa as EtapaFixa) : undefined}
            />
          </Fragment>
        ))}
      </div>

      {/* O que foi tirado não some da tela: fica aqui, riscado, com o caminho de
          volta e o efeito dito em uma linha — tirar o nome ou o horário muda a
          mensagem que chega ao advogado, e ele precisa saber como. */}
      {fixosTirados.length > 0 && (
        <div className="mt-3 rounded-lg border border-ink/10 bg-paper-soft/60 px-3 py-2.5">
          <p className="text-[11.5px] font-semibold text-ink-soft">Tiradas da conversa</p>
          <ul className="mt-1.5 space-y-1.5">
            {fixosTirados.map((p) => (
              <li key={p.texto} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="min-w-0 text-[12px] text-ink-faint line-through decoration-ink/30">{p.texto}</span>
                <button
                  type="button"
                  onClick={() => alternarEtapa(p.etapa as EtapaFixa)}
                  aria-label={`Devolver “${p.texto}” à conversa`}
                  className="shrink-0 rounded-full border border-burgundy/30 px-2.5 py-0.5 text-[12px] font-semibold text-burgundy transition-colors hover:bg-burgundy/[0.06]"
                >
                  Devolver
                </button>
                <span className="w-full text-[11px] leading-relaxed text-ink-faint">
                  {p.etapa === 'horario'
                    ? recebeNoPainel
                      ? 'Sem escolher horário, o pedido chega às Solicitações. Você fala com a pessoa, define a data no pedido e confirma; o compromisso entra na agenda.'
                      : 'Sem escolher horário, a mensagem abre no seu WhatsApp. Combine com a pessoa e, se usar a agenda digital, adicione o compromisso por lá.'
                    : EFEITO_DE_TIRAR[p.etapa as EtapaFixa]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 space-y-1.5 border-t border-ink/10 pt-3 text-[11px] leading-relaxed text-ink-faint">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-[5px] h-2 w-2 shrink-0 rotate-45 rounded-[1px]" style={{ background: CORES[0] }} />
          Trecho que só abre para quem deu a resposta indicada. A mesma cor marca a resposta na
          pergunta de cima.
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="flex w-2 shrink-0 justify-center pt-[2px]">
            <span className="h-3 border-l-2 border-dashed border-ink/30" />
          </span>
          Quem respondeu outra coisa, ou pulou a pergunta, segue sem passar pelo trecho.
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-[4px] h-2 w-2 shrink-0 rounded-full bg-burgundy" />
          Em vinho, as suas perguntas. Em tracejado, o que o assistente já faz sozinho.
        </li>
      </ul>
    </section>
  )
}

function Sequencia({ itens, ctx }: { itens: ItemDoMapa[]; ctx: Contexto }) {
  return (
    <>
      {itens.map((item, i) => (
        <Fragment key={item.tipo === 'pergunta' ? item.id : `ramo-${primeiroId(item)}`}>
          {i > 0 && <Seta />}
          {item.tipo === 'pergunta' ? <Caixa no={item} ctx={ctx} /> : <Ramo ramo={item} ctx={ctx} />}
        </Fragment>
      ))}
    </>
  )
}

const primeiroId = (ramo: RamoNoMapa): string => {
  const [primeiro] = ramo.itens
  if (!primeiro) return ramo.pergunta
  return primeiro.tipo === 'pergunta' ? primeiro.id : primeiroId(primeiro)
}

/** Um trecho que só abre para quem deu uma das respostas. */
function Ramo({ ramo, ctx }: { ramo: RamoNoMapa; ctx: Contexto }) {
  const cor = ctx.cores.get(`${ramo.pergunta}:${ramo.opcoes[0]?.id}`) ?? NEUTRA
  const respostas = ramo.opcoes.map((o) => `“${o.texto}”`)
  const emPalavras =
    respostas.length > 1 ? `${respostas.slice(0, -1).join(', ')} ou ${respostas[respostas.length - 1]}` : respostas[0]
  return (
    <div role="group" aria-label={`Só para quem respondeu ${emPalavras} na pergunta ${ramo.numero}`}>
      {/* A decisão */}
      <div
        className="flex items-start gap-2 rounded-lg border px-2.5 py-2"
        style={{ borderColor: alfa(cor, 0.4), background: alfa(cor, 0.07) }}
      >
        <span aria-hidden className="mt-[4px] h-2.5 w-2.5 shrink-0 rotate-45 rounded-[2px]" style={{ background: cor }} />
        <p className="min-w-0 text-[12px] leading-snug text-ink-soft [overflow-wrap:anywhere]" aria-hidden>
          Só para quem respondeu{' '}
          {ramo.opcoes.map((o, i) => (
            <Fragment key={o.id}>
              {i > 0 && (i === ramo.opcoes.length - 1 ? ' ou ' : ', ')}
              <span className="font-semibold" style={{ color: ctx.cores.get(`${ramo.pergunta}:${o.id}`) ?? cor }}>
                “{o.texto}”
              </span>
            </Fragment>
          ))}{' '}
          na pergunta {ramo.numero}
        </p>
      </div>
      <div className="flex">
        {/* O "sim": as perguntas do trecho */}
        <div className="min-w-0 flex-1">
          <div className="ml-3 border-l-2 pb-1 pl-3 pt-1" style={{ borderColor: cor }}>
            <span aria-hidden className="block pb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: cor }}>
              sim
            </span>
            <Sequencia itens={ramo.itens} ctx={ctx} />
          </div>
        </div>
        {/* O "não": quem deu outra resposta passa reto por aqui */}
        <div aria-hidden className="relative ml-1 w-6 shrink-0">
          <div className="absolute inset-y-0 left-1/2 border-l-2 border-dashed border-ink/20" />
          <span className="absolute left-1/2 top-2 -translate-x-1/2 bg-paper py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint [writing-mode:vertical-rl]">
            não · pula
          </span>
        </div>
      </div>
    </div>
  )
}

/** Uma pergunta do advogado, com as respostas que dá para ligar. */
function Caixa({ no, ctx }: { no: PerguntaNoMapa; ctx: Contexto }) {
  const painelId = useId()
  const destacada = ctx.destacadas.has(no.id)
  const respostaAberta =
    ctx.aberta?.pergunta === no.id ? no.respostas.find((r) => r.id === ctx.aberta?.resposta) : undefined
  return (
    <div
      className={`rounded-xl border bg-paper-soft px-3 py-2.5 transition-shadow ${
        no.inalcancavel ? 'border-dashed border-brass/60' : destacada ? 'border-burgundy/50' : 'border-ink/15'
      } ${destacada ? 'ring-2 ring-burgundy/20' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-burgundy text-[11px] font-bold tabular-nums text-paper-soft"
        >
          {no.numero}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-ink [overflow-wrap:anywhere]">
            <span className="sr-only">Pergunta {no.numero}: </span>
            {no.texto}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {TIPO_META[no.kind].label}
            {no.opcional ? ' · dá para pular' : ''}
          </p>
          {no.inalcancavel && (
            <span className="mt-1 inline-block rounded-full bg-brass/15 px-2 py-0.5 text-[10.5px] font-semibold text-brass-deep">
              Ninguém chega até aqui
            </span>
          )}
        </div>
      </div>

      {no.respostas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
          {no.respostas.map((r) => {
            const cor = ctx.cores.get(`${no.id}:${r.id}`)
            const ativa = respostaAberta?.id === r.id
            return (
              <button
                key={r.id}
                type="button"
                disabled={ctx.preview}
                aria-expanded={ativa}
                aria-controls={ativa ? painelId : undefined}
                onClick={() => ctx.alternar(no.id, r.id)}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors disabled:cursor-default ${
                  ativa
                    ? 'border-burgundy bg-burgundy/[0.08] text-burgundy'
                    : 'border-ink/15 bg-paper text-ink-soft hover:border-burgundy/40'
                }`}
              >
                {cor && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} />}
                <span className="min-w-0 truncate">{r.texto}</span>
                {r.abre.length > 0 && (
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: cor }}>
                    <span aria-hidden>→ </span>
                    <span className="sr-only">, abre a pergunta </span>
                    {r.abre.join(', ')}
                  </span>
                )}
                {r.encerra && <span className="shrink-0 text-[11px] font-semibold text-brass-deep">· encerra</span>}
              </button>
            )
          })}
        </div>
      )}

      {respostaAberta && <div id={painelId}>{ctx.painel(no, respostaAberta)}</div>}
    </div>
  )
}

/** O que muda na mensagem quando cada pergunta embutida sai da conversa. */
const EFEITO_DE_TIRAR: Record<EtapaFixa, string> = {
  horario: 'Sem dia e horário, o pedido chega como pedido de contato: você responde e combina o horário.',
  formato: 'A mensagem chega sem “Formato”, a menos que uma pergunta sua peça a preferência.',
  nome: 'A mensagem chega sem “Nome”, a menos que uma pergunta sua peça.',
}

/** Um passo que o assistente faz sozinho — com o × quando dá para tirar. */
function PassoFixo({ texto, onTirar }: { texto: string; onTirar?: () => void }) {
  return (
    <div
      className={`relative rounded-full border border-dashed border-ink/20 py-1.5 text-center text-[11.5px] leading-snug text-ink-faint ${
        onTirar ? 'pl-9 pr-9' : 'px-3.5'
      }`}
    >
      {texto}
      {onTirar && (
        <button
          type="button"
          onClick={onTirar}
          aria-label={`Tirar “${texto}” da conversa`}
          title="Tirar da conversa"
          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-burgundy/[0.08] hover:text-burgundy"
        >
          <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}

function Seta() {
  return (
    <div aria-hidden className="flex justify-center py-1 text-ink/25">
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 1v11M1.5 8.5 5 12l3.5-3.5" />
      </svg>
    </div>
  )
}
