import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { profileUrl, hostLabel } from '@/lib/publicUrl'
import { copiarTexto } from '@/lib/copiar'
import { resolveSchedulingMode } from '@/lib/booking'
import { CheckIcon, CopyIcon, ExternalLinkIcon, PenIcon } from '@/components/ui/icons'

// A CAPA do painel: o endereço do perfil e o que se faz com ele.
//
// Mandar o link a um cliente é o que um advogado mais faz com o próprio perfil;
// editar é o segundo gesto. Os três botões moram juntos porque são sobre a
// mesma coisa — e "Editar perfil" é o cheio, porque é o que mais se faz aqui.
//
// No celular estreito: Editar ocupa a linha de cima inteira, copiar e ver
// dividem a de baixo. A partir do `xs` os três cabem numa linha só.
export function PainelHero({ profile }: { profile: Profile }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (!(await copiarTexto(profileUrl(profile.slug)))) return
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1600)
  }

  const areas = profile.areas?.length ?? 0
  const perguntas = profile.faqs?.length ?? 0
  const agenda = resolveSchedulingMode(profile) === 'assistant'

  return (
    <section aria-label="Seu link" className="card-paper p-4 sm:p-6" data-capa-do-perfil>
      <div className="flex items-center justify-between gap-3">
        <h2 className="eyebrow font-sans">Seu link</h2>
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-600/50 motion-reduce:hidden" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-700" />
          </span>
          No ar
        </span>
      </div>

      {/* O endereço REAL (lib/publicUrl.ts), o mesmo que vai no QR. O host fica
          apagado e o nome em negrito: é o nome que a pessoa confere. A quebra,
          quando precisa, acontece na barra (<wbr>) — nunca no meio do nome. */}
      <p className="mt-2.5 font-mono text-[14.5px] leading-snug text-ink [overflow-wrap:anywhere] xs:text-[16px] sm:text-[17px]">
        <span className="text-ink-faint">{hostLabel()}/</span>
        <wbr />
        <span className="font-semibold">{profile.slug}</span>
      </p>

      {/* Celular: o recado e os números em linhas próprias — juntos, a quebra
          deixava o "·" pendurado no fim da primeira. */}
      <p className="mt-1.5 flex flex-col gap-0.5 text-[12.5px] leading-snug text-ink-faint sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
        <span>Mande a clientes e cole na bio do Instagram.</span>
        <span className="hidden sm:inline" aria-hidden>
          ·
        </span>
        <span>
          {areas} {areas === 1 ? 'área' : 'áreas'} · {perguntas} {perguntas === 1 ? 'pergunta' : 'perguntas'} · assistente{' '}
          {agenda ? 'ligado' : 'desligado'}
        </span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 xs:flex xs:flex-wrap">
        <Link to="/editor" className="btn-primary col-span-2 !py-2.5 text-[14px] xs:!px-5">
          <PenIcon width={16} height={16} />
          Editar perfil
        </Link>
        <button
          type="button"
          onClick={copiar}
          aria-live="polite"
          className="btn-ghost min-w-0 !px-2.5 !py-2.5 text-[13px] xs:!px-4"
        >
          {copiado ? (
            <CheckIcon width={15} height={15} strokeWidth={2.4} className="shrink-0" />
          ) : (
            <CopyIcon width={15} height={15} className="shrink-0" />
          )}
          {/* Abaixo de 340px "link" cai: a palavra sozinha quebrava o botão em duas linhas. */}
          {copiado ? 'Copiado!' : (
            <span className="whitespace-nowrap">
              Copiar<span className="hidden min-[340px]:inline"> link</span>
            </span>
          )}
        </button>
        <Link
          to={`/${profile.slug}`}
          target="_blank"
          className="btn-ghost min-w-0 !px-2.5 !py-2.5 text-[13px] xs:!px-4"
        >
          <ExternalLinkIcon width={15} height={15} className="shrink-0" />
          <span className="whitespace-nowrap">
            Ver<span className="hidden min-[340px]:inline"> perfil</span>
          </span>
        </Link>
      </div>
    </section>
  )
}
