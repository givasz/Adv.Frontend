import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { TextInput } from './fields'
import {
  carregarImagem,
  desenharRecorte,
  dimensoes,
  ENQUADRAMENTO_PADRAO,
  janelaDeRecorte,
  liberarImagem,
  recortarAvatar,
  ZOOM_MAX,
  type Enquadramento,
  type FonteDeImagem,
} from '@/lib/image'

// Seletor de foto de perfil — puxa do celular (câmera ou galeria) ou do
// computador via <input type="file">. A imagem é comprimida no navegador
// (ver lib/image.ts) e guardada como data URI em avatarUrl. Um "colar link"
// opcional mantém quem prefere hospedar a imagem em outro lugar.
//
// ENQUADRAMENTO (13/09/2026). Antes o recorte era automático, sempre o centro
// — e quem tinha a foto num canto, ou queria o rosto maior, não tinha o que
// fazer ("não dá para dimensionar o que vai aparecer?"). Agora, escolhida a
// imagem, abre-se AQUI MESMO (em linha, sem modal — regra do projeto) uma
// prévia quadrada: arrasta-se para posicionar e aproxima-se pela barra. A
// prévia e o recorte final desenham pela mesma janela (lib/image.ts), então o
// que se vê é o que se grava.

/** Lado da prévia de enquadramento, em px de CSS. */
const PREVIA = 220

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
  // A foto escolhida, decodificada, enquanto o enquadramento está aberto.
  const [fonte, setFonte] = useState<FonteDeImagem | null>(null)
  const [enq, setEnq] = useState<Enquadramento>(ENQUADRAMENTO_PADRAO)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Início de um arrasto: onde o dedo estava e onde o centro estava.
  const arrasto = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  const isUploaded = !!value?.startsWith('data:')

  // A prévia é um canvas desenhado a cada mudança de enquadramento — em 2× para
  // não sair borrada em tela de celular.
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !fonte) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    desenharRecorte(ctx, fonte, enq, c.width)
  }, [fonte, enq])

  // Bitmap não fica pendurado se o componente sair com o enquadramento aberto.
  // Pela ref, e não pelo estado: a limpeza roda uma vez, com o valor da hora.
  const fonteAtual = useRef<FonteDeImagem | null>(null)
  fonteAtual.current = fonte
  useEffect(() => () => {
    if (fonteAtual.current) liberarImagem(fonteAtual.current)
  }, [])

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo depois
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const src = await carregarImagem(file)
      if (fonte) liberarImagem(fonte)
      setEnq(ENQUADRAMENTO_PADRAO)
      setFonte(src)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a imagem.')
    } finally {
      setBusy(false)
    }
  }

  function confirmar() {
    if (!fonte) return
    try {
      onChange(recortarAvatar(fonte, enq))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar a imagem.')
      return
    }
    liberarImagem(fonte)
    setFonte(null)
  }

  function cancelar() {
    if (fonte) liberarImagem(fonte)
    setFonte(null)
  }

  // ---- arrastar para posicionar ----
  function aoPressionar(e: PointerEvent<HTMLCanvasElement>) {
    if (!fonte) return
    e.currentTarget.setPointerCapture(e.pointerId)
    arrasto.current = { x: e.clientX, y: e.clientY, cx: enq.cx, cy: enq.cy }
  }
  function aoMover(e: PointerEvent<HTMLCanvasElement>) {
    const a = arrasto.current
    if (!a || !fonte) return
    const { w, h } = dimensoes(fonte)
    const { lado } = janelaDeRecorte(w, h, enq)
    // px da prévia → px da foto: a janela de `lado` px cabe em PREVIA px de tela.
    const escala = lado / PREVIA
    // Arrastar a foto para a direita = a janela anda para a esquerda.
    const cx = a.cx - ((e.clientX - a.x) * escala) / w
    const cy = a.cy - ((e.clientY - a.y) * escala) / h
    // O centro não passa do ponto em que a janela encosta na borda — senão o
    // arrasto "acumula" fora da foto e demora a responder na volta.
    const minX = lado / 2 / w
    const minY = lado / 2 / h
    setEnq({
      zoom: enq.zoom,
      cx: Math.min(Math.max(cx, minX), 1 - minX),
      cy: Math.min(Math.max(cy, minY), 1 - minY),
    })
  }
  function aoSoltar(e: PointerEvent<HTMLCanvasElement>) {
    if (arrasto.current) e.currentTarget.releasePointerCapture(e.pointerId)
    arrasto.current = null
  }

  const stack = align === 'stack'

  return (
    <div className={stack ? 'flex flex-col items-center text-center' : ''}>
      {fonte ? (
        // ---- enquadramento ----
        <div className={`flex flex-col gap-3 ${stack ? 'items-center' : 'items-start'}`}>
          <div
            className="relative overflow-hidden rounded-xl2 border border-ink/15 bg-paper-deep shadow-card"
            style={{ width: PREVIA, height: PREVIA }}
          >
            <canvas
              ref={canvasRef}
              width={PREVIA * 2}
              height={PREVIA * 2}
              style={{ width: PREVIA, height: PREVIA, touchAction: 'none', cursor: 'grab' }}
              onPointerDown={aoPressionar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={aoSoltar}
              aria-label="Prévia da foto. Arraste para posicionar."
              role="img"
            />
            {/* Guia do círculo: a maioria dos temas mostra a foto redonda, e o que
                fica fora do círculo é o que some neles. Só escurece, não corta —
                os temas de foto quadrada (Ardósia, Timbre) usam o quadrado todo. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ boxShadow: '0 0 0 999px rgba(33,28,23,0.28)' }}
            />
          </div>

          <label className="flex w-full max-w-[220px] items-center gap-2.5 text-[12px] font-medium text-ink-soft">
            <span className="shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={ZOOM_MAX}
              step={0.01}
              value={enq.zoom}
              onChange={(e) => setEnq({ ...enq, zoom: Number(e.target.value) })}
              className="w-full accent-burgundy"
              aria-label="Aproximar a foto"
            />
          </label>
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            Arraste a foto para posicionar e use a barra para aproximar.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={confirmar} className="btn-primary !py-2 !px-4 text-[13px]">
              Usar esta foto
            </button>
            <button type="button" onClick={cancelar} className="btn-ghost !py-2 !px-4 text-[13px]">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
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
      )}

      {!fonte && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
          Do celular ou do computador · JPG ou PNG. Você escolhe o enquadramento antes de salvar.
        </p>
      )}
      {error && <p className="mt-1 text-[12px] font-medium text-burgundy">{error}</p>}

      {!fonte && (
        <button
          type="button"
          onClick={() => setShowUrl((v) => !v)}
          className="mt-2 text-[12px] font-medium text-ink-faint underline decoration-ink/20 underline-offset-2 transition-colors hover:text-burgundy"
        >
          {showUrl ? 'Ocultar link' : 'ou colar o link de uma imagem'}
        </button>
      )}
      {showUrl && !fonte && (
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
