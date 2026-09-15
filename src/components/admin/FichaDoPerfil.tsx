// A ficha de moderação — onde uma decisão é tomada.
//
// A tarefa é **comparar uma acusação com um texto e escolher um degrau**. Daí a
// ficha ser duas colunas no desktop —
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
import { Aviso, Botao, Carregando, Chip, LinkExterno, Motivo, Rotulo, entrada, fmtData } from './pecas'
import AcoesDaConta from './AcoesDaConta'
import { CheckIcon, ChevronDown, ExternalLinkIcon } from '@/components/ui/icons'

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
      <div className="border-t border-adm-border px-4">
        {erro ? <Aviso className="mt-4">{erro}</Aviso> : <Carregando texto="Carregando a ficha…" />}
      </div>
    )
  }

  const semMotivo = motivo.trim().length < 5
  const abertas = perfil.reports.filter((r) => r.status === 'open')
  const anteriores = perfil.reports.filter((r) => r.status !== 'open')

  return (
    <div className="border-t border-adm-border">
      {/* Identidade, uma linha só: quem é, onde está, e os atalhos de conferência. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-adm-line bg-white px-4 py-2.5 text-[12.5px]">
        <span className="font-semibold text-adm-ink">{perfil.name}</span>
        <span className="font-mono text-adm-muted">advoc.me/{perfil.slug}</span>
        <span className="text-adm-muted">{perfil.oabNumber}</span>
        {perfil.city && (
          <span className="text-adm-muted">
            {perfil.city}/{perfil.state}
          </span>
        )}
        <span className="ml-auto flex gap-1.5">
          <LinkExterno href={`/${perfil.slug}`}>
            Ver no ar <ExternalLinkIcon width={11} height={11} strokeWidth={1.8} />
          </LinkExterno>
          <LinkExterno href={cnaSearchUrl(perfil.name)}>
            Conferir no CNA <ExternalLinkIcon width={11} height={11} strokeWidth={1.8} />
          </LinkExterno>
        </span>
      </div>

      {erro && (
        <div className="px-4 pt-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}

      <div className="grid gap-px bg-adm-border lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        {/* ───────────────────────── evidência ───────────────────────── */}
        <section className="bg-white px-4 py-4">
          <Rotulo>O que dizem</Rotulo>

          {abertas.length === 0 && anteriores.length === 0 ? (
            <p className="mb-4 rounded-md border border-dashed border-adm-border px-3 py-4 text-center text-[12.5px] text-adm-muted">
              Nenhuma denúncia. Você chegou aqui pela busca.
            </p>
          ) : (
            <ul className="mb-4 space-y-2">
              {abertas.map((r) => (
                <li key={r.id} className="rounded-md border border-adm-border border-l-2 border-l-adm-danger bg-white px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-adm-ink">{REASON_LABEL[r.reason] ?? r.reason}</p>
                      {r.details && (
                        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-adm-soft">{r.details}</p>
                      )}
                      <p className="mt-1.5 text-[11.5px] tabular-nums text-adm-muted">
                        {fmtData(r.createdAt)} · {r.reporterEmail || 'anônima'}
                      </p>
                    </div>
                    <Botao
                      tamanho="sm"
                      onClick={() => void arquivar(r.id)}
                      disabled={ocupado || !podeDecidir || semMotivo}
                      title={semMotivo ? 'Escreva o motivo ao lado antes de arquivar.' : undefined}
                    >
                      Arquivar
                    </Botao>
                  </div>
                </li>
              ))}
              {anteriores.length > 0 && (
                <li className="pt-1">
                  {/* Reincidência é o que justifica subir um degrau — e por isso
                      ela precisa estar aqui, e não a duas telas de distância. */}
                  <Sanfona titulo={`${anteriores.length} denúncia(s) já decidida(s)`} destaque={anteriores.length >= 2}>
                    <ul className="space-y-1.5">
                      {anteriores.map((r) => (
                        <li key={r.id} className="text-[12px] text-adm-soft">
                          <span className="font-medium">{REASON_LABEL[r.reason] ?? r.reason}</span>
                          {' · '}
                          <span className="text-adm-muted">
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
        <section className="bg-adm-raised px-4 py-4">
          <Rotulo>A decisão</Rotulo>

          {!podeDecidir && (
            <Aviso tom="ok">Seu papel consulta a fila, mas não decide. Para tirar algo do ar, fale com a moderação.</Aviso>
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
            <label htmlFor={`dias-${profileId}`} className="mb-1 block text-[12.5px] font-medium text-adm-soft">
              Vale por
            </label>
            <select id={`dias-${profileId}`} value={dias} onChange={(e) => setDias(e.target.value)} className={entrada}>
              <option value="7">7 dias</option>
              <option value="15">15 dias</option>
              <option value="30">30 dias (padrão)</option>
              <option value="90">90 dias</option>
              <option value="0">Sem prazo — até alguém desfazer</option>
            </select>
            <p className="mt-1 text-[11.5px] text-adm-muted">
              Vencido o prazo, o perfil volta sozinho. É o que separa sanção de punição esquecida na fila.
            </p>
          </div>

          {semMotivo && podeDecidir && (
            <Aviso tom="nota">
              <strong>Escreva o motivo acima</strong> para liberar os degraus.
            </Aviso>
          )}

          <div className="space-y-2">
            {DEGRAUS.map((d) => {
              const atual = perfil.moderationStatus === d.status
              const precisaSecao = d.id === 'partial' && secoes.size === 0
              const grave = d.tom === 'grave'
              return (
                <div key={d.id}>
                  <button
                    type="button"
                    onClick={() => void aplicar(d.id)}
                    disabled={ocupado || !podeDecidir || semMotivo || precisaSecao}
                    className={`flex w-full items-center gap-3 rounded-md border bg-white px-3 py-2.5 text-left shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      grave
                        ? 'border-adm-danger/40 hover:bg-adm-danger-soft/40'
                        : 'border-amber-300/80 hover:bg-adm-warn-soft/50'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white ${
                        grave ? 'bg-adm-danger' : 'bg-adm-warn'
                      }`}
                    >
                      {d.grau}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13px] font-semibold ${grave ? 'text-adm-danger' : 'text-adm-warn'}`}>
                        {d.label}
                      </span>
                      <span className="block text-[11.5px] leading-snug text-adm-muted">
                        {precisaSecao ? 'Marque ao menos uma seção abaixo.' : d.quando}
                      </span>
                    </span>
                    {atual && <Chip tom="acento">atual</Chip>}
                  </button>

                  {d.id === 'partial' && (
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                      {SECOES.map((s) => (
                        <Marcar key={s.key} label={s.label} marcado={secoes.has(s.key)} onAlternar={() => alternar(s.key)} />
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
            <Botao
              variante="sucesso"
              className="mt-3 w-full"
              onClick={() => void aplicar('clear')}
              disabled={ocupado || !podeDecidir || semMotivo}
            >
              <CheckIcon width={14} height={14} /> Liberar o perfil
            </Botao>
          )}

          {perfil.moderationUntil && perfil.moderationStatus !== 'active' && (
            <p className="mt-2 text-center text-[11.5px] tabular-nums text-adm-muted">
              medida vence em {fmtData(perfil.moderationUntil)}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

// ---- peças da ficha ---------------------------------------------------------

/**
 * O conteúdo do perfil — aberto por padrão.
 *
 * A prova é a única coisa que importa nesta tela; ela abre junto, e o que se
 * fecha é o excesso (texto longo demais para caber sem rolar).
 */
function ConteudoDoPerfil({ perfil }: { perfil: ModerationProfile }) {
  const campos: { label: string; valor: string }[] = []
  if (perfil.headline) campos.push({ label: 'Frase de apresentação', valor: perfil.headline })
  if (perfil.bio) campos.push({ label: 'Bio', valor: perfil.bio })
  if (perfil.regionNote) campos.push({ label: 'Observação de região', valor: perfil.regionNote })

  return (
    <div className="mb-4 overflow-hidden rounded-md border border-adm-border bg-white">
      {campos.length === 0 && perfil.areas.length === 0 && (
        <p className="px-3 py-4 text-center text-[12.5px] text-adm-muted">O perfil não tem texto publicado.</p>
      )}
      {campos.map((c) => (
        <div key={c.label} className="border-b border-adm-line px-3 py-2.5 last:border-b-0">
          <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-adm-faint">{c.label}</p>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-adm-ink">{c.valor}</p>
        </div>
      ))}
      {perfil.areas.length > 0 && (
        <div className="border-b border-adm-line px-3 py-2.5 last:border-b-0">
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-adm-faint">
            Áreas ({perfil.areas.length})
          </p>
          <ul className="space-y-1">
            {perfil.areas.map((a) => (
              <li key={a.id} className="text-[13px] leading-relaxed text-adm-ink">
                <span className="font-medium">{a.label}</span>
                {a.description ? <span className="text-adm-soft"> — {a.description}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(perfil.faqs ?? []).length > 0 && (
        <div className="border-b border-adm-line px-3 py-2.5 last:border-b-0">
          <Sanfona titulo={`Perguntas frequentes (${(perfil.faqs ?? []).length})`}>
            <ul className="space-y-1.5">
              {(perfil.faqs ?? []).map((f) => (
                <li key={f.id} className="text-[12.5px] leading-relaxed text-adm-ink">
                  <span className="font-medium">{f.question}</span>
                  {f.answer ? <span className="text-adm-soft"> — {f.answer}</span> : null}
                </li>
              ))}
            </ul>
          </Sanfona>
        </div>
      )}
      {perfil.socials.length > 0 && (
        <div className="px-3 py-2.5">
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-adm-faint">Redes e site</p>
          <ul className="space-y-0.5">
            {perfil.socials.map((s) => (
              <li key={s.url} className="truncate font-mono text-[12px] text-adm-soft">
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
function Sanfona({ titulo, destaque, children }: { titulo: string; destaque?: boolean; children: React.ReactNode }) {
  const [aberta, setAberta] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className={`flex w-full items-center gap-1.5 text-left text-[12px] font-medium transition-colors ${
          destaque ? 'text-adm-danger' : 'text-adm-muted hover:text-adm-ink'
        }`}
      >
        <ChevronDown width={13} height={13} className={`shrink-0 transition-transform ${aberta ? '' : '-rotate-90'}`} />
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
      className={`flex cursor-pointer items-center gap-1.5 rounded-md border bg-white px-2 py-1.5 text-[11.5px] transition-colors hover:border-adm-faint ${
        desabilitado ? 'cursor-not-allowed opacity-50' : ''
      } ${marcado ? 'border-adm-accent bg-adm-accent-soft/50' : 'border-adm-border'}`}
    >
      <input type="checkbox" checked={marcado} disabled={desabilitado} onChange={onAlternar} className="h-3.5 w-3.5 accent-[#2563eb]" />
      <span className="truncate text-adm-soft">{label}</span>
    </label>
  )
}
