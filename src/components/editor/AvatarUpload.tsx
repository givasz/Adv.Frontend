import { useRef, useState, type ChangeEvent } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { TextInput } from './fields'
import { fileToAvatarDataUrl } from '@/lib/image'

// Seletor de foto de perfil — puxa do celular (câmera ou galeria) ou do
// computador via <input type="file">. A imagem é comprimida no navegador
// (ver lib/image.ts) e guardada como data URI em avatarUrl. Um "colar link"
// opcional mantém quem prefere hospedar a imagem em outro lugar.
export function AvatarUpload({
  name,
  value,
  onChange,
  size = 88,
  align = 'row',
}: {
  name: string
  value?: string
  onChange: (url: string | undefined) => void
  size?: number
  /** 'row' (editor) ou 'stack' centralizado (onboarding) */
  align?: 'row' | 'stack'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUrl, setShowUrl] = useState(false)

  const isUploaded = !!value?.startsWith('data:')

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo depois
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      onChange(await fileToAvatarDataUrl(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a imagem.')
    } finally {
      setBusy(false)
    }
  }

  const stack = align === 'stack'

  return (
    <div className={stack ? 'flex flex-col items-center text-center' : ''}>
      <div className={`flex items-center gap-4 ${stack ? 'flex-col' : ''}`}>
        <Avatar name={name} src={value} size={size} />
        <div className={`flex flex-col gap-1.5 ${stack ? 'items-center' : 'items-start'}`}>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="btn-ghost !py-2 !px-4 text-[13px] disabled:opacity-60"
          >
            {busy ? 'Processando…' : value ? 'Trocar foto' : 'Enviar foto'}
          </button>
          {value && !busy && (
            <button
              type="button"
              onClick={() => {
                onChange(undefined)
                setError(null)
              }}
              className="text-[12.5px] font-medium text-ink-faint transition-colors hover:text-burgundy"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <p className={`mt-2 text-[11.5px] leading-relaxed text-ink-faint ${stack ? '' : ''}`}>
        Do celular ou do computador · JPG ou PNG. A foto é ajustada automaticamente.
      </p>
      {error && <p className="mt-1 text-[12px] font-medium text-burgundy">{error}</p>}

      <button
        type="button"
        onClick={() => setShowUrl((v) => !v)}
        className="mt-2 text-[12px] font-medium text-ink-faint underline decoration-ink/20 underline-offset-2 transition-colors hover:text-burgundy"
      >
        {showUrl ? 'Ocultar link' : 'ou colar o link de uma imagem'}
      </button>
      {showUrl && (
        <TextInput
          className="mt-2"
          value={isUploaded ? '' : value ?? ''}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      )}
    </div>
  )
}
