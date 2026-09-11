import { ExternalLinkIcon } from '@/components/ui/icons'
import { CARTAO } from './estilos'

// Como assinar o PDF — com o que funciona HOJE, sem integração nenhuma nossa.
//
// A plataforma não envia o documento para assinatura (ainda não existe, e por
// isso não aparece como botão). O que ela faz é explicar os três caminhos que o
// advogado e o cliente já têm, na ordem do mais simples ao mais forte, e dizer
// para que serve cada nível sem citar número de lei (microcopy da RFC-001).
//
// Os dois endereços externos são serviços públicos oficiais: o assinador do
// gov.br e o validador do ITI. Nada de marca de empresa privada aqui — nomear
// uma seria recomendar um fornecedor.

const NIVEIS = [
  {
    nome: 'Simples',
    como: 'Aceite por e-mail, clique ou senha.',
    vale: 'Serve para acordos de menor risco; se alguém contestar, pode precisar de outras provas.',
  },
  {
    nome: 'Avançada',
    como: 'Conta gov.br prata ou ouro, ou plataforma com verificação de identidade.',
    vale: 'Identifica quem assinou e acusa alteração depois da assinatura. Adequada para a maioria dos contratos privados.',
  },
  {
    nome: 'Qualificada',
    como: 'Certificado digital ICP-Brasil — o token ou a nuvem da sua certificação.',
    vale: 'A mais forte: equivale à assinatura à mão e é a exigida em atos mais formais e no processo eletrônico.',
  },
]

export function ComoAssinar() {
  return (
    <section className={CARTAO} aria-labelledby="como-assinar">
      <h2 id="como-assinar" className="font-display text-[17px] font-semibold text-ink">
        Como assinar este PDF
      </h2>
      <ol className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-ink-soft">
        <li className="flex gap-3">
          <Numero n={1} />
          <span>
            <strong className="font-semibold text-ink">Com a conta gov.br, sem custo.</strong> Abra o
            assinador, envie o PDF, assine e baixe o arquivo assinado. Mande esse arquivo ao cliente
            para ele assinar do mesmo jeito.{' '}
            <a
              href="https://www.gov.br/pt-br/servicos/assinatura-eletronica"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-burgundy underline underline-offset-2 hover:text-burgundy-deep"
            >
              Assinador do gov.br
              <ExternalLinkIcon width={12} height={12} aria-hidden />
            </a>
          </span>
        </li>
        <li className="flex gap-3">
          <Numero n={2} />
          <span>
            <strong className="font-semibold text-ink">Com o seu certificado digital.</strong> Use o
            programa do seu token ou da certificação em nuvem para assinar o PDF.
          </span>
        </li>
        <li className="flex gap-3">
          <Numero n={3} />
          <span>
            <strong className="font-semibold text-ink">Por uma plataforma de assinatura</strong> que
            você já use: envie este PDF por ela, sem gerar outro arquivo.
          </span>
        </li>
      </ol>

      <h3 className="mt-5 text-[12.5px] font-semibold text-ink">Qual nível usar</h3>
      <dl className="mt-2 divide-y divide-ink/[0.07] rounded-lg border border-ink/10 bg-paper-soft text-[13px]">
        {NIVEIS.map((n) => (
          <div key={n.nome} className="grid gap-1 px-3.5 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
            <dt className="font-semibold text-ink">{n.nome}</dt>
            <dd className="leading-relaxed text-ink-soft">
              <span className="block text-ink">{n.como}</span>
              {n.vale}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
        Para ver quem assinou um PDF e se ele mudou depois, use o{' '}
        <a
          href="https://validar.iti.gov.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-burgundy underline underline-offset-2 hover:text-burgundy-deep"
        >
          validador oficial do ITI
        </a>
        .
      </p>
    </section>
  )
}

function Numero({ n }: { n: number }) {
  return (
    <span
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brass/40 bg-brass/10 text-[12px] font-semibold tabular-nums text-brass-deep"
      aria-hidden
    >
      {n}
    </span>
  )
}
