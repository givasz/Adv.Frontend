import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { canUseContratos } from '@/lib/plans'
import { hostLabel } from '@/lib/publicUrl'
import { modeloDoRascunho } from '@/lib/contratos/proprio'
import {
  camposVisiveis,
  pendencias,
  trechosPendentes,
  type DocumentoMontado,
} from '@/lib/contratos/modelos'
import {
  novoId,
  obterRascunho,
  salvarRascunho,
  type EtapaDoRascunho,
  type Rascunho,
} from '@/lib/contratos/rascunhos'
import { contextoDoPerfil, nomeDaParte } from '@/lib/contratos/contexto'
import { DECLARACOES } from '@/lib/contratos/versoes'
import { caracteresSemImpressao } from '@/lib/contratos/imprimivel'
import { gerarPdf, nomeDoArquivo, type OpcoesDoPdf } from '@/lib/contratos/pdf'
import { impressoesParaConferir, lerArquivo, sha256Hex } from '@/lib/contratos/impressao'
import { sortearCodigo } from '@/lib/contratos/codigo'
import { CodigoEmUso, registrarAssinado, registrarRevisado } from '@/lib/contratos/registros'
import { dataEHora, entregarPdf, tamanhoLegivel } from '@/lib/contratos/entrega'
import { SubPage, comVolta, useVoltar } from '@/components/ui/SubPage'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { ArrowRight, CheckIcon, DocIcon, InfoIcon, LockIcon, PenIcon } from '@/components/ui/icons'
import { Etapas } from '@/components/contratos/Etapas'
import { CampoDoModelo, idDoCampo } from '@/components/contratos/CampoDoModelo'
import { FolhaDoDocumento } from '@/components/contratos/FolhaDoDocumento'
import { ReciboDeRegistro } from '@/components/contratos/ReciboDeRegistro'
import { ComoAssinar } from '@/components/contratos/ComoAssinar'
import { SeletorDeArquivo } from '@/components/contratos/SeletorDeArquivo'
import { CARTAO } from '@/components/contratos/estilos'

// /contratos/rascunho/:id — um documento, da ficha à assinatura.
//
// A ORDEM DAS ETAPAS É A REGRA, não a navegação:
//   dados → revisão → registro → assinatura
// Não se registra sem revisar (a declaração é exigida aqui e no servidor), não
// se revisa um texto com "[preencher]" sobrando, e depois de registrado o texto
// TRAVA: mudar uma vírgula num arquivo registrado seria criar um documento que
// não bate com a própria impressão digital. Corrigir vira "nova versão", com
// outro código — e o registro antigo continua dizendo a verdade sobre o antigo.

const MAX_ARQUIVO = 50 * 1024 * 1024

type Trabalho = 'minuta' | 'registro' | 'baixar' | 'analisar' | 'assinada' | null

interface Analise {
  nome: string
  tamanho: number
  hash: string
  contemOriginal: boolean
}

export default function ContratoPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const voltar = useVoltar('/contratos')
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [perfil, setPerfil] = useState<Profile | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null | undefined>(undefined)
  const [tentouAvancar, setTentouAvancar] = useState(false)
  const [confirmandoRemontar, setConfirmandoRemontar] = useState(false)
  const [declarou, setDeclarou] = useState({ revisei: false, responsabilidade: false })
  const [faltouDeclarar, setFaltouDeclarar] = useState(false)
  const [trabalho, setTrabalho] = useState<Trabalho>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [naoGravou, setNaoGravou] = useState(false)
  const [analise, setAnalise] = useState<Analise | null>(null)
  const pdfRegistrado = useRef<Uint8Array | null>(null)
  const topo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .getDraft()
      .then(setPerfil)
      .catch((e: unknown) => {
        if (e instanceof SessaoExpirada) return
        setErroCarga(e instanceof Error ? e.message : 'Falha ao carregar o perfil.')
      })
  }, [])

  // Trocar de documento (a "nova versão" abre na mesma rota) zera tudo o que é
  // DESTE documento — a declaração principalmente: ela é feita documento a
  // documento, e não pode chegar marcada de outro.
  useEffect(() => {
    setRascunho(userId ? obterRascunho(userId, id) : null)
    setDeclarou({ revisei: false, responsabilidade: false })
    setFaltouDeclarar(false)
    setTentouAvancar(false)
    setConfirmandoRemontar(false)
    setAnalise(null)
    setErroAcao(null)
    pdfRegistrado.current = null
  }, [userId, id])

  // A barra de ações fica colada embaixo: sem folga na rolagem, o campo que
  // recebe o foco pelo Tab podia ficar escondido atrás dela.
  useEffect(() => {
    const html = document.documentElement
    const antes = html.style.scrollPaddingBottom
    html.style.scrollPaddingBottom = '6rem'
    return () => {
      html.style.scrollPaddingBottom = antes
    }
  }, [])

  // Toda mudança vai direto para o aparelho — não existe botão "salvar" para
  // esquecer de apertar.
  const atualizar = useCallback(
    (parcial: Partial<Rascunho>) => {
      setRascunho((atual) => {
        if (!atual) return atual
        const novo = { ...atual, ...parcial }
        setNaoGravou(!salvarRascunho(userId, novo))
        return novo
      })
    },
    [userId],
  )

  // Da plataforma, ou a CÓPIA do modelo próprio que o rascunho levou ao começar.
  const modelo = useMemo(() => (rascunho ? modeloDoRascunho(rascunho) : null), [rascunho])
  const ctx = useMemo(() => (perfil ? contextoDoPerfil(perfil) : null), [perfil])
  const pend = useMemo(() => (modelo && rascunho ? pendencias(modelo, rascunho.dados) : []), [modelo, rascunho])
  const doc = rascunho?.documento ?? null
  const pendentesNoTexto = doc ? trechosPendentes(doc) : 0
  const semImpressao = useMemo(() => {
    if (!doc) return []
    const tudo = [doc.titulo, ...doc.clausulas.flatMap((c) => [c.titulo, c.texto]), ...doc.fecho].join('\n')
    return caracteresSemImpressao(tudo)
  }, [doc])

  // Carrega o gerador de PDF assim que a revisão abre: o clique em "baixar" não
  // pode esperar o download da biblioteca, senão o celular perde o gesto e
  // recusa a folha de compartilhar.
  useEffect(() => {
    if (rascunho?.etapa && rascunho.etapa !== 'dados') void import('pdf-lib')
  }, [rascunho?.etapa])

  const irPara = (etapa: EtapaDoRascunho) => {
    setErroAcao(null)
    atualizar({ etapa })
    topo.current?.scrollIntoView({ block: 'start' })
    window.scrollTo({ top: 0 })
  }

  if (erroCarga) return <FalhaAoCarregar mensagem={erroCarga} />
  if (!perfil || !ctx || rascunho === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" role="status" aria-label="Carregando" />
      </div>
    )
  }

  if (!rascunho || !modelo) {
    return (
      <SubPage title="Documento não encontrado" backTo={voltar} icon={<DocIcon width={20} height={20} aria-hidden />}>
        <p className={`${CARTAO} text-[14px] leading-relaxed text-ink-soft`}>
          Este documento não está neste navegador. Os rascunhos ficam só no aparelho em que foram
          feitos — se você começou em outro, abra por lá.
        </p>
        <Link to="/contratos" className="btn-primary w-full !py-3 sm:w-auto">
          Ver meus documentos
        </Link>
      </SubPage>
    )
  }

  const liberado = canUseContratos(perfil.plan)
  const registro = rascunho.registro
  const etapa = rascunho.etapa
  const parte = nomeDaParte(rascunho)

  const alcancaveis: EtapaDoRascunho[] = registro
    ? ['registro', 'assinatura']
    : ['dados', ...(doc ? (['revisao'] as const) : []), ...(doc && !pendentesNoTexto && !semImpressao.length ? (['registro'] as const) : [])]

  const opcoesDoRegistro = (r: NonNullable<Rascunho['registro']>): OpcoesDoPdf => ({
    codigo: r.codigo,
    emitidoEm: r.emitidoEm,
    autor: r.autor,
    enderecoDeConferencia: r.enderecoDeConferencia,
  })

  // ---- Ações ---------------------------------------------------------------

  const montar = (forcar = false) => {
    if (pend.length) {
      setTentouAvancar(true)
      const primeiro = document.getElementById(idDoCampo(pend[0]!.campo.id))
      primeiro?.focus({ preventScroll: true })
      primeiro?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    if (doc && !forcar) {
      setConfirmandoRemontar(true)
      return
    }
    setConfirmandoRemontar(false)
    atualizar({ documento: modelo.montar(rascunho.dados, ctx), etapa: 'revisao', modeloVersao: modelo.versao })
    window.scrollTo({ top: 0 })
  }

  const baixarMinuta = async () => {
    if (!doc) return
    setTrabalho('minuta')
    setErroAcao(null)
    try {
      const bytes = await gerarPdf(doc, {
        codigo: null,
        emitidoEm: new Date().toISOString(),
        autor: ctx.advogado.nome,
        enderecoDeConferencia: `${hostLabel()}/contratos/conferir`,
      })
      await entregarPdf(bytes, nomeDoArquivo(doc, null))
    } catch {
      setErroAcao('Não foi possível gerar a minuta. Tente de novo.')
    } finally {
      setTrabalho(null)
    }
  }

  const registrar = async () => {
    if (!doc) return
    if (!declarou.revisei || !declarou.responsabilidade) {
      setFaltouDeclarar(true)
      document.getElementById(declarou.revisei ? 'declaracao-responsabilidade' : 'declaracao-revisei')?.focus()
      return
    }
    setTrabalho('registro')
    setErroAcao(null)
    try {
      for (let tentativa = 0; ; tentativa++) {
        const opcoes: OpcoesDoPdf = {
          codigo: sortearCodigo(),
          emitidoEm: new Date().toISOString(),
          autor: ctx.advogado.nome,
          enderecoDeConferencia: `${hostLabel()}/contratos/conferir`,
        }
        const bytes = await gerarPdf(doc, opcoes)
        const hash = await sha256Hex(bytes)
        try {
          const r = await registrarRevisado({
            modelo: rascunho.modelo,
            modeloVersao: rascunho.modeloVersao,
            codigo: opcoes.codigo!,
            hash,
            tamanho: bytes.length,
          })
          pdfRegistrado.current = bytes
          atualizar({
            registro: {
              id: r.id,
              codigo: r.codigo,
              hash: r.hash,
              tamanho: r.tamanho,
              emitidoEm: opcoes.emitidoEm,
              registradoEm: r.registradoEm,
              autor: opcoes.autor,
              enderecoDeConferencia: opcoes.enderecoDeConferencia,
            },
          })
          return
        } catch (e) {
          // Código sorteado já existia: sorteia outro e refaz o PDF (o código
          // está impresso nele, então o hash muda junto).
          if (e instanceof CodigoEmUso && tentativa < 3) continue
          throw e
        }
      }
    } catch (e) {
      setErroAcao(e instanceof Error && e.message ? e.message : 'Não foi possível registrar. Tente de novo.')
    } finally {
      setTrabalho(null)
    }
  }

  const baixarRegistrado = async () => {
    if (!doc || !registro) return
    setTrabalho('baixar')
    setErroAcao(null)
    try {
      let bytes = pdfRegistrado.current
      if (!bytes) {
        bytes = await gerarPdf(doc, opcoesDoRegistro(registro))
        // Refeito a partir do texto guardado — só é entregue se for, byte a
        // byte, o arquivo registrado. Um PDF "quase igual" não serve para nada.
        if ((await sha256Hex(bytes)) !== registro.hash) {
          setErroAcao(
            'Não foi possível refazer aqui o arquivo idêntico ao registrado. Use o PDF que você baixou no dia do registro.',
          )
          return
        }
        pdfRegistrado.current = bytes
      }
      await entregarPdf(bytes, nomeDoArquivo(doc, registro.codigo))
    } catch {
      setErroAcao('Não foi possível gerar o PDF. Tente de novo.')
    } finally {
      setTrabalho(null)
    }
  }

  const analisarAssinada = async (f: File) => {
    if (!registro) return
    setAnalise(null)
    setErroAcao(null)
    if (f.size > MAX_ARQUIVO) {
      setErroAcao('Este arquivo passa de 50 MB — não parece um contrato assinado. Confira o arquivo escolhido.')
      return
    }
    setTrabalho('analisar')
    try {
      const bytes = await lerArquivo(f)
      const { inteiro, trechos } = await impressoesParaConferir(bytes)
      if (inteiro.hash === registro.hash) {
        setErroAcao('Este é o próprio PDF registrado, ainda sem assinatura. Escolha o arquivo que o assinador devolveu.')
        return
      }
      setAnalise({
        nome: f.name,
        tamanho: bytes.length,
        hash: inteiro.hash,
        contemOriginal: trechos.some((t) => t.hash === registro.hash),
      })
    } catch {
      setErroAcao('Não foi possível ler este arquivo. Tente de novo.')
    } finally {
      setTrabalho(null)
    }
  }

  const registrarVersaoAssinada = async () => {
    if (!registro || !analise) return
    setTrabalho('assinada')
    setErroAcao(null)
    try {
      const r = await registrarAssinado({ origemCodigo: registro.codigo, hash: analise.hash, tamanho: analise.tamanho })
      const ja = (rascunho.assinadas ?? []).some((a) => a.hash === r.hash)
      if (!ja) {
        atualizar({
          assinadas: [
            ...(rascunho.assinadas ?? []),
            { hash: r.hash, tamanho: r.tamanho, registradoEm: r.registradoEm, nomeDoArquivo: analise.nome },
          ],
        })
      }
      setAnalise(null)
    } catch (e) {
      setErroAcao(e instanceof Error && e.message ? e.message : 'Não foi possível registrar. Tente de novo.')
    } finally {
      setTrabalho(null)
    }
  }

  const novaVersao = () => {
    if (!doc) return
    const agora = new Date().toISOString()
    const copia: Rascunho = {
      id: novoId(),
      modelo: rascunho.modelo,
      modeloVersao: rascunho.modeloVersao,
      proprio: rascunho.proprio,
      dados: { ...rascunho.dados },
      documento: structuredClone(doc),
      etapa: 'revisao',
      criadoEm: agora,
      atualizadoEm: agora,
    }
    salvarRascunho(userId, copia)
    navigate(comVolta(`/contratos/rascunho/${copia.id}`, '/contratos'), { replace: false })
  }

  // ---- Rodapé de ações, por etapa ------------------------------------------

  const ocupado = trabalho !== null
  let rodape: React.ReactNode = null
  if (etapa === 'dados') {
    rodape = (
      <>
        <span className="mr-auto hidden text-[12.5px] text-ink-faint min-[400px]:inline" aria-live="polite">
          {pend.length ? `${pend.length} ${pend.length === 1 ? 'campo a preencher' : 'campos a preencher'}` : 'Tudo preenchido'}
        </span>
        <button type="button" onClick={() => montar()} className="btn-primary w-full !py-3 text-[14px] min-[400px]:w-auto">
          Montar a minuta
          <ArrowRight width={15} height={15} aria-hidden />
        </button>
      </>
    )
  } else if (etapa === 'revisao') {
    const bloqueio = pendentesNoTexto > 0 || semImpressao.length > 0
    rodape = (
      <>
        <button type="button" onClick={() => irPara('dados')} className="btn-ghost !py-2.5 text-[14px]">
          Dados
        </button>
        <button
          type="button"
          onClick={() => irPara('registro')}
          disabled={bloqueio}
          className="btn-primary flex-1 !py-3 text-[14px] min-[400px]:flex-none"
        >
          Revisei, seguir
          <ArrowRight width={15} height={15} aria-hidden />
        </button>
      </>
    )
  } else if (etapa === 'registro' && !registro) {
    rodape = (
      <>
        <button type="button" onClick={() => irPara('revisao')} disabled={ocupado} className="btn-ghost !py-2.5 text-[14px]">
          Revisão
        </button>
        <button
          type="button"
          onClick={registrar}
          disabled={!liberado || ocupado}
          className="btn-primary flex-1 !py-3 text-[14px] min-[400px]:flex-none"
        >
          {trabalho === 'registro' ? 'Registrando…' : 'Registrar e gerar o PDF'}
        </button>
      </>
    )
  } else if (etapa === 'registro' && registro) {
    rodape = (
      <button type="button" onClick={() => irPara('assinatura')} className="btn-primary w-full !py-3 text-[14px] min-[400px]:w-auto">
        Como assinar
        <ArrowRight width={15} height={15} aria-hidden />
      </button>
    )
  }

  const erroNaTela = erroAcao && (
    <p role="alert" className="rounded-xl2 border border-burgundy/30 bg-burgundy/[0.05] px-4 py-3 text-[13.5px] leading-relaxed text-burgundy">
      {erroAcao}
    </p>
  )

  const SUBTITULO: Record<EtapaDoRascunho, string> = {
    dados: 'Preencha o que o modelo precisa. Você revisa o texto inteiro na próxima etapa.',
    revisao: 'Leia cada cláusula e mude o que for preciso — o texto final é seu.',
    registro: registro ? 'Registrado. Baixe o PDF: é este arquivo que deve ser assinado.' : 'Confirme a revisão e gere o PDF com código.',
    assinatura: 'Assine o PDF e, se quiser, registre também a versão assinada.',
  }

  return (
    <SubPage
      title={modelo.nome}
      documentTitle={modelo.nome}
      subtitle={SUBTITULO[etapa]}
      icon={<PenIcon width={20} height={20} aria-hidden />}
      backTo={voltar}
      backLabel="Documentos"
      footer={rodape}
    >
      <div ref={topo} className="scroll-mt-20">
        {/* O nome da parte fica numa linha só, cortado — no título ele fazia o
            cabeçalho ocupar quatro linhas no celular. */}
        {parte && (
          <p className="-mt-2 mb-3 truncate text-[13px] text-ink-faint" title={parte}>
            Cliente:{' '}
            <span className="font-medium text-ink-soft">{parte}</span>
          </p>
        )}
        <Etapas atual={etapa} alcancaveis={alcancaveis} onIr={irPara} />
      </div>

      {naoGravou && (
        <p role="alert" className="rounded-xl2 border border-burgundy/30 bg-burgundy/[0.05] px-4 py-3 text-[13.5px] text-burgundy">
          Este navegador não deixou guardar as últimas mudanças (aba privativa ou armazenamento cheio). Não
          feche a página antes de gerar o PDF.
        </p>
      )}

      {/* ---------------- 1. DADOS ---------------- */}
      {etapa === 'dados' && (
        <>
          {modelo.grupos.map((g) => {
            const campos = camposVisiveis(g, rascunho.dados)
            return (
              <section key={g.id} className={CARTAO} aria-labelledby={`grupo-${g.id}`}>
                <h2 id={`grupo-${g.id}`} className="font-display text-[17px] font-semibold text-ink">
                  {g.titulo}
                </h2>
                {g.descricao && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-faint">{g.descricao}</p>}
                {g.id === 'advogado' && (
                  <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-ink/[0.03] px-3.5 py-2.5 text-[13.5px] text-ink">
                    <span className="font-semibold">{ctx.advogado.nome || 'Sem nome no perfil'}</span>
                    <span className="text-ink-soft">{ctx.advogado.oab || 'sem inscrição no perfil'}</span>
                    <Link
                      to={comVolta('/editor?section=identidade', `/contratos/rascunho/${rascunho.id}`)}
                      className="ml-auto py-1 text-[12.5px] font-semibold text-burgundy underline underline-offset-2"
                    >
                      Corrigir no perfil
                    </Link>
                  </p>
                )}
                <div className="mt-4 space-y-4">
                  {campos.map((c) => {
                    const p = tentouAvancar ? pend.find((x) => x.campo.id === c.id) : undefined
                    return (
                      <CampoDoModelo
                        key={c.id}
                        campo={c}
                        valor={rascunho.dados[c.id] ?? ''}
                        onChange={(v) => atualizar({ dados: { ...rascunho.dados, [c.id]: v } })}
                        erro={p ? (p.motivo === 'vazio' ? 'Preencha este campo.' : 'Confira este valor.') : undefined}
                      />
                    )
                  })}
                </div>
              </section>
            )
          })}

          {confirmandoRemontar && (
            <div role="alertdialog" aria-labelledby="remontar-titulo" className="rounded-xl2 border border-brass/40 bg-brass/[0.07] p-4">
              <p id="remontar-titulo" className="text-[14px] font-semibold text-ink">
                Montar de novo substitui o texto que você editou na revisão.
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                Os dados novos entram, e cada mudança que você fez nas cláusulas se perde.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => montar(true)} className="btn-primary !py-2.5 text-[13.5px]">
                  Montar de novo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmandoRemontar(false)
                    irPara('revisao')
                  }}
                  className="btn-ghost !py-2.5 text-[13.5px]"
                >
                  Manter meu texto
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---------------- 2. REVISÃO ---------------- */}
      {etapa === 'revisao' && doc && (
        <>
          <p className="flex gap-2.5 rounded-xl2 border border-ink/10 bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
            <InfoIcon width={17} height={17} className="mt-0.5 shrink-0 text-brass-deep" aria-hidden />
            <span>
              Esta minuta foi montada a partir de um modelo padrão, <strong className="font-semibold text-ink">sem
              inteligência artificial</strong>. Ela é ponto de partida: confira nomes, números e datas, e
              ajuste as cláusulas ao caso.
            </span>
          </p>

          {pendentesNoTexto > 0 && (
            <p role="status" className="rounded-xl2 border border-burgundy/25 bg-burgundy/[0.04] px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-burgundy">
                {pendentesNoTexto} {pendentesNoTexto === 1 ? 'trecho' : 'trechos'} a completar.
              </strong>{' '}
              Troque cada “[preencher: …]” pelo texto certo — ou volte aos dados e monte de novo.
            </p>
          )}
          {semImpressao.length > 0 && (
            <p role="status" className="rounded-xl2 border border-burgundy/25 bg-burgundy/[0.04] px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-burgundy">Símbolos que não saem no PDF:</strong>{' '}
              <span className="font-mono">{semImpressao.join(' ')}</span>. Troque por palavras ou tire do texto.
            </p>
          )}

          <FolhaDoDocumento doc={doc} onChange={(d: DocumentoMontado) => atualizar({ documento: d })} marcaDagua="Minuta" />

          <div className={`${CARTAO} flex flex-col gap-3 sm:flex-row sm:items-center`}>
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-soft">
              Quer mostrar ao cliente antes? Baixe uma cópia marcada “minuta sem registro” — ela não serve
              para assinar.
            </p>
            <button type="button" onClick={baixarMinuta} disabled={ocupado} className="btn-ghost shrink-0 !py-2.5 text-[13.5px]">
              {trabalho === 'minuta' ? 'Gerando…' : 'Baixar minuta'}
            </button>
          </div>
          {erroNaTela}
        </>
      )}

      {/* ---------------- 3. REGISTRO ---------------- */}
      {etapa === 'registro' && doc && !registro && (
        <>
          <section className={CARTAO} aria-labelledby="o-que-fica">
            <h2 id="o-que-fica" className="font-display text-[17px] font-semibold text-ink">
              O que fica registrado
            </h2>
            <div className="mt-3 grid gap-3 text-[13px] leading-relaxed sm:grid-cols-2">
              <div className="rounded-lg bg-brass/[0.07] px-3.5 py-3">
                <p className="font-semibold text-ink">Guardamos</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-soft marker:text-brass">
                  <li>a impressão digital do PDF (SHA-256)</li>
                  <li>o código impresso no rodapé</li>
                  <li>data, hora e o endereço de onde você confirmou</li>
                  <li>seu nome e sua inscrição, como estão no perfil</li>
                </ul>
              </div>
              <div className="rounded-lg bg-ink/[0.04] px-3.5 py-3">
                <p className="font-semibold text-ink">Não guardamos</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-soft marker:text-ink-faint">
                  <li>o texto do documento</li>
                  <li>nome, CPF e endereço do cliente</li>
                  <li>valores e o assunto do caso</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
              O registro permite a qualquer pessoa conferir, depois, que um PDF é idêntico ao registrado. Ele não
              atesta o conteúdo nem a validade do documento, e não substitui a assinatura.
            </p>
          </section>

          {!liberado ? (
            <section className="rounded-xl2 border border-brass/30 bg-brass/[0.06] p-5">
              <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brass-deep">
                <LockIcon width={12} height={12} aria-hidden />
                Plano Max
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink">
                Registrar e gerar o PDF com código faz parte do Max. A minuta para conferência continua
                disponível na etapa de revisão.
              </p>
              <Link
                to={comVolta(`/planos?recurso=contratos&plano=${perfil.plan}`, `/contratos/rascunho/${rascunho.id}`)}
                className="btn-primary mt-3 w-full !py-3 text-[14px] sm:w-auto"
              >
                Ver o plano Max
              </Link>
            </section>
          ) : (
            <fieldset className={CARTAO} aria-describedby={faltouDeclarar ? 'declaracao-erro' : undefined}>
              <legend className="sr-only">Declaração de revisão</legend>
              <p className="font-display text-[17px] font-semibold text-ink">Antes de registrar</p>
              <div className="mt-3 space-y-2">
                {(['revisei', 'responsabilidade'] as const).map((k) => (
                  <label
                    key={k}
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border bg-paper-soft px-3.5 py-3 text-[14px] leading-snug text-ink transition-colors has-[:checked]:border-burgundy/50 has-[:checked]:bg-burgundy/[0.04] ${
                      faltouDeclarar && !declarou[k] ? 'border-burgundy/60' : 'border-ink/15'
                    }`}
                  >
                    <input
                      id={`declaracao-${k}`}
                      type="checkbox"
                      checked={declarou[k]}
                      onChange={(e) => setDeclarou((d) => ({ ...d, [k]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-burgundy"
                    />
                    <span>{DECLARACOES[k]}</span>
                  </label>
                ))}
              </div>
              <p id="declaracao-erro" aria-live="polite" className={faltouDeclarar && !(declarou.revisei && declarou.responsabilidade) ? 'mt-2 text-[12.5px] font-medium text-burgundy' : 'sr-only'}>
                {faltouDeclarar && !(declarou.revisei && declarou.responsabilidade) ? 'Marque as duas confirmações para registrar.' : ''}
              </p>
            </fieldset>
          )}

          <details className="group rounded-xl2 border border-ink/10 bg-paper/60">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[13.5px] font-semibold text-ink">
              Ver o texto que será registrado
              <ArrowRight width={14} height={14} className="rotate-90 text-ink-faint transition-transform group-open:-rotate-90" aria-hidden />
            </summary>
            <div className="px-2 pb-3 sm:px-3">
              <FolhaDoDocumento doc={doc} />
            </div>
          </details>
          {erroNaTela}
        </>
      )}

      {etapa === 'registro' && doc && registro && (
        <>
          <ReciboDeRegistro codigo={registro.codigo} hash={registro.hash} registradoEm={registro.registradoEm} />
          <section className={`${CARTAO} flex flex-col gap-3`}>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-ink">É este PDF que deve ser assinado.</strong> Qualquer mudança
              no arquivo — até salvar de novo em outro programa — muda a impressão digital. Para corrigir o texto,
              faça uma nova versão.
            </p>
            <button type="button" onClick={baixarRegistrado} disabled={ocupado} className="btn-primary w-full !py-3 text-[14px] sm:w-auto sm:self-start">
              <DocIcon width={16} height={16} aria-hidden />
              {trabalho === 'baixar' ? 'Preparando…' : `Baixar o PDF (${tamanhoLegivel(registro.tamanho)})`}
            </button>
          </section>
          {erroNaTela}
        </>
      )}

      {/* ---------------- 4. ASSINATURA ---------------- */}
      {etapa === 'assinatura' && doc && registro && (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <ReciboDeRegistro codigo={registro.codigo} hash={registro.hash} registradoEm={registro.registradoEm} compacto />
            <button type="button" onClick={baixarRegistrado} disabled={ocupado} className="btn-ghost !py-3 text-[14px]">
              <DocIcon width={16} height={16} aria-hidden />
              {trabalho === 'baixar' ? 'Preparando…' : 'Baixar o PDF'}
            </button>
          </div>

          <ComoAssinar />

          <section className={CARTAO} aria-labelledby="versao-assinada">
            <h2 id="versao-assinada" className="font-display text-[17px] font-semibold text-ink">
              Registrar a versão assinada
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              Opcional. Guarda também a impressão digital do arquivo que voltou do assinador. O arquivo é lido aqui
              no aparelho e não é enviado.
            </p>
            <div className="mt-3">
              <SeletorDeArquivo
                onArquivo={analisarAssinada}
                rotulo={trabalho === 'analisar' ? 'Lendo o arquivo…' : 'Escolher o PDF assinado'}
                dica="Toque para escolher, ou arraste o arquivo até aqui."
                ocupado={trabalho === 'analisar' || trabalho === 'assinada'}
                nomeAtual={analise?.nome}
                tamanhoAtual={analise?.tamanho}
              />
            </div>

            {analise && (
              <div
                className={`mt-3 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed ${
                  analise.contemOriginal ? 'bg-brass/[0.08] text-ink-soft' : 'bg-burgundy/[0.05] text-ink-soft'
                }`}
                role="status"
              >
                {analise.contemOriginal ? (
                  <p>
                    <strong className="font-semibold text-ink">O documento registrado está intacto no começo deste arquivo</strong>,
                    e as assinaturas vêm depois dele.
                  </p>
                ) : (
                  <p>
                    <strong className="font-semibold text-burgundy">Este arquivo não traz o documento registrado sem alteração.</strong>{' '}
                    Plataformas de assinatura costumam gerar um PDF novo. Confira se o texto é o mesmo antes de registrar.
                  </p>
                )}
                <button
                  type="button"
                  onClick={registrarVersaoAssinada}
                  disabled={ocupado}
                  className="btn-primary mt-3 w-full !py-2.5 text-[13.5px] sm:w-auto"
                >
                  {trabalho === 'assinada' ? 'Registrando…' : 'Registrar esta versão assinada'}
                </button>
              </div>
            )}

            {(rascunho.assinadas ?? []).length > 0 && (
              <ul className="mt-4 divide-y divide-ink/[0.07] rounded-lg border border-ink/10">
                {rascunho.assinadas!.map((a) => (
                  <li key={a.hash} className="flex items-start gap-2.5 px-3.5 py-2.5 text-[13px]">
                    <CheckIcon width={15} height={15} className="mt-0.5 shrink-0 text-brass-deep" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{a.nomeDoArquivo}</span>
                      <span className="block text-[12px] text-ink-faint">
                        Registrada em {dataEHora(a.registradoEm)} ·{' '}
                        <span className="font-mono" translate="no">
                          {a.hash.slice(0, 12)}…
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {erroNaTela}

          <section className="rounded-xl2 border border-dashed border-ink/15 p-4 sm:p-5">
            <p className="text-[14px] font-semibold text-ink">Precisa corrigir o texto?</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              O documento registrado não muda. Uma nova versão copia este texto para um rascunho novo, que ganha
              outro código quando for registrado.
            </p>
            <button type="button" onClick={novaVersao} className="btn-ghost mt-3 !py-2.5 text-[13.5px]">
              Fazer nova versão
            </button>
          </section>
        </>
      )}
    </SubPage>
  )
}
