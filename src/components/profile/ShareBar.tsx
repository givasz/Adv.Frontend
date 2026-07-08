import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import QRCode from 'qrcode'
import type { Profile } from '@/lib/types'
import { useDialog } from '@/lib/a11y'
import { CopyIcon } from '@/components/ui/icons'

// Monta um cartão de contato (vCard 3.0) profissional a partir do perfil. Só canais
// profissionais informados; sem linguagem de venda. Serve para eventos (OAB,
// congressos) como captação passiva dentro das regras.
function buildVCard(profile: Profile, url: string): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${profile.name}`, `N:${profile.name};;;;`]
  lines.push(`TITLE:Advogado(a) — ${profile.oabNumber}`)
  if (profile.headline) lines.push(`ROLE:${profile.headline}`)
  if (profile.contact.whatsapp) lines.push(`TEL;TYPE=CELL:+${profile.contact.whatsapp}`)
  if (profile.contact.email) lines.push(`EMAIL;TYPE=WORK:${profile.contact.email}`)
  const site = profile.socials.find((s) => s.kind === 'website')?.url
  if (site) lines.push(`URL:${site}`)
  lines.push(`URL:${url}`)
  if (profile.city || profile.state) {
    lines.push(`ADR;TYPE=WORK:;;;${profile.city};${profile.state};;Brasil`)
  }
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(head)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function downloadFile(content: string | Blob, filename: string, type = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type: `${type};charset=utf-8` }) : content
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export function ShareBar({
  slug,
  name,
  profile,
}: {
  slug: string
  name: string
  profile?: Profile
}) {
  const [open, setOpen] = useState(false)
  const url = `${window.location.origin}/${slug}`

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} · advoc.me`, url })
        return
      } catch {
        /* usuário cancelou — cai para o painel */
      }
    }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="fixed right-4 top-4 z-20 inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/10 bg-paper-soft/80 px-4 text-sm font-medium text-ink shadow-card backdrop-blur transition-colors hover:border-brass/50"
        aria-label="Compartilhar perfil"
      >
        Compartilhar
      </button>

      <AnimatePresence>
        {open && (
          <SharePanel url={url} name={name} profile={profile} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

function SharePanel({
  url,
  name,
  profile,
  onClose,
}: {
  url: string
  name: string
  profile?: Profile
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  useDialog(dialogRef, onClose)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 190,
        margin: 1,
        color: { dark: '#211c17', light: '#faf6ec' },
      }).catch(() => {})
    }
  }, [url])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="w-full max-w-sm rounded-xl2 border border-ink/10 bg-paper p-6 text-center shadow-lift"
      >
        <h3 id="share-title" className="text-xl font-semibold">
          Compartilhar perfil
        </h3>
        <p className="mt-1 text-sm text-ink-faint">
          Aponte a câmera ou copie o link de {name.split(' ')[0]}.
        </p>
        <div className="mt-5 flex justify-center">
          <div className="rounded-xl2 border border-ink/10 bg-paper-soft p-3">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`QR code do link do perfil de ${name.split(' ')[0]}`}
              className="rounded-md"
            />
          </div>
        </div>
        <button type="button" onClick={copy} className="btn-ghost mt-5 w-full">
          <CopyIcon width={17} height={17} />
          {copied ? 'Link copiado!' : url.replace(/^https?:\/\//, '')}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? 'Link copiado para a área de transferência' : ''}
        </span>

        {/* Cartão digital para eventos: baixar o QR ou o contato (vCard) */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              const png = canvasRef.current?.toDataURL('image/png')
              if (png) downloadFile(dataUrlToBlob(png), `qr-${slugify(name)}.png`)
            }}
            className="btn-ghost flex-1 !text-[13px]"
          >
            Baixar QR
          </button>
          {profile && (
            <button
              type="button"
              onClick={() => downloadFile(buildVCard(profile, url), `${slugify(name)}.vcf`)}
              className="btn-ghost flex-1 !text-[13px]"
            >
              Baixar contato
            </button>
          )}
        </div>

        <button type="button" onClick={onClose} className="mt-3 text-sm text-ink-faint hover:text-ink">
          Fechar
        </button>
      </motion.div>
    </motion.div>
  )
}
