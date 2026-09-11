import { useEffect, useId, useRef } from 'react'
import { avisoDoCampo, type Campo } from '@/lib/contratos/modelos'
import { mascararCnpj, mascararCpf } from '@/lib/contratos/documentos'
import { formatarReais, lerReais, reaisPorExtenso } from '@/lib/contratos/extenso'
import { CAMPO } from './estilos'

/** O id do elemento focável de um campo — usado para levar o foco à primeira pendência. */
export const idDoCampo = (id: string) => `campo-${id.replace(/[^a-zA-Z0-9-]/g, '-')}`

// Um campo de modelo, com o controle certo para o tipo: teclado numérico para
// CPF e dinheiro, calendário para data, botões para escolha. Tudo com <label> de
// verdade — o toque no rótulo tem de acertar o controle, no celular é o alvo maior.
export function CampoDoModelo({
  campo,
  valor,
  onChange,
  erro,
}: {
  campo: Campo
  valor: string
  onChange: (v: string) => void
  /** mensagem de pendência, depois de a pessoa tentar avançar */
  erro?: string
}) {
  const id = idDoCampo(campo.id)
  const ajudaId = useId()
  const aviso = avisoDoCampo(campo, valor)
  const mensagem = erro ?? aviso
  const descricao = mensagem ? ajudaId : undefined

  const cabecalho = (
    <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
      <span className="text-[13px] font-semibold text-ink">{campo.rotulo}</span>
      {campo.dica && <span className="text-[11.5px] text-ink-faint">{campo.dica}</span>}
    </span>
  )

  const rodape = (
    <>
      {campo.tipo === 'moeda' && !mensagem && lerReais(valor) ? (
        <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">
          Sai no documento como “{formatarReais(lerReais(valor)!)} ({reaisPorExtenso(lerReais(valor)!)})”.
        </p>
      ) : null}
      <p
        id={ajudaId}
        aria-live="polite"
        className={`text-[12px] leading-snug ${mensagem ? 'mt-1.5' : 'sr-only'} ${
          erro ? 'font-medium text-burgundy' : 'text-brass-deep'
        }`}
      >
        {mensagem ?? ''}
      </p>
    </>
  )

  const borda = erro ? '!border-burgundy/60' : ''

  if (campo.tipo === 'escolha') {
    return (
      <fieldset aria-describedby={descricao}>
        <legend className="mb-1.5 text-[13px] font-semibold text-ink">{campo.rotulo}</legend>
        <div className="flex flex-wrap gap-2">
          {campo.opcoes!.map((o, k) => {
            const marcado = valor === o.valor
            return (
              <label
                key={o.valor}
                className={`relative inline-flex min-h-[44px] cursor-pointer select-none flex-col justify-center rounded-lg border px-3.5 py-2 text-[14px] transition-[border-color,background-color,box-shadow] duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-burgundy/30 ${
                  marcado
                    ? 'border-burgundy bg-burgundy/[0.06] text-ink shadow-[inset_0_0_0_1px_theme(colors.burgundy.DEFAULT)]'
                    : `border-ink/15 bg-paper-soft text-ink-soft hover:border-ink/35 ${borda}`
                }`}
              >
                <input
                  // A pendência leva o foco à primeira opção: um grupo não
                  // recebe foco com anel visível, a opção recebe.
                  id={k === 0 ? id : undefined}
                  type="radio"
                  name={id}
                  value={o.valor}
                  checked={marcado}
                  onChange={() => onChange(o.valor)}
                  className="sr-only"
                />
                <span className={marcado ? 'font-semibold' : 'font-medium'}>{o.rotulo}</span>
                {o.dica && <span className="text-[11.5px] leading-tight text-ink-faint">{o.dica}</span>}
              </label>
            )
          })}
        </div>
        {rodape}
      </fieldset>
    )
  }

  if (campo.tipo === 'marcar') {
    const lista = valor.split('|').filter(Boolean)
    const alternar = (v: string) =>
      onChange((lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]).join('|'))
    return (
      <fieldset aria-describedby={descricao}>
        <legend className="mb-1.5 flex w-full flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-[13px] font-semibold text-ink">{campo.rotulo}</span>
          {campo.dica && <span className="text-[11.5px] font-normal text-ink-faint">{campo.dica}</span>}
        </legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {campo.opcoes!.map((o, k) => (
            <label
              key={o.valor}
              className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg border border-ink/10 bg-paper-soft px-3 py-2.5 text-[14px] leading-snug text-ink transition-colors hover:border-ink/30 has-[:checked]:border-burgundy/50 has-[:checked]:bg-burgundy/[0.04]"
            >
              <input
                id={k === 0 ? id : undefined}
                type="checkbox"
                checked={lista.includes(o.valor)}
                onChange={() => alternar(o.valor)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-burgundy"
              />
              <span>{o.rotulo}</span>
            </label>
          ))}
        </div>
        {rodape}
      </fieldset>
    )
  }

  if (campo.tipo === 'confirmar') {
    return (
      <div>
        <label
          className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border bg-paper-soft px-3.5 py-3 text-[14px] leading-snug text-ink transition-colors has-[:checked]:border-burgundy/50 has-[:checked]:bg-burgundy/[0.04] ${
            erro ? 'border-burgundy/60' : 'border-ink/15'
          }`}
        >
          <input
            id={id}
            type="checkbox"
            checked={valor === 'sim'}
            onChange={(e) => onChange(e.target.checked ? 'sim' : '')}
            aria-describedby={descricao}
            className="mt-0.5 h-4 w-4 shrink-0 accent-burgundy"
          />
          <span>
            {campo.rotulo}
            {campo.dica && <span className="mt-0.5 block text-[12px] text-ink-faint">{campo.dica}</span>}
          </span>
        </label>
        {rodape}
      </div>
    )
  }

  if (campo.tipo === 'paragrafo') {
    return (
      <label className="block">
        {cabecalho}
        <AreaQueCresce
          id={id}
          value={valor}
          onChange={onChange}
          placeholder={campo.exemplo}
          describedBy={descricao}
          className={`${CAMPO} ${borda} resize-none leading-relaxed`}
          minLinhas={3}
        />
        {rodape}
      </label>
    )
  }

  const tratar = (bruto: string) => {
    if (campo.tipo === 'cpf') return mascararCpf(bruto)
    if (campo.tipo === 'cnpj') return mascararCnpj(bruto)
    if (campo.tipo === 'numero') return bruto.replace(/\D/g, '').slice(0, 4)
    if (campo.tipo === 'moeda') return bruto.replace(/[^\d.,]/g, '').slice(0, 18)
    return bruto
  }

  const aoSair = () => {
    if (campo.tipo !== 'moeda') return
    const c = lerReais(valor)
    // "5000" vira "5.000,00": a pessoa vê o número como ele vai sair.
    if (c !== null) onChange(formatarReais(c).replace(/^R\$\s?/, '').replace(/ /g, ''))
  }

  const tipoHtml = campo.tipo === 'data' ? 'date' : campo.tipo === 'email' ? 'email' : 'text'
  const modo =
    campo.tipo === 'cpf' || campo.tipo === 'cnpj' || campo.tipo === 'numero'
      ? 'numeric'
      : campo.tipo === 'moeda'
        ? 'decimal'
        : campo.tipo === 'email'
          ? 'email'
          : undefined

  return (
    <label className="block">
      {cabecalho}
      <span className="relative block">
        {campo.tipo === 'moeda' && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[14px] text-ink-faint">
            R$
          </span>
        )}
        <input
          id={id}
          name={id}
          type={tipoHtml}
          inputMode={modo}
          value={valor}
          onChange={(e) => onChange(tratar(e.target.value))}
          onBlur={aoSair}
          placeholder={campo.exemplo}
          autoComplete={campo.autocomplete ?? 'off'}
          spellCheck={campo.tipo === 'texto' ? undefined : false}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricao}
          className={`${CAMPO} ${borda} ${campo.tipo === 'moeda' ? 'pl-10' : ''} ${
            campo.tipo === 'cpf' || campo.tipo === 'cnpj' || campo.tipo === 'numero' ? 'tabular-nums' : ''
          } ${campo.tipo === 'numero' ? 'max-w-[8rem]' : ''} ${campo.tipo === 'data' ? 'max-w-[13rem]' : ''}`}
        />
      </span>
      {rodape}
    </label>
  )
}

/**
 * Textarea que cresce com o texto — sem barra de rolagem dentro de outra barra
 * de rolagem, que é o pior lugar para revisar uma cláusula no celular.
 *
 * A altura é MEDIDA (scrollHeight) e aplicada de uma vez, sem transição: animar
 * altura trava o celular (ver lib/animacao.spec.ts).
 */
export function AreaQueCresce({
  id,
  value,
  onChange,
  placeholder,
  describedBy,
  className,
  minLinhas = 2,
  rotulo,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  describedBy?: string
  className?: string
  minLinhas?: number
  rotulo?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight + 2}px`
    }
    medir()
    // A largura muda ao girar o celular, e com ela a quebra das linhas.
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [value])

  return (
    <textarea
      ref={ref}
      id={id}
      name={id}
      rows={minLinhas}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-describedby={describedBy}
      aria-label={rotulo}
      className={className}
    />
  )
}
