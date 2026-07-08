import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { applyProfileSeo } from '@/lib/seo'
import { ProfileView } from '@/components/profile/ProfileView'
import { ReportDialog } from '@/components/profile/ReportDialog'
import { ShareBar } from '@/components/profile/ShareBar'
import { ScaleIcon } from '@/components/ui/icons'

export default function PublicProfile() {
  const { slug = '' } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    let alive = true
    setState('loading')
    api.getProfile(slug).then((p) => {
      if (!alive) return
      if (p) {
        setProfile(p)
        setState('ready')
      } else {
        setState('notfound')
      }
    })
    return () => {
      alive = false
    }
  }, [slug])

  // SEO local automático — título, meta e JSON-LD (Attorney) a partir do perfil.
  useEffect(() => {
    if (!profile) return
    return applyProfileSeo(profile)
  }, [profile])

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
      <ShareBar slug={profile.slug} name={profile.name} profile={profile} />
      <ProfileView profile={profile} />

      {/* Denúncia — canal discreto de conformidade (Prov. 205/2021) */}
      <div className="flex justify-center pb-10 pt-2">
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="text-[11.5px] font-medium text-ink-faint/70 underline-offset-2 transition-colors hover:text-burgundy hover:underline"
        >
          Denunciar este perfil
        </button>
      </div>

      {reporting && (
        <ReportDialog slug={profile.slug} name={profile.name} onClose={() => setReporting(false)} />
      )}
    </main>
  )
}
