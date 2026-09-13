import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import { useVoltar } from '@/components/ui/SubPage'
import { canUseTriagem } from '@/lib/plans'
import { perguntasDaConversa } from '@/lib/triagem'
import { resolveSchedulingMode } from '@/lib/booking'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { AssistantChat } from '@/components/profile/AssistantChat'
import { ArrowLeft } from '@/components/ui/icons'

// TESTAR MEU ASSISTENTE — /assistente/testar
//
// Responde a uma pergunta só, e é a pergunta que decide se alguém publica a
// triagem: "se eu fosse um cliente, o que eu veria?". Por isso não é uma prévia
// desenhada nem uma lista de perguntas — é a CONVERSA DE VERDADE, o mesmo
// componente do perfil público, lendo o mesmo perfil gravado.
//
// A única diferença é o fim: `teste` impede o botão de abrir o WhatsApp. O
// pedido seria do advogado para ele mesmo, e um teste que manda mensagem de
// verdade é um teste que ninguém faz duas vezes.
//
// Página, e não modal: a conversa precisa da tela inteira no celular (teclado
// subindo), e o voltar do navegador tem de desfazer o passo. Ver SubPage.

export default function TestarAssistentePage() {
  const navigate = useNavigate()
  const voltar = useVoltar('/editor?section=triagem')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Testar meu assistente · advoc.me'
    let vivo = true
    api
      .getDraft()
      .then((p) => vivo && setProfile(p))
      .catch((e) => {
        if (e instanceof SessaoExpirada) return
        if (vivo) setErro('Não foi possível carregar o seu perfil agora.')
      })
    return () => {
      vivo = false
    }
  }, [])

  if (erro) {
    return <FalhaAoCarregar mensagem={erro} />
  }

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  // Três motivos para não haver o que testar, e cada um leva a um lugar
  // diferente. "Nada para mostrar" sozinho deixaria a pessoa sem saber o que fazer.
  const semPlano = !canUseTriagem(profile.plan)
  const semAssistente = resolveSchedulingMode(profile) !== 'assistant'
  const semPerguntas = perguntasDaConversa(profile).length === 0

  if (semPlano || semAssistente || semPerguntas) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper-deep px-6 text-center">
        <p className="max-w-sm text-[14.5px] leading-relaxed text-ink-soft">
          {semPlano
            ? 'O assistente de triagem é um recurso do plano Max.'
            : semAssistente
              ? 'O assistente virtual está desligado. Ligue-o em “Sua agenda” para testar a conversa.'
              : 'Sua triagem ainda não tem nenhuma pergunta pronta para responder.'}
        </p>
        <Link
          to={semPlano ? '/planos?recurso=triagem' : semAssistente ? '/editor?section=agenda' : voltar}
          className="btn-primary"
        >
          {semPlano ? 'Ver o Max' : semAssistente ? 'Abrir minha agenda' : 'Voltar às perguntas'}
        </Link>
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh">
      {/* Faixa de ensaio: sem ela, a tela é indistinguível do perfil publicado —
          e o advogado que abrisse por um link antigo acharia que está no ar. */}
      <div className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-[12px] font-medium text-paper">
        <button
          type="button"
          onClick={() => navigate(voltar)}
          className="absolute left-3 flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-paper/80 transition-colors hover:text-paper"
        >
          <ArrowLeft width={14} height={14} />
          <span className="hidden sm:inline">Voltar</span>
        </button>
        Teste do seu assistente · nada é enviado
      </div>
      <AssistantChat profile={profile} onClose={() => navigate(voltar)} fullPage teste />
    </div>
  )
}
