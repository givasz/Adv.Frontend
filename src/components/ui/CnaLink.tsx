import { ExternalLinkIcon } from './icons'

// Consulta pública do Cadastro Nacional dos Advogados (CNA) — base OFICIAL e aberta
// da OAB, onde QUALQUER pessoa confere uma inscrição.
const CNA_BASE = 'https://cna.oab.org.br/'

/** Endereço da consulta do CNA já com o nome preenchido (busca pública por nome). */
export function cnaSearchUrl(name?: string): string {
  const n = (name ?? '').trim()
  return n ? `${CNA_BASE}?nome=${encodeURIComponent(n)}` : CNA_BASE
}

const TOOLTIP =
  'Consulta pública do Cadastro Nacional dos Advogados (CNA), base oficial da OAB. ' +
  'O advoc.me não confere, não valida e não endossa inscrições — quem confere é você, na fonte.'

// PONTEIRO PARA A FONTE, não marca de verificação.
// -----------------------------------------------------------------------------
// Aqui existia uma marca "OAB conferida", concedida pela plataforma após revisão
// manual e disponível só nos planos pagos. Duas coisas quebravam nisso:
//
//   1. Conformidade — uma distinção pública que se compra é exatamente a lógica
//      que o Prov. 205/2021 (Art. 5º, §1º) veda, e induzia o visitante a ler a
//      AUSÊNCIA da marca como demérito de um advogado igualmente inscrito.
//   2. Operação — a conferência era manual e não escalava para o plano gratuito.
//
// A saída resolve os dois: em vez de a plataforma dizer "nós conferimos", o perfil
// aponta para onde o próprio visitante confere. Vale para TODO perfil (inclusive
// Free), não custa revisão humana e é mais honesto que qualquer marca nossa.
//
// Sem ícone de check DE PROPÓSITO: nada foi verificado por nós, e um "✓" ao lado
// do número diria o contrário. Ver REGRAS.md §2.5.
export function CnaLink({
  name,
  compact = false,
  interactive = true,
  aviso = false,
}: {
  /** nome do advogado/sociedade — preenche a busca do CNA */
  name?: string
  compact?: boolean
  /** false dentro da prévia do editor: desabilita a navegação real */
  interactive?: boolean
  /**
   * Mostra a linha VISÍVEL de "informado pelo próprio advogado, não conferido".
   *
   * Ligado no perfil público, onde está o visitante que pode confiar no número e
   * se prejudicar. Desligado onde o texto seria ruído (listagens internas), mas
   * nunca desligado por plano: o aviso não é um recurso, é um dever.
   *
   * Por que uma linha e não só o `title` abaixo: `title` é tooltip de mouse. No
   * celular ele simplesmente não existe, e é no celular que estes perfis são
   * abertos. Um aviso que a maioria dos visitantes não tem como ver não protege
   * ninguém — nem eles, nem nós.
   */
  aviso?: boolean
}) {
  const cls = `inline-flex items-center gap-1 rounded-full font-medium transition-opacity hover:opacity-70 ${
    compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-[11.5px]'
  }`

  const link = (
    <a
      href={cnaSearchUrl(name)}
      title={TOOLTIP}
      aria-label="Conferir esta inscrição na consulta pública do CNA, da OAB."
      target="_blank"
      rel="noreferrer noopener nofollow"
      onClick={interactive ? undefined : (e) => e.preventDefault()}
      style={{ color: 'var(--c-faint, #8d857a)' }}
      className={cls}
    >
      conferir no CNA
      <ExternalLinkIcon width={compact ? 10 : 11} height={compact ? 10 : 11} strokeWidth={1.8} />
    </a>
  )

  if (!aviso) return link

  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      {link}
      <span
        className="text-[10px] leading-tight opacity-75"
        style={{ color: 'var(--c-faint, #8d857a)' }}
      >
        Número informado pelo próprio profissional — não conferido pelo advoc.me.
      </span>
    </span>
  )
}
