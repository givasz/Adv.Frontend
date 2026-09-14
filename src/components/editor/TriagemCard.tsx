import { useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  FontePossivel,
  OpcaoDeTriagem,
  PerguntaDeTriagem,
  TipoDePergunta,
} from '@/lib/triagem'
import type { Profile } from '@/lib/types'
import {
  fontesPossiveis,
  LIMITES_DA_TRIAGEM,
  normalizarTriagem,
  perguntasAlcancaveis,
  perguntasUtilizaveis,
  podeTrocarComAProxima,
  TRIAGEM_LABEL_MAX,
  TRIAGEM_MAX_OPCOES,
  TRIAGEM_MAX_PERGUNTAS,
  TRIAGEM_OPCAO_MAX,
  TRIAGEM_VAZIA,
  TIPOS_UNICOS,
  triagemEmEdicao,
} from '@/lib/triagem'
import {
  AVISO_DOS_MODELOS,
  modelosDeTriagem,
  novaOpcao,
  novaPergunta,
  TIPO_META,
  TIPOS_NA_ORDEM,
} from '@/lib/triagemModelos'
import { conferirPerguntaInteira } from '@/lib/triagemDados'
import { checkCompliance } from '@/lib/oab'
import { resolveSchedulingMode } from '@/lib/booking'
import { AvisoDaPergunta } from './AvisoDaPergunta'
import { Field, TextInput, Toggle } from './fields'
import { InfoTip } from './InfoTip'
import { MarginNotes } from './MarginNotes'
import { comVolta } from '@/components/ui/SubPage'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDown,
  MessageIcon,
  PenIcon,
  PlayIcon,
  ShieldIcon,
  SparkIcon,
  TrashIcon,
} from '@/components/ui/icons'

// ASSISTENTE DE TRIAGEM — a tela onde o advogado escreve as perguntas.
//
// A ideia inteira do recurso está na ordem desta tela: primeiro o que ele vai
// PERGUNTAR, depois como testar, e só então a letra do que a plataforma promete.
// Não há campo de "resposta automática" em lugar nenhum, e isso é a arquitetura
// falando: o assistente pergunta e encaminha; quem responde é o advogado.
//
// O CAMINHO da conversa não é desenhado aqui, e sim no fluxograma que ocupa o
// lugar da prévia do celular nesta seção (MapaDaTriagem). Aqui cada pergunta
// diz QUEM a recebe ("todo mundo" ou "só quem respondeu…"); lá se vê o todo e se
// liga uma resposta às perguntas seguintes. Os dois mexem no mesmo dado.
//
// A parte mais importante não é um controle, é o que a tela ENSINA. O pedido de
// dado pessoal desnecessário não nasce de má-fé — nasce de ninguém ter dito que
// pedir CPF na primeira conversa é coleta além do necessário (LGPD, art. 6º, III).
// Por isso a orientação aparece ANTES da primeira pergunta, os modelos já vêm
// limpos, e cada enunciado escrito passa por uma conferência com reescrita pronta
// ao lado (ver AvisoDaPergunta e lib/triagemDados.ts).

export function TriagemCard({
  profile,
  set,
  preview = false,
  irPara,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  /** modo espectro (dentro do cadeado): controles inertes, só para o advogado ver */
  preview?: boolean
  /** sai do editor gravando o que estiver em voo (ver Editor.irPara) */
  irPara?: (destino: string) => void
}) {
  // O editor trabalha com o texto CRU. Passar cada tecla pelo normalizador do
  // servidor comia o espaço digitado no fim ("Em " virava "Em") e descartava a
  // opção recém-criada, ainda vazia. Quem limpa o texto é o servidor, ao
  // gravar; aqui só se garante a forma — ver triagemEmEdicao.
  const config = useMemo(
    () => triagemEmEdicao(profile.triage ?? TRIAGEM_VAZIA),
    [profile.triage],
  )
  const perguntas = config.questions
  // As contas de CAMINHO (quem é alcançável) usam a forma que a conversa vai
  // ler: texto limpo, perguntas incompletas de fora.
  const normalizadas = useMemo(() => normalizarTriagem(config).questions, [config])
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const [verModelos, setVerModelos] = useState(false)

  const areas = profile.areas.map((a) => a.label.trim()).filter(Boolean)
  const modelos = useMemo(() => modelosDeTriagem(areas), [areas.join('|')])
  const assistenteLigado = resolveSchedulingMode(profile) === 'assistant'
  const utilizaveis = perguntasUtilizaveis(normalizadas)
  const idsUtilizaveis = new Set(utilizaveis.map((q) => q.id))
  const bothFormats = profile.serviceMode.inPerson && profile.serviceMode.online
  const temAtendimento = perguntas.some((q) => q.kind === 'atendimento')
  const temContato = perguntas.some((q) => q.kind === 'contato')
  // Quem a conversa consegue alcançar. O defeito clássico de todo formulário com
  // caminhos é a pergunta que ninguém consegue receber: ela fica na tela,
  // parece no ar, e nunca é feita a ninguém.
  const alcancaveis = useMemo(() => perguntasAlcancaveis(normalizadas), [normalizadas])

  const patch = (questions: PerguntaDeTriagem[], enabled = config.enabled) => {
    if (preview) return
    set({ triage: triagemEmEdicao({ enabled, questions }) })
  }

  const trocar = (id: string, p: Partial<PerguntaDeTriagem>) =>
    patch(perguntas.map((q) => (q.id === id ? { ...q, ...p } : q)))

  const remover = (id: string) => {
    patch(perguntas.filter((q) => q.id !== id))
    if (abertaId === id) setAbertaId(null)
  }

  /** Troca a pergunta de lugar com a vizinha — a ordem daqui é a ordem da conversa. */
  const mover = (i: number, passo: -1 | 1) => {
    const j = i + passo
    if (j < 0 || j >= perguntas.length) return
    // Uma pergunta nunca passa para cima daquela de que depende: a ligação se
    // soltaria em silêncio. O botão já vem apagado; esta é a segunda rede.
    if (!podeTrocarComAProxima(perguntas, Math.min(i, j))) return
    const lista = [...perguntas]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    patch(lista)
  }

  const adicionar = (kind: TipoDePergunta = 'escolha') => {
    if (perguntas.length >= TRIAGEM_MAX_PERGUNTAS) return
    const nova = novaPergunta(kind)
    patch([...perguntas, nova])
    setAbertaId(nova.id)
  }

  const aplicarModelo = (questions: PerguntaDeTriagem[]) => {
    patch(questions, true)
    setVerModelos(false)
    setAbertaId(null)
  }

  return (
    // `data-triagem-editor`: é por aqui que o teste de fumaça confere que
    // nenhum controle desta tela ficou sem nome acessível — ela é cheia de
    // botão só de ícone (subir, descer, excluir, remover opção).
    <div
      data-triagem-editor
      className={`space-y-5 ${preview ? 'pointer-events-none select-none' : ''}`}
    >
      <div className="flex items-start gap-2">
        <MessageIcon width={16} height={16} className="mt-0.5 shrink-0 text-brass-deep" />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          Defina quais informações você gostaria de receber{' '}
          <span className="font-medium text-ink">antes de um possível atendimento</span>. O
          assistente faz as suas perguntas, organiza as respostas e manda tudo no seu WhatsApp.
          Quem analisa e confirma é você.
        </p>
      </div>

      {/* 1 — o interruptor */}
      <div className="rounded-lg border border-ink/10 bg-paper-soft/60 px-3.5 py-3">
        <Toggle
          checked={config.enabled}
          onChange={(enabled) => patch(perguntas, enabled)}
          label="Ativar assistente de triagem"
        />
        <p className="mt-1.5 pl-[50px] text-[11.5px] leading-relaxed text-ink-faint">
          {config.enabled
            ? utilizaveis.length
              ? `O assistente pode fazer até ${utilizaveis.length} ${utilizaveis.length === 1 ? 'pergunta' : 'perguntas'} antes de oferecer horários.`
              : 'Sem nenhuma pergunta pronta, o assistente segue só com o agendamento.'
            : 'Desligado, o assistente continua marcando horários como sempre fez.'}
        </p>
      </div>

      {/* A triagem mora DENTRO do assistente: sem ele ligado, ninguém a alcança. */}
      {config.enabled && !assistenteLigado && (
        <p className="rounded-lg border border-brass/25 bg-brass/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-brass-deep">
          A triagem acontece dentro do assistente virtual, e ele está desligado. Ligue em{' '}
          <Link
            to="/editor?section=agenda"
            className="font-semibold underline underline-offset-4 hover:opacity-80"
          >
            Sua agenda
          </Link>{' '}
          para estas perguntas aparecerem no seu perfil.
        </p>
      )}

      {/* 2 — a orientação, ANTES da primeira pergunta */}
      <div className="flex items-start gap-2.5 rounded-lg border border-ink/10 bg-paper-deep/50 px-3.5 py-3">
        <ShieldIcon width={16} height={16} className="mt-0.5 shrink-0 text-brass-deep" />
        <div className="text-[12px] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">
            Evite pedir dados pessoais ou sensíveis nesta etapa.
          </p>
          <p className="mt-1">
            Pergunte só o necessário para decidir se vai atender. Para a triagem inicial, prefira
            informações gerais: nada de CPF, documentos, dados bancários, informações de saúde ou
            outros dados sensíveis — salvo quando forem realmente necessários e com o tratamento
            adequado. Quem visita também é avisado a não enviar documentos por aqui.
          </p>
        </div>
      </div>

      {/* 3 — as perguntas */}
      <div>
        <span className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink">Perguntas</span>
          <span className="text-[11px] tabular-nums text-ink-faint">
            {perguntas.length}/{TRIAGEM_MAX_PERGUNTAS}
          </span>
        </span>

        {perguntas.length === 0 ? (
          // Sem nenhuma pergunta, o caminho recomendado é UM TOQUE: o modelo
          // geral, montado com as áreas do próprio perfil. Mandar a pessoa
          // "procurar os modelos abaixo" é pedir trabalho a quem abriu a tela
          // justamente para não ter trabalho.
          <div className="rounded-lg border border-dashed border-brass/40 bg-brass/[0.05] px-3.5 py-4 text-center">
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              Nenhuma pergunta ainda. Comece pelo modelo geral — ele já usa as áreas do seu perfil,
              e depois você muda o que quiser.
            </p>
            <button
              type="button"
              disabled={preview}
              onClick={() => aplicarModelo(modelos[0].questions)}
              className="btn-primary mx-auto mt-3 !py-2.5"
            >
              <SparkIcon width={15} height={15} />
              Usar a {modelos[0].nome.toLowerCase()}
            </button>
            <p className="mt-2 text-[11px] text-ink-faint">
              {modelos[0].questions.length} perguntas · {AVISO_DOS_MODELOS.toLowerCase()}
            </p>
          </div>
        ) : (
          // `data-perguntas`: a tela tem outras listas (as opções de uma pergunta,
          // os limites do recurso), e o teste precisa contar SÓ as perguntas.
          <ul data-perguntas className="space-y-2">
            {perguntas.map((q, i) => (
              <PerguntaItem
                key={q.id}
                pergunta={q}
                indice={i}
                total={perguntas.length}
                fontes={fontesPossiveis(perguntas, i)}
                podeSubir={i > 0 && podeTrocarComAProxima(perguntas, i - 1)}
                podeDescer={podeTrocarComAProxima(perguntas, i)}
                // Pergunta INCOMPLETA não é órfã: ela já diz o que falta ("sem
                // opções ainda"), e o selo de "ninguém chega" só confundiria.
                alcancavel={!idsUtilizaveis.has(q.id) || alcancaveis.has(q.id)}
                tiposOcupados={perguntas.filter((x) => x.id !== q.id).map((x) => x.kind)}
                aberta={abertaId === q.id}
                preview={preview}
                onAbrir={() => setAbertaId(abertaId === q.id ? null : q.id)}
                onMover={(passo) => mover(i, passo)}
                onTrocar={(p) => trocar(q.id, p)}
                onRemover={() => remover(q.id)}
              />
            ))}
          </ul>
        )}

        {perguntas.length < TRIAGEM_MAX_PERGUNTAS ? (
          <button
            type="button"
            disabled={preview}
            onClick={() => adicionar()}
            className="btn-ghost mt-2 w-full border-dashed"
          >
            + Adicionar pergunta
          </button>
        ) : (
          <p className="mt-2 rounded-lg bg-brass/10 px-3 py-2 text-[12.5px] text-brass-deep">
            Você chegou ao máximo de {TRIAGEM_MAX_PERGUNTAS} perguntas. Uma triagem mais longa que
            isto costuma ser abandonada no meio.
          </p>
        )}
      </div>

      {/* Dois lembretes que só aparecem quando fazem falta de verdade. */}
      {config.enabled && utilizaveis.length > 0 && bothFormats && !temAtendimento && (
        <Lembrete
          texto="Você atende presencial e online, mas não pergunta a preferência. Sem isso, o assistente pergunta por conta depois dos horários."
          acao="Adicionar a pergunta"
          onClick={() => adicionar('atendimento')}
          desabilitado={preview || perguntas.length >= TRIAGEM_MAX_PERGUNTAS}
        />
      )}
      {config.enabled && utilizaveis.length > 0 && !temContato && (
        <Lembrete
          texto="Nenhuma pergunta pede o nome de quem escreve. Sem isso, o assistente pergunta por conta no fim da conversa."
          acao="Adicionar a pergunta"
          onClick={() => adicionar('contato')}
          desabilitado={preview || perguntas.length >= TRIAGEM_MAX_PERGUNTAS}
        />
      )}

      {/* 4 — o ensaio. O caminho inteiro está no fluxograma (ao lado no
          computador; na aba "Fluxograma" no celular). Ver o desenho responde "por
          onde passa"; conversar com o próprio assistente responde "como fica". */}
      {utilizaveis.length > 0 && (
        <div data-testar className="rounded-lg border border-ink/10 bg-paper-soft/60 p-3.5">
          <p className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-ink-soft">
            <MessageIcon width={14} height={14} className="mt-0.5 shrink-0 text-brass-deep" />
            <span>
              <span className="lg:hidden">
                O caminho completo da conversa está na aba{' '}
                <span className="font-semibold text-ink">Fluxograma</span>, no alto da tela.
              </span>
              <span className="hidden lg:inline">
                O caminho completo da conversa está no fluxograma, ao lado.
              </span>{' '}
              Para sentir como fica, converse com o seu assistente.
            </span>
          </p>
          <button
            type="button"
            disabled={preview || !irPara}
            onClick={() => irPara?.(comVolta('/assistente/testar', '/editor?section=triagem'))}
            className="btn-primary mt-3 w-full !py-2.5 disabled:opacity-50"
          >
            <PlayIcon width={15} height={15} />
            Testar meu assistente
          </button>
          <p className="mt-2 text-center text-[11.5px] leading-relaxed text-ink-faint">
            Abre a conversa de verdade, como quem visita o seu perfil vai ver. Nada é enviado.
          </p>
        </div>
      )}

      {/* 5 — modelos */}
      <div className="rounded-lg border border-brass/25 bg-brass/[0.05] p-3.5">
        <button
          type="button"
          onClick={() => setVerModelos((v) => !v)}
          aria-expanded={verModelos}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <SparkIcon width={14} height={14} className="text-brass-deep" />
            Começar por um modelo
          </span>
          <span className="text-[12px] font-semibold text-burgundy">
            {verModelos ? 'Fechar' : 'Ver modelos'}
          </span>
        </button>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
          {AVISO_DOS_MODELOS} Aplicar um modelo substitui as perguntas atuais.
        </p>
        {verModelos && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {modelos.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={preview}
                onClick={() => aplicarModelo(m.questions)}
                className="rounded-lg border border-ink/15 bg-paper/70 px-3 py-2.5 text-left transition-colors hover:border-brass/60"
              >
                <span className="block text-[13px] font-semibold text-ink">{m.nome}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">
                  {m.resumo}
                </span>
                <span className="mt-1 block text-[11px] text-ink-faint">
                  {m.questions.length} perguntas
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 6 — o limite do que a plataforma promete */}
      <div className="rounded-lg border border-ink/10 bg-paper-deep/50 px-3.5 py-3">
        <p className="text-[12px] font-semibold text-ink">Sobre este recurso</p>
        <ul className="mt-1.5 space-y-1.5">
          {LIMITES_DA_TRIAGEM.map((t) => (
            <li key={t} className="text-[11.5px] leading-relaxed text-ink-faint">
              {t}
            </li>
          ))}
        </ul>
      </div>

      {!profile.contact.whatsapp && (
        <div className="flex items-start gap-2 rounded-lg bg-brass/[0.08] px-3 py-2.5">
          <MessageIcon width={15} height={15} className="mt-0.5 shrink-0 text-brass-deep" />
          <p className="text-[12px] leading-relaxed text-brass-deep">
            Adicione seu número em <span className="font-semibold">Seus canais</span> — é para lá
            que as respostas da triagem são enviadas.
          </p>
        </div>
      )}
    </div>
  )
}

/** Lembrete de uma linha com um botão que resolve — nunca um alerta sem saída. */
function Lembrete({
  texto,
  acao,
  onClick,
  desabilitado,
}: {
  texto: string
  acao: string
  onClick: () => void
  desabilitado?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-ink/10 bg-paper-soft/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-faint">{texto}</span>
      <button
        type="button"
        onClick={onClick}
        disabled={desabilitado}
        className="shrink-0 self-start rounded-full border border-brass/50 px-3 py-1.5 text-[12px] font-semibold text-brass-deep transition-colors hover:bg-brass/15 disabled:opacity-40 sm:self-center"
      >
        {acao}
      </button>
    </div>
  )
}

/** "“A”, “B” ou “C”" — as respostas como se diz em voz alta. */
function emPalavras(textos: string[]): string {
  const aspas = textos.map((t) => `“${t}”`)
  return aspas.length > 1 ? `${aspas.slice(0, -1).join(', ')} ou ${aspas[aspas.length - 1]}` : aspas[0] ?? ''
}

// ---- Uma pergunta na lista -------------------------------------------------

function PerguntaItem({
  pergunta,
  indice,
  total,
  fontes,
  podeSubir,
  podeDescer,
  alcancavel,
  tiposOcupados,
  aberta,
  preview,
  onAbrir,
  onMover,
  onTrocar,
  onRemover,
}: {
  pergunta: PerguntaDeTriagem
  indice: number
  total: number
  /** as perguntas anteriores de que esta pode depender */
  fontes: FontePossivel[]
  /** subir não passa esta pergunta para cima daquela de que ela depende */
  podeSubir: boolean
  /** descer não passa esta pergunta para baixo de uma que depende dela */
  podeDescer: boolean
  /** a conversa consegue chegar até aqui? */
  alcancavel: boolean
  /** tipos já usados por OUTRAS perguntas — nome e formato só cabem uma vez */
  tiposOcupados: TipoDePergunta[]
  aberta: boolean
  preview: boolean
  onAbrir: () => void
  onMover: (passo: -1 | 1) => void
  onTrocar: (p: Partial<PerguntaDeTriagem>) => void
  onRemover: () => void
}) {
  const meta = TIPO_META[pergunta.kind]
  // Enunciado E opções: o visitante lê os dois, e é nas opções que ele toca.
  const textosDaPergunta = [pergunta.label, ...(pergunta.options ?? []).map((o) => o.texto)]
  const achados = useMemo(
    () => conferirPerguntaInteira(pergunta),
    // Pelos TEXTOS: as opções são objetos, e `join` de objeto dá sempre
    // "[object Object]" — o aviso não acordava quando se escrevia numa opção.
    [textosDaPergunta.join('|')],
  )
  const issues = useMemo(
    () => checkCompliance(textosDaPergunta.join(' ')),
    [textosDaPergunta.join('|')],
  )
  const comOpcoes = pergunta.kind === 'escolha' || pergunta.kind === 'multipla'
  const semOpcao = comOpcoes && !(pergunta.options ?? []).some((o) => o.texto.trim())

  const trocarOpcao = (i: number, p: Partial<OpcaoDeTriagem>) =>
    onTrocar({ options: (pergunta.options ?? []).map((o, j) => (j === i ? { ...o, ...p } : o)) })

  // QUEM RECEBE esta pergunta. A condição fica com a pergunta de destino, e é
  // nela que a tela pergunta — "só abrir esta pergunta se…" é a frase que o
  // advogado pensa.
  const condicao = pergunta.condicao
  const fonte = condicao ? fontes.find((f) => f.id === condicao.pergunta) : undefined
  const resumoDaCondicao =
    fonte && condicao?.opcoes.length
      ? `Só para quem respondeu ${emPalavras(
          fonte.opcoes.filter((o) => condicao.opcoes.includes(o.id)).map((o) => o.texto),
        )} na ${fonte.numero}`
      : null

  // ENCERRAR numa resposta. Múltipla escolha não encerra (a pessoa pode ter
  // marcado junto outra que abre uma pergunta), e opção sem texto não aparece —
  // não há o que reconhecer nela.
  const opcoesComTexto = (pergunta.options ?? []).filter((o) => o.texto.trim())
  const podeEncerrar = pergunta.kind !== 'multipla' && opcoesComTexto.length > 0
  const alternarEncerra = (id: string) =>
    onTrocar({
      options: (pergunta.options ?? []).map((o): OpcaoDeTriagem => {
        if (o.id !== id) return o
        if (!o.encerra) return { ...o, encerra: true }
        const { encerra: _fora, ...resto } = o
        return resto
      }),
    })

  // CONFIRMAR não grava nada — o editor já salva enquanto se escreve (é o "Tudo
  // salvo" do topo). O que o botão faz é dizer "terminei esta": fecha o painel
  // e devolve o foco ao botão de editar, para quem navega por teclado não se
  // perder. Pergunta pela metade não confirma, e a tela diz o que falta — um
  // botão apagado sem explicação é um botão quebrado.
  const faltaEnunciado = !pergunta.label.trim()
  const podeConfirmar = !faltaEnunciado && !semOpcao
  const painelId = useId()
  const editarRef = useRef<HTMLButtonElement>(null)
  const confirmar = () => {
    if (!podeConfirmar) return
    onAbrir()
    requestAnimationFrame(() => editarRef.current?.focus())
  }

  return (
    <li className="rounded-lg border border-ink/10 bg-paper-soft/60">
      <div className="flex items-start gap-2 p-3">
        <span className="mt-1 w-5 shrink-0 text-center text-[12px] font-semibold tabular-nums text-ink-faint">
          {indice + 1}
        </span>
        <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onAbrir}
          aria-expanded={aberta}
          aria-controls={painelId}
          className="block w-full min-w-0 text-left"
        >
          <span className="block truncate text-[13.5px] font-medium text-ink">
            {pergunta.label.trim() || <span className="text-ink-faint">Pergunta sem enunciado</span>}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-ink-faint">
            {meta.label} · {semOpcao ? 'sem opções ainda' : meta.exemplo}
          </span>
          {resumoDaCondicao && (
            <span className="mt-1 block text-[11.5px] font-medium text-burgundy [overflow-wrap:anywhere]">
              {resumoDaCondicao}
            </span>
          )}
          {/* Ninguém consegue receber esta pergunta. É o defeito clássico de
              formulário com caminhos: a pergunta está na lista, parece no ar, e
              nunca é feita a ninguém. Avisa, não bloqueia. */}
          {!alcancavel && (
            <span className="mt-1 inline-block rounded-full bg-brass/15 px-2 py-0.5 text-[11px] font-semibold text-brass-deep">
              Ninguém chega até aqui
            </span>
          )}
        </button>
        {/* EDITAR escrito, e não só o texto clicável: tocar no enunciado para
            abrir é um gesto que ninguém adivinha. Vira "Fechar" com o painel
            aberto, para o mesmo botão desfazer o que fez. */}
        {!preview && (
          <button
            ref={editarRef}
            type="button"
            onClick={onAbrir}
            aria-expanded={aberta}
            aria-controls={painelId}
            aria-label={`${aberta ? 'Fechar' : 'Editar'} a pergunta ${indice + 1}`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-burgundy/30 px-3 py-1 text-[12.5px] font-semibold text-burgundy transition-colors hover:bg-burgundy/[0.06]"
          >
            {aberta ? (
              <ChevronDown width={13} height={13} className="rotate-180" aria-hidden />
            ) : (
              <PenIcon width={13} height={13} aria-hidden />
            )}
            {aberta ? 'Fechar' : 'Editar'}
          </button>
        )}
        </div>
        {/* Setas, e não arrastar: a lista é curta, o alvo é grande no dedo e o
            gesto existe para quem navega por teclado ou leitor de tela. */}
        <div className="flex shrink-0 items-center gap-0.5">
          <IconeBotao
            label={`Mover a pergunta ${indice + 1} para cima`}
            disabled={preview || indice === 0 || !podeSubir}
            dica={indice > 0 && !podeSubir ? 'Ela depende da pergunta de cima' : undefined}
            onClick={() => onMover(-1)}
          >
            <ArrowUpIcon width={15} height={15} />
          </IconeBotao>
          <IconeBotao
            label={`Mover a pergunta ${indice + 1} para baixo`}
            disabled={preview || indice === total - 1 || !podeDescer}
            dica={indice < total - 1 && !podeDescer ? 'A pergunta de baixo depende desta' : undefined}
            onClick={() => onMover(1)}
          >
            <ArrowDownIcon width={15} height={15} />
          </IconeBotao>
          <IconeBotao
            label={`Excluir a pergunta ${indice + 1}`}
            disabled={preview}
            onClick={onRemover}
            perigo
          >
            <TrashIcon width={15} height={15} />
          </IconeBotao>
        </div>
      </div>

      {/* Avisos ficam FORA do painel de edição: uma pergunta que pede CPF precisa
          ser vista com a lista fechada, senão o problema fica escondido atrás de
          um "Editar" que ninguém vai tocar. */}
      {(achados.length > 0 || issues.length > 0) && (
        <div className="px-3 pb-3">
          <AvisoDaPergunta achados={achados} onUsarSugestao={(label) => onTrocar({ label })} />
          <MarginNotes issues={issues} />
        </div>
      )}

      {aberta && !preview && (
        <div id={painelId} className="space-y-3 border-t border-ink/10 px-3 py-3.5">
          <Field
            label="A pergunta, como quem visita vai ler"
            hint={`${pergunta.label.length}/${TRIAGEM_LABEL_MAX}`}
            info={
              <InfoTip
                title="Como escrever a pergunta"
                align="left"
                label="Ajuda sobre a pergunta da triagem"
                items={[
                  'Pergunte só o que você precisa saber para decidir se vai atender.',
                  'Prefira informações gerais — o detalhe vem na conversa com você.',
                  'Não peça CPF, documentos, dados bancários ou informações de saúde.',
                  'Evite prometer resultado, citar valores ou convidar a contratar.',
                ]}
              />
            }
          >
            <TextInput
              value={pergunta.label}
              maxLength={TRIAGEM_LABEL_MAX}
              onChange={(e) => onTrocar({ label: e.target.value })}
              // Pergunta recém-criada abre com o cursor no campo: é a única coisa
              // que dá para fazer nela, e procurar onde tocar é trabalho à toa.
              autoFocus={!pergunta.label}
              // Enter confirma — como atalho. O caminho principal é o botão:
              // no celular o Enter do teclado nem sempre está à vista.
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                e.preventDefault()
                confirmar()
              }}
              placeholder="Qual assunto você deseja tratar?"
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">
              Como a pessoa responde
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de resposta">
              {TIPOS_NA_ORDEM.map((k) => (
                <Pilula
                  key={k}
                  ativa={pergunta.kind === k}
                  // Nome e formato alimentam campos únicos da mensagem: uma
                  // segunda pergunta desse tipo seria descartada ao gravar.
                  // Melhor não deixar escolher do que deixar sumir.
                  disabled={
                    pergunta.kind !== k && TIPOS_UNICOS.includes(k) && tiposOcupados.includes(k)
                  }
                  onClick={() =>
                    onTrocar({
                      kind: k,
                      // Trocar para um tipo com lista sem opção nenhuma deixaria a
                      // pergunta impossível de responder — e ela some da conversa.
                      options:
                        k === 'escolha' || k === 'multipla'
                          ? pergunta.options?.length
                            ? pergunta.options
                            : [novaOpcao(), novaOpcao()]
                          : undefined,
                    })
                  }
                >
                  {TIPO_META[k].label}
                </Pilula>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">{meta.hint}</p>
          </div>

          {comOpcoes && (
            <div>
              <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">
                Opções de resposta
              </span>
              <ul className="space-y-1.5">
                {(pergunta.options ?? []).map((o, i) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <TextInput
                      value={o.texto}
                      maxLength={TRIAGEM_OPCAO_MAX}
                      onChange={(e) => trocarOpcao(i, { texto: e.target.value })}
                      placeholder={`Opção ${i + 1}`}
                      aria-label={`Opção ${i + 1}`}
                    />
                    <IconeBotao
                      label={`Remover a opção ${i + 1}`}
                      onClick={() =>
                        onTrocar({ options: (pergunta.options ?? []).filter((_, j) => j !== i) })
                      }
                      perigo
                    >
                      <TrashIcon width={15} height={15} />
                    </IconeBotao>
                  </li>
                ))}
              </ul>
              {(pergunta.options ?? []).length < TRIAGEM_MAX_OPCOES && (
                <button
                  type="button"
                  onClick={() => onTrocar({ options: [...(pergunta.options ?? []), novaOpcao()] })}
                  className="mt-2 text-[12.5px] font-semibold text-burgundy underline-offset-4 hover:underline"
                >
                  + Adicionar opção
                </button>
              )}
            </div>
          )}

          {/* Tipos de lista fixa: mostrar o que a pessoa vai ver evita a dúvida
              "e onde eu escrevo as opções?". */}
          {(pergunta.kind === 'sim-nao' || pergunta.kind === 'atendimento') && (
            <p className="rounded-lg bg-paper-deep/60 px-3 py-2 text-[11.5px] leading-relaxed text-ink-faint">
              As opções são fixas:{' '}
              <span className="font-medium text-ink-soft">
                {(pergunta.options ?? []).map((o) => o.texto).join(' · ')}
              </span>
              {pergunta.kind === 'atendimento' &&
                ' — e a resposta vai como “Formato” na sua mensagem.'}
            </p>
          )}

          {/* ---- QUEM RECEBE esta pergunta -----------------------------------
              Só aparece quando há de quem depender: uma pergunta anterior com
              respostas para escolher. A primeira pergunta é sempre de todos. */}
          {fontes.length > 0 && (
            <div>
              <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">
                Quem recebe esta pergunta
              </span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quem recebe esta pergunta">
                <Pilula ativa={!condicao} onClick={() => onTrocar({ condicao: undefined })}>
                  Todo mundo
                </Pilula>
                <Pilula
                  ativa={!!condicao}
                  onClick={() => {
                    // Começa pela pergunta logo acima que tem respostas — é quase
                    // sempre dela que a pergunta nova depende.
                    if (!condicao) {
                      onTrocar({ condicao: { pergunta: fontes[fontes.length - 1].id, opcoes: [] } })
                    }
                  }}
                >
                  Só quem deu uma resposta
                </Pilula>
              </div>
              {condicao && (
                <div className="mt-2 space-y-2 rounded-lg bg-paper-deep/60 px-3 py-2.5">
                  <label className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-soft">
                    Na pergunta
                    <select
                      value={fonte?.id ?? ''}
                      onChange={(e) => onTrocar({ condicao: { pergunta: e.target.value, opcoes: [] } })}
                      // 16px no celular: abaixo disso o Safari do iPhone dá zoom
                      // na página ao focar o campo.
                      className="min-w-0 max-w-full rounded-lg border border-ink/15 bg-paper-soft px-2.5 py-1.5 text-[16px] text-ink focus:border-burgundy focus:outline-none sm:text-[12.5px]"
                    >
                      {!fonte && <option value="">Escolha a pergunta</option>}
                      {fontes.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                  {fonte && (
                    <div>
                      <span className="mb-1 block text-[12px] text-ink-soft">quem respondeu</span>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Respostas que abrem esta pergunta">
                        {fonte.opcoes.map((o) => {
                          const marcada = condicao.opcoes.includes(o.id)
                          return (
                            <Pilula
                              key={o.id}
                              ativa={marcada}
                              onClick={() =>
                                onTrocar({
                                  condicao: {
                                    pergunta: fonte.id,
                                    opcoes: marcada
                                      ? condicao.opcoes.filter((x) => x !== o.id)
                                      : [...condicao.opcoes, o.id],
                                  },
                                })
                              }
                            >
                              {marcada && <CheckIcon width={12} height={12} strokeWidth={2.6} aria-hidden />}
                              {o.texto}
                            </Pilula>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <p className="text-[11.5px] leading-relaxed text-ink-faint" aria-live="polite">
                    {condicao.opcoes.length
                      ? 'Quem der outra resposta — ou pular aquela pergunta — não vê esta e segue para a seguinte.'
                      : 'Escolha ao menos uma resposta. Enquanto isso, a pergunta vale para todo mundo.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {podeEncerrar && (
            <div>
              <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">
                Respostas que encerram a triagem
              </span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Respostas que encerram a triagem">
                {opcoesComTexto.map((o) => (
                  <Pilula key={o.id} ativa={!!o.encerra} onClick={() => alternarEncerra(o.id)}>
                    {o.encerra && <CheckIcon width={12} height={12} strokeWidth={2.6} aria-hidden />}
                    {o.texto.trim()}
                  </Pilula>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
                Quem der uma resposta marcada não recebe as perguntas seguintes: a conversa vai
                direto para o fim. Para ligar uma resposta a uma pergunta, toque nela no fluxograma.
              </p>
            </div>
          )}

          {pergunta.kind === 'multipla' && opcoesComTexto.length > 0 && (
            <p className="rounded-lg bg-paper-deep/60 px-3 py-2 text-[11.5px] leading-relaxed text-ink-faint">
              Numa pergunta de várias respostas, nenhuma encerra a triagem — quem marca pode ter
              marcado junto outra que abre uma pergunta. Ligar uma resposta a uma pergunta
              seguinte funciona normalmente: basta uma das marcadas.
            </p>
          )}

          <Toggle
            checked={!!pergunta.optional}
            onChange={(optional) => onTrocar({ optional })}
            label="Quem visita pode pular esta pergunta"
          />

          <div className="flex flex-col gap-2 border-t border-ink/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11.5px] leading-relaxed text-ink-faint" aria-live="polite">
              {faltaEnunciado
                ? 'Escreva a pergunta para confirmar.'
                : semOpcao
                  ? 'Escreva ao menos uma opção de resposta para confirmar.'
                  : 'O que você escreve já fica salvo. Confirme quando terminar esta pergunta.'}
            </p>
            <button
              type="button"
              onClick={confirmar}
              disabled={!podeConfirmar}
              className="btn-primary !px-4 !py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50 sm:shrink-0"
            >
              <CheckIcon width={15} height={15} strokeWidth={2.4} aria-hidden />
              Confirmar pergunta
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Botão de escolha em pílula — o mesmo desenho para tipo, destinatário e encerrar. */
function Pilula({
  ativa,
  onClick,
  disabled,
  children,
}: {
  ativa: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        ativa
          ? 'border-burgundy bg-burgundy/[0.07] text-burgundy'
          : 'border-ink/15 text-ink-soft hover:border-brass/50'
      }`}
    >
      {children}
    </button>
  )
}

function IconeBotao({
  label,
  onClick,
  disabled,
  perigo,
  dica,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  perigo?: boolean
  /** por que o botão está apagado, quando não é óbvio */
  dica?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={dica}
      className={`shrink-0 rounded-lg p-2 text-ink-faint transition-colors disabled:opacity-30 ${
        perigo ? 'hover:bg-ink/[0.05] hover:text-burgundy' : 'hover:bg-ink/[0.05] hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
