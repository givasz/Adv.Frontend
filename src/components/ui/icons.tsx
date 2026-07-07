import type { SVGProps } from 'react'
import type { SocialKind } from '@/lib/types'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps): IconProps => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...props,
})

export const ScaleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v18M7 21h10M5 7h14M5 7l-2.5 6a3.5 3.5 0 0 0 5 0L5 7Zm14 0-2.5 6a3.5 3.5 0 0 0 5 0L19 7ZM12 5 5 7m7-2 7 2" />
  </svg>
)

// Selo estilo "chancela oficial" — NÃO usar em marca de verificação de perfil.
// O Prov. 205/2021 (Art.5º §2º) e o REGRAS.md §2.5 vedam ícones que lembrem
// autorização/selo oficial da OAB. Mantido apenas para outros usos decorativos.
export const CheckSeal = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m12 2 2.4 1.8 3 .1 1 2.8 2.4 1.8-1 2.8 1 2.8-2.4 1.8-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.2 15l1-2.8-1-2.8 2.4-1.8 1-2.8 3-.1L12 2Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

// Check simples (sem forma de selo) — para a marca informativa "OAB conferida".
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
)

export const WhatsappIcon = (p: IconProps) => (
  <svg {...base({ strokeWidth: 0, fill: 'currentColor', ...p })}>
    <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.86 9.86 0 0 0 4.73 1.2h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm5.8 14.16c-.25.7-1.45 1.33-1.99 1.38-.53.05-1.02.24-3.45-.72-2.9-1.14-4.75-4.1-4.9-4.3-.14-.19-1.17-1.56-1.17-2.97 0-1.42.74-2.11 1-2.4.26-.29.57-.36.76-.36l.55.01c.17.01.42-.07.65.5.25.6.85 2.07.92 2.22.08.15.13.32.02.51-.1.19-.16.31-.31.48-.15.17-.32.38-.46.51-.15.15-.31.31-.13.61.17.29.77 1.27 1.65 2.06 1.14 1.01 2.1 1.32 2.4 1.47.29.15.46.13.63-.08.17-.19.72-.84.91-1.13.19-.29.38-.24.65-.15.26.1 1.67.79 1.96.93.29.15.48.22.55.34.07.13.07.72-.18 1.42Z" />
  </svg>
)

export const InstagramIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="3.5" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
)

export const LinkedinIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 17v-7" />
  </svg>
)

export const GlobeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9Z" />
  </svg>
)

export const FacebookIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 8.5V7c0-1 .5-1.5 1.5-1.5H17V2.5h-2.5C12 2.5 11 4 11 6.5v2H8.5V12H11v9.5h3V12h2.2l.5-3.5H14Z" />
  </svg>
)

export const YoutubeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
    <path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" />
  </svg>
)

export const TiktokIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 3v11.5a3.5 3.5 0 1 1-3-3.46M14 3c.5 2.5 2 4 4.5 4.2" />
  </svg>
)

export const MailIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
)

export const CalendarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4M12 13.5l1.5 1.5 3-3" />
  </svg>
)

export const PinIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)

export const SparkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </svg>
)

export const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
)

export const CopyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </svg>
)

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
  </svg>
)

export const XIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </svg>
)

export const socialMeta: Record<
  SocialKind,
  { label: string; Icon: (p: IconProps) => JSX.Element }
> = {
  instagram: { label: 'Instagram', Icon: InstagramIcon },
  linkedin: { label: 'LinkedIn', Icon: LinkedinIcon },
  website: { label: 'Site', Icon: GlobeIcon },
  facebook: { label: 'Facebook', Icon: FacebookIcon },
  youtube: { label: 'YouTube', Icon: YoutubeIcon },
  tiktok: { label: 'TikTok', Icon: TiktokIcon },
}
