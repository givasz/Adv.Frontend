import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Firm } from '@/lib/escritorio'
import { PaginaEscritorio } from '@/components/escritorio/PaginaEscritorio'
import { ScaleIcon } from '@/components/ui/icons'

export default function Escritorio() {
  const { slug = '' } = useParams()
  const [firm, setFirm] = useState<Firm | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    api.getFirm(slug).then((f) => {
      if (!alive) return
      if (f) {
        setFirm(f)
        setState('ready')
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

  if (state === 'notfound' || !firm) {
    return (
      <div className="grain flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <ScaleIcon width={40} height={40} className="text-burgundy/60" />
        <h1 className="font-display text-2xl font-semibold">Escritório não encontrado</h1>
        <p className="max-w-xs text-ink-faint">
          O endereço <span className="font-medium">advoc.me/escritorio/{slug}</span> ainda não
          existe.
        </p>
        <Link to="/" className="btn-ghost mt-2">
          Voltar ao início
        </Link>
      </div>
    )
  }

  return <PaginaEscritorio firm={firm} />
}
