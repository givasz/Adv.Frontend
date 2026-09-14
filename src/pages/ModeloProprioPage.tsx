import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Profile } from '@/lib/types'
import { api, SessaoExpirada } from '@/lib/api'
import { canUseContratos } from '@/lib/plans'
import {
  CAMPOS_PADRAO,
  LIMITES_DO_MODELO_PROPRIO as L,
  QUEM_ASSINA_OPCOES,
  camposDoModelo,
  modeloEmBranco,
  problemasDoModelo,
  type ClausulaDoModeloProprio,
  type ConteudoDoModeloProprio,
  type QuemAssina,
} from '@/lib/contratos/proprio'
import {
  atualizarModeloProprio,
  criarModeloProprio,
  excluirModeloProprio,
  listarModelosProprios,
} from '@/lib/contratos/modelosProprios'
import { SubPage, comVolta, useVoltar } from '@/components/ui/SubPage'
import { FalhaAoCarregar } from '@/components/ui/FalhaAoCarregar'
import { ArrowDownIcon, ArrowUpIcon, InfoIcon, LockIcon, PenIcon, TrashIcon } from '@/components/ui/icons'
import { AreaQueCresce } from '@/components/contratos/CampoDoModelo'
import { CAMPO, CARTAO } from '@/components/contratos/estilos'

// /contratos/modelos/:id — escrever um modelo próprio ("novo" cria).
//
// O que esta tela precisa fazer bem, e nesta ordem:
//   1. dizer, ANTES de a pessoa escrever, que o modelo guarda só texto — e o que
//      é recusado (visível, não em tooltip);
//   2. tornar o campo entre chaves mais fácil que digitar o dado: "Inserir campo"
//      põe {Nome do cliente} onde o cursor está, sem decorar nome nenhum;
//   3. mostrar, enquanto se escreve, o que o servidor vai recusar — e o que o
//      formulário vai pedir quando o modelo for usado.
//
// Inserir campo é um painel em linha dentro da própria cláusula, e não uma
// janela sobreposta (ver "Sem modais"): no celular a lista de campos aparece
// logo abaixo do texto que a pessoa está escrevendo.

interface ClausulaEditavel extends ClausulaDoModeloProprio {
  k: string
}

interface Estado extends Omit<ConteudoDoModeloProprio, 'clausulas'> {
  clausulas: ClausulaEditavel[]
}

let seq = 0
const chave = () => `k${++seq}`
const editavel = (c: ConteudoDoModeloProprio): Estado => ({
  ...c,
  clausulas: c.clausulas.map((x) => ({ ...x, k: chave() })),
})
const conteudoDe = (e: Estado): ConteudoDoModeloProprio => ({
  nome: e.nome,
  quemAssina: e.quemAssina,
  titulo: e.titulo,
  clausulas: e.clausulas.map(({ titulo, texto }) => ({ titulo, texto })),
})

export default function ModeloProprioPage() {
  const { id = 'novo' } = useParams()
  const novo = id === 'novo'
  const navigate = useNavigate()
  const voltar = useVoltar('/contratos')

  const [perfil, setPerfil] = useState<Profile | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [original, setOriginal] = useState('')
  const [naoExiste, setNaoExiste] = useState(false)
  const [lotado, setLotado] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [inserindoEm, setInserindoEm] = useState<string | null>(null)
  const [novoCampo, setNovoCampo] = useState('')
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const elementos = useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>())
  const painelProblemas = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .getDraft()
      .then(setPerfil)
      .catch((e: unknown) => {
        if (e instanceof SessaoExpirada) return
        setErroCarga(e instanceof Error ? e.message : 'Falha ao carregar o perfil.')
      })
    listarModelosProprios()
      .then(({ modelos, limite }) => {
        if (novo) {
          setLotado(modelos.length >= limite)
          const e = editavel(modeloEmBranco())
          setEstado(e)
          setOriginal(JSON.stringify(conteudoDe(e)))
          return
        }
        const m = modelos.find((x) => x.id === id)
        if (!m) {
          setNaoExiste(true)
          return
        }
        const e = editavel(m)
        setEstado(e)
        setOriginal(JSON.stringify(conteudoDe(e)))
      })
      .catch((e: unknown) => setErroCarga(e instanceof Error ? e.message : 'Não foi possível carregar seus modelos.'))
  }, [id, novo])

  const conteudo = useMemo(() => (estado ? conteudoDe(estado) : null), [estado])
  const problemas = useMemo(() => (conteudo ? problemasDoModelo(conteudo) : []), [conteudo])
  const campos = useMemo(() => (conteudo ? camposDoModelo(conteudo) : { padrao: [], proprios: [] }), [conteudo])
  const sujo = !!conteudo && JSON.stringify(conteudo) !== original

  // Fechar a aba com o modelo pela metade avisa antes. Não há rascunho local de
  // modelo — de propósito: o texto do modelo mora no servidor, e só depois de
  // passar pela trava.
  useEffect(() => {
    if (!sujo) return
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  const registrarElemento = useCallback(
    (k: string) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (el) elementos.current.set(k, el)
      else elementos.current.delete(k)
    },
    [],
  )
  // Um callback por chave, estável entre renders (senão o efeito de montagem
  // da área de texto roda a cada tecla).
  const callbacks = useRef(new Map<string, (el: HTMLTextAreaElement | null) => void>())
  const aoMontar = (k: string) => {
    let cb = callbacks.current.get(k)
    if (!cb) callbacks.current.set(k, (cb = registrarElemento(k) as (el: HTMLTextAreaElement | null) => void))
    return cb
  }

  if (erroCarga) return <FalhaAoCarregar mensagem={erroCarga} titulo="Não foi possível abrir o modelo" />

  if (naoExiste) {
    return (
      <SubPage title="Modelo não encontrado" backTo={voltar} backLabel="Documentos" icon={<PenIcon width={20} height={20} aria-hidden />}>
        <p className={`${CARTAO} text-[14px] leading-relaxed text-ink-soft`}>
          Este modelo não existe mais nesta conta — pode ter sido excluído em outro aparelho.
        </p>
        <Link to="/contratos" className="btn-primary w-full !py-3 sm:w-auto">
          Ver meus documentos
        </Link>
      </SubPage>
    )
  }

  if (!perfil || !estado || !conteudo) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper-deep">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-burgundy" role="status" aria-label="Carregando" />
      </div>
    )
  }

  const liberado = canUseContratos(perfil.plan)
  const bloqueado = !liberado || (novo && lotado)
  const dadosPessoais = problemas.filter((p) => p.dadoPessoal)
  const outros = problemas.filter((p) => !p.dadoPessoal)

  const mudar = (parcial: Partial<Estado>) => setEstado((e) => (e ? { ...e, ...parcial } : e))
  const mudarClausula = (i: number, parcial: Partial<ClausulaEditavel>) =>
    setEstado((e) => (e ? { ...e, clausulas: e.clausulas.map((c, k) => (k === i ? { ...c, ...parcial } : c)) } : e))

  const inserir = (alvo: string, rotulo: string) => {
    const token = `{${rotulo.trim().replace(/[{}]/g, '')}}`
    const el = elementos.current.get(alvo)
    const atual = alvo === 'titulo' ? estado.titulo : estado.clausulas.find((c) => c.k === alvo)?.texto ?? ''
    const ini = el?.selectionStart ?? atual.length
    const fim = el?.selectionEnd ?? atual.length
    const novoTexto = `${atual.slice(0, ini)}${token}${atual.slice(fim)}`
    if (alvo === 'titulo') mudar({ titulo: novoTexto })
    else setEstado((e) => (e ? { ...e, clausulas: e.clausulas.map((c) => (c.k === alvo ? { ...c, texto: novoTexto } : c)) } : e))
    setInserindoEm(null)
    setNovoCampo('')
    // O cursor volta para depois do campo inserido — dá para seguir escrevendo.
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(ini + token.length, ini + token.length)
    })
  }

  const mover = (i: number, delta: -1 | 1) =>
    setEstado((e) => {
      if (!e) return e
      const j = i + delta
      if (j < 0 || j >= e.clausulas.length) return e
      const c = [...e.clausulas]
      ;[c[i], c[j]] = [c[j]!, c[i]!]
      return { ...e, clausulas: c }
    })

  const salvar = async () => {
    setErro(null)
    if (problemas.length) {
      setTentou(true)
      painelProblemas.current?.focus()
      painelProblemas.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }
    setSalvando(true)
    try {
      if (novo) await criarModeloProprio(conteudo)
      else await atualizarModeloProprio(id, conteudo)
      setOriginal(JSON.stringify(conteudo))
      navigate(voltar, { replace: true })
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : 'Não foi possível salvar o modelo. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    setErro(null)
    setSalvando(true)
    try {
      await excluirModeloProprio(id)
      setOriginal(JSON.stringify(conteudo))
      navigate(voltar, { replace: true })
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : 'Não foi possível excluir o modelo.')
      setSalvando(false)
    }
  }

  const contador = (n: number, max: number) =>
    n > max * 0.8 ? (
      <span className={`tabular-nums ${n > max ? 'font-semibold text-burgundy' : ''}`}>
        {n}/{max}
      </span>
    ) : undefined

  // Função que devolve JSX, chamada como função — e não um componente declarado
  // aqui dentro: um componente novo a cada render desmonta o campo de nome a
  // cada tecla, e o cursor sai dele no meio da palavra.
  const painelDeCampos = (alvo: string) => (
    <div className="mt-2 rounded-lg border border-brass/30 bg-brass/[0.05] p-3" role="group" aria-label="Inserir campo">
      <p className="text-[12px] font-semibold text-ink">Os que a plataforma preenche</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CAMPOS_PADRAO.map((c) => (
          <button
            key={c.rotulo}
            type="button"
            onClick={() => inserir(alvo, c.rotulo)}
            title={c.dica}
            className="rounded-full border border-brass/40 bg-paper-soft px-3 py-2 text-[12.5px] font-medium text-brass-deep transition-colors hover:bg-brass/15"
          >
            {`{${c.rotulo}}`}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12px] font-semibold text-ink">Um campo seu</p>
      <div className="mt-1.5 flex gap-2">
        <input
          value={novoCampo}
          onChange={(e) => setNovoCampo(e.target.value.replace(/[{}\n]/g, '').slice(0, L.rotuloDoCampo))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && novoCampo.trim().length >= 2) {
              e.preventDefault()
              inserir(alvo, novoCampo)
            }
          }}
          placeholder="Valor dos honorários…"
          aria-label="Nome do campo novo"
          autoComplete="off"
          className={`${CAMPO} !py-2`}
        />
        <button
          type="button"
          disabled={novoCampo.trim().length < 2}
          onClick={() => inserir(alvo, novoCampo)}
          className="btn-ghost shrink-0 !px-4 !py-2 text-[13px] disabled:opacity-50"
        >
          Inserir
        </button>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-ink-faint">
        O nome do campo é o que o formulário vai perguntar a cada documento.
      </p>
    </div>
  )

  return (
    <SubPage
      title={novo ? 'Novo modelo' : 'Editar modelo'}
      subtitle="Só texto. Os dados do cliente entram a cada documento, no seu aparelho."
      icon={<PenIcon width={20} height={20} aria-hidden />}
      backTo={voltar}
      backLabel="Documentos"
      documentTitle={novo ? 'Novo modelo' : `Modelo: ${estado.nome || 'sem nome'}`}
      footer={
        <>
          <span className="mr-auto hidden text-[12.5px] text-ink-faint min-[420px]:inline" aria-live="polite">
            {dadosPessoais.length
              ? `${dadosPessoais.length} ${dadosPessoais.length === 1 ? 'trecho parece' : 'trechos parecem'} dado pessoal`
              : sujo
                ? 'Alterações não salvas'
                : 'Nada a salvar'}
          </span>
          <button
            type="button"
            onClick={salvar}
            disabled={bloqueado || salvando || (!novo && !sujo)}
            className="btn-primary w-full !py-3 text-[14px] min-[420px]:w-auto"
          >
            {salvando ? 'Salvando…' : 'Salvar modelo'}
          </button>
        </>
      }
    >
      {!liberado && (
        <section className="rounded-xl2 border border-brass/30 bg-brass/[0.06] p-5">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brass-deep">
            <LockIcon width={12} height={12} aria-hidden />
            Plano Max
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink">
            Criar e editar modelos próprios faz parte do Max. {novo ? '' : 'Este modelo continua guardado, e você pode excluí-lo quando quiser.'}
          </p>
          <Link
            to={comVolta(`/planos?recurso=contratos&plano=${perfil.plan}`, novo ? '/contratos' : `/contratos/modelos/${id}`)}
            className="btn-primary mt-3 w-full !py-3 text-[14px] sm:w-auto"
          >
            Ver o plano Max
          </Link>
        </section>
      )}

      {liberado && novo && lotado && (
        <p role="status" className="rounded-xl2 border border-burgundy/25 bg-burgundy/[0.04] p-4 text-[13.5px] leading-relaxed text-ink-soft">
          Você já tem os 3 modelos do plano. Exclua um para criar outro.{' '}
          <Link to="/contratos" className="font-semibold text-burgundy underline underline-offset-2">
            Ver meus modelos
          </Link>
        </p>
      )}

      {/* A regra, antes de qualquer campo. Visível — nunca em tooltip. */}
      <section className="rounded-xl2 border border-ink/10 bg-paper px-4 py-3.5" aria-labelledby="regra-do-modelo">
        <h2 id="regra-do-modelo" className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          <InfoIcon width={16} height={16} className="text-brass-deep" aria-hidden />
          O modelo guarda só texto
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-soft marker:text-brass">
          <li>
            Onde entraria um dado, use um campo entre chaves — <span className="font-medium text-ink">{'{Nome do cliente}'}</span>,{' '}
            <span className="font-medium text-ink">{'{Valor dos honorários}'}</span>. Ele é pedido a cada documento.
          </li>
          <li>CPF, CNPJ, e-mail, telefone, CEP, número de processo, conta e chave Pix são recusados.</li>
          <li>
            <strong className="font-semibold text-ink">Nome de cliente não tem como ser detectado</strong> — não escreva
            nenhum.
          </li>
        </ul>
      </section>

      <fieldset disabled={bloqueado} className="space-y-4 disabled:opacity-70">
        <legend className="sr-only">Conteúdo do modelo</legend>

        <section className={CARTAO} aria-labelledby="sobre-o-modelo">
          <h2 id="sobre-o-modelo" className="font-display text-[17px] font-semibold text-ink">
            Sobre o modelo
          </h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold text-ink">
                Nome na sua lista
                <span className="text-[11.5px] font-normal text-ink-faint">{contador(estado.nome.length, L.nome)}</span>
              </span>
              <input
                value={estado.nome}
                onChange={(e) => mudar({ nome: e.target.value })}
                maxLength={L.nome + 20}
                placeholder="Contrato de consultoria mensal…"
                autoComplete="off"
                name="nome-do-modelo"
                className={CAMPO}
              />
            </label>

            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold text-ink">Quem assina</legend>
              <div className="flex flex-wrap gap-2">
                {QUEM_ASSINA_OPCOES.map((o) => (
                  <label
                    key={o.valor}
                    className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border px-3.5 py-2 text-[14px] transition-[border-color,background-color] duration-200 focus-within:ring-2 focus-within:ring-burgundy/30 ${
                      estado.quemAssina === o.valor
                        ? 'border-burgundy bg-burgundy/[0.06] font-semibold text-ink'
                        : 'border-ink/15 bg-paper-soft font-medium text-ink-soft hover:border-ink/35'
                    }`}
                  >
                    <input
                      type="radio"
                      name="quem-assina"
                      value={o.valor}
                      checked={estado.quemAssina === o.valor}
                      onChange={() => mudar({ quemAssina: o.valor as QuemAssina })}
                      className="sr-only"
                    />
                    {o.rotulo}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold text-ink">
                  Título do documento
                  <span className="text-[11.5px] font-normal text-ink-faint">{contador(estado.titulo.length, L.titulo)}</span>
                </span>
                <input
                  ref={registrarElemento('titulo')}
                  value={estado.titulo}
                  onChange={(e) => mudar({ titulo: e.target.value })}
                  maxLength={L.titulo + 20}
                  placeholder="Contrato de prestação de serviços de consultoria jurídica…"
                  autoComplete="off"
                  name="titulo-do-documento"
                  className={CAMPO}
                />
              </label>
              <button
                type="button"
                onClick={() => setInserindoEm(inserindoEm === 'titulo' ? null : 'titulo')}
                aria-expanded={inserindoEm === 'titulo'}
                className="mt-1.5 rounded-full px-2.5 py-2 text-[12.5px] font-medium text-burgundy transition-colors hover:bg-burgundy/[0.06]"
              >
                {inserindoEm === 'titulo' ? 'Fechar campos' : '+ Inserir campo'}
              </button>
              {inserindoEm === 'titulo' && painelDeCampos('titulo')}
            </div>
          </div>
        </section>

        <section aria-labelledby="clausulas-do-modelo" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h2 id="clausulas-do-modelo" className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brass-deep">
              Cláusulas
            </h2>
            <span className="text-[12px] text-ink-faint">Com título, ganha número. Sem título, é parágrafo solto.</span>
          </div>

          {estado.clausulas.map((c, i) => {
            const aqui = dadosPessoais.filter((p) => p.clausula === i)
            const numero = estado.clausulas.slice(0, i + 1).filter((x) => x.titulo.trim()).length
            return (
              <article
                key={c.k}
                className={`rounded-xl2 border bg-[#fffdf8] p-4 shadow-card sm:p-5 ${aqui.length ? 'border-burgundy/40' : 'border-ink/10'}`}
                aria-label={c.titulo.trim() ? `Cláusula ${numero}ª` : `Parágrafo ${i + 1}, sem título`}
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
                    {c.titulo.trim() ? `Cláusula ${numero}ª` : 'Parágrafo'}
                  </span>
                  <span className="ml-auto flex items-center">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      aria-label={`Subir o trecho ${i + 1}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUpIcon width={15} height={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === estado.clausulas.length - 1}
                      aria-label={`Descer o trecho ${i + 1}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDownIcon width={15} height={15} aria-hidden />
                    </button>
                  </span>
                </div>

                <input
                  value={c.titulo}
                  onChange={(e) => mudarClausula(i, { titulo: e.target.value })}
                  maxLength={L.tituloDaClausula + 20}
                  placeholder="Título da cláusula (opcional)…"
                  aria-label={`Título do trecho ${i + 1}`}
                  autoComplete="off"
                  className={`${CAMPO} mt-2 font-sans text-[14px] font-semibold uppercase tracking-[0.04em] sm:text-[13px]`}
                />
                <AreaQueCresce
                  value={c.texto}
                  onChange={(texto) => mudarClausula(i, { texto })}
                  aoMontar={aoMontar(c.k)}
                  rotulo={`Texto do trecho ${i + 1}`}
                  placeholder="Escreva o texto, com os campos entre chaves…"
                  minLinhas={3}
                  maxLength={L.textoDaClausula + 200}
                  className={`${CAMPO} mt-2 resize-none font-display text-[16px] leading-relaxed sm:text-[15px]`}
                />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11.5px] text-ink-faint">
                  <span>{contador(c.texto.length, L.textoDaClausula)}</span>
                </div>

                {aqui.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[12.5px] font-medium text-burgundy">
                    {aqui.map((p, k) => (
                      <li key={k}>{p.mensagem.replace(/^Na cláusula \d+: parece /, 'Parece ')}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-1 text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => setInserindoEm(inserindoEm === c.k ? null : c.k)}
                    aria-expanded={inserindoEm === c.k}
                    className="rounded-full px-2.5 py-2 font-medium text-burgundy transition-colors hover:bg-burgundy/[0.06]"
                  >
                    {inserindoEm === c.k ? 'Fechar campos' : '+ Inserir campo'}
                  </button>
                  {removendo === c.k ? (
                    <span className="ml-auto inline-flex items-center gap-1" role="group" aria-label="Confirmar remoção">
                      <button
                        type="button"
                        onClick={() => {
                          setEstado((e) => (e ? { ...e, clausulas: e.clausulas.filter((x) => x.k !== c.k) } : e))
                          setRemovendo(null)
                        }}
                        className="rounded-full bg-burgundy px-3 py-2 font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep"
                      >
                        Remover este trecho
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovendo(null)}
                        className="rounded-full px-2.5 py-2 font-medium text-ink-soft transition-colors hover:bg-ink/[0.05]"
                      >
                        Manter
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRemovendo(c.k)}
                      disabled={estado.clausulas.length === 1}
                      className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-2 font-medium text-ink-faint transition-colors hover:bg-burgundy/[0.06] hover:text-burgundy disabled:opacity-40"
                    >
                      <TrashIcon width={13} height={13} aria-hidden />
                      Remover
                    </button>
                  )}
                </div>
                {inserindoEm === c.k && painelDeCampos(c.k)}
              </article>
            )
          })}

          <button
            type="button"
            onClick={() =>
              setEstado((e) =>
                e && e.clausulas.length < L.clausulas
                  ? { ...e, clausulas: [...e.clausulas, { titulo: '', texto: '', k: chave() }] }
                  : e,
              )
            }
            disabled={estado.clausulas.length >= L.clausulas}
            className="w-full rounded-xl2 border-2 border-dashed border-ink/15 px-4 py-3.5 text-[14px] font-semibold text-ink-soft transition-colors hover:border-brass/60 hover:text-ink disabled:opacity-50"
          >
            + Adicionar cláusula
          </button>
        </section>
      </fieldset>

      {/* O que o servidor vai recusar, e o que o formulário vai pedir. */}
      <div
        ref={painelProblemas}
        tabIndex={-1}
        aria-live="polite"
        className="space-y-3 rounded-xl2 focus:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/30"
      >
        {dadosPessoais.length > 0 && (
          <section className="rounded-xl2 border border-burgundy/30 bg-burgundy/[0.05] p-4">
            <h2 className="text-[14px] font-semibold text-burgundy">Isto não pode ficar no modelo</h2>
            <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-ink-soft">
              {dadosPessoais.map((p, k) => (
                <li key={k}>{p.mensagem}</li>
              ))}
            </ul>
            <p className="mt-2 text-[12.5px] text-ink-faint">
              Troque cada um por um campo entre chaves, como {'{CPF ou CNPJ do cliente}'}.
            </p>
          </section>
        )}
        {tentou && outros.length > 0 && (
          <section className="rounded-xl2 border border-burgundy/25 bg-paper p-4">
            <h2 className="text-[14px] font-semibold text-ink">Falta ajustar antes de salvar</h2>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-ink-soft">
              {outros.map((p, k) => (
                <li key={k}>{p.mensagem}</li>
              ))}
            </ul>
          </section>
        )}
        {erro && (
          <p role="alert" className="rounded-xl2 border border-burgundy/30 bg-burgundy/[0.05] px-4 py-3 text-[13.5px] leading-relaxed text-burgundy">
            {erro}
          </p>
        )}
      </div>

      <section className={CARTAO} aria-labelledby="o-que-vai-pedir">
        <h2 id="o-que-vai-pedir" className="font-display text-[17px] font-semibold text-ink">
          O que o formulário vai pedir
        </h2>
        {campos.padrao.length + campos.proprios.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-ink-faint">Nenhum campo ainda — só cidade e data.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {[...campos.padrao.map((c) => c.rotulo), ...campos.proprios].map((r) => (
              <li key={r} className="rounded-full bg-ink/[0.05] px-2.5 py-1 text-[12.5px] text-ink-soft">
                {r}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
          {conteudo.quemAssina !== 'advogado' || campos.padrao.some((c) => c.exige === 'cliente')
            ? 'Os dados do cliente são pedidos inteiros (pessoa física ou jurídica). '
            : ''}
          Cidade e data entram sempre, no fecho. Os valores ficam no seu aparelho, não no modelo.
        </p>
      </section>

      {!novo && (
        <section className="rounded-xl2 border border-burgundy/25 bg-burgundy/[0.03] p-4 sm:p-5">
          <h2 className="font-display text-[16px] font-semibold text-ink">Excluir este modelo</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            Documentos já começados com ele continuam como estão: cada um levou uma cópia do texto.
          </p>
          {excluindo ? (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Confirmar exclusão">
              <button
                type="button"
                onClick={excluir}
                disabled={salvando}
                className="rounded-full bg-burgundy px-4 py-2.5 text-[13.5px] font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep disabled:opacity-60"
              >
                {salvando ? 'Excluindo…' : 'Excluir de vez'}
              </button>
              <button type="button" onClick={() => setExcluindo(false)} className="btn-ghost !py-2.5 text-[13.5px]">
                Manter
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExcluindo(true)}
              className="mt-3 rounded-lg border border-burgundy/40 px-3.5 py-2 text-[13px] font-semibold text-burgundy transition-colors hover:bg-burgundy/[0.06]"
            >
              Quero excluir
            </button>
          )}
        </section>
      )}
    </SubPage>
  )
}
