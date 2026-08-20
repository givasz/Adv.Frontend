import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { exampleProfiles } from '@/lib/mockData'
import { applyProfileSeo } from '@/lib/seo'
import { ProfileView } from '@/components/profile/ProfileView'
import { ReportDialog } from '@/components/profile/ReportDialog'
import { ShareBar } from '@/components/profile/ShareBar'
import { OwnerBar } from '@/components/profile/OwnerBar'
import { ScaleIcon } from '@/components/ui/icons'

export default function PublicProfile() {
  const { slug = '' } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')
  const [reporting, setReporting] = useState(false)
  // Dono? Só então aparece a barra com o caminho de volta ao editor. Comparamos
  // com o SLUG do rascunho dele — é o que amarra a sessão a este endereço.
  const { isAuthed } = useAuth()
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (!isAuthed) {
      setIsOwner(false)
      return
    }
    let alive = true
    api
      .getDraft()
      .then((mine) => {
        if (alive) setIsOwner(!!mine.slug && mine.slug === slug)
      })
      .catch(() => {
        /* sem rede: some a barra, que é auxiliar — o perfil segue de pé */
      })
    return () => {
      alive = false
    }
  }, [isAuthed, slug])

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

  // Altura real das barras do topo, para o botão flutuante não sumir atrás delas.
  const barsRef = useRef<HTMLDivElement>(null)
  const [barsHeight, setBarsHeight] = useState(0)
  useEffect(() => {
    const el = barsRef.current
    if (!el) return
    const medir = () => setBarsHeight(el.offsetHeight)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isOwner, state])

  // SEO local automático — título, meta e JSON-LD (Attorney) a partir do perfil.
  // Nos perfis de exemplo (fictícios) NÃO injetamos schema de advogado real.
  useEffect(() => {
    if (!profile) return
    if (exampleProfiles.some((p) => p.slug === profile.slug)) return
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

  // Fixtures de demonstração (marina-sales, guilherme-sales23): rotulados como
  // exemplo para não serem lidos como advogado real (OAB fictícia).
  const isExample = exampleProfiles.some((p) => p.slug === profile.slug)

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden">
      {/* As barras do topo são grudentas e o botão "Compartilhar" é fixo. Medimos
          a altura real (a do dono QUEBRA em duas linhas no celular) para o botão
          descer o tanto certo em vez de ficar escondido atrás. */}
      <div ref={barsRef}>
        {isExample && (
          <div className="sticky top-0 z-30 flex items-center justify-center gap-1.5 bg-ink px-4 py-2 text-center text-[11.5px] font-medium leading-snug text-paper-soft">
            <ScaleIcon width={13} height={13} className="shrink-0 text-brass-light" />
            Perfil de demonstração — pessoa e dados fictícios, apenas para exemplo do advoc.me.
          </div>
        )}
        {isOwner && <OwnerBar />}
      </div>
      <ShareBar
        slug={profile.slug}
        name={profile.name}
        profile={profile}
        topOffset={barsHeight}
      />
      <ProfileView profile={profile} owner={isOwner} />

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
