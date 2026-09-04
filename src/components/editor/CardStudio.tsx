import { useMemo, useState } from 'react'
import type { Profile } from '@/lib/types'
import {
  CARD_TAGLINE_MAX,
  CARD_TEMPLATES,
  DEFAULT_CARD,
  renderCard,
  resolveCard,
  type CardConfig,
  type CardSide,
  type CardTemplate,
} from '@/lib/cardArt'
import { baixarPng, baixarSvg, imprimirFolha } from '@/lib/cardExport'
import { checkCompliance } from '@/lib/oab'
import { Card, Field, TextInput, Toggle } from './fields'
import { CardStage } from './CardStage'
import { MarginNotes } from './MarginNotes'

// Cartão de visita: o advogado vê o cartão dele em tamanho real, mexe no que
// aparece e leva o arquivo para a gráfica.
//
// A prévia é o MESMO SVG que vai para o papel (lib/cardArt.ts) — não é uma
// imitação em HTML. O que ele vê é literalmente o arquivo que será impresso.
// Ela fica em CardStage.tsx: um cartão que gira na mão, com frente e verso de
// costas um para o outro, guias de corte e tamanho real.
//
// Sobre a conformidade: o cartão não ganha regra nova. A linha livre entra em
// publicTexts() e é conferida igual ao resto do perfil; um apontamento de
// bloqueio impede baixar a arte. O resto do conteúdo vem do perfil já conferido.

type Estado = { tipo: 'ocioso' } | { tipo: 'ocupado' } | { tipo: 'aviso'; texto: string }

export function CardStudio({
  profile,
  set,
  preview = false,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
  /** modo vitrine (sob o cadeado do Free/Pro): nada é salvo nem baixado */
  preview?: boolean
}) {
  const card = useMemo(() => resolveCard(profile.card), [profile.card])
  // A face que está de frente no palco — é ela que o PNG e o SVG levam.
  const [side, setSide] = useState<CardSide>('frente')
  const [estado, setEstado] = useState<Estado>({ tipo: 'ocioso' })

  const apontamentos = useMemo(() => checkCompliance(card.tagline), [card.tagline])
  const bloqueado = apontamentos.some((i) => i.severity === 'block')

  const mexer = (patch: Partial<CardConfig>) => {
    if (preview) return
    set({ card: { ...card, ...patch } })
  }

  /** Roda a geração de um arquivo. O retorno, quando vem, é um aviso a mostrar. */
  async function tentar(fn: () => Promise<string | void> | string | void) {
    if (preview || bloqueado) return
    setEstado({ tipo: 'ocupado' })
    try {
      const aviso = await fn()
      setEstado(aviso ? { tipo: 'aviso', texto: aviso } : { tipo: 'ocioso' })
    } catch (e) {
      setEstado({
        tipo: 'aviso',
        texto: e instanceof Error ? e.message : 'Não foi possível gerar o arquivo agora.',
      })
    }
  }

  const ocupado = estado.tipo === 'ocupado'

  return (
    <div className="space-y-5">
      <Card title="Seu cartão">
        <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
          O cartão usa o mesmo visual do seu perfil. Gire para conferir frente e verso, escolha o
          modelo e leve o arquivo para a gráfica de sua preferência.
        </p>

        <CardStage profile={profile} card={card} onSide={setSide} />
      </Card>

      <Card title="Modelo">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CARD_TEMPLATES.map((t) => (
            <ModeloBotao
              key={t.id}
              profile={profile}
              card={card}
              id={t.id}
              nome={t.name}
              blurb={t.blurb}
              ativo={card.template === t.id}
              onPick={() => mexer({ template: t.id })}
            />
          ))}
        </div>
      </Card>

      <Card title="O que aparece">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle checked={card.showWhatsapp} onChange={(v) => mexer({ showWhatsapp: v })} label="Telefone" />
          <Toggle checked={card.showEmail} onChange={(v) => mexer({ showEmail: v })} label="E-mail" />
          <Toggle checked={card.showCity} onChange={(v) => mexer({ showCity: v })} label="Cidade e estado" />
          <Toggle checked={card.showAddress} onChange={(v) => mexer({ showAddress: v })} label="Endereço" />
          <Toggle checked={card.showAreas} onChange={(v) => mexer({ showAreas: v })} label="Áreas de atuação" />
          <Toggle checked={card.showPhoto} onChange={(v) => mexer({ showPhoto: v })} label="Sua foto" />
          <Toggle checked={card.showQr} onChange={(v) => mexer({ showQr: v })} label="QR do perfil no verso" />
        </div>

        <Field
          label="Linha livre"
          hint={`${card.tagline.length}/${CARD_TAGLINE_MAX}`}
        >
          <TextInput
            value={card.tagline}
            maxLength={CARD_TAGLINE_MAX}
            onChange={(e) => mexer({ tagline: e.target.value })}
            placeholder="Ex.: Direito de Família e Sucessões"
          />
        </Field>
        <p className="-mt-2 text-[11.5px] leading-relaxed text-ink-faint">
          Fica sob o nome, no lugar das áreas. Sem esta linha, o cartão mostra as suas áreas.
        </p>

        <MarginNotes issues={apontamentos} />
      </Card>

      <Card title="Levar para a gráfica">
        <p className="-mt-1 text-[12.5px] leading-relaxed text-ink-faint">
          O PDF é o arquivo que a gráfica prefere: sai em tamanho exato, com as marcas de corte e a
          ficha técnica na própria folha. O PNG e o SVG ficam de reserva.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={preview || bloqueado || ocupado}
            onClick={() => void tentar(() => imprimirFolha(profile, card))}
            className="btn-primary flex-1 !py-2.5 !text-[13.5px] disabled:opacity-50"
          >
            Baixar PDF da gráfica
          </button>
          <button
            type="button"
            disabled={preview || bloqueado || ocupado}
            onClick={() =>
              void tentar(async () => {
                const comFonte = await baixarPng(profile, card, side)
                // Sem rede para buscar a fonte original, o PNG sai com a de
                // reserva — a prévia teria mentido, então dizemos isso.
                return comFonte
                  ? undefined
                  : 'A imagem saiu com uma fonte de reserva (não deu para baixar a original). Para ficar idêntico à prévia, use o PDF.'
              })
            }
            className="btn-ghost flex-1 !py-2.5 !text-[13px] disabled:opacity-50"
          >
            PNG 300 dpi ({side})
          </button>
          <button
            type="button"
            disabled={preview || bloqueado || ocupado}
            onClick={() => void tentar(() => baixarSvg(profile, card, side))}
            className="btn-ghost flex-1 !py-2.5 !text-[13px] disabled:opacity-50"
          >
            SVG ({side})
          </button>
        </div>

        <span className="sr-only" aria-live="polite">
          {ocupado ? 'Gerando o arquivo do cartão' : ''}
        </span>

        {estado.tipo === 'aviso' && (
          <p className="rounded-lg border border-brass/30 bg-brass/[0.06] px-3 py-2 text-[12px] leading-relaxed text-brass-deep">
            {estado.texto}
          </p>
        )}

        {bloqueado && (
          <p className="rounded-lg border border-burgundy/30 bg-burgundy/[0.06] px-3 py-2 text-[12px] leading-relaxed text-burgundy">
            Ajuste a linha livre acima para liberar o arquivo.
          </p>
        )}

        {/* Cartão é para entregar a quem pede o seu contato — não é material de
            distribuição em massa (Prov. 205/2021, Art. 3º, V). A frase abaixo diz
            isso sem citar norma nenhuma: conformidade invisível. */}
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          Feito para entregar em mãos — numa audiência, no escritório, a quem pediu o seu contato.
        </p>
      </Card>
    </div>
  )
}

/** Miniatura de um modelo: o cartão real, pequeno. Nada de ícone abstrato. */
function ModeloBotao({
  profile,
  card,
  id,
  nome,
  blurb,
  ativo,
  onPick,
}: {
  profile: Profile
  card: CardConfig
  id: CardTemplate
  nome: string
  blurb: string
  ativo: boolean
  onPick: () => void
}) {
  const svg = useMemo(
    () => renderCard(profile, { ...card, template: id }, 'frente', { sangria: false }),
    [profile, card, id],
  )
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={ativo}
      className={`rounded-lg border p-2 text-left transition-colors ${
        ativo ? 'border-burgundy bg-burgundy/[0.04]' : 'border-ink/12 hover:border-ink/25'
      }`}
    >
      <span
        className="block w-full overflow-hidden rounded-[3px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span className="mt-2 block text-[12.5px] font-semibold text-ink">{nome}</span>
      <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{blurb}</span>
    </button>
  )
}

/** Cartão de exemplo usado sob o cadeado — nunca é salvo em perfil nenhum. */
export const CARD_PREVIEW: CardConfig = { ...DEFAULT_CARD, template: 'razao', showAreas: true }
