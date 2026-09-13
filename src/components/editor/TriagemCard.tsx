import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PerguntaDeTriagem, TipoDePergunta } from '@/lib/triagem'
import type { Profile } from '@/lib/types'
import {
  LIMITES_DA_TRIAGEM,
  normalizarTriagem,
  OPCOES_ATENDIMENTO,
  OPCOES_SIM_NAO,
  perguntasUtilizaveis,
  resolveTriagem,
  roteiroDaConversa,
  TRIAGEM_LABEL_MAX,
  TRIAGEM_MAX_OPCOES,
  TRIAGEM_MAX_PERGUNTAS,
  TRIAGEM_OPCAO_MAX,
} from '@/lib/triagem'
import {
  AVISO_DOS_MODELOS,
  modelosDeTriagem,
  novaPergunta,
  TIPO_META,
  TIPOS_NA_ORDEM,
} from '@/lib/triagemModelos'
import { conferirPerguntaInteira } from '@/lib/triagemDados'
import { checkCompliance } from '@/lib/oab'
import { resolveSchedulingMode } from '@/lib/booking'
import { buildAssistantDays, resolveAssistantConfig } from '@/lib/assistant'
import { AvisoDaPergunta } from './AvisoDaPergunta'
import { Field, TextInput, Toggle } from './fields'
import { InfoTip } from './InfoTip'
import { MarginNotes } from './MarginNotes'
import { comVolta } from '@/components/ui/SubPage'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  MessageIcon,
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
  const config = useMemo(() => resolveTriagem(profile), [profile.triage])
  const perguntas = config.questions
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const [verModelos, setVerModelos] = useState(false)

  const areas = profile.areas.map((a) => a.label.trim()).filter(Boolean)
  const modelos = useMemo(() => modelosDeTriagem(areas), [areas.join('|')])
  const assistenteLigado = resolveSchedulingMode(profile) === 'assistant'
  const utilizaveis = perguntasUtilizaveis(perguntas)
  const bothFormats = profile.serviceMode.inPerson && profile.serviceMode.online
  const temAtendimento = perguntas.some((q) => q.kind === 'atendimento')
  const temContato = perguntas.some((q) => q.kind === 'contato')
  // A grade tem horário para oferecer daqui para a frente? É a MESMA conta da
  // conversa (buildAssistantDays), e não "tem dia marcado na semana" — uma grade
  // cheia pode não ter nenhum horário dentro da antecedência mínima.
  const comHorarios = useMemo(
    () =>
      assistenteLigado && buildAssistantDays(resolveAssistantConfig(profile.assistant)).length > 0,
    [assistenteLigado, profile.assistant],
  )
  const roteiro = useMemo(
    () => roteiroDaConversa(perguntas, { comHorarios, dosDoisJeitos: bothFormats }),
    [perguntas, comHorarios, bothFormats],
  )

  const patch = (questions: PerguntaDeTriagem[], enabled = config.enabled) => {
    if (preview) return
    set({ triage: normalizarTriagem({ enabled, questions }) })
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
              ? `O assistente faz ${utilizaveis.length} ${utilizaveis.length === 1 ? 'pergunta' : 'perguntas'} antes de oferecer horários.`
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

      {/* 4 — o roteiro inteiro, e o ensaio.
          A lista de cima é o que ele EDITA; esta é o que o visitante VAI VER —
          e são coisas diferentes, porque o roteiro tem a abertura, o aviso de
          segurança e os passos que vêm depois da triagem (dia, horário, nome).
          Sem ver isso junto, ele publica sem saber o tamanho do que montou. */}
      {utilizaveis.length > 0 && (
        <div data-roteiro className="rounded-lg border border-ink/10 bg-paper-soft/60 p-3.5">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <MessageIcon width={14} height={14} className="text-brass-deep" />
            Como a conversa vai ficar
          </p>
          <ol className="mt-2.5 space-y-1.5">
            {roteiro.map((passo, i) => (
              <li key={`${i}-${passo.texto}`} className="flex gap-2.5 text-[12.5px] leading-snug">
                <span
                  className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums ${
                    passo.minha
                      ? 'bg-burgundy text-paper-soft'
                      : 'border border-ink/15 text-ink-faint'
                  }`}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className={passo.minha ? 'text-ink' : 'text-ink-faint'}>
                  {passo.texto}
                  {passo.minha && <span className="sr-only"> (pergunta sua)</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-faint">
            <CheckIcon width={13} height={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-brass-deep" />
            Em vinho, as suas perguntas. As demais o assistente já faz sozinho.
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

// ---- Uma pergunta na lista -------------------------------------------------

function PerguntaItem({
  pergunta,
  indice,
  total,
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
  aberta: boolean
  preview: boolean
  onAbrir: () => void
  onMover: (passo: -1 | 1) => void
  onTrocar: (p: Partial<PerguntaDeTriagem>) => void
  onRemover: () => void
}) {
  const meta = TIPO_META[pergunta.kind]
  // Enunciado E opções: o visitante lê os dois, e é nas opções que ele toca.
  const achados = useMemo(
    () => conferirPerguntaInteira(pergunta),
    [pergunta.label, pergunta.options?.join('|')],
  )
  const issues = useMemo(
    () => checkCompliance([pergunta.label, ...(pergunta.options ?? [])].join(' ')),
    [pergunta.label, pergunta.options?.join('|')],
  )
  const comOpcoes = pergunta.kind === 'escolha' || pergunta.kind === 'multipla'
  const semOpcao = comOpcoes && !(pergunta.options ?? []).some((o) => o.trim())

  const trocarOpcao = (i: number, valor: string) =>
    onTrocar({ options: (pergunta.options ?? []).map((o, j) => (j === i ? valor : o)) })

  return (
    <li className="rounded-lg border border-ink/10 bg-paper-soft/60">
      <div className="flex items-start gap-2 p-3">
        <span className="mt-1 w-5 shrink-0 text-center text-[12px] font-semibold tabular-nums text-ink-faint">
          {indice + 1}
        </span>
        <button
          type="button"
          onClick={onAbrir}
          aria-expanded={aberta}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-[13.5px] font-medium text-ink">
            {pergunta.label.trim() || <span className="text-ink-faint">Pergunta sem enunciado</span>}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-ink-faint">
            {meta.label} · {semOpcao ? 'sem opções ainda' : meta.exemplo}
          </span>
        </button>
        {/* Setas, e não arrastar: a lista é curta, o alvo é grande no dedo e o
            gesto existe para quem navega por teclado ou leitor de tela. */}
        <div className="flex shrink-0 items-center gap-0.5">
          <IconeBotao
            label={`Mover a pergunta ${indice + 1} para cima`}
            disabled={preview || indice === 0}
            onClick={() => onMover(-1)}
          >
            <ArrowUpIcon width={15} height={15} />
          </IconeBotao>
          <IconeBotao
            label={`Mover a pergunta ${indice + 1} para baixo`}
            disabled={preview || indice === total - 1}
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
        <div className="space-y-3 border-t border-ink/10 px-3 py-3.5">
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
              placeholder="Qual assunto você deseja tratar?"
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">
              Como a pessoa responde
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de resposta">
              {TIPOS_NA_ORDEM.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={pergunta.kind === k}
                  onClick={() =>
                    onTrocar({
                      kind: k,
                      // Trocar para um tipo com lista sem opção nenhuma deixaria a
                      // pergunta impossível de responder — e ela some da conversa.
                      options:
                        k === 'escolha' || k === 'multipla'
                          ? (pergunta.options?.length ? pergunta.options : ['', ''])
                          : undefined,
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    pergunta.kind === k
                      ? 'border-burgundy bg-burgundy/[0.07] text-burgundy'
                      : 'border-ink/15 text-ink-soft hover:border-brass/50'
                  }`}
                >
                  {TIPO_META[k].label}
                </button>
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
                  <li key={i} className="flex items-center gap-2">
                    <TextInput
                      value={o}
                      maxLength={TRIAGEM_OPCAO_MAX}
                      onChange={(e) => trocarOpcao(i, e.target.value)}
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
                  onClick={() => onTrocar({ options: [...(pergunta.options ?? []), ''] })}
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
                {(pergunta.kind === 'sim-nao' ? OPCOES_SIM_NAO : OPCOES_ATENDIMENTO).join(' · ')}
              </span>
              {pergunta.kind === 'atendimento' &&
                ' — e a resposta vai como “Formato” na sua mensagem.'}
            </p>
          )}

          <Toggle
            checked={!!pergunta.optional}
            onChange={(optional) => onTrocar({ optional })}
            label="Quem visita pode pular esta pergunta"
          />
        </div>
      )}
    </li>
  )
}

function IconeBotao({
  label,
  onClick,
  disabled,
  perigo,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  perigo?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`shrink-0 rounded-lg p-2 text-ink-faint transition-colors disabled:opacity-30 ${
        perigo ? 'hover:bg-ink/[0.05] hover:text-burgundy' : 'hover:bg-ink/[0.05] hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
