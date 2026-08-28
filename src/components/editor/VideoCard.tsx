import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import type { Profile } from '@/lib/types'
import { checkCompliance, OAB_GUIDANCE_BY_FIELD } from '@/lib/oab'
import {
  orientacaoDoVideo,
  parseVideoUrl,
  VIDEO_CAPTION_MAX,
  type ParsedVideo,
  type VideoOrientation,
} from '@/lib/video'
import { themeStyle } from '@/lib/themes'
import { VideoPlayer } from '@/components/profile/VideoPlayer'
import { Card, Field, TextInput } from './fields'
import { InfoTip } from './InfoTip'
import { MarginNotes } from './MarginNotes'
import { ChevronDown, ExternalLinkIcon, PlayIcon } from '@/components/ui/icons'

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
        <span className="font-medium text-ink-soft"> Não é upload:</span> o vídeo fica no
        <span className="font-medium text-ink-soft"> YouTube</span> (ou no Vimeo) e aqui você cola o
        link. Assim ele não pesa no seu perfil e continua seu, na sua conta.
      </p>

      {!preview && <ComoFazer />}

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

          <EscolhaDeFormato
            video={video}
            escolha={profile.videoOrientation ?? 'auto'}
            disabled={preview}
            onChange={(videoOrientation) => set({ videoOrientation })}
          />

          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">
              Como vai aparecer
            </span>
            {/* `themed` + themeStyle: o player pinta com as variáveis do tema
                escolhido, então a prévia mostra a cor que o visitante vai ver, não
                um botão sem fundo. max-w para não ficar desproporcional na coluna
                larga do desktop — no perfil real ele acompanha a largura da página. */}
            <div className="themed max-w-sm rounded-xl2 p-3" style={themeStyle(profile.theme)}>
              <VideoPlayer
                video={video}
                caption={caption}
                name={profile.name}
                orientation={profile.videoOrientation}
                inert
              />
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

// Passo a passo de quem NUNCA subiu vídeo. Fica dentro do próprio card, aberto
// por um clique — a dúvida aparece aqui, a resposta tem de aparecer aqui também.
//
// O passo da VISIBILIDADE é o motivo de este texto existir: "Não listado" toca
// normalmente no perfil, "Privado" NÃO toca. Quem escolhe privado acha que
// escondeu o vídeo do YouTube e na verdade quebrou o próprio perfil — e não tem
// como descobrir isso sozinho.
function ComoFazer() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-brass/30 bg-brass/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brass/20 text-brass-deep">
          <PlayIcon width={13} height={13} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-brass-deep">
            Nunca subiu um vídeo? Veja como
          </span>
          <span className="block text-[11.5px] leading-snug text-ink-faint">
            Em 5 passos, do celular ao link colado aqui.
          </span>
        </span>
        <ChevronDown
          width={16}
          height={16}
          className={`shrink-0 text-brass-deep transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {/* Sem animar height: ver o comentário no FaqItem (ProfileView). Abrir e
          fechar tem de ser instantâneo, não uma medição por quadro. */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
            <ol className="space-y-3 border-t border-brass/25 px-3.5 py-3.5">
              <Passo n={1} titulo="Grave no celular mesmo">
                Um a dois minutos bastam. Luz na frente do rosto (janela serve), celular apoiado, e
                fale como falaria na primeira conversa: quem você é, onde atua e como trabalha.
              </Passo>
              <Passo n={2} titulo="Envie para o YouTube">
                No computador, abra{' '}
                <a
                  href="https://www.youtube.com/upload"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-semibold text-burgundy underline underline-offset-2"
                >
                  youtube.com/upload
                  <ExternalLinkIcon width={11} height={11} />
                </a>{' '}
                e entre com a sua conta Google. No celular: app do YouTube → <b>+ Criar</b> →{' '}
                <b>Enviar vídeo</b>. É gratuito.
              </Passo>
              <Passo n={3} titulo="Dê um título simples">
                “Apresentação — seu nome, advogado(a) em sua cidade”. Sem promessa de resultado, sem
                “o melhor”: valem as mesmas regras do resto do perfil.
              </Passo>
              <Passo n={4} titulo="Escolha “Não listado” na visibilidade">
                <b>Não listado</b> = só quem tem o link vê, e ele funciona normalmente aqui no seu
                perfil — é a escolha mais comum. <b>Público</b> também funciona (aparece nas buscas
                do YouTube).{' '}
                <span className="font-semibold text-burgundy-deep">
                  Não escolha “Privado”: o vídeo deixa de tocar no seu perfil.
                </span>
              </Passo>
              <Passo n={5} titulo="Copie o link e cole aqui em cima">
                No vídeo publicado, clique em <b>Compartilhar</b> e copie o endereço (fica parecido
                com <span className="whitespace-nowrap font-mono text-[11.5px]">youtu.be/AbC123</span>).
                Cole no campo acima — a prévia aparece na hora.
              </Passo>
            </ol>
            <p className="border-t border-brass/25 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-faint">
              Prefere o Vimeo? Funciona igual: envie por lá e cole o link{' '}
              <span className="whitespace-nowrap font-mono text-[11.5px]">vimeo.com/123456789</span>.
            </p>
        </motion.div>
      )}
    </div>
  )
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass/25 text-[11px] font-bold tabular-nums text-brass-deep">
        {n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-ink">{titulo}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-soft">{children}</span>
      </span>
    </li>
  )
}

/**
 * Deitado ou em pé — e por que a pergunta existe.
 *
 * O quadro do vídeo era fixo em 16:9. Quem gravasse em pé (que é como quase todo
 * mundo grava hoje) via o próprio vídeo minúsculo entre duas tarjas pretas.
 *
 * Metade do problema o sistema resolve sozinho: um Short do YouTube é vertical
 * por definição, e a URL diz isso. A outra metade não tem como saber — um vídeo
 * gravado em pé e publicado como vídeo COMUM, ou qualquer vídeo do Vimeo, só
 * entregaria a proporção se perguntássemos ao provedor (oEmbed), e este produto
 * não faz o navegador de quem visita conversar com terceiros para montar a
 * página. Um toque do advogado custa menos e acerta sempre.
 *
 * Por isso "Automático" é a opção padrão e vem primeiro, dizendo o que deduziu:
 * na maioria dos casos não há nada a fazer, e a escolha manual existe para quando
 * a dedução erra.
 */
function EscolhaDeFormato({
  video,
  escolha,
  disabled,
  onChange,
}: {
  video: ParsedVideo
  escolha: VideoOrientation
  disabled?: boolean
  onChange: (v: VideoOrientation) => void
}) {
  const rotuloId = useId()
  const deduzido = orientacaoDoVideo(video, 'auto')
  const opcoes: { valor: VideoOrientation; rotulo: string; forma: string }[] = [
    { valor: 'auto', rotulo: 'Automático', forma: '16 / 10' },
    { valor: 'horizontal', rotulo: 'Deitado', forma: '16 / 9' },
    { valor: 'vertical', rotulo: 'Em pé', forma: '9 / 16' },
  ]

  // NÃO usa `Field`: ele envolve o conteúdo num <label>, e um rótulo de campo
  // aponta para UM controle. Envolvendo três botões, o leitor de tela anunciava
  // "Formato do vídeo, reconhecido: em pé" ao chegar no primeiro deles, em vez de
  // "Automático" — o nome do grupo comendo o nome da opção. Isto é um grupo de
  // botões, e a marcação certa é `role="group"` com rótulo próprio.
  return (
    <div>
      <span className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2">
        <span id={rotuloId} className="text-[13px] font-semibold text-ink">
          Formato do vídeo
        </span>
        {escolha === 'auto' && (
          <span className="shrink-0 text-[11px] text-ink-faint">
            reconhecido: {deduzido === 'vertical' ? 'em pé' : 'deitado'}
          </span>
        )}
      </span>
      <div className="flex gap-2" role="group" aria-labelledby={rotuloId}>
        {opcoes.map((o) => {
          const ativo = escolha === o.valor
          return (
            <button
              key={o.valor}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.valor)}
              aria-pressed={ativo}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-[12px] transition-colors disabled:opacity-50 ${
                ativo
                  ? 'border-brass bg-brass/10 font-semibold text-ink'
                  : 'border-ink/12 text-ink-soft hover:border-brass/40'
              }`}
            >
              {/* O desenho da proporção diz o que a palavra levaria uma frase para
                  explicar — e é o que a pessoa está de fato escolhendo. */}
              <span
                aria-hidden
                className={`w-9 rounded-[3px] border-2 ${ativo ? 'border-brass-deep' : 'border-ink/25'}`}
                style={{
                  aspectRatio: o.forma,
                  // "Automático" não tem forma própria: mostra a que foi deduzida.
                  ...(o.valor === 'auto' && deduzido === 'vertical'
                    ? { aspectRatio: '9 / 16', width: '1.35rem' }
                    : null),
                }}
              />
              {o.rotulo}
            </button>
          )
        })}
      </div>
    </div>
  )
}
