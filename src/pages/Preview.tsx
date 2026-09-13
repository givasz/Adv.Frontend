import { useParams, useSearchParams } from 'react-router-dom'
import type { ThemeId } from '@/lib/themes'
import { THEMES } from '@/lib/themes'
import { sampleProfile } from '@/lib/mockData'
import { ProfileView } from '@/components/profile/ProfileView'

// Rota interna só para visualização/screenshot dos temas (não linkada na navegação).
//
// Dois parâmetros opcionais, para fotografar o que o perfil de exemplo sozinho
// não mostra:
//   ?botao=whatsapp|assistant|off  → qual balão flutuante desenhar
//   ?marca=8a2be2                  → cor de marca (white-label) por cima do tema
export default function Preview() {
  const { themeId } = useParams()
  const [params] = useSearchParams()
  const id = (THEMES.some((t) => t.id === themeId) ? themeId : 'papel') as ThemeId
  const botao = params.get('botao')
  const marca = params.get('marca')
  const profile = {
    ...sampleProfile,
    theme: id,
    plan: 'premium' as const,
    floating:
      botao === 'whatsapp' || botao === 'assistant' || botao === 'off'
        ? botao
        : sampleProfile.floating,
    branding: /^[0-9a-f]{6}$/i.test(marca ?? '')
      ? { ...sampleProfile.branding, accent: `#${marca}` }
      : sampleProfile.branding,
  }
  return (
    <main className="flex min-h-dvh flex-col">
      <ProfileView profile={profile} preview />
    </main>
  )
}
