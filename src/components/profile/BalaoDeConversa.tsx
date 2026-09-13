import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
// `m` no lugar de `motion` (LazyMotion): este componente so renderiza dentro do
// ProfileView, que ja prove as features domAnimation — usar `motion` aqui
// puxaria o framer-motion completo de volta para o pacote inicial do minisite.
import { AnimatePresence, m } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { registrarEvento } from '@/lib/eventos'
import { themeStyle } from '@/lib/themes'
import { comoAbrirWhatsapp } from '@/lib/whatsapp'
import { SparkIcon, WhatsappIcon, XIcon } from '@/components/ui/icons'
import { assistantTitle } from '@/lib/assistantTitle'

// O balão de conversa — o atalho que segue a rolagem no canto do perfil.
//
// Desde 13/09/2026 ele tem DOIS tipos, e o advogado escolhe um (ou nenhum) em
// "Botão flutuante": o atalho para o assistente, e o atalho para o WhatsApp.
// Quem decide QUAL aparece é lib/botaoFlutuante.ts; aqui só se desenha.
//
// ---------------------------------------------------------------------------
// O QUE ELE É, E O QUE ELE DELIBERADAMENTE NÃO É
//
// Ele é um ATALHO para a conversa que já existe (o assistente guiado, em
// /:slug/agendar). Nada mais. Quem toca vai para a mesma tela do botão de
// agendar do corpo da página, e a conversa termina onde sempre terminou: uma
// mensagem pronta no WhatsApp, escrita do aparelho do visitante.
//
// Ele NÃO é o widget de captura que se vê por aí — aquele que abre pedindo
// "nome e telefone para iniciarmos uma conversa". Duas razões independentes, e
// cada uma sozinha já bastaria:
//
//   1. **A OAB.** REGRAS.md, sobre a Cartilha do CFOAB: *"'caixas de perguntas'
//      e chats não podem ser usados para capturar clientes disfarçadamente"*.
//      Um formulário que colhe contato de quem passa é captação — e quem
//      responde por ela é o advogado, com advertência, censura ou suspensão.
//      "Sem compromisso", ali, é apelo comercial pelos mesmos critérios que
//      vedam "consulta grátis".
//   2. **Não guardamos dado de visitante.** É decisão de arquitetura desta
//      plataforma, e foi por ela que a agenda nativa saiu do produto em
//      21/08/2026: ela guardava nome, WhatsApp e assunto de quem procurava um
//      advogado. Um balão que colhe contato traria de volta exatamente o que
//      foi retirado — e com ele o dever de guardar, proteger e apagar o dado de
//      um terceiro que nunca teve conta aqui.
//
// O resultado prático é melhor para os dois lados: o visitante não preenche
// formulário nenhum (escreve do WhatsApp dele, onde já está logado) e o
// advogado recebe a mensagem no lugar onde de fato atende.
//
// TRAVA DE PLANO: quem decide é o servidor. `profile.floating` só chega
// diferente de 'off' em perfil Pro ou Max (ver backend, botao-flutuante.ts) —
// lib/botaoFlutuante.ts confere de novo, para a prévia do editor obedecer também.
// ---------------------------------------------------------------------------

/** Depois de quantos pixels de rolagem o balão aparece, numa página de verdade. */
const APARECE_APOS = 260
/** O mesmo, dentro da maquete de celular — a tela é menor, a rolagem é mais curta. */
const APARECE_APOS_NA_MOLDURA = 120

/**
 * O elemento que de fato rola acima deste — a janela, ou a tela do celularzinho.
 *
 * Sem isto o balão ouvia `window.scroll` também dentro da maquete, onde quem rola
 * é um `<div>` com `overflow-y: auto`. O efeito era ele nascer visível por cima
 * da foto e do nome do advogado, que é justamente o que a página tem para dizer.
 */
function paiQueRola(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const overflow = getComputedStyle(n).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && n.scrollHeight > n.clientHeight) return n
  }
  return null
}

/**
 * O rótulo do balão. Constante exportada porque ele é TEXTO PUBLICITÁRIO de um
 * advogado — passa pelos mesmos critérios do resto do perfil, e tem teste que o
 * confere (Prov. 205/2021: nada de apelo comercial, urgência ou convite a
 * contratar). "Agendar uma conversa" descreve o que acontece ao tocar; a
 * referência que originou o pedido dizia "Vamos conversar? (…) sem compromisso",
 * e "sem compromisso" cai na mesma vedação de "consulta grátis".
 */
export const BALAO_ROTULO = 'Agendar uma conversa'

/**
 * O rótulo do atalho de WhatsApp — o MESMO do botão de WhatsApp do corpo da
 * página. Dois textos para o mesmo gesto fariam o visitante achar que são coisas
 * diferentes. Passa pelos mesmos testes de conformidade do rótulo acima: REGRAS.md
 * permite botão de contato, desde que sem apelo ("Contrate pelo WhatsApp" não).
 */
export const BALAO_ROTULO_WHATSAPP = 'Conversar no WhatsApp'

export function BalaoDeConversa({
  profile,
  tipo,
  whatsapp,
  demo = false,
  inert = false,
  onDemo,
}: {
  profile: Profile
  /** qual atalho desenhar — decidido por lib/botaoFlutuante.ts */
  tipo: 'assistant' | 'whatsapp'
  /**
   * O link do WhatsApp como o corpo da página o monta: o endereço (ou a âncora
   * que não sai da página, no perfil de exemplo) e o clique que conta a métrica.
   * Vem de fora para os dois botões de WhatsApp nunca divergirem.
   */
  whatsapp?: { href: string; onClick?: (e: React.MouseEvent) => void }
  /** vitrine da home: o toque abre a conversa ali mesmo, dentro do telefone */
  demo?: boolean
  /**
   * Prévia do editor: aparece, mas não leva a lugar nenhum.
   *
   * Ele PRECISA aparecer aqui — é onde o advogado acabou de ligar o interruptor.
   * Um interruptor que não muda nada na prévia ao lado é indistinguível de um
   * interruptor quebrado, e a pessoa liga e desliga procurando o efeito.
   */
  inert?: boolean
  onDemo?: () => void
}) {
  const [visivel, setVisivel] = useState(false)
  const [dispensado, setDispensado] = useState(false)
  // Onde o balão vai ser desenhado. `undefined` = ainda não decidido (primeiro
  // render, antes de o DOM existir); daí não desenhar nada em vez de chutar o
  // <body> e vê-lo pular para dentro do telefone no quadro seguinte.
  const [destino, setDestino] = useState<HTMLElement | undefined>()
  const ancora = useRef<HTMLSpanElement>(null)

  // A MOLDURA MANDA. O balão é montado dentro do ProfileView, que tanto é a
  // página de verdade quanto o conteúdo do "celularzinho" da home e da prévia do
  // editor. Nos dois últimos ele não pode escapar da maquete: um atalho do
  // telefone flutuando sobre a página inteira não demonstra nada — mostra um
  // defeito.
  //
  // Em vez de receber isso por prop (que teria de atravessar ProfileView,
  // PhonePreview, Landing e Onboarding), o balão PERGUNTA ao DOM: sobe a partir
  // da própria âncora até achar uma moldura de telefone. Achou, mora nela; não
  // achou, é página de verdade e vai para o <body>. Funciona com quantos
  // telefones houver na tela, e uma maquete nova não precisa avisar ninguém.
  useEffect(() => {
    const moldura = ancora.current?.closest<HTMLElement>('[data-moldura-telefone]')
    setDestino(moldura ?? document.body)
  }, [])

  const naMoldura = destino !== undefined && destino !== document.body

  // Só aparece depois que a pessoa rolou um pouco. Um balão que salta no
  // primeiro instante compete com o nome do advogado, que é o que a página tem
  // para dizer; depois de uma rolagem, ele é um atalho para quem já se
  // interessou — que é o único momento em que ele ajuda alguém.
  useEffect(() => {
    // Dentro da maquete quem rola é a tela do celularzinho, não a janela — e o
    // balão tem de responder a ELA. Ouvir `window` ali fazia o balão nascer
    // visível por cima da foto e do nome, que é o que a página tem para dizer.
    const rolante = naMoldura ? paiQueRola(ancora.current) : null
    const limite = naMoldura ? APARECE_APOS_NA_MOLDURA : APARECE_APOS
    const quanto = () => (rolante ? rolante.scrollTop : window.scrollY)
    const alvo: HTMLElement | Window = rolante ?? window

    const aoRolar = () => setVisivel(quanto() > limite)
    aoRolar()
    alvo.addEventListener('scroll', aoRolar, { passive: true })
    return () => alvo.removeEventListener('scroll', aoRolar)
  }, [demo, naMoldura, destino])

  // Fechar é definitivo enquanto a página estiver aberta. Um balão que volta
  // depois de a pessoa o ter fechado deixa de ser atalho e vira insistência —
  // e insistir é o que a norma chama de captação.
  if (dispensado) return null

  const ehWhatsapp = tipo === 'whatsapp'
  const conteudo = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15"
        aria-hidden
      >
        {ehWhatsapp ? <WhatsappIcon width={18} height={18} /> : <SparkIcon width={18} height={18} />}
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[14px] font-semibold leading-tight">
          {ehWhatsapp ? BALAO_ROTULO_WHATSAPP : BALAO_ROTULO}
        </span>
        <span className="block text-[11.5px] leading-tight opacity-80">
          {ehWhatsapp ? profile.name : assistantTitle(profile)}
        </span>
      </span>
    </>
  )

  // Cor do tema do perfil, não um verde de WhatsApp: o balão é parte da página
  // do advogado, e não um enxerto de outra marca.
  const classe =
    'flex items-center gap-2.5 rounded-full py-2.5 pl-2.5 pr-4 shadow-card ' +
    'text-paper transition-transform hover:scale-[1.02] active:scale-[0.99]'
  const estilo = { background: 'var(--c-accent)' }

  // PORTAL, e não um `fixed` onde o componente é escrito.
  //
  // Não é preferência: `position: fixed` dentro de um ancestral com `transform`
  // ancora NO ANCESTRAL, não na viewport — e o ProfileView anima o próprio
  // contêiner com transform na entrada. Sem o portal, o balão existia, respondia
  // a `isVisible()` e ficava desenhado no fim do documento, muito abaixo da
  // dobra. Foi pelo mesmo motivo que o ShareBar é montado fora do ProfileView.
  //
  // Sair do contêiner custa o TEMA: `--c-accent` é declarado lá dentro e não
  // alcança o destino. `themeStyle` o traz junto, como o AssistantChat já faz
  // com a folha da conversa.
  const balao = (
    <AnimatePresence>
      {visivel && (
        <m.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          // `pb-[max(...)]` respeita a barra de gestos do iPhone; sem isso o
          // balão fica sob ela e o toque não chega.
          style={themeStyle(profile.theme)}
          className={`${
            naMoldura
              ? // Dentro da maquete: preso À CAIXA do telefone, e recortado por
                // ela (a moldura é `overflow-hidden`). `p-3` porque a tela é
                // pequena, e `right-3` para não cobrir a barra de rolagem
                // desenhada do telefone.
                'absolute bottom-0 right-1 z-40 p-3'
              : // Página de verdade: preso à janela. `pb-[max(...)]` respeita a
                // barra de gestos do iPhone; sem isso o balão fica sob ela e o
                // toque não chega.
                'fixed bottom-0 right-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
          } flex items-end gap-1.5`}
        >
          {inert ? (
            <div className={classe} style={estilo}>
              {conteudo}
            </div>
          ) : ehWhatsapp ? (
            // O WhatsApp não passa pela demonstração da home: quem decide o que
            // o toque faz é o link do corpo da página, que já sabe lidar com o
            // perfil de exemplo (não sai) e com a métrica (conta antes de sair).
            <a
              href={whatsapp?.href}
              onClick={whatsapp?.onClick}
              {...comoAbrirWhatsapp()}
              className={classe}
              style={estilo}
            >
              {conteudo}
            </a>
          ) : demo ? (
            <button type="button" onClick={onDemo} className={classe} style={estilo}>
              {conteudo}
            </button>
          ) : (
            <Link
              to={`/${profile.slug}/agendar`}
              // Mesma contagem do botão de agendar do corpo da página: os dois
              // são a mesma intenção, e separá-los faria a métrica do advogado
              // dizer que ninguém usa nenhum dos dois.
              onClick={() => registrarEvento(profile.slug, 'assistente')}
              className={classe}
              style={estilo}
            >
              {conteudo}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setDispensado(true)}
            aria-label="Fechar o atalho de conversa"
            className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-paper shadow-card transition-colors hover:bg-ink"
          >
            <XIcon width={13} height={13} />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      {/* A âncora fica no lugar de origem só para o balão descobrir, subindo o
          DOM, se está dentro de um telefone. Não desenha nada. */}
      <span ref={ancora} className="hidden" aria-hidden />
      {destino && createPortal(balao, destino)}
    </>
  )
}
