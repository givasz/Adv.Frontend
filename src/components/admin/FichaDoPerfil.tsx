// A ficha de moderação — onde uma decisão é tomada.
//
// O que havia antes era uma coluna: denúncias, um `<details>` cinza chamado "Ver
// conteúdo do perfil", uma caixa de texto e quatro botões, tudo empilhado. Para
// decidir era preciso rolar até o conteúdo, subir de volta até o motivo, rolar de
// novo para conferir, e no fim clicar num botão que não dizia o que ia acontecer.
//
// O desenho novo parte do que a tarefa é: **comparar uma acusação com um texto e
// escolher um degrau**. Daí a ficha ser duas colunas no desktop —
//
//   • à esquerda, a EVIDÊNCIA: quem é, o que já aconteceu antes, o que
//     denunciaram e o texto que está no ar, aberto por padrão (esconder a prova
//     atrás de um clique era o defeito central da tela antiga);
//   • à direita, a DECISÃO: motivo, prazo, seções e a escada — que fica visível
//     como escada, com o degrau em que o perfil está marcado.
//
// No celular vira uma coluna só, na mesma ordem: primeiro o que se lê, depois o
// que se decide.
//
// Fundamento de cada degrau em docs/politica-de-sancoes.md.

import { useEffect, useState } from 'react'
import {
  dismissReport,
  fichaDaConta,
  getModerationProfile,
  moderateProfile,
  type ContaFicha,
  type ModerationProfile,
} from '@/lib/adminApi'
import { REASON_LABEL } from '@/lib/reportReasons'
import { cnaSearchUrl } from '@/components/ui/CnaLink'
import { Aviso, Motivo, entrada, fmtData } from './pecas'
import AcoesDaConta from './AcoesDaConta'
import { CheckIcon, ChevronDown, ExternalLinkIcon, FlagIcon } from '@/components/ui/icons'
import { Marca } from '@/components/ui/Marca'

const SECOES: { key: string; label: string }[] = [
  { key: 'avatar', label: 'Foto' },
  { key: 'headline', label: 'Frase de apresentação' },
  { key: 'bio', label: 'Bio' },
  { key: 'regionNote', label: 'Observação de região' },
  { key: 'areas', label: 'Todas as áreas' },
  { key: 'faqs', label: 'Perguntas frequentes' },
  { key: 'socials', label: 'Redes e site' },
]

/** A escada, na tela. Espelha backend/src/admin/sancoes.ts. */
const DEGRAUS = [
  {
    id: 'warn' as const,
    grau: 1,
    label: 'Enviar aviso',
    status: 'warned',
    quando: 'O perfil segue no ar. O advogado lê o motivo no editor.',
    tom: 'brando',
  },
  {
    id: 'partial' as const,
    grau: 2,
    label: 'Ocultar seções',
    status: 'partial',
    quando: 'Só as partes marcadas saem do ar.',
    tom: 'brando',
  },
  {
    id: 'restrict' as const,
    grau: 3,
    label: 'Retirar do ar',
    status: 'restricted',
    quando: 'A página inteira sai. Se o plano é pago, a cobrança para.',
    tom: 'grave',
  },
]

export default function FichaDoPerfil({
  profileId,
  podeDecidir,
  podeSancionar,
  onChanged,
}: {
  profileId: string
  podeDecidir: boolean
  podeSancionar: boolean
  onChanged: () => void
}) {
  const [perfil, setPerfil] = useState<ModerationProfile | null>(null)
  const [conta, setConta] = useState<ContaFicha | null>(null)
  const [motivo, setMotivo] = useState('')
  const [dias, setDias] = useState('30')
  const [secoes, setSecoes] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setErro(null)
    try {
      const p = await getModerationProfile(profileId)
      setPerfil(p)
      setMotivo(p.moderationNote ?? '')
      try {
        const lido = JSON.parse(p.hiddenSections || '[]')
        setSecoes(new Set(Array.isArray(lido) ? lido : []))
      } catch {
        setSecoes(new Set())
      }
      // A ficha da conta é o que permite subir da página para a pessoa. Falha
      // aqui não derruba a tela: quem só tem `contas:ler` continua moderando.
      if (p.userId) setConta(await fichaDaConta(p.userId).catch(() => null))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o perfil.')
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  function alternar(chave: string) {
    setSecoes((atual) => {
      const proximo = new Set(atual)
      proximo.has(chave) ? proximo.delete(chave) : proximo.add(chave)
      return proximo
    })
  }

  async function aplicar(acao: 'warn' | 'partial' | 'restrict' | 'clear') {
    setOcupado(true)
    setErro(null)
    try {
      const texto = motivo.trim()
      setPerfil(
        await moderateProfile(profileId, {
          action: acao,
          note: acao === 'clear' ? undefined : texto,
          reason: acao === 'clear' ? texto : undefined,
          dias: acao === 'clear' ? undefined : Number(dias),
          hiddenSections: acao === 'partial' ? Array.from(secoes) : undefined,
        }),
      )
      onChanged()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao aplicar a medida.')
    } finally {
      setOcupado(false)
    }
  }

  async function arquivar(id: string) {
    setOcupado(true)
    setErro(null)
    try {
      await dismissReport(id, motivo.trim())
      await carregar()
      onChanged()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao arquivar.')
    } finally {
      setOcupado(false)
    }
  }

  if (!perfil) {
    return (
      <div className="border-t border-ink/10 px-4 py-5 text-[13px] text-ink-faint">
        Carregando a ficha…
      </div>
    )
  }

  const semMotivo = motivo.trim().length < 5
  const abertas = perfil.reports.filter((r) => r.status === 'open')
  const anteriores = perfil.reports.filter((r) => r.status !== 'open')

  return (
    <div className="border-t border-ink/10 bg-paper-deep/40">
      {erro && (
        <div className="px-4 pt-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}

      <div className="grid gap-px bg-ink/10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* ───────────────────────── evidência ───────────────────────── */}
        <section className="bg-paper-soft/60 px-4 py-4">
          <Rotulo>O que dizem</Rotulo>

          {abertas.length === 0 && anteriores.length === 0 ? (
            <p className="mb-4 rounded-lg border border-dashed border-ink/15 px-3 py-4 text-center text-[12.5px] text-ink-faint">
              Nenhuma denúncia. Você chegou aqui pela busca.
            </p>
          ) : (
            <ul className="mb-4 space-y-2">
              {abertas.map((r) => (
                <li key={r.id} className="rounded-lg border-l-2 border-burgundy/60 bg-paper px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">
                        {REASON_LABEL[r.reason] ?? r.reason}
                      </p>
                      {r.details && (
                        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-soft">
                          {r.details}
                        </p>
                      )}
                      <p className="mt-1.5 font-mono text-[11px] text-ink-faint">
                        {fmtData(r.createdAt)} · {r.reporterEmail || 'anônima'}
                      </p>
                    </div>
                    <button
                      onClick={() => void arquivar(r.id)}
                      disabled={ocupado || !podeDecidir || semMotivo}
                      title={semMotivo ? 'Escreva o motivo ao lado antes de arquivar.' : undefined}
                      className="shrink-0 rounded-lg border border-ink/15 px-2 py-1 text-[11.5px] font-medium text-ink-faint transition-colors hover:border-ink/40 hover:text-ink disabled:cursor-not-allowed disabled:border-transparent disabled:bg-ink/[0.06] disabled:text-ink-faint"
                    >
                      Arquivar
                    </button>
                  </div>
                </li>
              ))}
              {anteriores.length > 0 && (
                <li className="pt-1">
                  {/* Reincidência é o que justifica subir um degrau — e por isso
                      ela precisa estar aqui, e não a duas telas de distância. */}
                  <Sanfona
                    titulo={`${anteriores.length} denúncia(s) já decidida(s)`}
                    destaque={anteriores.length >= 2}
                  >
                    <ul className="space-y-1.5">
                      {anteriores.map((r) => (
                        <li key={r.id} className="text-[12px] text-ink-soft">
                          <span className="font-medium">{REASON_LABEL[r.reason] ?? r.reason}</span>
                          {' · '}
                          <span className="text-ink-faint">
                            {r.status === 'dismissed' ? 'arquivada' : (r.resolution ?? 'resolvida')} em{' '}
                            {fmtData(r.handledAt ?? r.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Sanfona>
                </li>
              )}
            </ul>
          )}

          <Rotulo>O que está no ar</Rotulo>
          <ConteudoDoPerfil perfil={perfil} />

          {conta && podeSancionar && (
            <>
              <Rotulo>A conta por trás da página</Rotulo>
              <AcoesDaConta
                conta={conta}
                motivo={motivo}
                onMudou={() => {
                  void carregar()
                  onChanged()
                }}
                onErro={setErro}
              />
            </>
          )}
        </section>

        {/* ───────────────────────── decisão ───────────────────────── */}
        <section className="bg-paper px-4 py-4">
          <Rotulo>A decisão</Rotulo>

          {!podeDecidir && (
            <Aviso tom="ok">
              Seu papel consulta a fila, mas não decide. Para tirar algo do ar,
              fale com a moderação.
            </Aviso>
          )}

          <Motivo
            id={`motivo-${profileId}`}
            valor={motivo}
            onChange={setMotivo}
            label="Motivo (obrigatório)"
            dica="É o texto que o advogado lê no editor. Diga qual regra foi contrariada e o que corrigir."
            linhas={4}
          />

          <div className="mb-4">
            <label
              htmlFor={`dias-${profileId}`}
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Vale por
            </label>
            <select
              id={`dias-${profileId}`}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className={entrada}
            >
              <option value="7">7 dias</option>
              <option value="15">15 dias</option>
              <option value="30">30 dias (padrão)</option>
              <option value="90">90 dias</option>
              <option value="0">Sem prazo — até alguém desfazer</option>
            </select>
            <p className="mt-1 text-[11.5px] text-ink-faint">
              Vencido o prazo, o perfil volta sozinho. É o que separa sanção de
              punição esquecida na fila.
            </p>
          </div>

          {semMotivo && podeDecidir && (
            <Aviso tom="nota">
              <strong>Escreva o motivo acima</strong> para liberar os botões.
            </Aviso>
          )}

          <div className="space-y-2">
            {DEGRAUS.map((d) => {
              const atual = perfil.moderationStatus === d.status
              const precisaSecao = d.id === 'partial' && secoes.size === 0
              return (
                <div key={d.id}>
                  <button
                    onClick={() => void aplicar(d.id)}
                    disabled={ocupado || !podeDecidir || semMotivo || precisaSecao}
                    className={`flex w-full items-center gap-3 rounded-xl2 border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-ink/[0.04] disabled:text-ink-faint ${
                      d.tom === 'grave'
                        ? 'border-burgundy/40 bg-burgundy/[0.07] hover:bg-burgundy/[0.13]'
                        : 'border-brass/40 bg-brass/[0.09] hover:bg-brass/[0.16]'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
                        d.tom === 'grave'
                          ? 'bg-burgundy text-paper-soft'
                          : 'bg-brass/40 text-brass-deep'
                      }`}
                    >
                      {d.grau}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[13.5px] font-semibold ${
                          d.tom === 'grave' ? 'text-burgundy-deep' : 'text-brass-deep'
                        }`}
                      >
                        {d.label}
                      </span>
                      <span className="block text-[11.5px] leading-snug text-ink-faint">
                        {precisaSecao ? 'Marque ao menos uma seção abaixo.' : d.quando}
                      </span>
                    </span>
                    {atual && (
                      <span className="shrink-0 rounded-full bg-ink/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                        atual
                      </span>
                    )}
                  </button>

                  {d.id === 'partial' && (
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                      {SECOES.map((s) => (
                        <Marcar
                          key={s.key}
                          label={s.label}
                          marcado={secoes.has(s.key)}
                          onAlternar={() => alternar(s.key)}
                        />
                      ))}
                      {perfil.areas.map((a) => (
                        <Marcar
                          key={a.id}
                          label={`Área: ${a.label || '—'}`}
                          marcado={secoes.has(`area:${a.id}`) || secoes.has('areas')}
                          desabilitado={secoes.has('areas')}
                          onAlternar={() => alternar(`area:${a.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {perfil.moderationStatus !== 'active' && (
            <button
              onClick={() => void aplicar('clear')}
              disabled={ocupado || !podeDecidir || semMotivo}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-ink/[0.06] disabled:text-ink-faint"
            >
              <CheckIcon width={14} height={14} /> Liberar o perfil
            </button>
          )}

          {perfil.moderationUntil && perfil.moderationStatus !== 'active' && (
            <p className="mt-2 text-center font-mono text-[11.5px] text-ink-faint">
              medida vence em {fmtData(perfil.moderationUntil)}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

// ---- peças da ficha ---------------------------------------------------------

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-brass-deep">
      {children}
    </p>
  )
}

/**
 * O conteúdo do perfil — aberto por padrão.
 *
 * Antes era um `<details>` fechado: a prova ficava escondida atrás de um clique
 * na tela em que a prova é a única coisa que importa. Agora ela abre junto, e o
 * que se fecha é o excesso (texto longo demais para caber sem rolar).
 */
function ConteudoDoPerfil({ perfil }: { perfil: ModerationProfile }) {
  const campos: { label: string; valor: string }[] = []
  if (perfil.headline) campos.push({ label: 'Frase de apresentação', valor: perfil.headline })
  if (perfil.bio) campos.push({ label: 'Bio', valor: perfil.bio })
  if (perfil.regionNote) campos.push({ label: 'Observação de região', valor: perfil.regionNote })

  return (
    <div className="mb-4 overflow-hidden rounded-xl2 border border-ink/10 bg-paper">
      {campos.length === 0 && perfil.areas.length === 0 && (
        <p className="px-3 py-4 text-center text-[12.5px] text-ink-faint">
          O perfil não tem texto publicado.
        </p>
      )}
      {campos.map((c) => (
        <div key={c.label} className="border-b border-ink/[0.07] px-3 py-2.5 last:border-b-0">
          <p className="mb-0.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
            {c.label}
          </p>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{c.valor}</p>
        </div>
      ))}
      {perfil.areas.length > 0 && (
        <div className="border-b border-ink/[0.07] px-3 py-2.5 last:border-b-0">
          <p className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
            Áreas ({perfil.areas.length})
          </p>
          <ul className="space-y-1">
            {perfil.areas.map((a) => (
              <li key={a.id} className="text-[13px] leading-relaxed text-ink">
                <span className="font-medium">{a.label}</span>
                {a.description ? <span className="text-ink-soft"> — {a.description}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(perfil.faqs ?? []).length > 0 && (
        <div className="border-b border-ink/[0.07] px-3 py-2.5 last:border-b-0">
          <Sanfona titulo={`Perguntas frequentes (${(perfil.faqs ?? []).length})`}>
            <ul className="space-y-1.5">
              {(perfil.faqs ?? []).map((f) => (
                <li key={f.id} className="text-[12.5px] leading-relaxed text-ink">
                  <span className="font-medium">{f.question}</span>
                  {f.answer ? <span className="text-ink-soft"> — {f.answer}</span> : null}
                </li>
              ))}
            </ul>
          </Sanfona>
        </div>
      )}
      {perfil.socials.length > 0 && (
        <div className="px-3 py-2.5">
          <p className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
            Redes e site
          </p>
          <ul className="space-y-0.5">
            {perfil.socials.map((s) => (
              <li key={s.url} className="truncate text-[12.5px] text-ink-soft">
                {s.url}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Sanfona simples. Abre e fecha por opacidade e deslize — nunca animando
 * `height`, que trava no celular e tem teste que barra (lib/animacao.spec.ts).
 */
function Sanfona({
  titulo,
  destaque,
  children,
}: {
  titulo: string
  destaque?: boolean
  children: React.ReactNode
}) {
  const [aberta, setAberta] = useState(false)
  return (
    <div>
      <button
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className={`flex w-full items-center gap-1.5 text-left text-[12px] font-medium transition-colors ${
          destaque ? 'text-burgundy-deep' : 'text-ink-faint hover:text-ink'
        }`}
      >
        <ChevronDown
          width={13}
          height={13}
          className={`shrink-0 transition-transform ${aberta ? '' : '-rotate-90'}`}
        />
        {titulo}
      </button>
      {aberta && <div className="mt-2 pl-4">{children}</div>}
    </div>
  )
}

function Marcar({
  label,
  marcado,
  desabilitado,
  onAlternar,
}: {
  label: string
  marcado: boolean
  desabilitado?: boolean
  onAlternar: () => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink/10 bg-paper-soft px-2 py-1.5 text-[11.5px] transition-colors hover:border-ink/25 ${
        desabilitado ? 'cursor-not-allowed opacity-50' : ''
      } ${marcado ? 'border-brass/50 bg-brass/10' : ''}`}
    >
      <input
        type="checkbox"
        checked={marcado}
        disabled={desabilitado}
        onChange={onAlternar}
        className="h-3.5 w-3.5 accent-[#835f2e]"
      />
      <span className="truncate text-ink-soft">{label}</span>
    </label>
  )
}

/** O cabeçalho de identidade, usado pelas duas abas que abrem uma ficha. */
export function CabecalhoDoPerfil({
  nome,
  slug,
  oab,
  cidade,
  estado,
}: {
  nome: string
  slug: string
  oab: string
  cidade?: string
  estado?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
      <Marca size={17} />
      <span className="font-mono">advoc.me/{slug}</span>
      <span>·</span>
      <span>{oab}</span>
      {cidade && (
        <>
          <span>·</span>
          <span>
            {cidade}/{estado}
          </span>
        </>
      )}
      <a
        href={cnaSearchUrl(nome)}
        target="_blank"
        rel="noreferrer noopener"
        className="ml-auto inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:border-brass/50 hover:text-brass-deep"
      >
        <FlagIcon width={11} height={11} /> Conferir no CNA
        <ExternalLinkIcon width={10} height={10} />
      </a>
    </div>
  )
}
