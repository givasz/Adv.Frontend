import type { Profile } from '@/lib/types'
import { checkCompliance, OAB_GUIDANCE_BY_FIELD } from '@/lib/oab'
import { parseVideoUrl, VIDEO_CAPTION_MAX } from '@/lib/video'
import { themeStyle } from '@/lib/themes'
import { VideoPlayer } from '@/components/profile/VideoPlayer'
import { Card, Field, TextInput } from './fields'
import { InfoTip } from './InfoTip'
import { MarginNotes } from './MarginNotes'

// Vídeo de apresentação (Max): o advogado cola um link de YouTube ou Vimeo e ele
// aparece no fim do perfil. Sem upload — ver lib/video.ts para o porquê.
//
// A checagem de conformidade alcança a legenda, não o vídeo: o que a plataforma
// pode fazer pelo conteúdo em si é orientar antes (InfoTip) e lembrar de quem é a
// responsabilidade. É o mesmo princípio do resto do editor — guarda-corpo, não
// promessa de imunidade.

const EXAMPLE = 'https://www.youtube.com/watch?v=…'

export function VideoCard({
  profile,
  set,
  /** modo espectro (dentro do cadeado): controles inertes, só para ver */
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  preview?: boolean
}) {
  const raw = profile.videoUrl ?? ''
  const video = parseVideoUrl(raw)
  const caption = profile.videoCaption ?? ''
  const captionIssues = checkCompliance(caption)
  // Link digitado que ainda não vira vídeo: avisa sem bloquear a digitação.
  const badLink = raw.trim().length > 0 && !video

  return (
    <Card title="Vídeo de apresentação">
      <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
        Um vídeo curto em que você se apresenta ou explica um tema aparece no fim do seu perfil.
        Cole o link do YouTube ou do Vimeo — o vídeo continua hospedado lá.
      </p>

      <Field
        label="Link do vídeo"
        hint="YouTube ou Vimeo"
        info={
          <InfoTip
            title="O que pode entrar no vídeo"
            align="left"
            label="Ajuda sobre o vídeo de apresentação"
            items={OAB_GUIDANCE_BY_FIELD.video}
          />
        }
      >
        <TextInput
          value={raw}
          disabled={preview}
          aria-invalid={badLink}
          onChange={(e) => set({ videoUrl: e.target.value })}
          placeholder={EXAMPLE}
        />
      </Field>
      {badLink && (
        <p className="-mt-2 text-[11.5px] leading-relaxed text-brass-deep">
          Não reconhecemos esse link. Use o endereço de um vídeo do YouTube
          (youtube.com/watch?v=… ou youtu.be/…) ou do Vimeo (vimeo.com/…).
        </p>
      )}

      {video && (
        <>
          <Field label="Legenda" hint={`${caption.length}/${VIDEO_CAPTION_MAX} · opcional`}>
            <TextInput
              value={caption}
              maxLength={VIDEO_CAPTION_MAX}
              disabled={preview}
              onChange={(e) => set({ videoCaption: e.target.value })}
              placeholder="Uma frase sobre o que a pessoa vai ver."
            />
          </Field>
          <MarginNotes issues={captionIssues} />

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Como vai aparecer
            </span>
            {/* `themed` + themeStyle: o player pinta com as variáveis do tema
                escolhido, então a prévia mostra a cor que o visitante vai ver, não
                um botão sem fundo. max-w para não ficar desproporcional na coluna
                larga do desktop — no perfil real ele acompanha a largura da página. */}
            <div className="themed max-w-sm rounded-xl2 p-3" style={themeStyle(profile.theme)}>
              <VideoPlayer video={video} caption={caption} name={profile.name} inert />
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-faint">
            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass-deep/70" />
            O conteúdo do vídeo é de sua responsabilidade: a plataforma revisa os textos do perfil,
            mas não consegue analisar imagem e áudio. Valem as mesmas regras — nada de resultados
            obtidos, casos de clientes ou convite a contratar.
          </p>
        </>
      )}
    </Card>
  )
}
