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
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  StoryIcon,
  TagIcon,
  UserIcon,
  WhatsappIcon,
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
  // Lupa: triagem é examinar o que chega antes de atender. O balão de conversa
  // já é a marca de "Contato e redes", e duas seções com o mesmo ícone tiram
  // do ícone a única coisa que ele faz — dizer onde a pessoa está.
  triagem: SearchIcon,
  botao: WhatsappIcon,
  faq: InfoIcon,
  aparencia: PaletteIcon,
  video: PlayIcon,
  marca: MedalIcon,
  analytics: ChartIcon,
  story: StoryIcon,
  qrcode: QrIcon,
  cartao: CardIcon,
  conteudo: ShieldIcon,
  plano: SparkIcon,
}
