import { useRef, useState, type ChangeEvent } from 'react'
import { fileToAvatarDataUrl } from '@/lib/image'
import { TextInput } from '@/components/editor/fields'

// A MARCA DO ESCRITÓRIO — a logo quando existe, o monograma quando não.
//
// O monograma nasceu como substituto ("exibido quando não há logo", dizia o tipo)
// de uma logo que nunca foi construída: o campo `logoUrl` existia no banco desde
// o começo, o editor não o oferecia e o backend não o gravava. Na prática, todo
// escritório era duas letras num círculo, e não havia caminho para trocar isso.
//
// Segue o mesmo caminho da foto do advogado (AvatarUpload): a imagem é comprimida
// no navegador e vira data URI. Sem upload para o nosso disco — a mesma razão do
// vídeo: mídia hospedada por nós é custo, banda e moderação.

export function LogoUpload({
  monogram,
  value,
  onChange,
}: {
  /** as duas letras que aparecem enquanto não há logo */
  monogram: string
  value?: string
  onChange: (url: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUrl, setShowUrl] = useState(false)
  const enviada = !!value?.startsWith('data:')

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

  return (
    <div>
      {/* Rótulo próprio, e não `Field`: este bloco tem vários controles, e um
          <label> envolvente se associaria só ao primeiro (o seletor de arquivo,
          que é escondido). Ver a mesma decisão no seletor de formato do vídeo. */}
      <span className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2">
        <span className="text-[13px] font-semibold text-ink">Logo do escritório</span>
        <span className="shrink-0 text-[11px] text-ink-faint">opcional</span>
      </span>
      <div className="flex items-center gap-4">
        {/* A prévia É o que a página pública desenha: logo se houver, monograma se
            não. Ver components/escritorio/PaginaEscritorio.tsx. */}
        <span
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl2 border border-ink/10 bg-paper-soft"
          aria-hidden
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain p-1.5" />
          ) : (
            <span className="font-display text-[24px] font-semibold text-burgundy">
              {monogram || '—'}
            </span>
          )}
        </span>

        <div className="flex flex-col items-start gap-1.5">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="btn-ghost !py-2 !px-4 text-[13px] disabled:opacity-60"
          >
            {busy ? 'Processando…' : value ? 'Trocar logo' : 'Enviar logo'}
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

      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
        JPG ou PNG. Sem logo, ficam as iniciais do nome — que é o que aparece hoje.
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
          value={enviada ? '' : (value ?? '')}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      )}
    </div>
  )
}
