import { Link } from 'react-router-dom'

// AVISO DE PRIVACIDADE DOS FLUXOS PÚBLICOS (LGPD, Lei 13.709/2018).
// -----------------------------------------------------------------------------
// Estes fluxos pedem dado pessoal a quem NÃO tem conta e nunca leu nada nosso: o
// visitante escreve o nome, o WhatsApp e — o mais delicado — o ASSUNTO da conversa,
// que é a descrição do problema jurídico dele. Isso chegava até nós sem uma linha
// dizendo para onde ia.
//
// O aviso precisa dizer três coisas, e nesta ordem: quem recebe (o advogado),
// quem mais toca (nós, e em que medida) e como não entregar demais. A última é a
// que mais protege o visitante: ninguém precisa contar o caso para marcar horário.
//
// Curto de propósito — um parágrafo que ninguém lê não é transparência, é enfeite.

type Fluxo = 'assistente' | 'formulario' | 'denuncia'

const TEXTO: Record<Fluxo, { corpo: React.ReactNode; guarda?: string }> = {
  assistente: {
    corpo: (
      <>
        O que você escrever aqui vira uma mensagem no <strong>WhatsApp do próprio advogado</strong>.
        O advoc.me não guarda esta conversa.
      </>
    ),
    guarda: 'Escreva só o assunto em linhas gerais — não é preciso detalhar seu caso para marcar um horário.',
  },
  formulario: {
    corpo: (
      <>
        O formulário só monta a mensagem: ela sai do <strong>seu aparelho</strong> direto para o
        WhatsApp do advogado. O advoc.me não recebe nem guarda nada disto.
      </>
    ),
    guarda: 'Escreva o assunto em linhas gerais — não é preciso detalhar seu caso para marcar um horário.',
  },
  denuncia: {
    corpo: (
      <>
        Sua denúncia vai para a <strong>moderação do advoc.me</strong>, não para o advogado
        denunciado. O e-mail é opcional e serve só para retorno.
      </>
    ),
  },
}

/**
 * `tone` existe porque este aviso aparece nos dois mundos do produto: nas páginas
 * do app (paleta fixa) e DENTRO do perfil, que roda o tema escolhido pelo advogado
 * via CSS vars. Um `text-ink-faint` fixo sumiria nos temas escuros.
 */
export function PrivacyNote({
  fluxo,
  tone = 'page',
  semGuarda = false,
  className = '',
}: {
  fluxo: Fluxo
  tone?: 'page' | 'themed'
  /**
   * Esconde a orientação "escreva o assunto em linhas gerais". Ela só faz sentido
   * ENQUANTO o assunto está sendo escrito — repeti-la na pergunta do nome deixa a
   * conversa dando um conselho sobre um campo que já ficou para trás.
   */
  semGuarda?: boolean
  className?: string
}) {
  const { corpo, guarda } = TEXTO[fluxo]
  return (
    <p
      className={`text-[11.5px] leading-relaxed ${tone === 'themed' ? 't-faint' : 'text-ink-faint'} ${className}`}
    >
      {corpo}{' '}
      {guarda && !semGuarda && <span className="block mt-1">{guarda}</span>}
      <Link
        to="/legal/privacidade"
        target="_blank"
        className="mt-1 inline-block font-medium underline underline-offset-2 hover:opacity-80"
      >
        Como tratamos seus dados
      </Link>
    </p>
  )
}
