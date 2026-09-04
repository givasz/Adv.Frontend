import { Link } from 'react-router-dom'

// A DECLARAÇÃO NO MOMENTO DO ATO.
//
// Os Termos (item 3) já diziam que os dados do perfil são de responsabilidade de
// quem os publica, e que declarar inscrição falsa pode configurar os crimes dos
// arts. 297, 299 e 304 do Código Penal. Cláusula genérica, porém, é o que toda
// plataforma tem — e é o que todo réu diz que nunca leu.
//
// O que muda o resultado de uma disputa é uma declaração ESPECÍFICA, feita no
// segundo em que a pessoa colocou o conteúdo no ar, sobre aquele conteúdo, com
// data e endereço registrados do outro lado (Profile.truthDeclaredAt e
// AccessLog). Deixa de ser "você concordou com um documento" e passa a ser "você
// afirmou isto, neste dia, deste lugar".
//
// TOM: firme e sem ameaça. O texto cita a consequência uma vez, em linguagem
// direta, e não repete. Quem está publicando é advogado — sabe o que é falsidade
// ideológica, e um parágrafo de intimidação só faria a tela parecer hostil sem
// acrescentar validade nenhuma à declaração.
export function DeclaracaoDeVeracidade({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl2 border border-brass/35 bg-brass/[0.07] px-3.5 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ink/25 text-burgundy accent-burgundy focus:ring-2 focus:ring-burgundy/20"
      />
      <span className="text-[12.5px] leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink">Declaro</span> que sou o(a) titular da inscrição
        informada, que as informações deste perfil são verdadeiras e que respondo pelo conteúdo
        publicado, inclusive perante a OAB. Informação falsa é de responsabilidade exclusiva de quem
        a publica.{' '}
        <Link
          to="/legal/termos"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-burgundy underline underline-offset-2"
        >
          Termos de Uso
        </Link>
        .
      </span>
    </label>
  )
}
