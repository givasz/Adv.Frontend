import { Link } from 'react-router-dom'

/**
 * A caixa dos Termos — o registro que faltava.
 *
 * Até 04/09/2026 a tela de cadastro trazia uma frase passiva ("ao continuar você
 * concorda") e mais nada: nenhuma caixa, nenhum registro, nenhuma versão. O
 * texto dos documentos era bom e não valia como contrato, porque o ônus de
 * provar que o consumidor teve oportunidade de conhecer a cláusula é de quem a
 * redigiu (CDC, art. 46) — e não havia com o que provar.
 *
 * Três decisões, e todas contam:
 *
 *   • DESMARCADA. Um padrão que a pessoa não desfez não é manifestação dela.
 *   • BLOQUEIA O BOTÃO. Se o cadastro seguisse sem ela, a caixa seria enfeite;
 *     e o servidor recusa de qualquer jeito (backend AuthService.signup e
 *     entrarComGoogle), então deixar passar aqui só entregaria um erro
 *     incompreensível do outro lado.
 *   • LINKS QUE ABREM EM OUTRA ABA. Ler os Termos não pode custar o formulário
 *     preenchido — quem perde o que digitou aprende a nunca mais clicar, que é
 *     o oposto de "oportunidade de conhecer".
 *
 * Mora aqui, e não dentro da AuthPage, porque a conta criada pelo "Continuar com
 * o Google" passa pela MESMA caixa (pages/EntrarComGooglePage). Dois textos de
 * aceite seriam dois contratos.
 */
export function AceiteDosTermos({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink/10 bg-paper-soft/60 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ink/25 text-burgundy accent-burgundy focus:ring-2 focus:ring-burgundy/20"
      />
      <span className="text-[12.5px] leading-relaxed text-ink-soft">
        Li e aceito os{' '}
        <Link
          to="/legal/termos"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-burgundy underline underline-offset-2"
        >
          Termos de Uso
        </Link>{' '}
        e a{' '}
        <Link
          to="/legal/privacidade"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-burgundy underline underline-offset-2"
        >
          Política de Privacidade
        </Link>
        . Declaro ser advogado(a) regularmente inscrito(a) na OAB e responder pelo conteúdo que
        publicar.
      </span>
    </label>
  )
}
