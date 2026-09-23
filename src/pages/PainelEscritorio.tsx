import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { api, SessaoExpirada } from '@/lib/api'
import type { Firm, FirmMember } from '@/lib/escritorio'
import {
  assuntosDaConversa,
  atendimentoDe,
  editorDoEscritorio,
  faltasDoEscritorio,
  partesDoEscritorio,
  rotuloDoEstado,
  type AncoraDoEscritorio,
} from '@/lib/escritorioPainel'
import { solicitacoesDoEscritorio } from '@/lib/agendaDigital'
import { carregarMetricasDoEscritorio, type Metricas } from '@/lib/metricas'
import { FIRM_PRICING, firmMonthlyPrice } from '@/lib/plans'
import { firmUrl, hostLabel } from '@/lib/publicUrl'
import { copiarTexto } from '@/lib/copiar'
import { slugify } from '@/lib/brFormat'
import { dataUrlToBlob, downloadFile } from '@/lib/vcard'
import { AccountMenu } from '@/components/auth/AccountMenu'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { TrustGauge } from '@/components/ui/TrustGauge'
import { comVolta } from '@/components/ui/SubPage'
import { Marca } from '@/components/ui/Marca'
import { TrocaDePainel } from '@/components/painel/TrocaDePainel'
import { Atalho, Grupo, Linha, ListaEmCartao, Plaqueta } from '@/components/painel/pecas'
import type { SectionIcon } from '@/components/editor/sectionIcons'
import {
  ArrowRight,
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  CopyIcon,
  DocIcon,
  ExternalLinkIcon,
  InfoIcon,
  MailIcon,
  MessageIcon,
  PaletteIcon,
  PenIcon,
  PinIcon,
  QrIcon,
  ScaleIcon,
  SparkIcon,
  UserIcon,
} from '@/components/ui/icons'

// O PAINEL DO ESCRITÓRIO — /escritorio/painel, para quem administra (dono ou
// admin; /firms/me não responde a mais ninguém).
//
// Antes a sociedade não tinha painel: havia um editor longo (que também fazia
// as vezes de painel, com dois atalhos no alto) e um cartão no pé do painel
// pessoal. Quem pagava o escritório não tinha um lugar que respondesse "como
// está a minha página, o que chegou por ela e quem está nela". A página segue a
// mesma ordem do painel pessoal, com as mesmas três peças (components/painel/pecas):
//
//   1. Como está a página?       → a CAPA: endereço, "no ar", editar/copiar/ver.
//      O que falta nela?         → o quanto está pronta, com cada falta levando
//                                  ao cartão certo do editor.
//   2. O que chegou?             → pedidos, visitas e convites sem resposta.
//   3. Quem está nela?           → os advogados, em ordem alfabética, e como cada
//                                  um atende (agenda, triagem, caixa).
//   4. E cada parte da página?   → uma linha por cartão do editor, com resumo.
//   5. Levar para fora da tela   → o QR da página.
//   6. O plano                   → assentos e mensalidade.

const ICONE_DA_PARTE: Record<AncoraDoEscritorio, SectionIcon> = {
  sociedade: ScaleIcon,
  sede: PinIcon,
  apresentacao: DocIcon,
  marca: PaletteIcon,
  contato: MessageIcon,
  assistente: SparkIcon,
  advogados: UserIcon,
}

export default function PainelEscritorio() {
  // undefined = carregando · null = não administra escritório nenhum
  const [firm, setFirm] = useState<Firm | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Painel do escritório · advoc.me'
    api
      .getMyFirm()
      .then((f) => setFirm(f && f.name ? f : null))
      .catch((e: unknown) => {
        // Sessão caída: o RequireAuth leva ao login sozinho.
        if (e instanceof SessaoExpirada) return
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar o escritório.')
      })
  }, [])

  if (erro) return <FalhaAoCarregar mensagem={erro} />

  if (firm === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  return (
    <div className="grain min-h-dvh overflow-x-clip bg-paper-deep">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <Link to="/" className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold text-ink">
          <Marca size={28} />
          <span className="hidden min-[340px]:inline">advoc.me</span>
          <span className="sr-only min-[340px]:hidden">advoc.me</span>
        </Link>
        <AccountMenu compact painel supportTo={comVolta('/suporte', '/escritorio/painel')} />
      </header>

      {firm ? <Conteudo firm={firm} /> : <SemEscritorio />}
    </div>
  )
}

/** Quem chegou aqui sem administrar escritório nenhum. */
function SemEscritorio() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-2 sm:px-5">
      <p className="eyebrow">Painel do escritório</p>
      <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight text-ink sm:text-[32px]">
        Você ainda não administra um escritório.
      </h1>
      <div className="card-paper mt-6 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <Plaqueta Icone={ScaleIcon} />
        <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-soft">
          Crie a página institucional da sociedade e convide os advogados pelo e-mail deles. Cada um mantém o
          próprio perfil. Se você foi convidado, aceite o convite no seu painel.
        </p>
        <div className="flex w-full flex-col gap-2 xs:w-auto xs:flex-row sm:flex-col">
          <Link to="/escritorio/editar" className="btn-primary !py-2.5 text-[14px]">
            Criar escritório
          </Link>
          <Link to="/painel" className="btn-ghost !py-2.5 text-[13.5px]">
            Voltar ao meu painel
          </Link>
        </div>
      </div>
    </main>
  )
}

function Conteudo({ firm }: { firm: Firm }) {
  const members = firm.members ?? []
  const { faltas, pct } = useMemo(() => faltasDoEscritorio(firm), [firm])
  const partes = useMemo(() => partesDoEscritorio(firm), [firm])
  const convitesPendentes = members.filter((m) => m.status === 'invited').length
  const usados = firm.seats?.used ?? members.length
  const contratados = firm.seats?.purchased ?? Math.max(FIRM_PRICING.includedSeats, usados)
  const mensalidade = firm.monthlyPrice ?? firmMonthlyPrice(Math.max(FIRM_PRICING.includedSeats, usados))

  return (
    <main className="stagger mx-auto w-full max-w-3xl space-y-9 px-4 pb-16 pt-2 sm:space-y-11 sm:px-5 sm:pt-4">
      <div className="space-y-5">
        <TrocaDePainel atual="escritorio" sempre />

        {/* Saudação: o logo (ou as iniciais) e o nome da sociedade. */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <LogoDoEscritorio firm={firm} />
            <div className="min-w-0">
              <p className="eyebrow">Painel do escritório</p>
              <h1 className="mt-1 font-display text-[22px] font-semibold leading-tight tracking-tight text-ink [text-wrap:balance] xs:text-[26px] sm:text-[30px]">
                {firm.name}
              </h1>
            </div>
          </div>
          <span className="inline-flex items-center rounded-[4px] border border-ink/25 bg-paper-soft px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Plano Escritório
          </span>
        </div>

        <CapaDaPagina firm={firm} />
        <ProntidaoCard pct={pct} faltas={faltas} />
      </div>

      <Grupo titulo="Toda semana" subtitulo="O que chega pela página.">
        <div className="grid gap-3 sm:grid-cols-3">
          <PedidosAtalho firm={firm} />
          <VisitasAtalho />
          <Atalho
            to={editorDoEscritorio('advogados')}
            Icone={MailIcon}
            titulo="Convites"
            texto={
              convitesPendentes > 0
                ? 'Esperando o advogado aceitar pelo painel dele.'
                : 'Chame um advogado pelo e-mail dele, ou liste quem ainda não tem conta.'
            }
            destaque={
              convitesPendentes > 0
                ? `${convitesPendentes} ${convitesPendentes === 1 ? 'convite sem resposta' : 'convites sem resposta'}`
                : 'Convidar advogado'
            }
            coluna
          />
        </div>
      </Grupo>

      <Grupo titulo="Advogados" subtitulo="Em ordem alfabética, como na página.">
        <Advogados firm={firm} members={members} usados={usados} contratados={contratados} mensalidade={mensalidade} />
      </Grupo>

      <Grupo titulo="A página" subtitulo="Cada parte do que o visitante vê.">
        <ListaEmCartao impar={partes.length % 2 === 1}>
          {partes.map((p) => (
            <Linha
              key={p.ancora}
              to={editorDoEscritorio(p.ancora)}
              Icone={ICONE_DA_PARTE[p.ancora]}
              titulo={p.titulo}
              texto={p.texto}
              pendente={p.pendente}
            />
          ))}
        </ListaEmCartao>
      </Grupo>

      {firm.slug && (
        <Grupo titulo="Divulgue" subtitulo="Leve a página para fora da tela.">
          <QrDaPagina firm={firm} />
        </Grupo>
      )}

      <Grupo titulo="Seu plano" subtitulo="Escritório: a página e um lugar para cada advogado.">
        <section className="card-paper p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <h3 className="font-display text-[20px] font-semibold leading-tight text-ink sm:text-[22px]">
                R$ {mensalidade}
                <span className="font-sans text-[13px] font-medium text-ink-faint"> /mês</span>
              </h3>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-faint">
                Inclui {FIRM_PRICING.includedSeats} advogados; a partir do {FIRM_PRICING.includedSeats + 1}º, + R${' '}
                {FIRM_PRICING.extraSeatPrice}/mês por advogado.
              </p>
            </div>
            <Link to={editorDoEscritorio('advogados')} className="btn-ghost !px-4 !py-2 text-[13px]">
              Gerenciar advogados
            </Link>
          </div>
          <Assentos usados={usados} contratados={contratados} />
        </section>
      </Grupo>

      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-ink/10 pt-6 text-[13px] text-ink-faint">
        <Link to="/painel" className="inline-block py-2 hover:text-ink">
          Meu painel pessoal
        </Link>
        <Link to="/legal" className="inline-block py-2 hover:text-ink">
          Documentos e privacidade
        </Link>
        <Link
          to={comVolta('/suporte', '/escritorio/painel')}
          className="inline-block py-2 font-medium underline-offset-4 transition-colors hover:text-burgundy hover:underline"
        >
          Achou um problema? Falar com o suporte
        </Link>
      </footer>
    </main>
  )
}

/** O logo quando existe; as iniciais quando não — o mesmo gesto da página pública. */
function LogoDoEscritorio({ firm }: { firm: Firm }) {
  return firm.logoUrl ? (
    <img
      src={firm.logoUrl}
      alt=""
      className="h-[52px] w-[52px] shrink-0 rounded-xl border border-ink/10 bg-paper-soft object-contain p-1"
    />
  ) : (
    <span
      aria-hidden
      className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-ink font-display text-[18px] font-semibold tracking-wide text-paper-soft shadow-selo"
    >
      {firm.monogram || firm.name.slice(0, 2).toUpperCase()}
    </span>
  )
}

/** A CAPA: o endereço da página e o que se faz com ele. */
function CapaDaPagina({ firm }: { firm: Firm }) {
  const [copiado, setCopiado] = useState(false)
  const advogados = firm.lawyers?.length ?? 0
  const assuntos = assuntosDaConversa(firm).length

  async function copiar() {
    if (!firm.slug || !(await copiarTexto(firmUrl(firm.slug)))) return
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1600)
  }

  return (
    <section aria-label="A página do escritório" className="card-paper p-4 sm:p-6" data-capa-do-escritorio>
      <div className="flex items-center justify-between gap-3">
        <h2 className="eyebrow font-sans">Seu link</h2>
        {firm.slug && (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" aria-hidden />
            No ar
          </span>
        )}
      </div>

      {firm.slug ? (
        <p className="mt-2.5 font-mono text-[14.5px] leading-snug text-ink [overflow-wrap:anywhere] xs:text-[16px] sm:text-[17px]">
          <span className="text-ink-faint">{hostLabel()}/escritorio/</span>
          <wbr />
          <span className="font-semibold">{firm.slug}</span>
        </p>
      ) : (
        <p className="mt-2.5 text-[14px] text-ink-soft">
          A página ganha endereço quando a sociedade tem nome. Termine no editor.
        </p>
      )}

      <p className="mt-1.5 flex flex-col gap-0.5 text-[12.5px] leading-snug text-ink-faint sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
        <span>Mande a clientes e ponha na assinatura do e-mail.</span>
        <span className="hidden sm:inline" aria-hidden>
          ·
        </span>
        <span>
          {advogados} {advogados === 1 ? 'advogado' : 'advogados'} · {assuntos} {assuntos === 1 ? 'assunto' : 'assuntos'} ·
          conversa {firm.assistantRoute === 'lawyer' ? 'para o advogado escolhido' : 'para o escritório'}
        </span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 xs:flex xs:flex-wrap">
        <Link to="/escritorio/editar" className="btn-primary col-span-2 !py-2.5 text-[14px] xs:!px-5">
          <PenIcon width={16} height={16} />
          Editar página
        </Link>
        {firm.slug && (
          <>
            <button
              type="button"
              onClick={copiar}
              aria-live="polite"
              className="btn-ghost min-w-0 !px-2.5 !py-2.5 text-[13px] xs:!px-4"
            >
              {copiado ? (
                <CheckIcon width={15} height={15} strokeWidth={2.4} className="shrink-0" />
              ) : (
                <CopyIcon width={15} height={15} className="shrink-0" />
              )}
              {copiado ? (
                'Copiado!'
              ) : (
                <span className="whitespace-nowrap">
                  Copiar<span className="hidden min-[340px]:inline"> link</span>
                </span>
              )}
            </button>
            <Link
              to={`/escritorio/${firm.slug}`}
              target="_blank"
              className="btn-ghost min-w-0 !px-2.5 !py-2.5 text-[13px] xs:!px-4"
            >
              <ExternalLinkIcon width={15} height={15} className="shrink-0" />
              <span className="whitespace-nowrap">
                Ver<span className="hidden min-[340px]:inline"> página</span>
              </span>
            </Link>
          </>
        )}
      </div>
    </section>
  )
}

/** O quanto a página está pronta, com cada falta levando ao cartão do editor. */
function ProntidaoCard({ pct, faltas }: { pct: number; faltas: ReturnType<typeof faltasDoEscritorio>['faltas'] }) {
  return (
    <section aria-label="Página pronta" className="card-paper overflow-hidden">
      <div className="flex flex-col items-start gap-3 p-4 min-[340px]:flex-row min-[340px]:items-center min-[340px]:gap-4 sm:gap-5 sm:p-6">
        <TrustGauge score={pct} size={84} stroke={8} legenda="% pronta" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">A página</p>
          <p className="mt-1 font-display text-[19px] font-semibold leading-tight text-ink sm:text-[21px]">
            {pct === 100 ? 'Completa' : pct >= 70 ? 'Quase pronta' : pct >= 40 ? 'Tomando forma' : 'Começando'}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-faint sm:text-[13px]">
            {faltas.length === 0
              ? 'Tudo que a página pode mostrar está preenchido.'
              : `Falta${faltas.length === 1 ? '' : 'm'} ${faltas.length} ${faltas.length === 1 ? 'item' : 'itens'} — cada um leva ao lugar certo do editor.`}
          </p>
        </div>
      </div>

      {faltas.length > 0 ? (
        <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.09]">
          {faltas.map((f, i) => (
            <li key={f.key}>
              <Link
                to={editorDoEscritorio(f.ancora)}
                className="group flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-paper sm:px-6"
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold tabular-nums ${
                    f.key === 'destino'
                      ? 'border-burgundy bg-burgundy text-paper-soft'
                      : 'border-brass/45 bg-brass/[0.08] text-brass-deep'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-semibold leading-tight text-ink">{f.acao}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-faint">{f.porque}</span>
                </span>
                <ArrowRight
                  width={16}
                  height={16}
                  className="shrink-0 text-ink-faint transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:text-burgundy"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-start gap-2 border-t border-ink/[0.09] px-4 py-3.5 text-[13px] leading-snug text-ink-soft sm:px-6">
          <CheckIcon width={15} height={15} strokeWidth={2.4} className="mt-px shrink-0 text-emerald-700" />
          Página completa — cada parte já tem o que mostrar.
        </p>
      )}
    </section>
  )
}

/**
 * Pedidos da página. Com a caixa ligada, o número de quem espera resposta —
 * é a única TAREFA do painel. Desligada, o cartão diz para onde os pedidos vão
 * hoje (o WhatsApp do escritório), sem fingir uma caixa vazia.
 */
function PedidosAtalho({ firm }: { firm: Firm }) {
  const ligada = firm.meetingInboxEnabled === true
  const [pendentes, setPendentes] = useState<number | null>(null)

  useEffect(() => {
    if (!ligada) return
    let vivo = true
    solicitacoesDoEscritorio
      .listar(1, 'pending')
      .then((d) => vivo && setPendentes(d.pendingCount))
      .catch(() => vivo && setPendentes(-1))
    return () => {
      vivo = false
    }
  }, [ligada])

  let destaque = 'Caixa desligada'
  if (ligada) {
    destaque =
      pendentes === null
        ? 'Contando…'
        : pendentes < 0
          ? 'Não deu para contar agora'
          : pendentes === 0
            ? 'Nenhum esperando resposta'
            : `${pendentes} esperando resposta`
  }

  return (
    <Atalho
      to="/escritorio/solicitacoes"
      Icone={CalendarIcon}
      titulo="Pedidos"
      texto={
        ligada
          ? 'Encaminhe cada pedido a um advogado; quem confirma é ele.'
          : 'Hoje a conversa da página termina no WhatsApp do escritório.'
      }
      destaque={<span aria-live="polite">{destaque}</span>}
      coluna
    />
  )
}

/** Visitas da página nos últimos dias — o número já no painel. */
function VisitasAtalho() {
  const [dados, setDados] = useState<Metricas | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    carregarMetricasDoEscritorio()
      .then((m) => vivo && setDados(m))
      .catch(() => vivo && setErro(true))
    return () => {
      vivo = false
    }
  }, [])

  let destaque = 'Contando…'
  if (erro) destaque = 'Não deu para carregar agora'
  else if (dados) {
    const v = dados.visitas.janela
    const c = dados.contatos
    destaque =
      v === 0
        ? 'Nenhuma visita ainda'
        : `${v} ${v === 1 ? 'visita' : 'visitas'}${c > 0 ? ` · ${c} ${c === 1 ? 'contato' : 'contatos'}` : ''}`
  }

  return (
    <Atalho
      to="/escritorio/visitas"
      Icone={ChartIcon}
      titulo="Visitas"
      texto={dados ? `Aberturas da página nos últimos ${dados.janelaDias} dias.` : 'Aberturas da página e o que foi usado nela.'}
      destaque={<span aria-live="polite">{destaque}</span>}
      coluna
    />
  )
}

/** Barra dos assentos: quantos estão em uso do que o plano cobre. */
function Assentos({ usados, contratados }: { usados: number; contratados: number }) {
  const pct = contratados ? Math.min(100, Math.round((usados / contratados) * 100)) : 0
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
        <span className="block h-full rounded-full bg-brass-deep" style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-faint">
        {usados} de {contratados} {contratados === 1 ? 'lugar' : 'lugares'}
      </span>
    </div>
  )
}

/**
 * Os advogados — quem está na página e como cada um atende pela conversa dela.
 *
 * A ordem é a do servidor (alfabética): nenhuma lista do escritório sugere
 * hierarquia (Prov. 205/2021). As etiquetas dizem o que a conversa da página faz
 * com cada um, que é o que o dono não vê de lugar nenhum sem abrir perfil por
 * perfil: se os horários dele são oferecidos, se as perguntas dele valem, se o
 * pedido vai para a caixa dele.
 */
function Advogados({
  firm,
  members,
  usados,
  contratados,
  mensalidade,
}: {
  firm: Firm
  members: FirmMember[]
  usados: number
  contratados: number
  mensalidade: number
}) {
  const delega = firm.assistantRoute === 'lawyer'
  return (
    <section className="card-paper overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
        <p className="text-[13px] text-ink-soft">
          <span className="font-semibold text-ink">
            {usados} {usados === 1 ? 'integrante' : 'integrantes'}
          </span>{' '}
          · {contratados} {contratados === 1 ? 'lugar' : 'lugares'} no plano · R$ {mensalidade}/mês
        </p>
        <Link
          to={editorDoEscritorio('advogados')}
          className="inline-flex items-center gap-1 py-1 text-[13px] font-semibold text-burgundy hover:underline hover:underline-offset-4"
        >
          Adicionar ou convidar
          <ArrowRight width={14} height={14} />
        </Link>
      </div>

      {members.length === 0 ? (
        <p className="mx-4 mb-4 rounded-lg border border-dashed border-ink/15 px-3 py-5 text-center text-[13px] text-ink-faint sm:mx-6 sm:mb-6">
          Ninguém no escritório ainda. Convide o primeiro advogado pelo e-mail dele.
        </p>
      ) : (
        <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.09]">
          {members.map((m) => (
            <LinhaDoAdvogado key={`${m.kind}-${m.id}`} member={m} firm={firm} delega={delega} />
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 border-t border-ink/[0.09] bg-paper/60 px-4 py-3 text-[12px] leading-relaxed text-ink-faint sm:px-6">
        <InfoIcon width={14} height={14} className="mt-0.5 shrink-0" />
        <span>
          <strong className="font-semibold text-ink-soft">Agenda</strong>: a conversa oferece os horários livres dele.{' '}
          <strong className="font-semibold text-ink-soft">Triagem</strong>: as perguntas dele valem aqui.{' '}
          <strong className="font-semibold text-ink-soft">Caixa</strong>: {delega ? 'o pedido vai para o painel dele.' : 'vale no perfil dele; pela página, o pedido vem ao escritório.'}{' '}
          Cada advogado liga isso no próprio perfil.
        </span>
      </p>
    </section>
  )
}

function LinhaDoAdvogado({ member: m, firm, delega }: { member: FirmMember; firm: Firm; delega: boolean }) {
  const a = atendimentoDe(m, firm)
  const estado = rotuloDoEstado(m)
  const sub = [m.oabNumber, m.area].filter(Boolean).join(' · ')
  const iniciais = m.name
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-6">
      <span
        aria-hidden
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold ${
          a.comConta ? 'bg-burgundy/10 text-burgundy' : 'border border-dashed border-ink/25 text-ink-faint'
        }`}
      >
        {iniciais || '?'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 break-words font-display text-[15px] font-semibold leading-tight text-ink">
            {m.name}
          </span>
          <span
            className={`rounded-[4px] px-1.5 py-[3px] text-[10px] font-bold uppercase leading-none tracking-[0.12em] ${
              m.status === 'active'
                ? 'bg-ink/[0.07] text-ink-soft'
                : m.status === 'invited'
                  ? 'bg-brass/15 text-brass-deep'
                  : 'border border-dashed border-ink/25 text-ink-faint'
            }`}
          >
            {estado}
          </span>
        </p>
        {sub && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-faint [overflow-wrap:anywhere]">{sub}</p>}

        {a.comConta ? (
          <p className="mt-2 flex flex-wrap gap-1.5">
            <Etiqueta ligada={a.agenda}>Agenda</Etiqueta>
            <Etiqueta ligada={a.triagem}>Triagem</Etiqueta>
            <Etiqueta ligada={a.caixa}>Caixa</Etiqueta>
            {delega && !a.caixa && <Etiqueta ligada={a.whatsapp}>WhatsApp</Etiqueta>}
          </p>
        ) : (
          <p className="mt-1 text-[12px] leading-snug text-ink-faint">
            {m.status === 'invited'
              ? 'Aparece na página quando aceitar. O convite fica no painel dele.'
              : 'Aparece na página sem link para perfil. Dê acesso pelo e-mail dele no editor.'}
          </p>
        )}
        {a.comConta && !a.alcancavel && (
          <p className="mt-1.5 text-[12px] font-medium leading-snug text-burgundy">
            Quem escolher este advogado na conversa não tem para onde mandar o pedido.
          </p>
        )}
      </div>
      {m.profileSlug && (
        <Link
          to={`/${m.profileSlug}`}
          target="_blank"
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink"
          aria-label={`Ver o perfil de ${m.name}`}
        >
          <ExternalLinkIcon width={14} height={14} />
          <span className="hidden xs:inline">Perfil</span>
        </Link>
      )}
    </li>
  )
}

function Etiqueta({ ligada, children }: { ligada: boolean; children: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        ligada ? 'border-emerald-700/30 bg-emerald-700/[0.07] text-emerald-800' : 'border-ink/15 text-ink-faint'
      }`}
    >
      {ligada ? <CheckIcon width={10} height={10} strokeWidth={3} aria-hidden /> : null}
      {children}
      <span className="sr-only">{ligada ? ' ligada' : ' desligada'}</span>
    </span>
  )
}

/** O QR da página, para imprimir na recepção, no cartão ou na apresentação. */
function QrDaPagina({ firm }: { firm: Firm }) {
  const [png, setPng] = useState('')
  const url = firmUrl(firm.slug)

  // Imagem, não canvas: o toCanvas grava a largura no `style` do elemento e
  // passa por cima de qualquer classe — o QR ocupava o cartão inteiro. Gerado
  // em 480px, aparece em 132: a imagem baixada sai nítida para impressão.
  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#211c17', light: '#faf6ec' } })
      .then((d) => vivo && setPng(d))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [url])

  return (
    <section className="card-paper flex flex-col items-center gap-4 p-4 text-center xs:flex-row xs:items-center xs:text-left sm:gap-6 sm:p-6">
      <span className="flex h-[132px] w-[132px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink/10 bg-paper-soft">
        {png ? (
          <img src={png} alt="QR Code da página do escritório" width={132} height={132} className="h-full w-full" />
        ) : (
          <QrIcon width={28} height={28} className="text-ink-faint" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center justify-center gap-2 font-display text-[17px] font-semibold leading-tight text-ink xs:justify-start">
          <QrIcon width={17} height={17} className="text-brass-deep" />
          QR da página
        </h3>
        <p className="mt-1 text-[12.5px] leading-snug text-ink-faint">
          Aponte a câmera e abre a página do escritório. Para a recepção, o cartão de visita ou o slide de
          apresentação.
        </p>
        <button
          type="button"
          disabled={!png}
          onClick={() => png && downloadFile(dataUrlToBlob(png), `qr-${slugify(firm.name) || firm.slug}.png`)}
          className="btn-ghost mt-3 !px-4 !py-2 text-[13px]"
        >
          Baixar QR (PNG)
        </button>
      </div>
    </section>
  )
}
