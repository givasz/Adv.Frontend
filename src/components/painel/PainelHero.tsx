import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { profileUrl, profileUrlLabel } from '@/lib/publicUrl'
import { copiarTexto } from '@/lib/copiar'
import { PLAN_LABEL } from '@/lib/upsell'
import { editorPath } from '@/lib/editorSections'
import { comVolta } from '@/components/ui/SubPage'
import { Avatar } from '@/components/ui/Avatar'
import { CheckIcon, CopyIcon, PenIcon, ShareIcon } from '@/components/ui/icons'

// O alto do painel: quem é, o endereço do perfil e os dois gestos mais comuns.
//
// Mandar o link a um cliente é o que um advogado mais faz com o próprio perfil,
// e o painel não tinha o link em lugar nenhum — era preciso abrir o perfil
// público e copiar da barra do navegador. Editar era o segundo gesto sem botão:
// só se chegava ao editor por um passo do índice ou por um cartão de recurso.
export function PainelHero({ profile }: { profile: Profile }) {
  const [copiado, setCopiado] = useState(false)
  const firstName = profile.name.split(' ')[0] || 'você'

  async function copiar() {
    if (!(await copiarTexto(profileUrl(profile.slug)))) return
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1600)
  }

  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar name={profile.name} src={profile.avatarUrl} size={60} />
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-semibold leading-tight text-ink">Olá, {firstName}</h1>
        <p className="mt-0.5 text-[14px] text-ink-soft">
          Seu perfil está no ar ·{' '}
          <Link
            to={editorPath('plano')}
            className="font-medium text-brass-deep underline-offset-4 hover:underline"
          >
            plano {PLAN_LABEL[profile.plan]}
          </Link>
        </p>
        {/* O endereço REAL (lib/publicUrl.ts), o mesmo que vai no QR. */}
        <div className="mt-2.5 flex max-w-full items-center gap-2 rounded-full border border-ink/10 bg-paper py-1 pl-3.5 pr-1">
          <span className="min-w-0 truncate text-[12.5px] text-ink-soft">{profileUrlLabel(profile.slug)}</span>
          <button
            type="button"
            onClick={copiar}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-burgundy transition-colors hover:bg-burgundy/[0.07]"
            aria-live="polite"
          >
            {copiado ? <CheckIcon width={13} height={13} strokeWidth={2.4} /> : <CopyIcon width={13} height={13} />}
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link to="/editor" className="btn-primary !py-2.5 !px-5 text-[13.5px]">
          <PenIcon width={15} height={15} />
          Editar perfil
        </Link>
        <Link
          to={comVolta(`/${profile.slug}/compartilhar`, '/painel')}
          className="btn-ghost !py-2.5 !px-4 text-[13.5px]"
        >
          <ShareIcon width={15} height={15} />
          Compartilhar
        </Link>
      </div>
    </section>
  )
}
