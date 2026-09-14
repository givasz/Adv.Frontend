import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import type { Profile } from '@/lib/types'
import { api } from '@/lib/api'
import { slugify } from '@/lib/brFormat'
import { buildVCard, dataUrlToBlob, downloadFile } from '@/lib/vcard'
import { copiarTexto } from '@/lib/copiar'
import { registrarEvento } from '@/lib/eventos'
import { SubPage, useVoltar } from '@/components/ui/SubPage'
import { CopyIcon, QrIcon } from '@/components/ui/icons'

// Compartilhar um perfil — /:slug/compartilhar.
//
// Era um painel sobreposto. Como página, o QR fica grande de verdade (é para
// alguém apontar a câmera), o link tem endereço próprio e o "voltar" do celular
// faz o que a pessoa espera. O botão do perfil só cai aqui quando o navegador não
// tem compartilhamento nativo — quando tem, continua abrindo o do sistema.
export default function SharePage() {
  const { slug = '' } = useParams()
  const voltar = useVoltar(`/${slug}`)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [copied, setCopied] = useState(false)
  // O navegador recusou as duas formas de copiar: o endereço fica à vista.
  const [naoCopiou, setNaoCopiou] = useState(false)
  const url = `${window.location.origin}/${slug}`

  useEffect(() => {
    let alive = true
    api
      .getProfile(slug)
      .then((p) => alive && p && setProfile(p))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [slug])

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 240,
        margin: 1,
        color: { dark: '#211c17', light: '#faf6ec' },
      }).catch(() => {})
    }
  }, [url])

  async function copy() {
    if (await copiarTexto(url)) {
      setNaoCopiou(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } else {
      setNaoCopiou(true)
    }
  }

  const primeiro = profile?.name.split(' ')[0] ?? ''

  return (
    <SubPage
      title="Compartilhar perfil"
      subtitle={
        primeiro
          ? `Aponte a câmera para o código ou copie o link de ${primeiro}.`
          : 'Aponte a câmera para o código ou copie o link.'
      }
      icon={<QrIcon width={18} height={18} />}
      backTo={voltar}
      backLabel="Voltar ao perfil"
      documentTitle="Compartilhar perfil"
    >
      <div className="rounded-xl2 border border-ink/10 bg-paper p-6 text-center shadow-card">
        <div className="flex justify-center">
          <div className="rounded-xl2 border border-ink/10 bg-paper-soft p-3">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`QR code do perfil${primeiro ? ` de ${primeiro}` : ''}`}
              className="rounded-md"
            />
          </div>
        </div>

        <button type="button" onClick={copy} className="btn-ghost mt-5 w-full">
          <CopyIcon width={17} height={17} />
          <span className="truncate">{copied ? 'Link copiado!' : url.replace(/^https?:\/\//, '')}</span>
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? 'Link copiado para a área de transferência' : ''}
        </span>
        {naoCopiou && (
          // Navegador de aplicativo que recusa copiar: em vez de nada acontecer,
          // o endereço fica à vista, pronto para o toque longo.
          <p role="status" className="mt-2 text-[12px] leading-relaxed text-ink-soft">
            Não deu para copiar por aqui. Toque e segure o endereço para copiar:{' '}
            <span className="select-all break-all font-medium text-ink">{url}</span>
          </p>
        )}

        {/* Material para levar a evento: o QR em imagem e o contato em vCard. */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              const png = canvasRef.current?.toDataURL('image/png')
              if (png) downloadFile(dataUrlToBlob(png), `qr-${slugify(profile?.name ?? slug)}.png`)
            }}
            className="btn-ghost flex-1 !text-[13px]"
          >
            Baixar QR
          </button>
          {profile && (
            <button
              type="button"
              onClick={() => {
                // Salvar o contato na agenda é uma intenção de falar depois —
                // conta junto com WhatsApp e agendamento (ver lib/eventos.ts).
                registrarEvento(slug ?? '', 'cartao')
                downloadFile(buildVCard(profile, url), `${slugify(profile.name)}.vcf`, 'text/vcard')
              }}
              className="btn-ghost flex-1 !text-[13px]"
            >
              Baixar contato
            </button>
          )}
        </div>
        {/* Navegador de aplicativo (Instagram, Facebook) muitas vezes não baixa
            arquivo nenhum — e não avisa. A linha diz o caminho que funciona. */}
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
          Se o arquivo não baixar, abra esta página no navegador do celular.
        </p>
      </div>
    </SubPage>
  )
}
