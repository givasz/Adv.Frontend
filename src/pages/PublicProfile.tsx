import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { ProfileView } from '@/components/profile/ProfileView'
import { ShareBar } from '@/components/profile/ShareBar'
import { ScaleIcon } from '@/components/ui/icons'

export default function PublicProfile() {
  const { slug = '' } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    api.getProfile(slug).then((p) => {
      if (!alive) return
      if (p) {
        setProfile(p)
        setState('ready')
        document.title = `${p.name} · ${p.oabNumber} · advoc.me`
      } else {
        setState('notfound')
      }
    })
    return () => {
      alive = false
    }
  }, [slug])

  if (state === 'loading') {
    return (
      <div className="grain flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" />
      </div>
    )
  }

  if (state === 'notfound' || !profile) {
    return (
      <div className="grain flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <ScaleIcon width={40} height={40} className="text-burgundy/60" />
        <h1 className="text-2xl font-semibold">Perfil não encontrado</h1>
        <p className="max-w-xs text-ink-faint">
          O endereço <span className="font-medium">advoc.me/{slug}</span> ainda não existe.
        </p>
        <Link to="/" className="btn-ghost mt-2">
          Voltar ao início
        </Link>
      </div>
    )
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <ShareBar slug={profile.slug} name={profile.name} />
      <ProfileView profile={profile} />
    </main>
  )
}
