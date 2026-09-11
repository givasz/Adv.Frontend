import { Fragment, useCallback, useState } from 'react'
import {
  MARCA_PENDENTE,
  clausulaEmBranco,
  tituloDaClausula,
  type Clausula,
  type DocumentoMontado,
} from '@/lib/contratos/modelos'
import { AreaQueCresce } from './CampoDoModelo'
import { TrashIcon } from '@/components/ui/icons'

// A FOLHA — o documento como ele vai sair, e o lugar onde ele é revisado.
//
// É a peça que dá identidade a estas telas: não um formulário de "cláusulas",
// mas uma página de papel, com a margem, o título ao centro e os títulos das
// cláusulas no latão do timbre. O advogado lê um documento, não uma lista de
// caixas de texto — e é lendo como documento que se pega o erro.
//
// No modo de edição, cada parágrafo é uma área de texto sem moldura: some a
// diferença entre ler e corrigir. A moldura aparece ao passar o dedo/mouse e no
// foco, com anel visível (acessibilidade não pode depender de adivinhar).

function destacarPendentes(texto: string) {
  const partes = texto.split(/(\[preencher:[^\]]*\])/g)
  return partes.map((p, i) =>
    p.startsWith(MARCA_PENDENTE) ? (
      <mark key={i} className="rounded bg-burgundy/10 px-1 font-sans text-[0.85em] font-semibold text-burgundy">
        {p}
      </mark>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  )
}

const EDITAVEL =
  'block w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 -mx-2 ' +
  'text-inherit transition-[border-color,background-color,box-shadow] duration-200 ' +
  'hover:border-ink/10 focus:border-burgundy/40 focus:bg-paper-soft/70 focus:outline-none focus:ring-2 focus:ring-burgundy/15'

export function FolhaDoDocumento({
  doc,
  onChange,
  marcaDagua,
}: {
  doc: DocumentoMontado
  /** sem `onChange`, a folha é só leitura */
  onChange?: (doc: DocumentoMontado) => void
  /** texto discreto no alto da folha ("Minuta", "Registrado") */
  marcaDagua?: string
}) {
  const editavel = !!onChange
  const [removendo, setRemovendo] = useState<string | null>(null)
  // Estável: um ref em função nova a cada render roubaria o foco de volta a
  // cada tecla digitada em outra cláusula.
  const focarAoAparecer = useCallback((el: HTMLButtonElement | null) => el?.focus(), [])

  const trocar = (i: number, parcial: Partial<Clausula>) => {
    const clausulas = doc.clausulas.map((c, k) => (k === i ? { ...c, ...parcial } : c))
    onChange?.({ ...doc, clausulas })
  }
  const inserirDepois = (i: number) => {
    const clausulas = [...doc.clausulas]
    clausulas.splice(i + 1, 0, clausulaEmBranco())
    onChange?.({ ...doc, clausulas })
  }
  const remover = (i: number) => {
    onChange?.({ ...doc, clausulas: doc.clausulas.filter((_, k) => k !== i) })
    setRemovendo(null)
  }

  return (
    <article
      className="relative overflow-hidden rounded-[6px] border border-ink/10 bg-[#fffdf8] px-5 py-8 text-ink shadow-lift sm:px-12 sm:py-12"
      aria-label={`Documento: ${doc.titulo}`}
    >
      {/* Filete de margem, como o de papel pautado jurídico. Decorativo. */}
      <span
        className="pointer-events-none absolute inset-y-0 left-3 w-px bg-burgundy/[0.12] sm:left-7"
        aria-hidden
      />
      {marcaDagua && (
        <span className="absolute right-4 top-3 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink-faint sm:right-6 sm:top-5">
          {marcaDagua}
        </span>
      )}

      <h2 className="text-balance text-center font-display text-[16px] font-semibold uppercase leading-snug tracking-[0.06em] sm:text-[18px]">
        {doc.titulo}
      </h2>
      <span className="rule-brass mx-auto mt-4 block w-24" aria-hidden />

      <div className="mt-7 space-y-6 font-display text-[15px] leading-[1.75] [font-optical-sizing:auto] sm:text-[15.5px]">
        {doc.clausulas.map((c, i) => {
          const titulo = tituloDaClausula(doc, i)
          const pendentes = c.texto.split(MARCA_PENDENTE).length - 1
          return (
            <section key={c.id} className="group/clausula">
              {(titulo || (editavel && c.numerada)) && (
                <div className="mb-1.5 flex items-center gap-2">
                  {editavel && c.numerada ? (
                    <label className="flex min-w-0 flex-1 items-baseline gap-1.5">
                      <span className="shrink-0 font-sans text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
                        {tituloDaClausula({ ...doc, clausulas: doc.clausulas.map((x) => ({ ...x, titulo: '' })) }, i)} —
                      </span>
                      <input
                        value={c.titulo}
                        onChange={(e) => trocar(i, { titulo: e.target.value })}
                        placeholder="Título da cláusula…"
                        aria-label={`Título da ${titulo || 'cláusula'}`}
                        className={`${EDITAVEL} !mx-0 min-w-0 flex-1 !px-1.5 !py-0.5 font-sans text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep`}
                      />
                    </label>
                  ) : (
                    <h3 className="font-sans text-[11.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
                      {titulo}
                    </h3>
                  )}
                  {editavel && pendentes > 0 && (
                    <span className="shrink-0 rounded-full bg-burgundy/10 px-2 py-0.5 font-sans text-[11px] font-semibold text-burgundy">
                      {pendentes} a completar
                    </span>
                  )}
                </div>
              )}

              {editavel ? (
                <AreaQueCresce
                  value={c.texto}
                  onChange={(texto) => trocar(i, { texto })}
                  rotulo={`Texto: ${titulo || 'parágrafo sem título'}`}
                  placeholder="Escreva a cláusula…"
                  className={EDITAVEL}
                />
              ) : (
                c.texto
                  .split('\n')
                  .filter((p) => p.trim())
                  .map((p, k) => (
                    <p key={k} className={`text-pretty ${k ? 'mt-2' : ''}`}>
                      {destacarPendentes(p)}
                    </p>
                  ))
              )}

              {editavel && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 font-sans text-[12.5px] opacity-100 transition-opacity sm:opacity-60 sm:group-focus-within/clausula:opacity-100 sm:group-hover/clausula:opacity-100">
                  <button
                    type="button"
                    onClick={() => inserirDepois(i)}
                    className="rounded-full px-2.5 py-2 font-medium text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-burgundy"
                  >
                    + Cláusula abaixo
                  </button>
                  {removendo === c.id ? (
                    <span className="inline-flex items-center gap-1" role="group" aria-label="Confirmar remoção">
                      <button
                        type="button"
                        // O foco vai para a confirmação: quem usa teclado não
                        // precisa caçá-la, e o navegador rola até ela respeitando
                        // a folga da barra fixa de baixo.
                        ref={focarAoAparecer}
                        onClick={() => remover(i)}
                        className="rounded-full bg-burgundy px-3 py-2 font-semibold text-paper-soft transition-colors hover:bg-burgundy-deep"
                      >
                        Remover esta cláusula
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
                      onClick={() => setRemovendo(c.id)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-2 font-medium text-ink-faint transition-colors hover:bg-burgundy/[0.06] hover:text-burgundy"
                    >
                      <TrashIcon width={13} height={13} aria-hidden />
                      Remover
                    </button>
                  )}
                </div>
              )}
            </section>
          )
        })}

        <div className="space-y-1 pt-2">
          {doc.fecho.map((l, i) => (
            <p key={i} className="text-pretty">
              {destacarPendentes(l)}
            </p>
          ))}
        </div>

        <div className="grid gap-x-10 gap-y-9 pt-8 sm:grid-cols-2">
          {doc.assinaturas.map((a, i) => (
            <div key={i} className="text-center">
              <span className="block border-t border-ink/60" aria-hidden />
              <p className="mt-2 text-[14px] font-semibold leading-snug">
                {a.nome ? destacarPendentes(a.nome) : <span className="sr-only">Linha em branco</span>}
              </p>
              <p className="font-sans text-[12px] leading-snug text-ink-faint">{a.papel}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}
