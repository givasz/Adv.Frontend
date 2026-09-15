import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import {
  DEFAULT_STORY,
  STORY_TEMPLATES,
  medirAproximado,
  renderStory,
  type Medidor,
  type StoryConfig,
} from '@/lib/storyArt'
import {
  compartilharStory,
  navegadorDeAplicativo,
  nomeDoStory,
  podeCompartilharImagem,
  prepararMedidor,
  storyPng,
} from '@/lib/storyExport'
import { downloadFile } from '@/lib/vcard'
import { copiarTexto } from '@/lib/copiar'
import { profileUrl, profileUrlLabel } from '@/lib/publicUrl'
import { editorPath } from '@/lib/editorSections'
import { Card, Toggle } from './fields'
import { CheckIcon, CopyIcon, ShareIcon } from '@/components/ui/icons'

// Story do perfil: a imagem pronta para os stories do Instagram, o status do
// WhatsApp ou qualquer rede que o celular ofereça.
//
// A prévia é o MESMO SVG que vira o PNG (lib/storyArt.ts). A configuração não é
// salva no perfil de propósito: é uma peça do dia, e guardar exigiria coluna nova
// no banco para uma escolha que se refaz em dois toques.
//
// O PNG é gerado ANTES do toque em "Compartilhar": a folha de compartilhar do
// celular só abre com o gesto ainda fresco, e gerar a imagem leva alguns
// décimos de segundo — o bastante para o iPhone recusar.
//
// Usado em dois lugares: a seção do editor (completo) e a página de
// compartilhar do perfil (`compacto`), que serve ao dono e a quem visita.

type Estado = { tipo: 'ocioso' } | { tipo: 'gerando' } | { tipo: 'aviso'; texto: string }
type Pronto = { chave: string; blob: Blob; comFonte: boolean }

export function StoryStudio({ profile, compacto = false }: { profile: Profile; compacto?: boolean }) {
  const [config, setConfig] = useState<StoryConfig>(DEFAULT_STORY)
  const [medir, setMedir] = useState<Medidor>(() => medirAproximado)
  const [pronto, setPronto] = useState<Pronto | null>(null)
  const [estado, setEstado] = useState<Estado>({ tipo: 'ocioso' })
  const [copiado, setCopiado] = useState(false)
  const compartilha = useMemo(podeCompartilharImagem, [])
  const deAplicativo = useMemo(navegadorDeAplicativo, [])

  // A inscrição acompanha toda divulgação do advogado — sem ela, não sai imagem.
  const semOab = !profile.oabNumber?.trim()

  // Tudo o que muda o desenho. Serve para saber se o PNG já gerado ainda vale.
  const chave = JSON.stringify([
    config,
    profile.name,
    profile.oabNumber,
    profile.headline,
    (profile.areas ?? []).map((a) => a.label),
    profile.city,
    profile.state,
    profile.theme,
    profile.branding?.accent,
    profile.slug,
    profile.plan,
    profile.avatarUrl?.length,
    profile.avatarUrl?.slice(-48),
  ])

  // A métrica real da fonte do tema: sem ela o nome quebraria numa largura na
  // prévia e em outra no arquivo.
  useEffect(() => {
    let vivo = true
    void prepararMedidor(profile).then((m) => vivo && setMedir(() => m))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.theme])

  useEffect(() => {
    if (semOab) return
    let vivo = true
    const t = setTimeout(() => {
      storyPng(profile, config)
        .then((r) => vivo && setPronto({ chave, ...r }))
        .catch(() => {})
    }, 600)
    return () => {
      vivo = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, semOab])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const svg = useMemo(() => renderStory(profile, config, { medir }), [chave, medir])

  async function arquivo(): Promise<Pronto> {
    if (pronto?.chave === chave) return pronto
    const novo = { chave, ...(await storyPng(profile, config)) }
    setPronto(novo)
    return novo
  }

  async function entregar(modo: 'compartilhar' | 'baixar') {
    if (semOab || estado.tipo === 'gerando') return
    setEstado({ tipo: 'gerando' })
    try {
      const a = await arquivo()
      const nome = nomeDoStory(profile)
      if (modo === 'baixar') downloadFile(a.blob, nome)
      else if ((await compartilharStory(a.blob, nome)) === 'sem-gesto') {
        setEstado({ tipo: 'aviso', texto: 'A imagem ficou pronta. Toque de novo em “Compartilhar story”.' })
        return
      }
      setEstado(
        a.comFonte
          ? { tipo: 'ocioso' }
          : {
              tipo: 'aviso',
              texto: 'A imagem saiu com uma fonte de reserva — não deu para baixar a original agora. Com a internet estável, gere de novo.',
            },
      )
    } catch (e) {
      setEstado({ tipo: 'aviso', texto: e instanceof Error ? e.message : 'Não foi possível gerar a imagem agora.' })
    }
  }

  async function copiar() {
    if (!(await copiarTexto(profileUrl(profile.slug)))) return
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1600)
  }

  const mexer = (patch: Partial<StoryConfig>) => setConfig((c) => ({ ...c, ...patch }))
  const gerando = estado.tipo === 'gerando'

  const previa = (largura: string) => (
    <div
      className={`mx-auto w-full ${largura} overflow-hidden rounded-[18px] border border-ink/10 shadow-card [&>svg]:block [&>svg]:h-auto [&>svg]:w-full`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )

  const acoes = (
    <div className="space-y-3">
      {semOab && (
        <p className="rounded-lg border border-burgundy/30 bg-burgundy/[0.06] px-3 py-2 text-[12.5px] leading-relaxed text-burgundy">
          O número da OAB acompanha toda divulgação.{' '}
          {compacto ? (
            'Este perfil ainda não tem o número, então a imagem não é gerada.'
          ) : (
            <>
              <Link to={editorPath('identidade', 'oab')} className="font-semibold underline underline-offset-2">
                Preencha a inscrição
              </Link>{' '}
              para liberar a imagem.
            </>
          )}
        </p>
      )}

      <ol className="space-y-3">
        <Passo n={1} texto="Copie o endereço do perfil — é ele que vai na figurinha de link.">
          <button type="button" onClick={copiar} className="btn-ghost w-full !py-2 !text-[13px] sm:w-auto">
            {copiado ? <CheckIcon width={14} height={14} strokeWidth={2.4} /> : <CopyIcon width={14} height={14} />}
            <span className="truncate">{copiado ? 'Endereço copiado' : profileUrlLabel(profile.slug)}</span>
          </button>
        </Passo>
        <Passo
          n={2}
          texto={
            compartilha
              ? 'Compartilhe a imagem e escolha o Instagram (Stories) ou o WhatsApp (Status).'
              : 'Baixe a imagem e passe para o celular — o story se posta de lá.'
          }
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={semOab || gerando}
              onClick={() => void entregar(compartilha ? 'compartilhar' : 'baixar')}
              className="btn-primary !py-2.5 !text-[13.5px] disabled:opacity-50"
            >
              {/* O ícone de compartilhar só onde o botão compartilha: no
                  computador ele baixa, e o desenho prometeria outra coisa. */}
              {compartilha && <ShareIcon width={15} height={15} />}
              {gerando ? 'Preparando a imagem…' : compartilha ? 'Compartilhar story' : 'Baixar imagem'}
            </button>
            {compartilha && (
              <button
                type="button"
                disabled={semOab || gerando}
                onClick={() => void entregar('baixar')}
                className="btn-ghost !py-2.5 !text-[13px] disabled:opacity-50"
              >
                Só baixar
              </button>
            )}
          </div>
        </Passo>
        <Passo n={3} texto="No Instagram, toque na figurinha Link e cole o endereço: quem vê o story chega ao perfil com um toque." />
      </ol>

      <span className="sr-only" aria-live="polite">
        {gerando ? 'Preparando a imagem do story' : ''}
      </span>

      {estado.tipo === 'aviso' && (
        <p role="status" className="rounded-lg border border-brass/30 bg-brass/[0.06] px-3 py-2 text-[12px] leading-relaxed text-brass-deep">
          {estado.texto}
        </p>
      )}

      {deAplicativo && (
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          Você está no navegador de um aplicativo, que costuma não entregar imagens. Abra esta página no Safari ou no Chrome.
        </p>
      )}
    </div>
  )

  if (compacto) {
    return (
      <section className="rounded-xl2 border border-ink/10 bg-paper p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink">Story pronto</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-faint">
          Uma imagem do perfil para os stories do Instagram ou o status do WhatsApp.
        </p>
        <div className="mt-4 grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] items-start gap-4">
          {previa('max-w-[140px]')}
          <div className="space-y-2" role="radiogroup" aria-label="Modelo do story">
            {STORY_TEMPLATES.map((t) => (
              <ModeloChip key={t.id} nome={t.name} ativo={config.template === t.id} onPick={() => mexer({ template: t.id })} />
            ))}
          </div>
        </div>
        <div className="mt-5">{acoes}</div>
      </section>
    )
  }

  const ativo = STORY_TEMPLATES.find((t) => t.id === config.template)

  return (
    <div className="space-y-5">
      <Card title="Seu story">
        <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
          Uma imagem no formato dos stories, com o visual do seu perfil. Nome e número da OAB saem sempre.
        </p>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-start">
          {previa('max-w-[240px]')}
          <div className="min-w-0 space-y-5">
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink">Modelo</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Modelo do story">
                {STORY_TEMPLATES.map((t) => (
                  <ModeloMiniatura
                    key={t.id}
                    svg={renderStory(profile, { ...config, template: t.id }, { medir })}
                    nome={t.name}
                    ativo={config.template === t.id}
                    onPick={() => mexer({ template: t.id })}
                  />
                ))}
              </div>
              {ativo && <p className="mt-2 text-[11.5px] leading-snug text-ink-faint">{ativo.blurb}</p>}
            </div>
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink">O que aparece</p>
              <div className="grid grid-cols-1 gap-3">
                <Toggle checked={config.showPhoto} onChange={(v) => mexer({ showPhoto: v })} label="Sua foto" />
                <Toggle checked={config.showHeadline} onChange={(v) => mexer({ showHeadline: v })} label="Frase de apresentação" />
                <Toggle checked={config.showAreas} onChange={(v) => mexer({ showAreas: v })} label="Áreas de atuação" />
                <Toggle checked={config.showCity} onChange={(v) => mexer({ showCity: v })} label="Cidade e estado" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Postar">
        {acoes}
        {/* A peça segue as regras de divulgação sem citar nenhuma: só quem é o
            profissional e onde encontrá-lo. */}
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          Sóbrio de propósito: nome, inscrição, áreas e o endereço do perfil — sem preço, sem promessa e sem convite a contratar.
        </p>
      </Card>
    </div>
  )
}

function Passo({ n, texto, children }: { n: number; texto: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brass/40 text-[12px] font-semibold text-brass-deep"
        aria-hidden
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[13px] leading-relaxed text-ink-soft">{texto}</p>
        {children}
      </div>
    </li>
  )
}

function ModeloMiniatura({ svg, nome, ativo, onPick }: { svg: string; nome: string; ativo: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onPick}
      className={`rounded-lg border p-1.5 text-left transition-colors ${
        ativo ? 'border-burgundy bg-burgundy/[0.04]' : 'border-ink/12 hover:border-ink/25'
      }`}
    >
      <span
        className="block overflow-hidden rounded-[6px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span className="mt-1.5 block text-center text-[12px] font-semibold text-ink">{nome}</span>
    </button>
  )
}

function ModeloChip({ nome, ativo, onPick }: { nome: string; ativo: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onPick}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
        ativo ? 'border-burgundy bg-burgundy/[0.05] text-ink' : 'border-ink/12 text-ink-soft hover:border-ink/25'
      }`}
    >
      {nome}
      {ativo && <CheckIcon width={14} height={14} strokeWidth={2.4} className="text-burgundy" aria-hidden />}
    </button>
  )
}
