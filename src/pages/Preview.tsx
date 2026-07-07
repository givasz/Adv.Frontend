import { useParams } from 'react-router-dom'
import type { ThemeId } from '@/lib/themes'
import { THEMES } from '@/lib/themes'
import { sampleProfile } from '@/lib/mockData'
import { ProfileView } from '@/components/profile/ProfileView'

// Rota interna só para visualização/screenshot dos temas (não linkada na navegação).
export default function Preview() {
  const { themeId } = useParams()
  const id = (THEMES.some((t) => t.id === themeId) ? themeId : 'papel') as ThemeId
  const profile = { ...sampleProfile, theme: id, plan: 'premium' as const }
  return (
    <main className="flex min-h-dvh flex-col">
      <ProfileView profile={profile} preview />
    </main>
  )
}
