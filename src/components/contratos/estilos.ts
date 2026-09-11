// Classes compartilhadas das telas de documento.
//
// 16px no celular é regra, não gosto: o Safari do iPhone dá zoom na página
// inteira ao focar um campo com fonte menor que isso, e um formulário de vinte
// campos que dá zoom a cada toque é inutilizável. No computador volta aos 14px
// do resto do app.
export const CAMPO =
  'w-full rounded-lg border border-ink/15 bg-paper-soft px-3.5 py-2.5 text-[16px] leading-snug text-ink ' +
  'placeholder:text-ink-faint/70 transition-[border-color,box-shadow] duration-200 ' +
  'focus:border-burgundy focus:outline-none focus:ring-2 focus:ring-burgundy/15 sm:text-[14px]'

export const CARTAO = 'rounded-xl2 border border-ink/10 bg-paper p-4 shadow-card sm:p-5'

export const ROTULO_DE_SECAO =
  'text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brass-deep'
