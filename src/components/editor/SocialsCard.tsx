import { useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import type { Profile, SocialKind, SocialLink } from '@/lib/types'
import { explicaNormalizacao, normalizeSocialUrl, validateSocialUrl } from '@/lib/socials'
import { Field, TextInput } from '@/components/editor/fields'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripIcon,
  socialMeta,
  TrashIcon,
} from '@/components/ui/icons'

// AS REDES DO PERFIL — quais são, o que cada uma aponta, e em que ORDEM aparecem.
//
// Antes eram seis campos fixos, um por rede, sempre visíveis e sempre na mesma
// sequência. Três coisas estavam erradas nisso:
//
// 1. Não havia ordem nenhuma para escolher. Pior: editar um link o mandava para o
//    FIM do array (`[...rest, { kind, url }]`), e o array É a ordem que o perfil
//    público desenha. A fileira de ícones se reorganizava sozinha conforme o
//    advogado mexia nos campos, sem que nada na tela sugerisse isso.
// 2. A ordem nem sobrevivia ao banco: `SocialLink` não tinha coluna `order` nem
//    `orderBy` na leitura (`areas` e `faqs` sempre tiveram), então o Postgres
//    devolvia as linhas na ordem que lhe conviesse.
// 3. Quem escrevia `@joaosilva` — que é como as pessoas guardam o próprio perfil
//    na cabeça — via "Endereço inválido", salvava assim mesmo, e o link SUMIA:
//    `safeUrl('@joao')` monta `https://@joao`, que não tem hostname, e o backend
//    descarta a linha. Sem erro, sem aviso, sem link.
//
// Agora as redes preenchidas são uma lista reordenável (arrasto e setas), as
// vazias ficam embaixo esperando, e o que a pessoa digita é interpretado ao sair
// do campo — ver lib/socials.ts.

const TODAS = Object.keys(socialMeta) as SocialKind[]

export function SocialsCard({
  profile,
  set,
}: {
  profile: Profile
  set: (patch: Partial<Profile>) => void
}) {
  const preenchidas = profile.socials.filter((s) => s.url.trim())
  const vazias = TODAS.filter((k) => !preenchidas.some((s) => s.kind === k))

  const trocar = (novas: SocialLink[]) => set({ socials: novas })

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= preenchidas.length) return
    const lista = [...preenchidas]
    const [item] = lista.splice(de, 1)
    lista.splice(para, 0, item)
    trocar(lista)
  }

  const alterar = (kind: SocialKind, url: string) =>
    trocar(preenchidas.map((s) => (s.kind === kind ? { ...s, url } : s)))

  const remover = (kind: SocialKind) => trocar(preenchidas.filter((s) => s.kind !== kind))

  // Rede nova entra no FIM: é onde a pessoa espera ver o que acabou de escrever,
  // e mexer na posição das outras por conta própria desfaria o arrasto dela.
  const adicionar = (kind: SocialKind, url: string) => trocar([...preenchidas, { kind, url }])

  return (
    <>
      {preenchidas.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] text-ink-faint">
            {preenchidas.length > 1
              ? 'Arraste para mudar a ordem em que aparecem no seu perfil.'
              : 'Esta rede aparece no seu perfil.'}
          </p>
          <Reorder.Group axis="y" values={preenchidas} onReorder={trocar} className="space-y-2">
            {preenchidas.map((s, i) => (
              <ItemArrastavel
                key={s.kind}
                social={s}
                posicao={i}
                total={preenchidas.length}
                onChange={(url) => alterar(s.kind, url)}
                onRemove={() => remover(s.kind)}
                onMover={(delta) => mover(i, i + delta)}
              />
            ))}
          </Reorder.Group>
        </div>
      )}

      {vazias.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] text-ink-faint">
            {preenchidas.length > 0 ? 'Adicionar outra rede' : 'Onde as pessoas podem te encontrar'}
          </p>
          <div className="grid gap-3">
            {vazias.map((kind) => (
              <CampoVazio key={kind} kind={kind} onPreencher={(url) => adicionar(kind, url)} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function ItemArrastavel({
  social,
  posicao,
  total,
  onChange,
  onRemove,
  onMover,
}: {
  social: SocialLink
  posicao: number
  total: number
  onChange: (url: string) => void
  onRemove: () => void
  onMover: (delta: -1 | 1) => void
}) {
  // O arrasto sai da PEGA, não da linha inteira: com a linha toda arrastável,
  // tentar posicionar o cursor dentro do campo de texto no celular vira um
  // arrasto, e o link fica impossível de corrigir.
  const controls = useDragControls()
  const meta = socialMeta[social.kind]
  const Icon = meta.Icon
  const campo = useCampoDeRede(social.kind, social.url, onChange)

  return (
    <Reorder.Item
      value={social}
      dragListener={false}
      dragControls={controls}
      className="rounded-lg border border-ink/10 bg-paper-soft/50 p-2.5"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          // `touch-none` impede o navegador de rolar a página quando o dedo desce
          // sobre a pega — sem isso o arrasto compete com a rolagem e perde.
          className="shrink-0 cursor-grab touch-none rounded p-1 text-ink-faint hover:bg-ink/[0.06] active:cursor-grabbing"
          aria-label={`Arrastar ${meta.label} para reordenar`}
        >
          <GripIcon width={18} height={18} />
        </button>

        <Icon
          width={20}
          height={20}
          className="shrink-0"
          style={meta.color ? { color: meta.color } : undefined}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <TextInput
            value={campo.texto}
            onChange={(e) => campo.digitar(e.target.value)}
            onBlur={campo.sair}
            aria-invalid={!!campo.erro}
            aria-label={meta.label}
            placeholder={placeholderDe(social.kind)}
            className="!py-1.5 text-[13px]"
          />
        </div>

        {/* O mesmo reordenar, pelo teclado. Arrasto não é alcançável por quem
            navega com Tab — e é a única forma de reordenar que existia. */}
        <div className="flex shrink-0 flex-col">
          <BotaoMover
            dir="cima"
            disabled={posicao === 0}
            onClick={() => onMover(-1)}
            label={`Mover ${meta.label} para cima`}
          />
          <BotaoMover
            dir="baixo"
            disabled={posicao === total - 1}
            onClick={() => onMover(1)}
            label={`Mover ${meta.label} para baixo`}
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-ink-faint hover:bg-burgundy/10 hover:text-burgundy"
          aria-label={`Remover ${meta.label}`}
        >
          <TrashIcon width={16} height={16} />
        </button>
      </div>

      {/* A conferência de rede é feita sobre o valor ATUAL, a cada desenho — não
          só depois de uma edição. Assim ela também alcança o que já estava
          gravado antes desta tela existir: um link do Instagram no campo do
          LinkedIn ficava lá, calado, e quem descobria era o cliente que clicou no
          ícone do LinkedIn e caiu no Instagram. */}
      <Recado aviso={campo.aviso} erro={campo.erro} conferencia={confere(social)} />
    </Reorder.Item>
  )
}

function CampoVazio({
  kind,
  onPreencher,
}: {
  kind: SocialKind
  onPreencher: (url: string) => void
}) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  return (
    <Field label={socialMeta[kind].label}>
      <TextInput
        value={texto}
        placeholder={placeholderDe(kind)}
        aria-invalid={!!erro}
        onChange={(e) => {
          setTexto(e.target.value)
          if (erro) setErro(null)
        }}
        onBlur={() => {
          const r = normalizeSocialUrl(kind, texto)
          if (r.error) return setErro(r.error)
          if (!r.url) return
          // Some daqui e reaparece na lista de cima, já na ordem gravada.
          setTexto('')
          setErro(null)
          onPreencher(r.url)
        }}
      />
      {erro && <p className="mt-1 text-[11.5px] leading-relaxed text-burgundy">{erro}</p>}
    </Field>
  )
}

/**
 * O ciclo de um campo de rede: digita livre, e ao SAIR o texto é interpretado.
 *
 * Interpretar a cada tecla faria o cursor pular e transformaria `i` em
 * `https://instagram.com/i` antes da pessoa terminar a palavra.
 */
function useCampoDeRede(kind: SocialKind, url: string, onChange: (url: string) => void) {
  // `rascunho` é o que está sendo digitado; `null` significa "nada em edição, o
  // valor é o gravado". Sem essa distinção, um campo vazio recém-normalizado
  // voltaria a mostrar o texto antigo.
  const [rascunho, setRascunho] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  return {
    texto: rascunho ?? url,
    erro,
    aviso,
    digitar: (v: string) => {
      setRascunho(v)
      setErro(null)
      setAviso(null)
    },
    sair: () => {
      if (rascunho === null) return
      const r = normalizeSocialUrl(kind, rascunho)
      if (r.error) {
        // O rascunho FICA na tela: apagar o que a pessoa escreveu junto com a
        // mensagem de erro a deixaria sem saber o que corrigir.
        setErro(r.error)
        return
      }
      setRascunho(null)
      setAviso(explicaNormalizacao(rascunho, r.url))
      onChange(r.url)
    },
  }
}

function BotaoMover({
  dir,
  disabled,
  onClick,
  label,
}: {
  dir: 'cima' | 'baixo'
  disabled: boolean
  onClick: () => void
  label: string
}) {
  const Icon = dir === 'cima' ? ArrowUpIcon : ArrowDownIcon
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded px-1 text-ink-faint hover:bg-ink/[0.06] disabled:opacity-25 disabled:hover:bg-transparent"
    >
      <Icon width={13} height={13} />
    </button>
  )
}

/** O link aponta para a rede que diz apontar? Vale para o valor já gravado. */
function confere(social: SocialLink): string | null {
  const r = validateSocialUrl(social.kind, social.url)
  return r.status === 'mismatch' || r.status === 'invalid' ? (r.message ?? null) : null
}

/**
 * Uma linha só embaixo do campo, e três coisas disputando o lugar. A ordem é a
 * da urgência: o que impede de gravar, o que está gravado mas provavelmente
 * errado, e por último o que foi corrigido sozinho.
 */
function Recado({
  aviso,
  erro,
  conferencia,
}: {
  aviso: string | null
  erro: string | null
  conferencia: string | null
}) {
  const linha = 'mt-1.5 pl-[3.25rem] text-[11.5px] leading-relaxed'
  // Não deu para entender o que foi digitado: nada foi gravado.
  if (erro) return <p className={`${linha} text-burgundy`}>{erro}</p>
  // Gravado, mas o link é de outra rede. Aviso, não impedimento: o link funciona,
  // e a decisão é do advogado — talvez ele saiba de algo que a regra não sabe.
  if (conferencia) return <p className={`${linha} text-brass-deep`}>{conferencia}</p>
  // O campo mudou sozinho debaixo da pessoa. Dizer o que foi entendido é a
  // diferença entre um produto prestativo e um que parece ter um bug.
  if (aviso) return <p className={`${linha} text-ink-faint`}>{aviso}</p>
  return null
}

/** Mostra o formato mais curto que funciona — é o que convida a escrever. */
function placeholderDe(kind: SocialKind): string {
  if (kind === 'website') return 'seusite.com.br'
  if (kind === 'linkedin') return '@seu-usuario  ou  linkedin.com/in/…'
  return '@seuusuario'
}

