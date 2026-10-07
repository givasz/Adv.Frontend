import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  dataDoBeneficio,
  linkLegivel,
  ROTULO_DA_SITUACAO,
  type PainelConvidado,
  type PainelDoParceiro,
  type PainelParticipante,
} from '@/lib/partners'
import { CheckIcon, CopyIcon, InfoIcon, ShieldIcon } from '@/components/ui/icons'

// O painel do Programa Advocme Parceiros — só o desenho, sem rede (a página em
// pages/PartnersPage.tsx busca e passa os dados). Separado para o teste poder
// conferir a cópia obrigatória e a ausência de dado pessoal sem servidor.
//
// O TOM: ferramenta de trabalho entre colegas, não campanha. Nada de ranking,
// placar, medalha, "ganhe", "comissão" ou contagem regressiva. O que o parceiro vê
// de cada indicação é a situação e a data — nunca quem é.

const COMO_FUNCIONA = [
  'Compartilhe o Advocme com outro profissional da advocacia.',
  'A nova conta contrata PRO ou MAX.',
  'Após a confirmação do pagamento, seu MAX é prorrogado.',
]

const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-deep'

export interface AcoesDoPainel {
  onAceitar?: () => void
  aceitando?: boolean
  onCopiar?: () => void
  copiado?: boolean | null
  onMais?: () => void
  carregandoMais?: boolean
  erro?: string | null
}

export function PainelDoProgramaParceiros({ dados, ...acoes }: { dados: PainelDoParceiro } & AcoesDoPainel) {
  return (
    <div className="space-y-4">
      <header>
        <p className={eyebrow}>Advocme Parceiros</p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{dados.chamada}</p>
      </header>

      {acoes.erro && (
        <p role="alert" className="rounded-lg border border-burgundy/30 bg-burgundy/[0.06] px-3 py-2 text-[13px] text-burgundy">
          {acoes.erro}
        </p>
      )}

      {dados.status === 'invited' ? <Convite dados={dados} {...acoes} /> : <Participacao dados={dados} {...acoes} />}

      <ComoFunciona />
      <AvisoObrigatorio texto={dados.aviso} />
    </div>
  )
}

function Convite({ dados, onAceitar, aceitando }: { dados: PainelConvidado } & AcoesDoPainel) {
  const [li, setLi] = useState(false)
  return (
    <section className="card-paper p-4 sm:p-6" aria-label="Convite para o programa">
      <h2 className="font-display text-[20px] font-semibold leading-tight text-ink">Você foi convidado</h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
        Ao aceitar, você recebe {dados.beneficioInicialDias} dias de acesso ao MAX, uma única vez.
      </p>
      {dados.avisos.pro && <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{dados.avisos.pro}</p>}
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{dados.avisos.fimSemCobranca}</p>

      <h3 className={`${eyebrow} mt-5`}>Regras do programa</h3>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-soft">
        {dados.regras.itens.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p className="mt-2 text-[11.5px] text-ink-faint">Versão das regras: {dados.regras.versao}</p>

      {dados.bloqueio ? (
        <div className="mt-5 rounded-lg border border-brass/40 bg-brass/10 p-3 text-[13px] leading-relaxed text-ink">
          <p>{dados.bloqueio}</p>
          <Link to="/assinatura" className="mt-2 inline-block font-semibold text-burgundy underline-offset-4 hover:underline">
            Abrir Minha assinatura
          </Link>
        </div>
      ) : (
        <div className="mt-5">
          <label className="flex items-start gap-2.5 text-[13.5px] leading-snug text-ink">
            <input
              type="checkbox"
              checked={li}
              onChange={(e) => setLi(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-burgundy"
            />
            Li e aceito as regras do Programa Advocme Parceiros.
          </label>
          <button
            type="button"
            disabled={!li || aceitando}
            onClick={onAceitar}
            className="btn-primary mt-4 w-full !py-3 disabled:opacity-50"
          >
            {aceitando ? 'Registrando…' : 'Aceitar e participar'}
          </button>
        </div>
      )}
    </section>
  )
}

function Participacao({
  dados,
  onCopiar,
  copiado,
  onMais,
  carregandoMais,
}: { dados: PainelParticipante } & AcoesDoPainel) {
  const ate = dataDoBeneficio(dados.benefitUntil)
  return (
    <>
      {dados.status === 'suspended' && (
        <p className="rounded-lg border border-brass/40 bg-brass/10 px-3 py-2.5 text-[13px] leading-relaxed text-ink">
          {dados.proximaAcao}
        </p>
      )}
      {dados.status === 'ended' && (
        <p className="rounded-lg border border-ink/15 bg-paper-soft px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
          {dados.proximaAcao}
        </p>
      )}

      {dados.referralUrl && (
        <section className="card-paper p-4 sm:p-5" aria-label="Seu link">
          <h2 className={eyebrow}>Seu link</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-ink/15 bg-paper px-3 py-2 font-mono text-[13px] text-ink">
              {linkLegivel(dados.referralUrl)}
            </code>
            <button
              type="button"
              onClick={onCopiar}
              disabled={dados.status !== 'active'}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-burgundy/40 hover:text-burgundy disabled:opacity-50"
            >
              {copiado ? <CheckIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          {copiado === false && (
            <p className="mt-2 text-[12px] text-ink-faint">Não deu para copiar aqui. Selecione o link acima e copie à mão.</p>
          )}
          {dados.status === 'active' && <p className="mt-2 text-[12.5px] text-ink-faint">{dados.proximaAcao}</p>}
        </section>
      )}

      <section className="card-paper p-4 sm:p-5" aria-label="Seu benefício">
        <h2 className={eyebrow}>Seu benefício</h2>
        <p className="mt-1.5 font-display text-[20px] font-semibold leading-tight text-ink">
          {dados.activeBenefit && ate ? `MAX até ${ate}` : 'Sem acesso adicional ao MAX agora'}
        </p>
        {dados.avisos.pro && <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{dados.avisos.pro}</p>}
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{dados.avisos.fimSemCobranca}</p>
      </section>

      <section className="card-paper p-4 sm:p-5" aria-label="Indicações">
        <h2 className={eyebrow}>Indicações</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Total rotulo="Cadastros" valor={dados.totais.cadastrados} />
          <Total rotulo="Confirmadas" valor={dados.totais.conversoes} />
          <Total rotulo="Em validação" valor={dados.totais.pendentes} />
          <Total rotulo="Revogadas" valor={dados.totais.revogadas} />
        </dl>

        {dados.indicacoes.itens.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-faint">Nenhuma indicação ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink/[0.08] border-t border-ink/[0.08]">
            {dados.indicacoes.itens.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
                <span className="text-[13.5px] font-medium text-ink">{i.rotulo}</span>
                <span className="text-[12.5px] text-ink-soft">
                  {ROTULO_DA_SITUACAO[i.situacao]}
                  {i.dias ? ` · ${i.dias} dias` : ''}
                  {i.situacao === 'validacao' && i.validaEm ? ` · até ${dataDoBeneficio(i.validaEm)}` : ''}
                </span>
                <span className="w-full text-[11.5px] text-ink-faint">{dataDoBeneficio(i.data)}</span>
              </li>
            ))}
          </ul>
        )}
        {dados.indicacoes.temMais && (
          <button
            type="button"
            onClick={onMais}
            disabled={carregandoMais}
            className="mt-3 text-[13px] font-semibold text-burgundy underline-offset-4 hover:underline disabled:opacity-50"
          >
            {carregandoMais ? 'Carregando…' : 'Ver mais'}
          </button>
        )}
      </section>
    </>
  )
}

function Total({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-paper px-3 py-2">
      <dt className="text-[11.5px] text-ink-faint">{rotulo}</dt>
      <dd className="font-display text-[20px] font-semibold tabular-nums text-ink">{valor}</dd>
    </div>
  )
}

function ComoFunciona() {
  return (
    <section className="card-paper p-4 sm:p-5" aria-label="Como funciona">
      <h2 className={eyebrow}>Como funciona</h2>
      <ol className="mt-2 space-y-2">
        {COMO_FUNCIONA.map((passo, i) => (
          <li key={passo} className="flex items-start gap-3 text-[13.5px] leading-snug text-ink">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper-soft">
              {i + 1}
            </span>
            {passo}
          </li>
        ))}
      </ol>
    </section>
  )
}

function AvisoObrigatorio({ texto }: { texto: string }) {
  return (
    <aside className="flex items-start gap-2.5 rounded-lg border border-ink/10 bg-paper-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
      <ShieldIcon width={16} height={16} className="mt-0.5 shrink-0 text-burgundy" aria-hidden />
      <span>{texto}</span>
    </aside>
  )
}

/** Para quem chega sem participar: não há convite aberto ao público. */
export function SemParticipacao() {
  return (
    <section className="card-paper flex items-start gap-3 p-4 sm:p-5">
      <InfoIcon width={18} height={18} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden />
      <p className="text-[13.5px] leading-relaxed text-ink-soft">
        Sua conta não participa do Programa Advocme Parceiros. A participação é feita por convite do Advocme.
      </p>
    </section>
  )
}
