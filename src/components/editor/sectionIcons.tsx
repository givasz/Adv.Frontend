import type { SectionId } from '@/lib/editorSections'
import {
  CalendarIcon,
  CardIcon,
  ChartIcon,
  DocIcon,
  InfoIcon,
  MedalIcon,
  MessageIcon,
  PaletteIcon,
  PinIcon,
  PlayIcon,
  QrIcon,
  ShieldIcon,
  SparkIcon,
  TagIcon,
  UserIcon,
} from '@/components/ui/icons'

export type SectionIcon = (p: { width?: number; height?: number; className?: string }) => JSX.Element

// A marca visual de cada seção — a mesma no chip do editor e no cartão do
// painel, para a pessoa reconhecer o lugar antes de ler o nome. Mora na camada
// de componentes porque lib/editorSections.ts não sabe o que é um SVG.
export const SECTION_ICON: Record<SectionId, SectionIcon> = {
  identidade: UserIcon,
  bio: DocIcon,
  redes: MessageIcon,
  areas: TagIcon,
  local: PinIcon,
  agenda: CalendarIcon,
  faq: InfoIcon,
  aparencia: PaletteIcon,
  video: PlayIcon,
  marca: MedalIcon,
  analytics: ChartIcon,
  qrcode: QrIcon,
  cartao: CardIcon,
  conteudo: ShieldIcon,
  plano: SparkIcon,
}
