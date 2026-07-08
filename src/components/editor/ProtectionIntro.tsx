import { useState } from 'react'
import { motion } from 'framer-motion'
import { POLICY_VERSION } from '@/lib/oab'
import { CheckIcon, ScaleIcon, XIcon } from '@/components/ui/icons'

const KEY = 'advocme:intro:dismissed'

// "Prova de proteção" — mostra ao advogado, ANTES de preencher qualquer campo, as
// verificações de conformidade pelas quais o perfil passa. Vende a proposta de valor
// (proteção disciplinar) antes do produto. Dispensável, some após fechar.
const GUARANTEES = [
  'Verificação automática contra os termos vedados pelo Provimento 205/2021',
  'Bloqueio de publicação enquanto houver texto irregular',
  'Conferência do número de OAB feita pela plataforma',
  'Trilha de auditoria com a versão das regras vigente em cada publicação',
]

export function ProtectionIntro() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== '1'
    } catch {
      return true
    }
  })

  if (!open) return null

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* storage indisponível */
    }
    setOpen(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl2 border border-brass/30 bg-gradient-to-br from-brass/[0.12] to-brass/[0.03] p-5 shadow-card"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar apresentação"
        className="absolute right-3 top-3 rounded-full p-1 text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink"
      >
        <XIcon width={16} height={16} />
      </button>

      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl2 bg-brass/20 text-brass-deep">
          <ScaleIcon width={20} height={20} />
        </span>
        <div>
          <p className="font-display text-[17px] font-semibold leading-tight text-brass-deep">
            Seu perfil nasce protegido
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-faint">
            Antes de ir ao ar, ele passa por estas verificações de conformidade:
          </p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {GUARANTEES.map((g) => (
          <li key={g} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brass/20 text-brass-deep">
              <CheckIcon width={11} height={11} strokeWidth={2.6} />
            </span>
            {g}
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-brass/15 pt-3 text-[11.5px] leading-relaxed text-ink-faint">
        Baseado no {POLICY_VERSION} do CFOAB. Não constitui aconselhamento jurídico.
      </p>
    </motion.div>
  )
}
