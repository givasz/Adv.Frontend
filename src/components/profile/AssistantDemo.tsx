import type { Profile } from '@/lib/types'
import { AssistantChat } from '@/components/profile/AssistantChat'

// Vitrine do assistente virtual: o mesmo componente do perfil real, funcionando de
// verdade dentro de um aparelho. Nada de screenshot — quem chega na home conversa.
export function AssistantDemo({ profile }: { profile: Profile }) {
  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="relative rounded-[2.5rem] border-[10px] border-ink bg-ink shadow-lift">
        <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
        <div className="relative h-[600px] max-h-[76svh] overflow-hidden rounded-[1.8rem]">
          <AssistantChat profile={profile} variant="inline" />
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-faint">
        Demonstração real — experimente responder
      </p>
    </div>
  )
}
