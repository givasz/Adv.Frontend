import { useRef } from 'react'
import { useInView } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { AssistantChat } from '@/components/profile/AssistantChat'

// Vitrine do assistente virtual: o mesmo componente do perfil real, funcionando de
// verdade dentro de um aparelho. Nada de screenshot — quem chega na home conversa.
//
// A conversa só COMEÇA quando o telefone entra na tela. Antes, o componente era
// montado junto com a home inteira: a saudação e o "digitando…" rolavam lá em
// cima, e quem descia até aqui encontrava a conversa pronta. O efeito que mais
// vende o recurso — ver o assistente escrever — era justamente o que ninguém via.
//
// `once: true`: uma vez começada, a conversa não recomeça se a pessoa rolar para
// fora e voltar. Reiniciar apagaria o que ela já tivesse respondido.
//
// `amount: 0.4`: espera 40% do telefone visível. Disparar no primeiro pixel faria
// a saudação começar com o aparelho ainda entrando pela borda de baixo. Exigir
// uma fração é seguro mesmo em tela baixa porque a altura do aparelho é limitada
// por `svh`: ele encolhe junto com a janela, então esses 40% sempre cabem na
// viewport — testado de 320x568 a 1440x900.

export function AssistantDemo({ profile }: { profile: Profile }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  // Sem IntersectionObserver (navegador antigo) a conversa nunca receberia o
  // sinal: melhor tocar de imediato do que exibir um telefone vazio para sempre.
  const observable = typeof IntersectionObserver !== 'undefined'

  return (
    <div ref={ref} className="mx-auto w-full max-w-[320px]">
      <div className="relative rounded-[2.5rem] border-[10px] border-ink bg-ink shadow-lift">
        <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
        <div className="relative h-[600px] max-h-[76svh] overflow-hidden rounded-[1.8rem]">
          {/* `pace`: a vitrine fala mais devagar que o perfil real. Aqui ninguém
              quer marcar horário — quer VER o assistente trabalhando —, e no
              ritmo do perfil a abertura terminava antes de a pessoa acabar de ler
              a primeira frase. */}
          <AssistantChat
            profile={profile}
            variant="inline"
            autoStart={!observable || inView}
            pace={1.8}
          />
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-faint">
        Demonstração real — experimente responder
      </p>
    </div>
  )
}
