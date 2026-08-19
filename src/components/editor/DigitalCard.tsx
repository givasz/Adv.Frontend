import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { Profile } from '@/lib/types'
import { slugify } from '@/lib/brFormat'
import { profileUrl, profileUrlLabel } from '@/lib/publicUrl'
import { buildVCard, dataUrlToBlob, downloadFile } from '@/lib/vcard'
import { Card } from './fields'
import { CopyIcon } from '@/components/ui/icons'

// Cartão digital do advogado: o QR do perfil, pronto para baixar em alta resolução
// (cartão de visita, vitrine, assinatura de e-mail) e o contato em vCard.
//
// A seção existia vendendo "QR Code personalizado" e mostrava... o endereço em
// texto. O QR só existia no perfil público. Agora o dono também tem o dele — e é
// um motivo real para o Pro, não uma promessa.

const PREVIEW_PX = 190
const PRINT_PX = 1024 // resolução de impressão (cartão/banner)

export function DigitalCard({ profile }: { profile: Profile }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  // A URL REAL do perfil, não a marca. Ver lib/publicUrl.ts: apontar o QR para
  // advoc.me gerava um código que não abria nada.
  const url = profileUrl(profile.slug)
  const label = profileUrlLabel(profile.slug)

  useEffect(() => {
    if (!canvasRef.current) return
    void QRCode.toCanvas(canvasRef.current, url, {
      width: PREVIEW_PX,
      margin: 1,
      color: { dark: '#1c1917', light: '#ffffff' },
    })
  }, [url])

  const copy = () => {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      },
      () => {},
    )
  }

  // Gera o PNG em alta resolução na hora do download (a prévia fica pequena na tela).
  const downloadQr = async () => {
    const png = await QRCode.toDataURL(url, {
      width: PRINT_PX,
      margin: 2,
      color: { dark: '#1c1917', light: '#ffffff' },
    })
    downloadFile(dataUrlToBlob(png), `qr-${slugify(profile.name) || 'perfil'}.png`)
  }

  return (
    <Card title="QR Code e contato">
      <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
        Aponte a câmera e o perfil abre. Use em cartão de visita, na vitrine do escritório ou na
        assinatura de e-mail.
      </p>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-ink/10 bg-paper-soft/60 p-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="shrink-0 rounded-xl2 border border-ink/10 bg-white p-2.5">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`QR Code do perfil ${label}`}
            className="block rounded-md"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2.5 text-center sm:text-left">
          <div>
            <p className="font-display text-[15px] font-semibold text-ink">{profile.name || 'Seu nome'}</p>
            {/* Exibe exatamente o que o QR carrega — rótulo e código não podem
                divergir, senão o advogado imprime uma coisa e entrega outra. */}
            <p className="truncate text-[12.5px] text-ink-soft">{label}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <button type="button" onClick={downloadQr} className="btn-ghost !py-2 !px-3 !text-[13px]">
              Baixar QR (PNG)
            </button>
            <button
              type="button"
              onClick={() => downloadFile(buildVCard(profile, url), `${slugify(profile.name) || 'contato'}.vcf`)}
              className="btn-ghost !py-2 !px-3 !text-[13px]"
            >
              Baixar contato (vCard)
            </button>
            <button type="button" onClick={copy} className="btn-ghost !py-2 !px-3 !text-[13px]">
              <CopyIcon width={14} height={14} />
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
          <span className="sr-only" aria-live="polite">
            {copied ? 'Link copiado para a área de transferência' : ''}
          </span>
        </div>
      </div>
    </Card>
  )
}
