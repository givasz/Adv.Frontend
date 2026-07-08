import { useState } from 'react'
import type { Firm } from '@/lib/escritorio'
import { WhatsappIcon, ArrowRight } from '@/components/ui/icons'
import { Modal } from './Modal'

// Triagem de contato: antes de abrir o WhatsApp genérico, pergunta a ÁREA para
// direcionar a conversa. Evita o "WhatsApp balcão" e organiza a captação de forma
// sóbria (sem urgência, sem linguagem de venda).
export function ModalTriagemWhatsApp({ firm, onClose }: { firm: Firm; onClose: () => void }) {
  const [area, setArea] = useState<string | null>(null)

  const waHref = (areaLabel: string) => {
    const text = `Olá! Vim pela página do ${firm.name} e gostaria de falar sobre ${areaLabel}.`
    return `https://wa.me/${firm.contact.whatsapp}?text=${encodeURIComponent(text)}`
  }

  return (
    <Modal title="Sobre qual assunto deseja falar?" onClose={onClose} labelledBy="triagem-title">
      <p className="mt-1.5 text-sm text-ink-soft">
        Escolha a área para direcionarmos seu contato à equipe responsável.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {firm.areas.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setArea(a.label)}
            aria-pressed={area === a.label}
            style={area === a.label ? { borderColor: 'var(--firm-accent)' } : undefined}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
              area === a.label
                ? 'bg-burgundy/[0.04] text-ink'
                : 'border-ink/12 bg-paper text-ink hover:border-brass/50'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {firm.contact.whatsapp && (
        <a
          href={area ? waHref(area) : undefined}
          target="_blank"
          rel="noreferrer noopener"
          aria-disabled={!area}
          onClick={(e) => {
            if (!area) e.preventDefault()
          }}
          style={area ? { background: 'var(--firm-accent)' } : undefined}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition-all ${
            area
              ? 'text-paper-soft active:scale-[0.98]'
              : 'cursor-not-allowed bg-ink/10 text-ink-faint'
          }`}
        >
          <WhatsappIcon width={18} height={18} />
          {area ? `Falar sobre ${area}` : 'Selecione uma área acima'}
          {area && <ArrowRight width={16} height={16} />}
        </a>
      )}

      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-ink-faint">
        Contato informativo. Nenhuma orientação jurídica é prestada por este canal antes da
        análise do caso.
      </p>
    </Modal>
  )
}
