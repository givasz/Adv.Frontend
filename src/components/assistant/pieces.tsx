import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckIcon } from '@/components/ui/icons'
import { formatarData, tetoDaResposta, type PerguntaDeTriagem } from '@/lib/triagem'

// Vocabulário visual da conversa guiada, compartilhado pelos dois assistentes
// (perfil individual e escritório). Saiu de AssistantChat.tsx quando o escritório
// ganhou o seu: o roteiro de cada um é diferente, mas balão, "digitando…", chip,
// campo e resumo são a mesma conversa — duplicá-los seria deixá-los divergir.
//
// Tudo aqui se pinta pelas variáveis --c-* do tema (ver lib/themes.ts). Quem usa
// fora do sistema de temas — a página do escritório — declara essas mesmas
// variáveis no contêiner.

export function Bubble({
  from,
  text,
  reduced,
}: {
  from: 'bot' | 'user'
  text: string
  reduced: boolean
}) {
  const bot = from === 'bot'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${bot ? 'justify-start' : 'justify-end'}`}
    >
      <p
        className={`max-w-[85%] px-3.5 py-2.5 text-[14px] leading-relaxed ${
          bot
            ? 'rounded-[16px] rounded-bl-[5px] border'
            : 'rounded-[16px] rounded-br-[5px] font-medium'
        }`}
        style={
          bot
            ? {
                background: 'var(--c-surface)',
                borderColor: 'var(--c-border)',
                color: 'var(--c-muted)',
              }
            : { background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }
        }
      >
        {text}
      </p>
    </motion.div>
  )
}

export function TypingDots() {
  return (
    <div className="flex justify-start">
      <span
        className="flex items-center gap-1 rounded-[16px] rounded-bl-[5px] border px-3.5 py-3"
        style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
        aria-label="digitando"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--c-faint)' }}
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
          />
        ))}
      </span>
    </div>
  )
}

// Cartão de resumo — o "comprovante" do que foi combinado, antes de enviar.
export function Summary({
  title,
  rows,
  empilhadas = [],
  reduced,
}: {
  title: string
  rows: [string, string][]
  /**
   * Pares que NÃO cabem em duas colunas: a pergunta da triagem é uma frase
   * inteira, e espremê-la nos 74px do rótulo deixaria "Você já possui processo
   * relacionado a esse assunto?" em sete linhas de uma palavra. Aqui a pergunta
   * fica em cima e a resposta embaixo.
   */
  empilhadas?: [string, string][]
  reduced: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mt-1 overflow-hidden rounded-[16px] border"
      style={{ borderColor: 'var(--c-ring)', background: 'var(--c-surface)' }}
    >
      <p
        className="flex items-center gap-2 px-4 py-2.5 font-display text-[13px] font-semibold uppercase tracking-[0.14em]"
        style={{ background: 'var(--c-accent-soft)' }}
      >
        <CheckIcon width={14} height={14} className="t-accent" strokeWidth={2.4} />
        {title}
      </p>
      <dl className="divide-y" style={{ borderColor: 'var(--c-border)' }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 px-4 py-2.5">
            <dt className="t-faint w-[74px] shrink-0 text-[11.5px] uppercase tracking-wider">{k}</dt>
            <dd className="t-muted flex-1 text-[13.5px] leading-snug">{v}</dd>
          </div>
        ))}
        {empilhadas.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="px-4 py-2.5">
            <dt className="t-faint text-[11.5px] leading-snug">{k}</dt>
            <dd className="t-muted mt-0.5 text-[13.5px] font-medium leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  )
}

export function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="t-faint mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Chip({
  children,
  onClick,
  subtle = false,
  href,
}: {
  children: React.ReactNode
  onClick: () => void
  subtle?: boolean
  /** Vira link (nova aba) em vez de botão: navegação passa onde `window.open` não passa. */
  href?: string
}) {
  const className =
    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-all duration-200 hover:-translate-y-px active:translate-y-0'
  const style = {
    borderColor: subtle ? 'var(--c-border)' : 'var(--c-ring)',
    background: subtle ? 'transparent' : 'var(--c-accent-soft)',
    color: subtle ? 'var(--c-faint)' : 'var(--c-text)',
  }
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        // O que o clique muda na conversa vai para DEPOIS da navegação: trocar de
        // etapa no mesmo gesto desmonta o link antes de o navegador segui-lo, e
        // link fora do documento não navega.
        onClick={() => setTimeout(onClick, 0)}
        className={className}
        style={style}
      >
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  )
}

/**
 * Chip que LEMBRA se foi tocado — a peça da pergunta de múltipla escolha da
 * triagem, onde o visitante marca quantas quiser antes de confirmar.
 *
 * `aria-pressed` e não `checked`: são botões que alternam, não um formulário de
 * caixas de seleção, e é assim que o leitor de tela anuncia o estado sem que a
 * conversa deixe de ser uma conversa.
 */
export function ChipToggle({
  children,
  on,
  onClick,
}: {
  children: React.ReactNode
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-all duration-200 hover:-translate-y-px active:translate-y-0"
      style={{
        borderColor: on ? 'var(--c-accent)' : 'var(--c-border)',
        background: on ? 'var(--c-accent)' : 'transparent',
        color: on ? 'var(--c-accent-ink)' : 'var(--c-faint)',
      }}
    >
      {on && <CheckIcon width={13} height={13} strokeWidth={2.6} aria-hidden />}
      {children}
    </button>
  )
}

export function Composer({
  value,
  onChange,
  onSend,
  placeholder,
  label,
  canSend,
  skipLabel,
  onSkip,
  type = 'text',
  maxLength = 140,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  placeholder: string
  label: string
  canSend: boolean
  skipLabel?: string
  onSkip?: () => void
  /** 'date' abre o calendário do aparelho — usado pela pergunta de data da triagem. */
  type?: 'text' | 'date'
  /** teto de caracteres; a triagem usa um maior no "conte brevemente" */
  maxLength?: number
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSend()
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        // Só no texto: no campo de data o atributo não significa nada e o
        // navegador ignora — mas deixá-lo ali confunde quem lê o código depois.
        maxLength={type === 'text' ? maxLength : undefined}
        className="min-w-0 flex-1 rounded-full border px-4 py-2.5 text-[16px] outline-none transition-colors sm:text-[14px]"
        style={{
          borderColor: 'var(--c-border)',
          background: 'var(--c-bg)',
          color: 'var(--c-text)',
        }}
      />
      {skipLabel && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="t-faint shrink-0 px-1 text-[13px] font-medium underline-offset-4 hover:underline"
        >
          {skipLabel}
        </button>
      )}
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Enviar resposta"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-40"
        style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
      >
        <ArrowRight width={18} height={18} />
      </button>
    </form>
  )
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---- A área de resposta de uma pergunta da triagem -------------------------
//
// Mora aqui, com as outras peças, porque são DUAS conversas que a usam: a do
// perfil e a do escritório, que faz as perguntas do advogado escolhido. Morava
// dentro de AssistantChat, e foi por isso que a página da sociedade nasceu sem
// triagem nenhuma.
//
// Um tipo por vez, e nenhum deles é um formulário: escolha vira chip, sim/não
// vira dois chips, texto vira o mesmo campo do resto da conversa. O visitante
// não deve perceber que mudou de mecanismo no meio do caminho.
//
// O enunciado JÁ FOI DITO pelo assistente, no balão acima. Aqui o rótulo é o do
// gesto ("Escolha uma opção"), e o `aria-label` do campo livre repete a pergunta
// — quem ouve a tela precisa do vínculo que o olho faz sozinho.

const ROTULO_DO_GESTO: Record<PerguntaDeTriagem['kind'], string> = {
  escolha: 'Escolha uma opção',
  multipla: 'Marque quantas quiser',
  'sim-nao': 'Sim ou não',
  atendimento: 'Formato do atendimento',
  data: 'Escolha uma data',
  texto: 'Sua resposta',
  'texto-longo': 'Sua resposta',
  contato: 'Seu nome',
}

export function CampoDaTriagem({
  pergunta,
  indice,
  draft,
  setDraft,
  marcadas,
  setMarcadas,
  onResponder,
  endereco,
}: {
  pergunta: PerguntaDeTriagem
  indice: number
  draft: string
  setDraft: (v: string) => void
  marcadas: string[]
  setMarcadas: (v: string[]) => void
  onResponder: (indice: number, texto: string, antes?: string[], opcoes?: string[]) => void
  /** fala do endereço, dita quando a pessoa escolhe presencial */
  endereco: string
}) {
  const rotulo = ROTULO_DO_GESTO[pergunta.kind]
  const pular = pergunta.optional ? (
    <Chip subtle onClick={() => onResponder(indice, '')}>
      Prefiro não responder
    </Chip>
  ) : null

  // Escolha, sim/não e atendimento são o MESMO gesto: uma fileira de opções.
  // As três guardam suas opções no mesmo lugar (as duas últimas com a lista
  // fixa, posta pelo normalizador) — é isso que faz ramificar ser um mecanismo
  // só, e não três.
  if (pergunta.kind !== 'multipla' && pergunta.options?.length) {
    return (
      <ChipRow label={rotulo}>
        {pergunta.options.map((o) => (
          <Chip
            key={o.id}
            onClick={() =>
              // Escolher "presencial" é a hora de dizer onde fica o escritório —
              // quem acabou de decidir sair de casa pergunta "onde?" em seguida.
              onResponder(
                indice,
                o.texto,
                pergunta.kind === 'atendimento' && o.id === 'presencial' && endereco
                  ? [endereco]
                  : [],
                // O id da opção é o que decide o CAMINHO. O texto é o que vai na
                // mensagem; usá-lo como chave soltaria a pergunta ligada a cada
                // correção de digitação do advogado.
                [o.id],
              )
            }
          >
            {o.texto}
          </Chip>
        ))}
        {pular}
      </ChipRow>
    )
  }

  if (pergunta.kind === 'multipla') {
    const alterna = (id: string) =>
      setMarcadas(marcadas.includes(id) ? marcadas.filter((x) => x !== id) : [...marcadas, id])
    return (
      <div>
        <ChipRow label={rotulo}>
          {(pergunta.options ?? []).map((o) => (
            <ChipToggle key={o.id} on={marcadas.includes(o.id)} onClick={() => alterna(o.id)}>
              {o.texto}
            </ChipToggle>
          ))}
        </ChipRow>
        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            disabled={!marcadas.length}
            // A ordem das OPÇÕES manda, não a ordem em que foram tocadas: a
            // resposta é lida pelo advogado, e ele reconhece a própria lista.
            // Os ids marcados viajam juntos: basta UM deles para abrir a
            // pergunta ligada a ele (múltipla escolha só não ENCERRA a triagem).
            onClick={() => {
              const escolhidas = (pergunta.options ?? []).filter((o) => marcadas.includes(o.id))
              onResponder(
                indice,
                escolhidas.map((o) => o.texto).join(', '),
                [],
                escolhidas.map((o) => o.id),
              )
            }}
            className="rounded-full px-4 py-2 text-[13.5px] font-semibold transition-opacity disabled:opacity-40"
            style={{ background: 'var(--c-accent)', color: 'var(--c-accent-ink)' }}
          >
            Pronto{marcadas.length ? ` (${marcadas.length})` : ''}
          </button>
          {pergunta.optional && (
            <button
              type="button"
              onClick={() => onResponder(indice, '')}
              className="t-faint text-[13px] font-medium underline-offset-4 hover:underline"
            >
              Prefiro não responder
            </button>
          )}
        </div>
      </div>
    )
  }

  // Campo escrito: data, resposta curta, resposta longa e o nome.
  const data = pergunta.kind === 'data'
  return (
    <Composer
      value={draft}
      onChange={setDraft}
      onSend={() => onResponder(indice, data ? formatarData(draft) : draft)}
      type={data ? 'date' : 'text'}
      maxLength={tetoDaResposta(pergunta.kind)}
      placeholder={data ? '' : pergunta.kind === 'contato' ? 'Seu nome' : 'Escreva sua resposta'}
      label={pergunta.label}
      skipLabel={pergunta.optional ? 'Pular' : undefined}
      onSkip={pergunta.optional ? () => onResponder(indice, '') : undefined}
      canSend={draft.trim().length > (pergunta.kind === 'contato' ? 1 : 0)}
    />
  )
}
