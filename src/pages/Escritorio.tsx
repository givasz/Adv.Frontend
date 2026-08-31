import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { isExampleFirm, type Firm } from '@/lib/escritorio'
import { PaginaEscritorio } from '@/components/escritorio/PaginaEscritorio'
import { Marca } from '@/components/ui/Marca'

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
        <Marca size={46} className="opacity-80" />
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

  return (
    <>
      {isExampleFirm(slug) && (
        <div className="sticky top-0 z-30 flex items-center justify-center gap-1.5 bg-ink px-4 py-2 text-center text-[11.5px] font-medium leading-snug text-paper-soft">
          <Marca size={16} />
          Escritório de demonstração — sociedade, advogados e registros fictícios, apenas para
          exemplo do advoc.me.
        </div>
      )}
      <PaginaEscritorio firm={firm} />
    </>
  )
}
