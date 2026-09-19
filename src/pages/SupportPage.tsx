import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  anexoUrl,
  marcarRespostasVistas,
  myTickets,
  openTicket,
  SUPPORT_KIND_LABEL,
  SUPPORT_KINDS,
  SUPPORT_STATUS_LABEL,
  type SupportKind,
  type SupportTicket,
} from '@/lib/support'
import { ANEXOS_MAX, prepararAnexo } from '@/lib/anexoImagem'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { CheckIcon, ChevronDown, ClockIcon, MessageIcon, XIcon } from '@/components/ui/icons'

// Suporte ao cliente — /suporte.
//
// Era um modal aberto por cima do editor. Virou página porque chamado é texto
// longo: no celular o teclado subia e sobrava uma fresta para escrever. Agora tem
// endereço próprio — dá até para mandar o link para alguém.
//
// DUAS ABAS (16/09/2026)
//
//   • Novo chamado — tipo em um toque, texto, e até 3 imagens (escolhidas ou
//     coladas com Ctrl+V). O contexto técnico vai junto sozinho (lib/support.ts).
//   • Respostas — cada chamado com a resposta da equipe em destaque. Antes o
//     histórico ficava no pé do formulário e nada avisava que havia resposta; a
//     pessoa só a via se voltasse aqui por acaso. Agora a resposta nova acende a
//     aba, o menu da conta e o painel, e chega por e-mail com link para cá
//     (`?aba=respostas`).
//
// A aba mora na URL, e os dois painéis ficam montados (um só escondido): trocar
// de aba para conferir uma resposta não apaga o chamado que estava sendo escrito.

type Aba = 'novo' | 'respostas'
const ABAS: Aba[] = ['novo', 'respostas']

export default function SupportPage() {
  const voltar = useVoltar('/painel')
  const [params, setParams] = useSearchParams()
  const aba: Aba = params.get('aba') === 'respostas' ? 'respostas' : 'novo'

  const [chamados, setChamados] = useState<SupportTicket[] | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  // `imagensPerdidas`: o servidor criou o chamado mas não devolveu as imagens —
  // um servidor sem suporte a anexo ignora o campo em silêncio, e a pessoa
  // acharia que mandou o print.
  const [enviado, setEnviado] = useState<{ imagensPerdidas: boolean } | null>(null)
  // Respostas novas já marcadas como vistas NESTA visita: o selo "Nova resposta"
  // continua no cartão (a pessoa ainda está lendo), mas a contagem da aba some.
  const [vistas, setVistas] = useState<Set<string>>(() => new Set())
  const abas = useRef<(HTMLButtonElement | null)[]>([])

  const irPara = useCallback(
    (destino: Aba) => {
      const p = new URLSearchParams(params)
      if (destino === 'respostas') p.set('aba', 'respostas')
      else p.delete('aba')
      // replace: trocar de aba não empilha histórico — o "voltar" continua
      // levando para onde a pessoa estava antes do suporte.
      setParams(p, { replace: true })
      if (destino === 'novo') setEnviado(null)
    },
    [params, setParams],
  )

  const carregar = useCallback(async () => {
    setErroLista(null)
    try {
      setChamados(await myTickets())
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : 'Não foi possível carregar seus chamados.')
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // Marca como vistas as respostas novas que a aba de respostas MOSTROU — pelos
  // ids, para uma resposta que chegue depois da carga continuar acesa.
  useEffect(() => {
    if (aba !== 'respostas' || !chamados) return
    const ids = chamados.filter((t) => t.novaResposta && !vistas.has(t.id)).map((t) => t.id)
    if (!ids.length) return
    setVistas((v) => new Set([...v, ...ids]))
    void marcarRespostasVistas(ids)
  }, [aba, chamados, vistas])

  const novas = chamados?.filter((t) => t.novaResposta && !vistas.has(t.id)).length ?? 0

  function aoTeclar(e: React.KeyboardEvent) {
    const i = ABAS.indexOf(aba)
    const alvo =
      e.key === 'ArrowRight' ? (i + 1) % ABAS.length
      : e.key === 'ArrowLeft' ? (i - 1 + ABAS.length) % ABAS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? ABAS.length - 1
      : -1
    if (alvo < 0) return
    e.preventDefault()
    irPara(ABAS[alvo]!)
    abas.current[alvo]?.focus()
  }

  return (
    <SubPage
      title="Suporte"
      subtitle="Atendimento a quem tem conta no advoc.me. As respostas ficam na aba Respostas e chegam também pelo seu e-mail."
      icon={<MessageIcon width={18} height={18} />}
      backTo={voltar}
      backLabel="Voltar"
      documentTitle="Suporte"
    >
      <div
        role="tablist"
        aria-label="Suporte"
        className="grid grid-cols-2 gap-1 rounded-full border border-ink/10 bg-paper p-1 shadow-card"
      >
        {ABAS.map((id, i) => {
          const ativa = aba === id
          return (
            <button
              key={id}
              ref={(el) => {
                abas.current[i] = el
              }}
              type="button"
              role="tab"
              id={`suporte-aba-${id}`}
              aria-selected={ativa}
              aria-controls={`suporte-painel-${id}`}
              tabIndex={ativa ? 0 : -1}
              onClick={() => irPara(id)}
              onKeyDown={aoTeclar}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-full px-3 text-[13.5px] font-semibold transition-colors ${
                ativa ? 'bg-burgundy text-paper' : 'text-ink-soft hover:bg-ink/[0.04] hover:text-ink'
              }`}
            >
              {id === 'novo' ? 'Novo chamado' : 'Respostas'}
              {id === 'respostas' && novas > 0 && (
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                    ativa ? 'bg-paper text-burgundy' : 'bg-burgundy text-paper'
                  }`}
                >
                  {novas}
                  <span className="sr-only">{novas === 1 ? ' resposta nova' : ' respostas novas'}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id="suporte-painel-novo"
        aria-labelledby="suporte-aba-novo"
        hidden={aba !== 'novo'}
      >
        <NovoChamado
          onEnviado={(imagensPerdidas) => {
            setEnviado({ imagensPerdidas })
            irPara('respostas')
            void carregar()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      </div>

      <div
        role="tabpanel"
        id="suporte-painel-respostas"
        aria-labelledby="suporte-aba-respostas"
        hidden={aba !== 'respostas'}
        className="space-y-3"
      >
        {enviado && (
          <div
            role="status"
            className="suporte-entra flex items-start gap-3 rounded-xl2 border border-brass/40 bg-brass/[0.08] px-4 py-3.5"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass/25 text-brass-deep">
              <CheckIcon width={14} height={14} strokeWidth={2.6} />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-ink">Chamado enviado.</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
                Ele aparece abaixo. Quando respondermos, a resposta fica aqui e avisamos pelo seu e-mail.
              </p>
              {enviado.imagensPerdidas && (
                <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-burgundy-deep">
                  As imagens não foram anexadas. Se elas forem importantes, abra outro chamado com elas
                  daqui a pouco.
                </p>
              )}
            </div>
          </div>
        )}

        {erroLista && (
          <div className="rounded-xl2 border border-burgundy/30 bg-burgundy/5 px-4 py-3.5 text-[13px] text-burgundy-deep">
            <p>{erroLista}</p>
            <button type="button" onClick={() => void carregar()} className="mt-2 font-semibold underline underline-offset-4">
              Tentar de novo
            </button>
          </div>
        )}

        {!chamados && !erroLista && (
          <div className="flex justify-center py-10" aria-label="Carregando seus chamados">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
          </div>
        )}

        {chamados?.length === 0 && (
          <div className="flex flex-col items-center rounded-xl2 border border-ink/10 bg-paper px-6 py-10 text-center shadow-card">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-burgundy/10 text-burgundy">
              <MessageIcon width={22} height={22} />
            </span>
            <h2 className="mt-3 font-display text-[18px] font-semibold text-ink">Nenhum chamado ainda</h2>
            <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink-soft">
              Quando você abrir um chamado, ele aparece aqui com a situação e a resposta da equipe.
            </p>
            <button type="button" onClick={() => irPara('novo')} className="btn-primary mt-5">
              Abrir um chamado
            </button>
          </div>
        )}

        {chamados && chamados.length > 0 && (
          <ul className="space-y-3">
            {chamados.map((t) => (
              <Chamado key={t.id} chamado={t} />
            ))}
          </ul>
        )}
      </div>
    </SubPage>
  )
}

// ---- Novo chamado ---------------------------------------------------------------

function NovoChamado({ onEnviado }: { onEnviado: (imagensPerdidas: boolean) => void }) {
  const [kind, setKind] = useState<SupportKind>('bug')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [anexos, setAnexos] = useState<string[]>([])
  const [preparando, setPreparando] = useState(0)
  const [avisoImagem, setAvisoImagem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seletor = useRef<HTMLInputElement>(null)

  const vagas = ANEXOS_MAX - anexos.length - preparando
  const podeEnviar = !busy && preparando === 0 && subject.trim().length >= 3 && message.trim().length >= 10

  async function adicionar(arquivos: File[]) {
    setAvisoImagem(null)
    if (!arquivos.length) return
    const cabem = arquivos.slice(0, Math.max(0, vagas))
    if (cabem.length < arquivos.length) {
      setAvisoImagem(`Cabem até ${ANEXOS_MAX} imagens por chamado.`)
    }
    // Uma de cada vez: três fotos de 12 MB decodificadas juntas derrubam a aba
    // num celular modesto.
    for (const arquivo of cabem) {
      setPreparando((n) => n + 1)
      try {
        const pronta = await prepararAnexo(arquivo)
        setAnexos((atuais) => (atuais.length < ANEXOS_MAX ? [...atuais, pronta] : atuais))
      } catch (e) {
        setAvisoImagem(e instanceof Error ? e.message : 'Não foi possível ler essa imagem. Tente outra.')
      } finally {
        setPreparando((n) => n - 1)
      }
    }
  }

  // Ctrl+V de uma captura de tela, em qualquer ponto do formulário. Se a área
  // de transferência também tem TEXTO (copiar células de planilha traz os dois),
  // o texto é o que a pessoa quis colar — e a imagem fica de fora.
  function aoColar(e: React.ClipboardEvent) {
    const dados = e.clipboardData
    if (!dados || dados.getData('text/plain')) return
    const imagens = Array.from(dados.files ?? []).filter((f) => f.type.startsWith('image/'))
    if (!imagens.length) return
    e.preventDefault()
    void adicionar(imagens)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!podeEnviar) return
    setBusy(true)
    setError(null)
    try {
      const criado = await openTicket({ kind, subject, message, anexos })
      const imagensPerdidas = anexos.length > 0 && (criado.anexos?.length ?? 0) < anexos.length
      setSubject('')
      setMessage('')
      setAnexos([])
      setAvisoImagem(null)
      setKind('bug')
      onEnviado(imagensPerdidas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.')
    } finally {
      setBusy(false)
    }
  }

  const campo =
    'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint/60 transition-colors focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15'

  return (
    <div className="rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-5">
      <form onSubmit={enviar} onPaste={aoColar} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-semibold text-ink">Do que se trata?</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {SUPPORT_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={kind === k.value}
                onClick={() => setKind(k.value)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  kind === k.value
                    ? 'border-burgundy bg-burgundy/[0.06] ring-1 ring-burgundy/30'
                    : 'border-ink/15 bg-paper-soft hover:border-ink/30'
                }`}
              >
                <span className="block text-[13px] font-semibold text-ink">{k.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{k.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="suporte-assunto" className="mb-1.5 block text-[12.5px] font-semibold text-ink">
            Assunto
          </label>
          <input
            id="suporte-assunto"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder="Ex.: o botão de agendar não abre no celular"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="suporte-msg" className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[12.5px] font-semibold text-ink">O que aconteceu</span>
            <span className="text-[11px] text-ink-faint">{message.length}/4000</span>
          </label>
          <textarea
            id="suporte-msg"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            placeholder="Conte o que você fez, o que esperava e o que apareceu. Se souber repetir o problema, descreva o passo a passo."
            className={`${campo} resize-none leading-relaxed`}
          />
        </div>

        {/* ─── imagens ─── */}
        <div>
          <p className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[12.5px] font-semibold text-ink">
              Imagens <span className="font-normal text-ink-faint">(opcional)</span>
            </span>
            <span className="text-[11px] tabular-nums text-ink-faint">
              {anexos.length}/{ANEXOS_MAX}
            </span>
          </p>
          <p className="mb-2.5 text-[11.5px] leading-relaxed text-ink-faint">
            Uma captura da tela mostra o problema melhor que muitas palavras. Antes de anexar, confira se
            ela não mostra dados de clientes. No computador, dá para colar com Ctrl+V.
          </p>

          <ul className="grid grid-cols-3 gap-2">
            {anexos.map((src, i) => (
              <li key={src.slice(-32) + i} className="relative">
                <img
                  src={src}
                  alt={`Imagem ${i + 1} anexada`}
                  className="aspect-square w-full rounded-lg border border-ink/10 bg-paper-soft object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAnexos((a) => a.filter((_, j) => j !== i))}
                  aria-label={`Remover a imagem ${i + 1}`}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/75 text-paper shadow-card transition-colors hover:bg-burgundy"
                >
                  <XIcon width={13} height={13} strokeWidth={2.6} />
                </button>
              </li>
            ))}
            {Array.from({ length: preparando }, (_, i) => (
              <li
                key={`preparando-${i}`}
                className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-ink/20 bg-paper-soft"
                aria-label="Preparando imagem"
              >
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
              </li>
            ))}
            {vagas > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => seletor.current?.click()}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink/25 bg-paper-soft px-2 text-center text-[12px] font-medium text-ink-soft transition-colors hover:border-burgundy/50 hover:text-burgundy"
                >
                  <span aria-hidden className="text-[22px] font-light leading-none">+</span>
                  Adicionar imagem
                </button>
              </li>
            )}
          </ul>
          <input
            ref={seletor}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const arquivos = Array.from(e.target.files ?? [])
              // Zera o campo: escolher a MESMA imagem de novo (depois de removê-la)
              // não dispararia `change`.
              e.target.value = ''
              void adicionar(arquivos)
            }}
          />
          {avisoImagem && (
            <p role="alert" className="mt-2 text-[12px] leading-relaxed text-burgundy-deep">
              {avisoImagem}
            </p>
          )}
        </div>

        <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-faint">
          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass-deep/70" />
          Enviamos junto a página em que você está e o seu navegador — é o que costuma explicar o
          problema. As imagens são apagadas 90 dias depois de o chamado ser resolvido.
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-burgundy/30 bg-burgundy/5 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-burgundy-deep"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!podeEnviar}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Enviando…' : preparando > 0 ? 'Preparando imagem…' : 'Enviar chamado'}
        </button>
      </form>
    </div>
  )
}

// ---- Um chamado na aba de respostas ---------------------------------------------

function dia(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const TOM_DA_SITUACAO: Record<SupportTicket['status'], string> = {
  resolved: 'bg-brass/20 text-brass-deep',
  in_progress: 'bg-burgundy/10 text-burgundy',
  open: 'bg-ink/[0.06] text-ink-faint',
}

function Chamado({ chamado: t }: { chamado: SupportTicket }) {
  const [aberto, setAberto] = useState(false)
  const resposta = t.adminNote?.trim()
  const anexos = t.anexos ?? []
  const detalhe = `suporte-detalhe-${t.id}`
  const oQueVer =
    anexos.length === 0 ? 'sua mensagem'
    : anexos.length === 1 ? 'sua mensagem e a imagem'
    : `sua mensagem e as ${anexos.length} imagens`

  return (
    <li
      className={`rounded-xl2 border bg-paper p-4 shadow-card sm:p-5 ${
        t.novaResposta ? 'border-brass/60 ring-1 ring-brass/30' : 'border-ink/10'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TOM_DA_SITUACAO[t.status]}`}
        >
          {SUPPORT_STATUS_LABEL[t.status]}
        </span>
        <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          {SUPPORT_KIND_LABEL[t.kind]}
        </span>
        {t.novaResposta && (
          <span className="ml-auto rounded-full bg-burgundy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-paper">
            Nova resposta
          </span>
        )}
      </div>

      <h3 className="mt-2 break-words text-[15px] font-semibold leading-snug text-ink">{t.subject}</h3>
      <p className="mt-0.5 text-[12px] text-ink-faint">Aberto em {dia(t.createdAt)}</p>

      {resposta ? (
        <div className="mt-3 rounded-lg border-l-2 border-brass bg-brass/[0.08] px-3.5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brass-deep">
            Resposta do suporte{t.answeredAt ? ` · ${dia(t.answeredAt)}` : ''}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink">{resposta}</p>
        </div>
      ) : (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-ink/[0.04] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
          <ClockIcon width={15} height={15} className="mt-0.5 shrink-0 text-ink-faint" />
          Ainda sem resposta. Avisamos pelo seu e-mail assim que respondermos.
        </p>
      )}

      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={detalhe}
        onClick={() => setAberto((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 py-1 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-burgundy"
      >
        {aberto ? 'Esconder' : 'Ver'} {oQueVer}
        <ChevronDown
          width={14}
          height={14}
          className={`transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {aberto && (
        <div id={detalhe} className="suporte-entra mt-2 space-y-2.5">
          {t.message && (
            <p className="whitespace-pre-wrap break-words rounded-lg bg-paper-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
              {t.message}
            </p>
          )}
          {anexos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {anexos.map((a, i) => {
                const src = anexoUrl(t.id, a)
                const img = (
                  <img
                    src={src}
                    alt={`Imagem ${i + 1} que você anexou`}
                    loading="lazy"
                    className="aspect-square w-full rounded-lg border border-ink/10 bg-paper-soft object-cover"
                  />
                )
                return (
                  <li key={a.id}>
                    {/* Abre a imagem inteira em outra aba. No modo sem servidor a
                        imagem é um data URI, que o navegador não abre como página. */}
                    {a.dataUrl ? (
                      img
                    ) : (
                      <a href={src} target="_blank" rel="noreferrer noopener" title="Abrir a imagem inteira">
                        {img}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}
