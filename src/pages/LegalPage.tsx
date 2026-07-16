import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLegalDoc, LEGAL_DOCS } from '@/lib/legalContent'
import { ArrowRight, ScaleIcon } from '@/components/ui/icons'

// Renderiza a documentação jurídica DA PLATAFORMA (rota /legal/:slug). Sem :slug,
// mostra o índice. Conteúdo em lib/legalContent.ts. Mantém a identidade visual sóbria.
export default function LegalPage() {
  const { slug } = useParams()
  const doc = slug ? getLegalDoc(slug) : undefined

  useEffect(() => {
    document.title = doc
      ? `${doc.title} · advoc.me`
      : slug
        ? 'Documento não encontrado · advoc.me'
        : 'Documentação jurídica · advoc.me'
  }, [doc, slug])

  return (
    <div className="grain min-h-dvh overflow-x-hidden">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold">
          <ScaleIcon width={22} height={22} className="text-burgundy" />
          advoc.me
        </Link>
        <Link to="/legal" className="text-sm font-medium text-ink-soft hover:text-ink">
          Documentos legais
        </Link>
      </nav>

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-6">
        {!slug ? (
          <LegalIndex />
        ) : !doc ? (
          <NotFound />
        ) : (
          <article>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
              Documentação jurídica
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">
              {doc.title}
            </h1>
            <p className="mt-3 text-[14px] text-ink-soft">{doc.summary}</p>
            <p className="mt-1 text-[12.5px] text-ink-faint">Atualizado em {doc.updated}.</p>

            <div className="rule-brass my-8 max-w-xs" />

            <div className="space-y-7">
              {doc.sections.map((s, i) => (
                <section key={i}>
                  {s.heading && (
                    <h2 className="font-display text-lg font-semibold text-ink">{s.heading}</h2>
                  )}
                  {s.paragraphs?.map((p, j) => (
                    <p key={j} className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                      {p}
                    </p>
                  ))}
                  {s.bullets && (
                    <ul className="mt-3 space-y-2">
                      {s.bullets.map((b, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-ink-soft">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass-deep" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <div className="mt-12 rounded-xl2 border border-ink/10 bg-paper-soft/60 p-5 text-[13px] leading-relaxed text-ink-faint">
              Este documento é a política de uso da plataforma advoc.me e não constitui aconselhamento
              jurídico. O advoc.me não é filiado à OAB.
            </div>

            <OtherDocs currentSlug={doc.slug} />
          </article>
        )}
      </main>
    </div>
  )
}

function LegalIndex() {
  return (
    <div>
      <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
        Transparência
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Documentação jurídica</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        As políticas que regem o uso da plataforma advoc.me. Específicas do nosso produto — não são
        modelos genéricos.
      </p>
      <ul className="mt-8 divide-y divide-ink/10 rounded-xl2 border border-ink/10 bg-paper-soft/60">
        {LEGAL_DOCS.map((d) => (
          <li key={d.slug}>
            <Link
              to={`/legal/${d.slug}`}
              className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-paper"
            >
              <span>
                <span className="block font-display text-[16px] font-semibold text-ink">{d.title}</span>
                <span className="mt-0.5 block text-[13px] text-ink-soft">{d.summary}</span>
              </span>
              <ArrowRight width={18} height={18} className="shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OtherDocs({ currentSlug }: { currentSlug: string }) {
  const others = LEGAL_DOCS.filter((d) => d.slug !== currentSlug)
  return (
    <nav className="mt-10">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
        Outros documentos
      </p>
      <div className="flex flex-wrap gap-2">
        {others.map((d) => (
          <Link
            key={d.slug}
            to={`/legal/${d.slug}`}
            className="rounded-full border border-ink/15 px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-burgundy/40 hover:text-burgundy"
          >
            {d.navLabel}
          </Link>
        ))}
      </div>
    </nav>
  )
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="font-display text-2xl font-semibold text-ink">Documento não encontrado</h1>
      <p className="mt-2 text-[14.5px] text-ink-soft">
        O documento que você procura não existe ou foi movido.
      </p>
      <Link to="/legal" className="btn-primary mt-6 inline-flex">
        Ver documentos legais
        <ArrowRight width={18} height={18} />
      </Link>
    </div>
  )
}
