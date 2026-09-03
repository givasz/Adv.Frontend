// A identidade do assistente, sozinha num módulo de propósito: o perfil público
// (ProfileView, BalaoDeConversa) só precisa do TÍTULO — importar de assistant.ts
// arrastava o roteiro da conversa inteiro (agenda, mensagem de WhatsApp, config)
// para o pacote inicial do minisite. assistant.ts reexporta estes dois nomes,
// então quem já vive do lado pesado não muda nada.
import type { Profile } from './types'

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

/** "Assistente virtual de Pedro" — sempre explícito de que não é a pessoa. */
export function assistantTitle(profile: Pick<Profile, 'name'>): string {
  const first = firstName(profile.name)
  return first ? `Assistente virtual de ${first}` : 'Assistente virtual'
}
