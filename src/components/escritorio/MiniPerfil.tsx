import { useState } from 'react'
import type { FirmLawyer } from '@/lib/escritorio'
import { Avatar } from '@/components/ui/Avatar'
import { ArrowRight, LinkedinIcon } from '@/components/ui/icons'
import { FirmVerified } from './FirmVerified'
import { ModalContato } from './ModalContato'

// Mini-perfil do advogado exibido DENTRO da página do escritório (sem sair de domínio).
// Foto, nome, OAB, área, bio curta, LinkedIn pessoal, "Solicitar contato" e "Voltar".
export function MiniPerfil({ lawyer, onBack }: { lawyer: FirmLawyer; onBack: () => void }) {
  const [contact, setContact] = useState(false)

  return (
    <div className="rounded-xl2 border border-ink/10 bg-paper-soft p-6 shadow-card">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition-colors hover:text-burgundy"
      >
        <ArrowRight width={15} height={15} className="rotate-180" />
        Voltar ao escritório
      </button>

      <div className="mt-5 flex items-center gap-4">
        <Avatar src={lawyer.avatarUrl} name={lawyer.name} size={72} />
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold text-ink">{lawyer.name}</h3>
          <p className="mt-0.5 text-sm text-ink-soft">{lawyer.area}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-brass-deep">{lawyer.oabNumber}</span>
            {lawyer.oabVerified && <FirmVerified compact />}
          </div>
        </div>
      </div>

      <p className="mt-4 text-[14.5px] leading-relaxed text-ink-soft">{lawyer.bio}</p>

      <div className="mt-5 space-y-2.5">
        {lawyer.linkedin && (
          <a
            href={lawyer.linkedin}
            target="_blank"
            rel="noreferrer noopener"
            className="link-tile !py-3 text-sm font-medium"
          >
            <LinkedinIcon width={18} height={18} className="text-ink-faint" />
            LinkedIn pessoal
            <ArrowRight width={15} height={15} className="ml-auto text-ink-faint" />
          </a>
        )}
        <button
          type="button"
          onClick={() => setContact(true)}
          className="btn-primary w-full"
          style={{ background: 'var(--firm-accent)' }}
        >
          Solicitar contato
        </button>
      </div>

      {contact && <ModalContato subjectName={lawyer.name} onClose={() => setContact(false)} />}
    </div>
  )
}
