import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { registrarEvento } from '@/lib/eventos'
import { themeStyle } from '@/lib/themes'
import { SparkIcon, XIcon } from '@/components/ui/icons'
import { assistantTitle } from '@/lib/assistant'

// O balão de conversa — o atalho que segue a rolagem no canto do perfil.
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
// TRAVA DE PLANO: quem decide é o servidor. `profile.assistant.floating` só
// chega `true` em perfil Pro ou Max (ver backend, buildAssistant) — aqui a
// conferência é a segunda camada, para a prévia do editor obedecer também.
// ---------------------------------------------------------------------------

/** Depois de quantos pixels de rolagem o balão aparece. */
const APARECE_APOS = 260

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
 * O balão deve aparecer neste perfil?
 *
 * Três condições, e as três precisam valer:
 *   • o advogado LIGOU (`assistant.floating`, desligado por padrão);
 *   • o servidor deixou — o campo só chega `true` em Pro/Max (buildAssistant);
 *   • o assistente é de fato o modo de agendamento escolhido, senão o balão
 *     seria um atalho para uma conversa que não existe.
 *
 * Função pura e exportada para ter teste: a decisão de mostrar um elemento que
 * persegue o visitante é exatamente o tipo de coisa que não pode regredir num
 * refactor de JSX.
 */
export function balaoVisivel(
  profile: Pick<Profile, 'assistant'>,
  opcoes: { schedulingMode: string; podeAgendar: boolean },
): boolean {
  if (profile.assistant?.floating !== true) return false
  if (opcoes.schedulingMode !== 'assistant') return false
  return opcoes.podeAgendar
}

export function BalaoDeConversa({
  profile,
  /** demo da home / prévia do editor: não navega, só mostra */
  demo = false,
  onDemo,
}: {
  profile: Profile
  demo?: boolean
  onDemo?: () => void
}) {
  const [visivel, setVisivel] = useState(false)
  const [dispensado, setDispensado] = useState(false)

  // Só aparece depois que a pessoa rolou um pouco. Um balão que salta no
  // primeiro instante compete com o nome do advogado, que é o que a página tem
  // para dizer; depois de uma rolagem, ele é um atalho para quem já se
  // interessou — que é o único momento em que ele ajuda alguém.
  useEffect(() => {
    if (demo) {
      setVisivel(true)
      return
    }
    const aoRolar = () => setVisivel(window.scrollY > APARECE_APOS)
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [demo])

  // Fechar é definitivo enquanto a página estiver aberta. Um balão que volta
  // depois de a pessoa o ter fechado deixa de ser atalho e vira insistência —
  // e insistir é o que a norma chama de captação.
  if (dispensado) return null

  const conteudo = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15"
        aria-hidden
      >
        <SparkIcon width={18} height={18} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[14px] font-semibold leading-tight">{BALAO_ROTULO}</span>
        <span className="block text-[11.5px] leading-tight opacity-80">
          {assistantTitle(profile)}
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

  // PORTAL para o <body>, e não um `fixed` no lugar onde o componente é usado.
  //
  // Não é preferência: `position: fixed` dentro de um ancestral com `transform`
  // ancora NO ANCESTRAL, não na viewport — e o ProfileView anima o próprio
  // contêiner com transform na entrada. O balão existia, respondia a `isVisible`
  // e ficava desenhado no fim do documento, quilômetros abaixo da dobra. Foi
  // pelo mesmo motivo que o ShareBar é montado fora do ProfileView.
  //
  // Sair do contêiner custa o TEMA: `--c-accent` é declarado lá dentro e não
  // alcança o <body>. `themeStyle` o traz junto, como o AssistantChat já faz com
  // a folha da conversa.
  return createPortal(
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          // `pb-[max(...)]` respeita a barra de gestos do iPhone; sem isso o
          // balão fica sob ela e o toque não chega.
          style={themeStyle(profile.theme)}
          className="fixed bottom-0 right-0 z-40 flex items-end gap-1.5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {demo ? (
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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
